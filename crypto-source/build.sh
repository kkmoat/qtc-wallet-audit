#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .cargo
cp cargo-vendor-config.toml .cargo/config.toml
export CARGO_PROFILE_RELEASE_STRIP=none
# Keep machine-specific source paths out of public panic strings.
export CARGO_ENCODED_RUSTFLAGS="--remap-path-prefix=$PWD=."
if [[ -n "${CRYPTO_LLVM_LIBRARY_DIR:-}" ]]; then
  export DYLD_LIBRARY_PATH="$CRYPTO_LLVM_LIBRARY_DIR"
fi
CRYPTO_BINDGEN_BIN="${WASM_BINDGEN_BIN:-wasm-bindgen}"
if [[ "$("$CRYPTO_BINDGEN_BIN" --version)" != "wasm-bindgen 0.2.114" ]]; then
  echo 'Expected wasm-bindgen CLI 0.2.114.' >&2
  exit 1
fi
cargo test --release --locked --offline
cargo build --release --locked --offline --target wasm32-unknown-unknown
"$CRYPTO_BINDGEN_BIN" target/wasm32-unknown-unknown/release/quantus_browser_crypto.wasm --target web --out-dir pkg-web
"$CRYPTO_BINDGEN_BIN" target/wasm32-unknown-unknown/release/quantus_browser_crypto.wasm --target nodejs --out-dir pkg-node
node test-node.cjs
node test-init-sync.mjs
