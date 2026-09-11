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
  if (url !== wasmUrl) throw new Error('Test shim refused unexpected fetch');
  if (!(options?.signal instanceof AbortSignal) || options.credentials !== 'same-origin' || options.redirect !== 'error') {
    throw new Error('WASM fetch must be abortable and restricted to its own origin');
  }
  if (workerData.fetchMode === 'reject') throw new Error('Test-only upstream error details');
  if (workerData.fetchMode === 'http-error') return new Response('Unavailable', { status: 503 });
  if (workerData.fetchMode === 'stall') {
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        parentPort.postMessage({ shim: 'fetch-aborted' });
        reject(new DOMException('Test fetch aborted', 'AbortError'));
      }, { once: true });
    });
  }
  if (workerData.fetchDelayMs) await new Promise(resolve => setTimeout(resolve, workerData.fetchDelayMs));
  const bytes = workerData.fetchMode === 'invalid-wasm' ? new Uint8Array(4) : await readFile(workerData.wasmPath);
  return new Response(bytes, { headers: { 'Content-Type': 'application/wasm' } });
};
globalThis.self = globalThis;
globalThis.postMessage = value => parentPort.postMessage(value);
await import(pathToFileURL(workerData.workerPath).href);
parentPort.on('message', data => {
  try { globalThis.onmessage({ data }); }
  catch { parentPort.postMessage({ id: data.id, ok: false, error: 'Worker dispatch failed' }); }
});
parentPort.postMessage({ ready: true });
