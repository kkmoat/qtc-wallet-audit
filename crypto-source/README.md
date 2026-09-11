# QTC listings cryptographic asset

Version 0.2.0 is a browser-local wallet and authentication adapter built on official Quantus cryptographic crates. It is an application component, not an official wallet release or an independent security audit. Source license: GPL-3.0-only. Distribute the complete corresponding source, including `vendor/` and its licenses, alongside the public WASM assets.

Exact dependency versions are pinned in `Cargo.lock`. The principal libraries are `qp-rusty-crystals-dilithium` and `qp-rusty-crystals-hdwallet` 4.1.1, `qp-poseidon-core` 3.1.0, `bip39` 2.2.2 and `wasm-bindgen` 0.2.114.

## Wallet creation in a browser worker

```js
import init, { mnemonicFromEntropy, deriveAccount } from './pkg-web/quantus_browser_crypto.js';
await init();
const entropy = crypto.getRandomValues(new Uint8Array(32));
let phrase;
let handle;
try {
  phrase = mnemonicFromEntropy(entropy); // 24 English BIP39 words; SECRET
  entropy.fill(0);
  handle = deriveAccount(phrase, 'ml-dsa-65', 0);
  // Back up and encrypt the phrase locally before discarding it.
  // Never log, upload, or put it into a URL, analytics, crash report or clipboard.
  // Public fields: handle.address, handle.publicKey, handle.accountId,
  // handle.path, handle.scheme.
  // Keep the handle only while unlocked; see the authentication API below.
} finally {
  entropy.fill(0);
  phrase = '';
  handle?.clear();
  handle?.free();
}
```

The application must generate the 32 entropy bytes on the user's device with `crypto.getRandomValues`, never on the server or with `Math.random`. This API cannot determine whether caller-supplied entropy was random. `mnemonicFromEntropy` rejects every input length except 32 bytes.

For new listings wallets, enforce `ml-dsa-65` and account index 0 on both client and server. This maps to the official path `m/44'/189189'/0'/0'/1'`, with no additional BIP39 passphrase. The account ID is the official Poseidon hash of the public key, encoded with SS58 prefix 189 (`qz...`). The low-level adapter retains ML-DSA-87 for compatibility; it must not silently become the default. Changing scheme, account index or derivation path changes the wallet.

## Authentication API

```ts
mnemonicFromEntropy(entropy: Uint8Array): string;
deriveAccount(phrase: string, scheme: string, accountIndex: number): SecretHandle;
addressFromPublicKey(publicKey: Uint8Array, scheme: string): string;
handle.signMessage(message: Uint8Array): Uint8Array;
verifyMessage(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array, scheme: string): boolean;
```

`signMessage` signs **1 to 8192 raw bytes** using the independent ML-DSA context `QTC_LISTINGS_AUTH_V1`. Convert canonical text with `new TextEncoder().encode(text)`. No Substrate 256-byte prehash rule is applied, including messages longer than 256 bytes. Do not hex-encode, wrap, truncate or prehash the message unless a future version of the entire authentication protocol explicitly changes that contract. ML-DSA-65 public keys are 1952 bytes and signatures 3309 bytes; ML-DSA-87 uses 2592 and 4627 bytes.

Signatures authenticate control of a key only. They do not prove identity, balances, solvency, availability of funds, successful payment or agreement with arbitrary listing contents. Authentication signatures cannot validate as the adapter's transaction signatures, which use a different context. This module itself does not contact RPC, store data or broadcast transactions.

### Server verification and Cloudflare Workers

Copy the web JS and WASM together. Wrangler can statically import a WASM file as a compiled `WebAssembly.Module`:

```ts
import wasmModule from './crypto/quantus_browser_crypto_bg.wasm';
import { initSync, verifyMessage, addressFromPublicKey } from './crypto/quantus_browser_crypto.js';
initSync({ module: wasmModule });

// These bytes must come from a server-created, stored challenge, not a
// client-provided replacement message. Reject oversized HTTP requests early.
function proofIsValid(challengeAddress, serverMessageBytes, publicKey, signature) {
  if (publicKey.length !== 1952 || signature.length !== 3309) return false;
  if (serverMessageBytes.length < 1 || serverMessageBytes.length > 8192) return false;
  try {
    return addressFromPublicKey(publicKey, 'ml-dsa-65') === challengeAddress &&
      verifyMessage(publicKey, serverMessageBytes, signature, 'ml-dsa-65');
  } catch {
    return false;
  }
}
```

Configure Wrangler's `CompiledWasm` rule if needed for the project's imports. Initialization with a precompiled module was tested with the actual web-target WASM in Node; deployment inside Cloudflare Workers must still be tested by the integrating application. A Cloudflare Worker is not a browser Web Worker.

A complete protocol must also:

- Generate an unpredictable, single-use challenge nonce on the server; bind canonical message bytes to the exact HTTPS origin/domain, application purpose/version, full qz address, issue time and short expiry (for example five minutes).
- Verify the message against the stored challenge; reject changed addresses, reused/expired challenges and unintended origins. Consume the nonce atomically only with successful authentication. Return generic authentication failures.
- For signed listing actions, bind the operation and exact canonical body hash; otherwise explicitly use authentication to establish a secure session and require CSRF protection for actions.
- Use secure session handling, such as host-only `HttpOnly; Secure; SameSite` cookies, sensible expiry, logout, rate limits, request size limits and origin validation. A valid signature alone is not a full login implementation.
- Never request or receive a mnemonic, entropy, private key, vault password or decrypted vault at the server. Only public key, signature and public challenge identifiers are needed.

## Browser vault integration requirements

A reasonable native-WebCrypto baseline is PBKDF2-HMAC-SHA-256 with **at least 600,000 iterations**, a new random salt of at least 16 bytes, and AES-256-GCM with a new random 12-byte IV for every encryption and a 128-bit tag. Use `extractable: false` for derived keys. Calibrate responsiveness in a worker without weakening the baseline silently; expensive KDFs do not make weak passwords strong.

Store a versioned record containing the encrypted mnemonic and necessary KDF/cipher parameters. Authenticate a fixed canonical representation of the version, scheme, path and public address as AES-GCM additional authenticated data. Strictly validate allowed algorithm identifiers, decoded lengths, supported version, and iteration bounds before processing imported records. Do not silently trim or normalize a user's vault password. Use a strong unique password, confirmation on creation, and generic wrong-password/corrupt-record errors.

Keep only encrypted vault data in local browser storage. A backup flow should show the 24 words locally, explain that they control the funds, require a backup confirmation before use, and support downloading the encrypted vault. Distinguish the local vault password from an optional BIP39 passphrase: this adapter adds no BIP39 passphrase. Record scheme/path/version with the backup.

Clearing site data, changing browser profile or changing site origin can remove or hide the local vault. It does not erase chain balances. Password alone cannot recover a deleted vault; the 24 words and matching derivation settings can restore it in a compatible wallet. If the password is forgotten, the mnemonic can recreate the wallet. Losing both usable vault access and the mnemonic is unrecoverable by the site operator.

## Transaction API retained for compatibility

`signPayload(completeScalePayload, 152)` and `verifyPayload` retain the separate `QUANTUS_EXTRINSIC` context. The payload is Blake2b-256 hashed only when its length exceeds 256 bytes, following the existing adapter's chain signing contract. The caller must separately pin mainnet genesis, runtime 152, transaction version 6, metadata, signed extensions and call encoding. New runtimes require review. A listings authentication component should not expose this transaction API to its UI or call it to authenticate.

## Sensitive memory and limitations

Rust-owned mnemonic and entropy input copies use zeroizing wrappers; secret key material is zeroized on drop. The handle exposes no private-key accessor. Always `clear()` then `free()` the handle and terminate its dedicated browser worker when locking or closing the page. Clear UI inputs and JavaScript references promptly. The JS mnemonic string, glue-layer return copies and browser-managed memory cannot be guaranteed erased. This component cannot protect an unlocked wallet against hostile same-origin JavaScript, malicious browser extensions, compromised hosting, altered dependencies or a compromised device. CSP and local processing reduce exposure but do not prove absolute safety.

## Verification and distribution

`cargo test --release --locked --offline` runs seven native tests. `node test-node.cjs` runs actual node-target WASM against both schemes and six message lengths (1, 140, 256, 257, 300 and 8192 bytes). `node test-init-sync.mjs` loads the actual web WASM with a precompiled module and verifies its synchronous initialization route. Tests cover entropy length/round-trip, address mapping, tampered messages/signatures, malformed inputs, wrong keys, size limits, cleared handles and authentication/extrinsic context separation. They generate fresh throwaway entropy, print no mnemonic, never read a user wallet and never broadcast.

See [REBUILD.md](REBUILD.md), `SHA256SUMS`, and `qtc-market-crypto-source.zip`. Hashes detect differences only when obtained through an independently trusted channel; a compromised server can replace both an asset and its published hash. The source archive contains the adapter, locked vendored dependencies, tests, build instructions and licenses. Build tools and generated binaries are distributed separately.

Sources:

- Official SDK derivation: https://github.com/Quantus-Network/quantus-apps/blob/main/quantus_sdk/rust/src/api/crypto.rs
- Official signing context: https://github.com/Quantus-Network/quantus-apps/blob/main/quantus_sdk/rust/src/signing_context.rs
- Official chain key/address primitives: https://github.com/Quantus-Network/chain/blob/main/primitives/dilithium-crypto/src/types.rs
- Cloudflare static WASM modules: https://developers.cloudflare.com/workers/runtime-apis/webassembly/javascript/
- Browser CSPRNG: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
- AES-GCM parameters: https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams
- PBKDF2 baseline: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
