// Test instrumentation only. The production wallet worker is imported unchanged.
import {parentPort,workerData} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {webcrypto} from 'node:crypto';

const wasmUrl=pathToFileURL(workerData.wasmPath).href;
const randomCalls=[];
let randomMode='normal',unavailableBytes=32,weakRandomCalls=0,allowedFetches=0,rejectedFetches=0,consoleCalls=0;

// Record sizes only; never copy entropy, keys, phrases, passwords or addresses.
const secureRandom=array=>{
 randomCalls.push({type:array?.constructor?.name,bytes:array?.byteLength});
 if(randomMode==='unavailable'&&array.byteLength===unavailableBytes)throw new Error('Test CSPRNG unavailable');
 return webcrypto.getRandomValues(array);
};
const setRandomMode=(mode,bytes=32)=>{
 randomMode=mode;unavailableBytes=bytes;
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:Object.freeze({
  subtle:webcrypto.subtle,
  ...(mode==='missing'?{}:{getRandomValues:secureRandom}),
 })});
};
setRandomMode('normal');
Math.random=()=>{weakRandomCalls++;throw new Error('Weak random fallback forbidden in wallet test');};

// Suppress and count console attempts without retaining potentially sensitive args.
for(const name of ['log','info','warn','error','debug','trace','dir','table'])console[name]=()=>{consoleCalls++;};
globalThis.fetch=async input=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input?.url;
 if(url===wasmUrl){allowedFetches++;return new Response(await readFile(workerData.wasmPath),{headers:{'Content-Type':'application/wasm'}})}
 rejectedFetches++;
 throw new Error('Wallet test refused an unexpected fetch');
};
globalThis.self=globalThis;
globalThis.postMessage=value=>parentPort.postMessage(value);
await import(pathToFileURL(workerData.workerPath).href);

parentPort.on('message',async data=>{
 if(data.testControl){
  if(data.testControl==='diagnostics'){
   parentPort.postMessage({id:data.id,ok:true,result:{randomCalls:[...randomCalls],weakRandomCalls,allowedFetches,rejectedFetches,consoleCalls}});
  }else if(data.testControl==='resetRandomCalls'){
   randomCalls.length=0;parentPort.postMessage({id:data.id,ok:true});
  }else if(data.testControl==='randomMode'&&['normal','unavailable','missing'].includes(data.mode)&&[undefined,32,16,12].includes(data.bytes)){
   setRandomMode(data.mode,data.bytes);parentPort.postMessage({id:data.id,ok:true});
  }else if(data.testControl==='probeUnexpectedFetch'){
   // The shim rejects this fixed .invalid URL before invoking any transport.
   let rejected=false;try{await globalThis.fetch('https://wallet-test-unexpected.invalid/')}catch{rejected=true}
   parentPort.postMessage({id:data.id,ok:true,result:{rejected}});
  }else parentPort.postMessage({id:data.id,ok:false});
  return;
 }
 try{globalThis.onmessage({data})}
 catch{parentPort.postMessage({id:data.id,ok:false,error:'Worker dispatch failed'})}
});
parentPort.postMessage({ready:true});
