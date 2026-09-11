import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { initSync,mnemonicFromEntropy,deriveAccount,verifyMessage,verifyPayload,addressFromPublicKey } from './pkg-web/quantus_browser_crypto.js';
// Exercise the precompiled-module route used by Cloudflare's static .wasm imports.
const module = new WebAssembly.Module(await readFile(new URL('./pkg-web/quantus_browser_crypto_bg.wasm',import.meta.url)));
initSync({module});
const entropy=randomBytes(32);
let phrase='';
let handle;
try {
  phrase=mnemonicFromEntropy(entropy);
  handle=deriveAccount(phrase,'ml-dsa-65',0);
  phrase=''; entropy.fill(0);
  const message=new TextEncoder().encode('QTC Listings authentication test: server must bind a fresh challenge and origin.');
  const signature=handle.signMessage(message);
  assert.equal(addressFromPublicKey(handle.publicKey,'ml-dsa-65'),handle.address);
  assert.equal(verifyMessage(handle.publicKey,message,signature,'ml-dsa-65'),true);
  assert.equal(verifyPayload(handle.publicKey,message,signature,'ml-dsa-65',152),false);
  signature[0]^=1;
  assert.equal(verifyMessage(handle.publicKey,message,signature,'ml-dsa-65'),false);
  assert.throws(()=>mnemonicFromEntropy(new Uint8Array(31)),/32 bytes/);
} finally {
  phrase=''; entropy.fill(0);
  if(handle){handle.clear();handle.free();}
}
console.log('WASM web target: initSync({module}), address binding and positive/negative verification passed. This is not a deployed Cloudflare integration test.');
