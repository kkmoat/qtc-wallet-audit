/* tslint:disable */
/* eslint-disable */

/**
 * Holds official zeroize-on-drop keypairs. No secret accessors are exposed.
 */
export class SecretHandle {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Immediately drop and zeroize secret key material; safe to call repeatedly.
     */
    clear(): void;
    /**
     * Sign 1..=8192 raw message bytes under QTC_LISTINGS_AUTH_V1.
     * This uses a separate ML-DSA context from chain extrinsics and does not
     * apply Substrate's >256-byte hashing rule. It does not authorize a transfer.
     */
    signMessage(message: Uint8Array): Uint8Array;
    /**
     * Sign the complete SCALE SignedPayload. Performs Substrate's >256-byte hash rule.
     * It never assembles or broadcasts a transaction.
     */
    signPayload(payload: Uint8Array, spec_version: number): Uint8Array;
    readonly accountId: Uint8Array;
    readonly address: string;
    readonly cleared: boolean;
    readonly path: string;
    readonly publicKey: Uint8Array;
    readonly scheme: string;
}

/**
 * Derive the official SS58/189 qz address from a validated public key.
 * Servers must compare this address with the address bound to their challenge.
 */
export function addressFromPublicKey(public_key: Uint8Array, scheme: string): string;

export function deriveAccount(mnemonic: string, scheme: string, account_index: number): SecretHandle;

/**
 * Explicit canonical BIP44 path option for accounts created with custom HD indices.
 */
export function deriveAccountAtPath(mnemonic: string, scheme: string, path: string): SecretHandle;

/**
 * Convert caller-supplied 256-bit CSPRNG entropy to a 24-word English BIP39 backup.
 * Generate the entropy in the user's browser, never on the application server.
 * The returned mnemonic is secret; callers must not log or upload it.
 */
export function mnemonicFromEntropy(entropy: Uint8Array): string;

/**
 * Verify a raw authentication message under QTC_LISTINGS_AUTH_V1.
 * The caller remains responsible for address binding, origin, challenge expiry,
 * operation/body binding, one-time nonce consumption and session security.
 */
export function verifyMessage(public_key: Uint8Array, message: Uint8Array, signature: Uint8Array, scheme: string): boolean;

export function verifyPayload(public_key: Uint8Array, payload: Uint8Array, signature: Uint8Array, scheme: string, spec_version: number): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_secrethandle_free: (a: number, b: number) => void;
    readonly addressFromPublicKey: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly deriveAccount: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly deriveAccountAtPath: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly mnemonicFromEntropy: (a: number, b: number) => [number, number, number, number];
    readonly secrethandle_accountId: (a: number) => [number, number];
    readonly secrethandle_address: (a: number) => [number, number];
    readonly secrethandle_clear: (a: number) => void;
    readonly secrethandle_cleared: (a: number) => number;
    readonly secrethandle_path: (a: number) => [number, number];
    readonly secrethandle_publicKey: (a: number) => [number, number];
    readonly secrethandle_scheme: (a: number) => [number, number];
    readonly secrethandle_signMessage: (a: number, b: number, c: number) => [number, number, number, number];
    readonly secrethandle_signPayload: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly verifyMessage: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
    readonly verifyPayload: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
