// Public receiving-address validation only. No wallet secrets or network requests.
import { blake2b } from '@noble/hashes/blake2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { base58 } from '@scure/base';
const encoder = new TextEncoder();
export function validateQuantusAddress(value) {
  const fail = () => { throw new Error('请输入有效的 Quantus 主网收款地址（qz 开头），并检查地址校验码。'); };
  if (typeof value !== 'string') return fail();
  const address = value.trim();
  if (!/^qz[1-9A-HJ-NP-Za-km-z]{40,62}$/.test(address)) return fail();
  let decoded;
  try { decoded = base58.decode(address); } catch { return fail(); }
  // SS58 prefix 189, 32-byte AccountId, two-byte BLAKE2b-512 checksum.
  if (decoded.length !== 36 || decoded[0] !== 111 || decoded[1] !== 64 || base58.encode(decoded) !== address) return fail();
  const payload = new Uint8Array(41);
  payload.set(encoder.encode('SS58PRE')); payload.set(decoded.subarray(0, 34), 7);
  const checksum = blake2b(payload, { dkLen: 64 });
  if (decoded[34] !== checksum[0] || decoded[35] !== checksum[1]) return fail();
  if (decoded.subarray(2, 34).every(byte => byte === 0)) return fail();
  return address;
}
export function validateEvmAddress(value) {
  const fail = () => { throw new Error('请输入有效的 USDT EVM 收款地址（0x 开头、40 位十六进制），并检查混合大小写校验码。'); };
  if (typeof value !== 'string') return fail();
  const address = value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/.test(address)) return fail();
  const body = address.slice(2), lower = body.toLowerCase();
  const hash = Array.from(keccak_256(encoder.encode(lower)), byte => byte.toString(16).padStart(2, '0')).join('');
  const checked = [...lower].map((character, index) => parseInt(hash[index], 16) >= 8 ? character.toUpperCase() : character).join('');
  if (body !== lower && body !== body.toUpperCase() && body !== checked) return fail();
  return '0x' + checked;
}
