# Rebuild

The verified build used Rust 1.98.1, `wasm32-unknown-unknown`, wasm-bindgen CLI 0.2.114 and Node.js on macOS arm64. The source uses no Apple APIs. `Cargo.lock` and `vendor/` pin all dependencies and include their license files. Rust, its target standard library and the wasm-bindgen CLI are build tools; install them separately from their official distributions.

With `cargo` and `wasm-bindgen` on `PATH`:

```sh
./build.sh
```

Or run the same commands individually:

```sh
mkdir -p .cargo
cp cargo-vendor-config.toml .cargo/config.toml
export CARGO_ENCODED_RUSTFLAGS="--remap-path-prefix=$PWD=."
CARGO_PROFILE_RELEASE_STRIP=none cargo test --release --locked --offline
CARGO_PROFILE_RELEASE_STRIP=none cargo build --release --locked --offline --target wasm32-unknown-unknown
wasm-bindgen target/wasm32-unknown-unknown/release/quantus_browser_crypto.wasm --target web --out-dir pkg-web
wasm-bindgen target/wasm32-unknown-unknown/release/quantus_browser_crypto.wasm --target nodejs --out-dir pkg-node
node test-node.cjs
node test-init-sync.mjs
```

`build.sh` accepts the optional `WASM_BINDGEN_BIN` environment variable for an explicit CLI path. The CLI version must match wasm-bindgen 0.2.114 in Cargo.lock. On macOS, manually relocated Rust toolchains may require `CRYPTO_LLVM_LIBRARY_DIR` pointing to that toolchain's `lib` directory. The script sets `DYLD_LIBRARY_PATH` internally so `rust-lld` can find `libLLVM.dylib`; normal installed toolchains typically do not need this.

Serve the generated web JS and WASM together. For Cloudflare Workers, import the WASM as a compiled module and pass `initSync({module: wasmModule})`; see README. Actual `initSync` execution passed in Node, but the integrating application must test its deployed Worker environment. These local functional tests are not an independent audit or a claim of byte-identical reproducible builds across toolchains/platforms.

`qtc-market-crypto-source.zip` contains source and dependencies, excluding build caches, local toolchains, compiled artifacts and private data. `SHA256SUMS` covers the distributed artifacts and source archive, not itself.
