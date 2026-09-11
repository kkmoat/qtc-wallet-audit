# Receiving-address validation source

The address checks are separate from the unchanged Quantus wallet WASM.
Source: /source/receiving-address-validation.mjs (GPL-3.0-or-later).
Browser/server bundle: /crypto/address-checks.mjs.
Readable signing protocol modules: /crypto/domain.mjs and /crypto/settlement.mjs.
MIT dependency notices: /crypto/address-checks.LICENSE.txt.

Using Node.js 24 in an empty directory, save the source file as address-validation-source.mjs, then run:

```sh
npm init -y
npm install --ignore-scripts --save-exact @noble/hashes@2.4.0 @scure/base@2.4.0 esbuild@0.28.2
node --input-type=module -e "import {build} from 'esbuild'; await build({entryPoints:['address-validation-source.mjs'],outfile:'address-checks.mjs',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof'});"
```

This checks public address encodings and checksums only. It does not prove address ownership or token/network support by a receiving wallet. No keys, RPC calls, or transfers are used.
