import assert from 'node:assert/strict';
import {manifest,sha256} from './verify-snapshot.mjs';
const allowed=new Set(['https://qtc-market.vercel.app','https://uniqtc.xyz','https://www.uniqtc.xyz']);
const origin=process.argv[2];
assert.ok(process.argv.length===3&&allowed.has(origin),'Pass exactly one documented HTTPS market origin. Example: npm run verify:site -- https://uniqtc.xyz');
const assets=manifest.files.filter(x=>x.path.startsWith('public/crypto/')&&!x.path.endsWith('.d.ts'));
for(const asset of assets){
 const url=origin+'/'+asset.path.slice('public/'.length);
 const response=await fetch(url,{redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,200,`HTTP status mismatch: ${asset.path}`);
 // Read at most the expected asset length plus one chunk. Do not execute remote code.
 const reader=response.body.getReader(),parts=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;assert.ok(size<=asset.bytes,`Oversize response: ${asset.path}`);parts.push(value)}}finally{await reader.cancel()}
 assert.equal(size,asset.bytes,`Size mismatch: ${asset.path}`);
 assert.equal(sha256(Buffer.concat(parts)),asset.sha256,`Live asset differs from snapshot: ${asset.path}`);
 console.log(`MATCH ${asset.path}`);
}
console.log(`PASS: ${assets.length} public wallet assets match this snapshot at ${new Date().toISOString()}. This does not verify HTML, UI chunks, browser extensions, server handling, past/future deployments, or every visitor's response.`);
