import { parentPort, workerData } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { webcrypto } from 'node:crypto';

// Browser API shim only: execute the current Site worker source unchanged.
// Intercept only the exact local WASM file init() requests; no network is used.
const wasmUrl = pathToFileURL(workerData.wasmPath).href;
globalThis.crypto ??= webcrypto;
globalThis.fetch = async (input, options) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url === wasmUrl) return new Response(await readFile(workerData.wasmPath), { headers: { 'Content-Type': 'application/wasm' } });
  throw new Error('Test shim refused unexpected fetch');
};
globalThis.self = globalThis;
globalThis.postMessage = value => parentPort.postMessage(value);
await import(pathToFileURL(workerData.workerPath).href);
parentPort.on('message', data => {
  try { globalThis.onmessage({ data }); }
  catch { parentPort.postMessage({ id: data.id, ok: false, error: 'Worker dispatch failed' }); }
});
parentPort.postMessage({ ready: true });
