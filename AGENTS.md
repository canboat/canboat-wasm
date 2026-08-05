# AGENTS.md

Conventions for agents (and humans) working on this repository.

## What this is

The [canboat](https://github.com/canboat/canboat) NMEA 2000
decoder/encoder compiled to WebAssembly and wrapped for npm. **This repo
contains no protocol logic of its own** — the wire brain is the canboat
Rust workspace, consumed as a git dependency pinned by revision in
`Cargo.toml`. One codebase, two build targets: anything about PGN
decoding/encoding belongs upstream in canboat (usually in its
`database/` YAML), never here.

## Layout

- `src/lib.rs` — the wasm-bindgen bindings (Decoder with format
  sniffing + fast-packet reassembly, encodeToPlain/encodeData).
- `ts/` — strict TypeScript wrapper: public entry (`index.ts`), the
  canboatjs-compatibility shim (`compat.ts`), and the vendored
  analyzer-output normalizer (`ts/vendor/`, Apache-2.0 from Signal K).
- `pkg/` — wasm-pack output (generated, gitignored).
- `dist/` — tsup dual ESM/CJS output (generated, gitignored).
- `test/smoke.mjs` + `test/smoke.cjs` — pinned wire vectors against
  both package entries.

## Invariants

- **Parity is the contract.** The wasm output must stay byte-identical
  to the native `canboat` binary. The deep gates (RX byte-identity over
  a live capture, Signal K delta parity, TX corpus sweep, canName byte
  parity) live in the canboat/signalk harnesses; the smoke tests here
  pin representative vectors. If a change alters any smoke vector,
  that is a finding to explain, not a fixture to update.
- **Strict TypeScript, dual ESM/CJS.** `tsc` (strict,
  `noUncheckedIndexedAccess`) must pass; tsup emits both formats plus
  declarations; both smoke suites must pass. The wasm-pack glue stays
  a CJS runtime module loaded externally — never bundle it.
- **The Cargo pin is deliberate.** Bump the `rev` consciously (it
  changes the compiled brain) and say so in the commit message. Once
  the wasm32 prerequisites are merged upstream, the pin moves to
  `canboat/canboat`.
- **Publishing is tag-triggered CI, never a laptop.** Pushing a
  `vX.Y.Z` tag publishes to npm via OIDC trusted publishing and cuts a
  GitHub Release with generated notes. Prerelease versions publish
  under the `next` dist-tag and never move `latest`.

## Workflow

- Conventional commits (`feat:`, `fix:`, `refactor:`, `ci:`, …); PR
  titles likewise — release notes are generated from them.
- `npm run format` before committing TS/JS/MD changes; CI runs the
  read-only `ci-lint` and rejects drift. Rust side: `cargo fmt` and
  clippy with `-D warnings`.
- Full local check: `npm run build && npm run typecheck && npm test`.
- No hand-written changelog — the Releases page is the changelog.
