import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Worker} from 'node:worker_threads';

// Real production Worker and WASM, browser APIs instrumented in an isolated Node
// thread. Only temporary secrets held in memory; assertion messages never include
// wallet values. This verifies CSPRNG API use, not entropy quality or browser CSP.
test('actual wallet worker uses fresh CSPRNG inputs and fails closed without them',{timeout:30000},async t=>{
 const directory=new URL('../public/crypto/',import.meta.url);
 const files=['wallet-worker.js','vault.mjs','domain.mjs','settlement.mjs','address-checks.mjs','quantus_browser_crypto.js','quantus_browser_crypto_bg.wasm'];
 const before=await Promise.all(files.map(async file=>createHash('sha256').update(await readFile(new URL(file,directory))).digest('hex')));
 const worker=new Worker(new URL('wallet-randomness-shim.mjs',import.meta.url),{workerData:{
  workerPath:fileURLToPath(new URL('wallet-worker.js',directory)),
  wasmPath:fileURLToPath(new URL('quantus_browser_crypto_bg.wasm',directory)),
 }});
 let sequence=0,resolveReady,rejectReady;
 const pending=new Map();
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject});
 const readyTimer=setTimeout(()=>rejectReady(new Error('Instrumented wallet worker readiness timed out')),10000);
 worker.on('message',message=>{
  if(message.ready)return; // Importing the shim is separate from WASM readiness.
  if(message.type==='ready'){clearTimeout(readyTimer);resolveReady();return;}
  if(message.type==='fatal'){
   clearTimeout(readyTimer);rejectReady(new Error('Instrumented wallet initialization failed'));
   for(const slot of pending.values()){clearTimeout(slot.timer);slot.reject(new Error('Instrumented wallet initialization failed'))}pending.clear();return;
  }
  if(message.type==='progress')return;
  const slot=pending.get(message.id);
  if(slot){clearTimeout(slot.timer);pending.delete(message.id);slot.resolve(message);}
 });
 worker.on('error',()=>{
  clearTimeout(readyTimer);rejectReady(new Error('Instrumented wallet worker failed'));
  for(const slot of pending.values())slot.reject(new Error('Instrumented wallet worker failed'));
 });
 const call=data=>new Promise((resolve,reject)=>{
  const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Instrumented wallet operation timed out'))},10000);
  pending.set(id,{resolve,reject,timer});worker.postMessage({...data,id});
 });
 const control=async(testControl,more={})=>{
  const response=await call({testControl,...more});assert.ok(response.ok,'Test control must succeed');return response.result;
 };
 const randomSizes=async()=>{
  const diagnostics=await control('diagnostics');
  assert.ok(diagnostics.randomCalls.every(item=>item.type==='Uint8Array'),'CSPRNG inputs must be byte arrays');
  return diagnostics.randomCalls.map(item=>item.bytes);
 };
 let password=randomBytes(24).toString('base64url'),first=null,second=null,recovered=null;
 try{
  await ready;
  await t.test('creation requests 32 entropy bytes, 16 salt bytes and 12 IV bytes',async()=>{
   await control('resetRandomCalls');
   const response=await call({type:'create',password});
   assert.ok(response.ok,'First wallet creation must succeed');first=response.result;
   assert.deepEqual(await randomSizes(),[32,16,12]);
   assert.ok(typeof first.phrase==='string'&&first.phrase.split(' ').length===24,'Creation must return a local 24-word backup');
   assert.ok(first.account.scheme==='ml-dsa-65'&&first.account.path==="m/44'/189189'/0'/0'/1'",'Creation must use the fixed ML-DSA-65 derivation');
  });
  // Guard later tests if an earlier subtest fails, without exposing its values.
  assert.ok(first,'Creation prerequisite failed');
  await t.test('two creations using the same password produce distinct identities and encryption randomness',async()=>{
   await control('resetRandomCalls');
   const response=await call({type:'create',password});
   assert.ok(response.ok,'Second wallet creation must succeed');second=response.result;
   assert.deepEqual(await randomSizes(),[32,16,12]);
   assert.ok(first.phrase!==second.phrase,'Fresh creations must produce different backups');
   assert.ok(first.account.address!==second.account.address&&first.account.publicKey!==second.account.publicKey,'Fresh creations must produce different public identities');
   assert.ok(first.vault.salt!==second.vault.salt&&first.vault.iv!==second.vault.iv,'Each encryption must use fresh salt and IV');
   assert.ok(!JSON.stringify(first.vault).includes(first.phrase)&&!JSON.stringify(second.vault).includes(second.phrase),'Encrypted backups must not contain plaintext phrases');
  });
  await t.test('recovery preserves identity while renewing only vault salt and IV',async()=>{
   assert.ok((await call({type:'close'})).ok,'Close must succeed');
   await control('resetRandomCalls');
   const response=await call({type:'recover',phrase:first.phrase,password});
   assert.ok(response.ok,'Recovery must succeed');recovered=response.result;
   assert.deepEqual(await randomSizes(),[16,12]);
   assert.ok(recovered.account.address===first.account.address&&recovered.account.publicKey===first.account.publicKey,'The same backup must recover the same identity');
   assert.ok(recovered.account.path===first.account.path&&recovered.account.scheme===first.account.scheme,'Recovery must preserve derivation settings');
   assert.ok(recovered.vault.salt!==first.vault.salt&&recovered.vault.iv!==first.vault.iv&&recovered.vault.data!==first.vault.data,'Recovery must produce fresh authenticated encryption');
   assert.ok(!Object.hasOwn(recovered,'phrase'),'Recovery must not return the phrase to its caller again');
  });
  for(const scenario of [
   {mode:'unavailable',bytes:32,expected:[32],label:'entropy randomness fails'},
   {mode:'unavailable',bytes:16,expected:[32,16],label:'salt randomness fails'},
   {mode:'unavailable',bytes:12,expected:[32,16,12],label:'IV randomness fails'},
   {mode:'missing',expected:[],label:'the CSPRNG method is missing'},
  ])await t.test(`creation fails closed when ${scenario.label}`,async()=>{
   await control('resetRandomCalls');await control('randomMode',{mode:scenario.mode,bytes:scenario.bytes});
   const response=await call({type:'create',password});
   assert.ok(response.ok===false,'Unavailable secure randomness must prevent wallet creation');
   assert.ok(!Object.hasOwn(response,'result'),'Failed creation must return no wallet material');
   assert.deepEqual(await randomSizes(),scenario.expected);
   assert.ok((await control('diagnostics')).weakRandomCalls===0,'No Math.random fallback may be attempted');
   assert.ok((await call({type:'sign',challenge:{},expected:{}})).ok===false,'Failed creation must leave the worker locked');
   await control('randomMode',{mode:'normal'});
  });
  await t.test('normal wallet operations perform only the exact local WASM fetch',async()=>{
   const diagnostics=await control('diagnostics');
   assert.ok(diagnostics.allowedFetches===1&&diagnostics.rejectedFetches===0,'Actual wallet operations must not attempt unexpected fetches');
   assert.ok(diagnostics.consoleCalls===0,'Wallet operations must not print diagnostic values');
   assert.ok((await control('probeUnexpectedFetch')).rejected,'Network guard must reject an unexpected URL without a transport');
   const after=await control('diagnostics');
   assert.ok(after.allowedFetches===1&&after.rejectedFetches===1,'Only the deliberate guard probe may be rejected');
   assert.ok(after.weakRandomCalls===0,'No weak RNG fallback may occur');
  });
  for(let index=0;index<files.length;index++){
   const after=createHash('sha256').update(await readFile(new URL(files[index],directory))).digest('hex');
   assert.ok(after===before[index],'Wallet source and compiled assets must remain unchanged');
  }
 }finally{
  password='';first=null;second=null;recovered=null;
  clearTimeout(readyTimer);for(const slot of pending.values())clearTimeout(slot.timer);pending.clear();
  await worker.terminate();
 }
});
