import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
export const manifest=JSON.parse(await readFile(new URL('snapshot.json',root),'utf8'));
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(manifest.schemaVersion,1);
assert.ok(Array.isArray(manifest.files)&&manifest.files.length>0);
const seen=new Set();
for(const item of manifest.files){
 assert.match(item.path,/^[A-Za-z0-9_./-]+$/);
 assert.ok(!item.path.startsWith('/')&&!item.path.split('/').includes('..')&&!seen.has(item.path));
 seen.add(item.path);
 const url=new URL(item.path,root),info=await lstat(url);
 assert.ok(info.isFile()&&!info.isSymbolicLink());
 const bytes=await readFile(url);
 assert.equal(bytes.length,item.bytes,`Size mismatch: ${item.path}`);
 assert.equal(sha256(bytes),item.sha256,`Hash mismatch: ${item.path}`);
}
console.log(`Snapshot verified: ${manifest.files.length} selected source/artifact files. This is integrity checking, not a security certification.`);
