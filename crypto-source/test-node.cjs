'use strict';
// Fresh throwaway randomness only. Never print mnemonics, private material or wallet data.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const api = require('./pkg-node/quantus_browser_crypto.js');
function temporaryPhrase() {
  const entropy = randomBytes(32);
  try { return api.mnemonicFromEntropy(entropy); }
  finally { entropy.fill(0); }
}
let phrase = temporaryPhrase();
assert.equal(phrase.split(' ').length, 24);
for (const n of [0,16,24,31,33,64]) assert.throws(() => api.mnemonicFromEntropy(new Uint8Array(n)), /32 bytes/);
let checked = 0;
for (const scheme of ['ml-dsa-65','ml-dsa-87']) {
  const handle = api.deriveAccount(phrase, scheme, 0);
  try {
    assert.equal(api.addressFromPublicKey(handle.publicKey,scheme),handle.address);
    assert.match(handle.address,/^qz/);
    assert.equal(handle.path,`m/44'/189189'/0'/0'/${scheme==='ml-dsa-65'?1:0}'`);
    assert.equal(handle.publicKey.length, scheme==='ml-dsa-65'?1952:2592);
    assert.equal('mnemonic' in handle,false);
    assert.equal('privateKey' in handle,false);
    for (const size of [1,140,256,257,300,8192]) {
      const message = randomBytes(size);
      const signature = handle.signMessage(message);
      assert.equal(signature.length,scheme==='ml-dsa-65'?3309:4627);
      assert.equal(api.verifyMessage(handle.publicKey,message,signature,scheme),true);
      const changed = Uint8Array.from(message); changed[0]^=1;
      assert.equal(api.verifyMessage(handle.publicKey,changed,signature,scheme),false);
      const broken = Uint8Array.from(signature); broken[0]^=1;
      assert.equal(api.verifyMessage(handle.publicKey,message,broken,scheme),false);
      assert.equal(api.verifyMessage(handle.publicKey,message,signature.subarray(0,10),scheme),false);
      assert.equal(api.verifyMessage(handle.publicKey,message,signature,'unknown'),false);
      assert.equal(api.verifyPayload(handle.publicKey,message,signature,scheme,152),false);
      const txSignature = handle.signPayload(message,152);
      assert.equal(api.verifyPayload(handle.publicKey,message,txSignature,scheme,152),true);
      assert.equal(api.verifyMessage(handle.publicKey,message,txSignature,scheme),false);
      checked++;
    }
    assert.throws(()=>handle.signMessage(new Uint8Array(0)),/1 to 8192/);
    assert.throws(()=>handle.signMessage(new Uint8Array(8193)),/1 to 8192/);
    assert.throws(()=>api.addressFromPublicKey(new Uint8Array(3),scheme),/Invalid public key/);
    const other = api.deriveAccount(phrase,scheme,1);
    try {
      assert.notEqual(other.address,handle.address);
      const m = new TextEncoder().encode('unrelated temporary identity');
      const sig = handle.signMessage(m);
      assert.equal(api.verifyMessage(other.publicKey,m,sig,scheme),false);
    } finally { other.clear(); other.free(); }
    handle.clear(); handle.clear();
    assert.equal(handle.cleared,true);
    assert.throws(()=>handle.signMessage(new Uint8Array([1])),/cleared/);
  } finally { handle.clear(); handle.free(); }
}
phrase='';
console.log(`WASM node target: ${checked} message/scheme cases passed; tampering, domain separation, address binding, bounds and locking passed.`);
