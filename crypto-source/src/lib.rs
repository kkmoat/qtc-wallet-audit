//! Browser-local wallet and signing bridge. No network, storage, or private-key export APIs.
//! The caller must independently verify the intended chain and review the transaction.
use blake2::{Blake2b512, Blake2b, Digest, digest::consts::U32};
use qp_rusty_crystals_dilithium::{ml_dsa_65, ml_dsa_87};
use wasm_bindgen::prelude::*;
use zeroize::Zeroizing;

const CONTEXT: &[u8] = b"QUANTUS_EXTRINSIC";
const AUTH_CONTEXT: &[u8] = b"QTC_LISTINGS_AUTH_V1";
const MAX_AUTH_MESSAGE: usize = 8 * 1024;
const SUPPORTED_SPEC: u32 = 152;
const MAX_PAYLOAD: usize = 1024 * 1024;

enum Keys {
    Dsa65(Box<ml_dsa_65::Keypair>),
    Dsa87(Box<ml_dsa_87::Keypair>),
}

impl Keys {
    fn public(&self) -> Vec<u8> {
        match self {
            Self::Dsa65(k) => k.public().to_bytes().to_vec(),
            Self::Dsa87(k) => k.public().to_bytes().to_vec(),
        }
    }
    fn sign(&self, msg: &[u8]) -> Result<Vec<u8>, &'static str> {
        self.sign_with_context(msg, CONTEXT)
    }
    fn sign_with_context(&self, msg: &[u8], context: &[u8]) -> Result<Vec<u8>, &'static str> {
        match self {
            Self::Dsa65(k) => k.sign(msg, Some(context), None).map(|s| s.to_vec()),
            Self::Dsa87(k) => k.sign(msg, Some(context), None).map(|s| s.to_vec()),
        }.map_err(|_| "Signing failed")
    }
}

fn message(payload: &[u8]) -> Vec<u8> {
    if payload.len() > 256 {
        Blake2b::<U32>::digest(payload).to_vec()
    } else {
        payload.to_vec()
    }
}

fn address_for_id(id: &[u8; 32]) -> String {
    let mut bytes = vec![0x6f, 0x40]; // SS58 prefix 189, two-byte encoding.
    bytes.extend_from_slice(id);
    let mut hasher = Blake2b512::new();
    hasher.update(b"SS58PRE");
    hasher.update(&bytes);
    bytes.extend_from_slice(&hasher.finalize()[..2]);
    bs58::encode(bytes).into_string()
}

fn parse_scheme(scheme: &str) -> Result<bool, &'static str> {
    match scheme {
        "ml-dsa-65" => Ok(true),
        "ml-dsa-87" => Ok(false),
        _ => Err("Expected ml-dsa-65 or ml-dsa-87"),
    }
}

fn canonical_path(scheme: &str, account: u32) -> Result<String, &'static str> {
    if account >= (1 << 31) { return Err("Account index must be below 2^31"); }
    let last = if parse_scheme(scheme)? { 1 } else { 0 };
    Ok(format!("m/44'/189189'/{account}'/0'/{last}'"))
}

fn derive_inner(mnemonic: String, scheme: &str, path: String) -> Result<SecretHandle, &'static str> {
    let mnemonic = Zeroizing::new(mnemonic);
    if mnemonic.len() > 1024 { return Err("Mnemonic is too long"); }
    let is65 = parse_scheme(scheme)?;
    let keys = if is65 {
        Keys::Dsa65(Box::new(qp_rusty_crystals_hdwallet::ml_dsa_65::derive_key_from_mnemonic(
            mnemonic.as_str(), None, &path,
        ).map_err(|_| "Invalid mnemonic or derivation path")?))
    } else {
        Keys::Dsa87(Box::new(qp_rusty_crystals_hdwallet::ml_dsa_87::derive_key_from_mnemonic(
            mnemonic.as_str(), None, &path,
        ).map_err(|_| "Invalid mnemonic or derivation path")?))
    };
    let public_key = keys.public();
    let account_id = qp_poseidon_core::hash_bytes(&public_key);
    Ok(SecretHandle {
        keys: Some(keys),
        address: address_for_id(&account_id),
        account_id,
        public_key,
        path,
        scheme: scheme.to_owned(),
    })
}

fn mnemonic_from_entropy_inner(entropy: &[u8]) -> Result<String, &'static str> {
    if entropy.len() != 32 { return Err("Expected exactly 32 bytes of CSPRNG entropy"); }
    let entropy = Zeroizing::new(entropy.to_vec());
    // This feature-enabled Mnemonic also zeroizes its internal word indices on drop.
    let mnemonic = bip39::Mnemonic::from_entropy_in(bip39::Language::English, &entropy)
        .map_err(|_| "Invalid entropy length")?;
    Ok(mnemonic.to_string())
}

/// Convert caller-supplied 256-bit CSPRNG entropy to a 24-word English BIP39 backup.
/// Generate the entropy in the user's browser, never on the application server.
/// The returned mnemonic is secret; callers must not log or upload it.
#[wasm_bindgen(js_name = mnemonicFromEntropy)]
pub fn mnemonic_from_entropy(entropy: Vec<u8>) -> Result<String, JsError> {
    // Own the wasm-bindgen input allocation so the original copy is wiped too.
    let entropy = Zeroizing::new(entropy);
    mnemonic_from_entropy_inner(&entropy).map_err(JsError::new)
}

fn address_from_public_key_inner(public_key: &[u8], scheme: &str) -> Result<String, &'static str> {
    match scheme {
        "ml-dsa-65" => { ml_dsa_65::PublicKey::from_bytes(public_key).map_err(|_| "Invalid public key")?; },
        "ml-dsa-87" => { ml_dsa_87::PublicKey::from_bytes(public_key).map_err(|_| "Invalid public key")?; },
        _ => return Err("Expected ml-dsa-65 or ml-dsa-87"),
    }
    Ok(address_for_id(&qp_poseidon_core::hash_bytes(public_key)))
}

/// Derive the official SS58/189 qz address from a validated public key.
/// Servers must compare this address with the address bound to their challenge.
#[wasm_bindgen(js_name = addressFromPublicKey)]
pub fn address_from_public_key(public_key: &[u8], scheme: &str) -> Result<String, JsError> {
    address_from_public_key_inner(public_key, scheme).map_err(JsError::new)
}

fn valid_auth_message(message: &[u8]) -> bool {
    !message.is_empty() && message.len() <= MAX_AUTH_MESSAGE
}

/// Holds official zeroize-on-drop keypairs. No secret accessors are exposed.
#[wasm_bindgen]
pub struct SecretHandle {
    keys: Option<Keys>,
    address: String,
    account_id: [u8; 32],
    public_key: Vec<u8>,
    path: String,
    scheme: String,
}

#[wasm_bindgen]
impl SecretHandle {
    #[wasm_bindgen(getter)]
    pub fn address(&self) -> String { self.address.clone() }
    #[wasm_bindgen(getter, js_name = accountId)]
    pub fn account_id(&self) -> Vec<u8> { self.account_id.to_vec() }
    #[wasm_bindgen(getter, js_name = publicKey)]
    pub fn public_key(&self) -> Vec<u8> { self.public_key.clone() }
    #[wasm_bindgen(getter)]
    pub fn path(&self) -> String { self.path.clone() }
    #[wasm_bindgen(getter)]
    pub fn scheme(&self) -> String { self.scheme.clone() }
    #[wasm_bindgen(getter)]
    pub fn cleared(&self) -> bool { self.keys.is_none() }

    /// Sign the complete SCALE SignedPayload. Performs Substrate's >256-byte hash rule.
    /// It never assembles or broadcasts a transaction.
    #[wasm_bindgen(js_name = signPayload)]
    pub fn sign_payload(&self, payload: &[u8], spec_version: u32) -> Result<Vec<u8>, JsError> {
        if spec_version != SUPPORTED_SPEC { return Err(JsError::new("Unsupported runtime: expected specVersion 152")); }
        if payload.is_empty() || payload.len() > MAX_PAYLOAD { return Err(JsError::new("Invalid signing payload length")); }
        let keys = self.keys.as_ref().ok_or_else(|| JsError::new("Signing key has been cleared"))?;
        keys.sign(&message(payload)).map_err(JsError::new)
    }

    /// Sign 1..=8192 raw message bytes under QTC_LISTINGS_AUTH_V1.
    /// This uses a separate ML-DSA context from chain extrinsics and does not
    /// apply Substrate's >256-byte hashing rule. It does not authorize a transfer.
    #[wasm_bindgen(js_name = signMessage)]
    pub fn sign_message(&self, message: &[u8]) -> Result<Vec<u8>, JsError> {
        self.sign_auth_inner(message).map_err(JsError::new)
    }

    /// Immediately drop and zeroize secret key material; safe to call repeatedly.
    pub fn clear(&mut self) { self.keys = None; }
}

impl SecretHandle {
    fn sign_auth_inner(&self, message: &[u8]) -> Result<Vec<u8>, &'static str> {
        if !valid_auth_message(message) { return Err("Authentication message must contain 1 to 8192 bytes"); }
        self.keys.as_ref().ok_or("Signing key has been cleared")?
            .sign_with_context(message, AUTH_CONTEXT)
    }
}

#[wasm_bindgen(js_name = deriveAccount)]
pub fn derive_account(mnemonic: String, scheme: &str, account_index: u32) -> Result<SecretHandle, JsError> {
    // The guard ensures even a rejected scheme/index wipes the incoming Rust copy.
    let mut phrase = Zeroizing::new(mnemonic);
    let path = canonical_path(scheme, account_index).map_err(JsError::new)?;
    derive_inner(core::mem::take(&mut *phrase), scheme, path).map_err(JsError::new)
}

/// Explicit canonical BIP44 path option for accounts created with custom HD indices.
#[wasm_bindgen(js_name = deriveAccountAtPath)]
pub fn derive_account_at_path(mnemonic: String, scheme: &str, path: String) -> Result<SecretHandle, JsError> {
    derive_inner(mnemonic, scheme, path).map_err(JsError::new)
}

#[wasm_bindgen(js_name = verifyPayload)]
pub fn verify_payload(public_key: &[u8], payload: &[u8], signature: &[u8], scheme: &str, spec_version: u32) -> bool {
    if spec_version != SUPPORTED_SPEC || payload.is_empty() || payload.len() > MAX_PAYLOAD { return false; }
    let msg = message(payload);
    match scheme {
        "ml-dsa-65" => ml_dsa_65::PublicKey::from_bytes(public_key).map(|p| p.verify(&msg, signature, Some(CONTEXT))).unwrap_or(false),
        "ml-dsa-87" => ml_dsa_87::PublicKey::from_bytes(public_key).map(|p| p.verify(&msg, signature, Some(CONTEXT))).unwrap_or(false),
        _ => false,
    }
}

/// Verify a raw authentication message under QTC_LISTINGS_AUTH_V1.
/// The caller remains responsible for address binding, origin, challenge expiry,
/// operation/body binding, one-time nonce consumption and session security.
#[wasm_bindgen(js_name = verifyMessage)]
pub fn verify_message(public_key: &[u8], message: &[u8], signature: &[u8], scheme: &str) -> bool {
    if !valid_auth_message(message) { return false; }
    match scheme {
        "ml-dsa-65" => ml_dsa_65::PublicKey::from_bytes(public_key)
            .map(|p| p.verify(message, signature, Some(AUTH_CONTEXT))).unwrap_or(false),
        "ml-dsa-87" => ml_dsa_87::PublicKey::from_bytes(public_key)
            .map(|p| p.verify(message, signature, Some(AUTH_CONTEXT))).unwrap_or(false),
        _ => false,
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_phrase() -> Zeroizing<String> {
        let mut entropy = Zeroizing::new([0u8; 32]);
        getrandom::getrandom(entropy.as_mut()).expect("Test CSPRNG unavailable");
        Zeroizing::new(mnemonic_from_entropy_inner(entropy.as_ref()).unwrap())
    }
    fn wallet(scheme: &str) -> SecretHandle {
        let phrase = temporary_phrase();
        derive_inner(phrase.to_string(), scheme, canonical_path(scheme, 0).unwrap()).unwrap()
    }
    #[test]
    fn entropy_produces_24_words_and_roundtrips() {
        let mut entropy = Zeroizing::new([0u8; 32]);
        getrandom::getrandom(entropy.as_mut()).unwrap();
        let phrase = Zeroizing::new(mnemonic_from_entropy_inner(entropy.as_ref()).unwrap());
        assert_eq!(phrase.split_whitespace().count(), 24);
        let mnemonic = bip39::Mnemonic::parse_in_normalized(bip39::Language::English, phrase.as_str()).unwrap();
        let (recovered, length) = mnemonic.to_entropy_array();
        let recovered = Zeroizing::new(recovered);
        assert_eq!(length, 32);
        assert!(&recovered[..length] == entropy.as_ref());
    }
    #[test]
    fn entropy_length_is_exactly_256_bits() {
        for n in [0, 16, 24, 31, 33, 64] {
            assert!(mnemonic_from_entropy_inner(&vec![0u8; n]).is_err());
        }
    }
    #[test]
    fn official_address_mapping_matches_both_schemes() {
        for scheme in ["ml-dsa-65", "ml-dsa-87"] {
            let handle = wallet(scheme);
            assert!(handle.address.starts_with("qz"));
            assert_eq!(address_from_public_key_inner(&handle.public_key, scheme).unwrap(), handle.address);
            assert_eq!(handle.account_id, qp_poseidon_core::hash_bytes(&handle.public_key));
            assert_eq!(handle.path, if scheme == "ml-dsa-65" {"m/44'/189189'/0'/0'/1'"} else {"m/44'/189189'/0'/0'/0'"});
        }
    }
    #[test]
    fn public_key_mapping_rejects_malformed_inputs() {
        assert!(address_from_public_key_inner(&[0u8; 12], "ml-dsa-65").is_err());
        let handle = wallet("ml-dsa-65");
        assert!(address_from_public_key_inner(&handle.public_key, "unknown").is_err());
        assert!(address_from_public_key_inner(&handle.public_key, "ml-dsa-87").is_err());
    }
    #[test]
    fn authentication_signatures_verify_and_reject_tampering() {
        for scheme in ["ml-dsa-65", "ml-dsa-87"] {
            let handle = wallet(scheme);
            let msg = b"QTC listings test challenge: no transaction authority";
            let signature = handle.sign_auth_inner(msg).unwrap();
            assert!(verify_message(&handle.public_key, msg, &signature, scheme));
            let mut changed = msg.to_vec(); changed[0] ^= 1;
            assert!(!verify_message(&handle.public_key, &changed, &signature, scheme));
            let mut broken = signature.clone(); broken[0] ^= 1;
            assert!(!verify_message(&handle.public_key, msg, &broken, scheme));
            assert!(!verify_message(&handle.public_key, msg, &signature[..10], scheme));
        }
    }
    #[test]
    fn authentication_and_extrinsic_contexts_are_isolated() {
        for scheme in ["ml-dsa-65", "ml-dsa-87"] {
            let handle = wallet(scheme);
            for n in [140, 256, 257, 300] {
                let msg = vec![0x51; n];
                let auth_sig = handle.sign_auth_inner(&msg).unwrap();
                let tx_sig = handle.sign_payload(&msg, 152).unwrap();
                assert!(verify_message(&handle.public_key, &msg, &auth_sig, scheme));
                assert!(!verify_payload(&handle.public_key, &msg, &auth_sig, scheme, 152));
                assert!(verify_payload(&handle.public_key, &msg, &tx_sig, scheme, 152));
                assert!(!verify_message(&handle.public_key, &msg, &tx_sig, scheme));
            }
        }
    }
    #[test]
    fn authentication_message_size_boundary_and_cleared_handles() {
        let mut handle = wallet("ml-dsa-65");
        assert!(handle.sign_auth_inner(&[]).is_err());
        assert!(handle.sign_auth_inner(&vec![0; 8193]).is_err());
        let msg = vec![0x51; 8192];
        let sig = handle.sign_auth_inner(&msg).unwrap();
        assert!(verify_message(&handle.public_key, &msg, &sig, "ml-dsa-65"));
        assert!(!verify_message(&handle.public_key, &[], &sig, "ml-dsa-65"));
        assert!(!verify_message(&handle.public_key, &vec![0;8193], &sig, "ml-dsa-65"));
        handle.clear(); handle.clear();
        assert!(handle.sign_auth_inner(b"locked").is_err());
        assert!(handle.cleared());
    }
}
