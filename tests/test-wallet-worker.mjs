import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const assetDir = new URL('.', import.meta.url);
const site = resolve(process.argv[2] || fileURLToPath(new URL('../', import.meta.url)));
const cryptoDir = join(site, 'public', 'crypto');
const workerPath = join(cryptoDir, 'wallet-worker.js');
const wasmPath = join(cryptoDir, 'quantus_browser_crypto_bg.wasm');
const files = ['wallet-worker.js','vault.mjs','domain.mjs','settlement.mjs','address-checks.mjs','quantus_browser_crypto.js','quantus_browser_crypto_bg.wasm'];
const initialHashes = {};
for (const name of files) initialHashes[name] = createHash('sha256').update(await readFile(join(cryptoDir,name))).digest('hex');
const { normalize, messageFor, fromHex } = await import(pathToFileURL(join(cryptoDir,'domain.mjs')).href);
const { initSync, verifyMessage, verifyPayload, addressFromPublicKey } = await import(pathToFileURL(join(cryptoDir,'quantus_browser_crypto.js')).href);
initSync({ module: new WebAssembly.Module(await readFile(wasmPath)) });
const worker = new Worker(new URL('test-wallet-worker-shim.mjs', assetDir), { workerData: { workerPath, wasmPath } });
let nextId = 0;
const pending = new Map();
let markReady, failReady;
const ready = new Promise((ok, fail) => { markReady=ok; failReady=fail; });
worker.on('message', value => {
  if (value.ready) { markReady(); return; }
  const slot = pending.get(value.id);
  if (slot) { clearTimeout(slot.timer); pending.delete(value.id); slot.resolve(value); }
});
worker.on('error', () => { failReady(new Error('Wallet worker failed')); for(const slot of pending.values()) slot.reject(new Error('Wallet worker failed')); });
function call(type, data = {}) {
  const id = ++nextId;
  return new Promise((resolveCall, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Wallet worker response timed out')); }, 20000);
    pending.set(id,{resolve:resolveCall,reject,timer});
    worker.postMessage({id,type,...data});
  });
}
const checks=[];
function check(condition, label) { assert(condition, label); checks.push(label); }
const origin='https://qtc-listings-test.invalid';
const input={settlementPolicy:'qtc_usdt_bsc_v1',paymentNetwork:'bsc',receiveAddress:'0x52908400098527886E0F7030069857D2E4169EE7',side:'sell',quantity:'2.5',minimum:'0.1',price:'0.42',nickname:'Temporary test',contactType:'email',contact:'test@example.invalid',hours:1,payment:'negotiable',notes:'Ephemeral local test; never published'};
let password=randomBytes(24).toString('base64url'), newPassword=randomBytes(24).toString('base64url');
let phrase='',created=null,vault=null;
try {
  await ready;
  created=await call('create',{password});
  check(created.ok,'create succeeds');
  phrase=created.result.phrase;
  delete created.result.phrase;
  check(typeof phrase==='string' && phrase.split(' ').length===24,'24-word backup returned only to local caller');
  const account=created.result.account;
  vault=created.result.vault;
  check(account.scheme==='ml-dsa-65' && account.path==="m/44'/189189'/0'/0'/1'",'official ML-DSA-65 default derivation');
  check(vault.kind==='qtc-market-wallet' && vault.version===1 && vault.kdf.iterations===600000 && vault.cipher==='AES-256-GCM','encrypted vault parameters');
  check(!JSON.stringify(vault).includes(phrase) && !('phrase' in vault),'vault contains no plaintext mnemonic');
  check(Buffer.from(vault.salt,'base64').length===16 && Buffer.from(vault.iv,'base64').length===12,'fresh 16-byte salt and 12-byte IV');
  check(addressFromPublicKey(fromHex(account.publicKey,1952),'ml-dsa-65')===account.address,'independent public-key/address binding');
  check((await call('close')).ok,'close after create');
  check((await call('unlock',{vault,password})).ok,'unlock encrypted vault');

  const challenge={id:randomUUID(),origin,address:account.address,action:'publish',payload:normalize('publish',input),expiresAt:Date.now()+240000};
  challenge.message=messageFor(challenge);
  const expected={address:account.address,origin,action:'publish',payload:input};
  const signed=await call('sign',{challenge,expected});
  check(signed.ok,'domain-bound listing challenge signs');
  const publicKey=fromHex(account.publicKey,1952), signature=fromHex(signed.result.signature,3309), message=new TextEncoder().encode(challenge.message);
  check(verifyMessage(publicKey,message,signature,'ml-dsa-65'),'independent authentication verification');
  check(!verifyPayload(publicKey,message,signature,'ml-dsa-65',152),'authentication signature rejected as chain transaction signature');
  const changed=message.slice(); changed[0]^=1;
  check(!verifyMessage(publicKey,changed,signature,'ml-dsa-65'),'modified message rejected');
  const capacityChallenge={id:randomUUID(),origin,address:account.address,action:'sell_capacity',payload:normalize('sell_capacity',{}),expiresAt:Date.now()+240000};
  capacityChallenge.message=messageFor(capacityChallenge);
  const capacityExpected={address:account.address,origin,action:'sell_capacity',payload:{}};
  const capacitySigned=await call('sign',{challenge:capacityChallenge,expected:capacityExpected});
  check(capacitySigned.ok&&verifyMessage(publicKey,new TextEncoder().encode(capacityChallenge.message),fromHex(capacitySigned.result.signature,3309),'ml-dsa-65'),'sell capacity read signs only its own domain-bound current-wallet challenge');
  check(!(await call('sign',{challenge:capacityChallenge,expected:{...capacityExpected,payload:{address:'another wallet'}}})).ok,'sell capacity read rejects caller-supplied wallet override before signing');
  check(!verifyMessage(publicKey,message,fromHex(capacitySigned.result.signature,3309),'ml-dsa-65'),'capacity read signature cannot authorize a sell publication');
  const broken=signature.slice(); broken[0]^=1;
  check(!verifyMessage(publicKey,message,broken,'ml-dsa-65'),'modified signature rejected');
  check(!(await call('sign',{challenge,expected:{...expected,origin:'https://different-origin.invalid'}})).ok,'unexpected origin rejected before signing');
  check(!(await call('sign',{challenge,expected:{...expected,payload:{...input,quantity:'3'}}})).ok,'changed listing terms rejected before signing');
  const changedHours={...challenge,payload:{...challenge.payload,hours:12}};changedHours.message=messageFor(changedHours);
  check(!(await call('sign',{challenge:changedHours,expected})).ok,'changed hour duration rejected before wallet signing');
  check(!verifyMessage(publicKey,new TextEncoder().encode(changedHours.message),signature,'ml-dsa-65'),'signed one-hour publication cannot authenticate a twelve-hour payload');
  const {hours:oldHours,...oldFields}=challenge.payload;
  const oldDays={...challenge,payload:{...oldFields,days:1}};oldDays.message=messageFor(oldDays);
  check(!(await call('sign',{challenge:oldDays,expected:{...expected,payload:oldDays.payload}})).ok,'old days publication refused by the current wallet protocol');
  const expired={...challenge,expiresAt:Date.now()-1000}; expired.message=messageFor(expired);
  check(!(await call('sign',{challenge:expired,expected})).ok,'expired challenge rejected before signing');

  check(!(await call('unlock',{vault,password:newPassword})).ok,'wrong password rejected');
  check(!(await call('sign',{challenge,expected})).ok,'failed unlock leaves wallet locked');
  check((await call('unlock',{vault,password})).ok,'valid unlock still works after wrong password');
  const alteredVault={...vault,path:"m/44'/189189'/1'/0'/1'"};
  check(!(await call('unlock',{vault:alteredVault,password})).ok,'modified vault metadata fails authenticated decryption');
  const changedData=Buffer.from(vault.data,'base64'); changedData[0]^=1;
  check(!(await call('unlock',{vault:{...vault,data:changedData.toString('base64')},password})).ok,'modified vault ciphertext rejected');

  const recovered=await call('recover',{phrase,password:newPassword});
  phrase='';
  check(recovered.ok && recovered.result.account.address===account.address,'mnemonic recovery preserves original address');
  check(recovered.result.vault.salt!==vault.salt && recovered.result.vault.iv!==vault.iv && recovered.result.vault.data!==vault.data,'recovery creates fresh encrypted vault');
  check((await call('close')).ok,'close recovered wallet');
  check((await call('unlock',{vault:recovered.result.vault,password:newPassword})).ok,'recovered vault unlocks using new password');
  check((await call('sign',{challenge,expected})).ok,'recovered account signs same domain-bound challenge');
  check((await call('close')).ok,'final close succeeds');
  check(!(await call('sign',{challenge,expected})).ok,'sign after close rejected');
  check((await call('close')).ok,'close is idempotent');
  for (const name of files) check(createHash('sha256').update(await readFile(join(cryptoDir,name))).digest('hex')===initialHashes[name], 'asset unchanged: '+name);
  console.log(JSON.stringify({passed:checks.length,checks,assetHashes:initialHashes,limitations:['Node browser-worker shim, not browser UI or CSP test','No server, D1, network or transaction broadcast','No mnemonic/private key/address/password printed or persisted']},null,2));
} finally {
  phrase=''; password=''; newPassword=''; created=null; vault=null;
  for(const slot of pending.values()) clearTimeout(slot.timer);
  pending.clear();
  await worker.terminate();
}
