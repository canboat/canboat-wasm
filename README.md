# canboat-wasm

The [canboat](https://github.com/canboat/canboat) NMEA 2000
decoder/encoder compiled to WebAssembly: the canboat wire brain as a
pure-npm, in-process package — no native addon, no binary download.

This is **the same Rust code** as the native `canboat` binary, compiled
for `wasm32-unknown-unknown`. Not a port, not a re-implementation: one
codebase, two build targets, byte-identical output.

## Status

Working, verified, **not yet published to npm**. Verified against the
canboat/signalk test harnesses:

- RX **byte-identical** to the native `canboat convert` across a
  7595-record live NMEA 2000 capture.
- Signal K delta parity equal to the native analyzer baseline over the
  canboatjs test corpus.
- TX identical to the native encoder on every corpus object both can
  encode; 1311/1311 canName byte parity vs canboatjs `toPgn`.
- ~1.4 MB wasm (≈470 KB gzipped). Decode throughput ≈5 µs/line
  in-process — ~2.8× faster than canboatjs, and ahead of the native
  binary running as a child process (which pays pipe overhead).

## API

```js
const { Decoder, encodeToPlain, encodeData, version, compat } =
  require('@canboat/wasm')

// Stateful line decoder: plain ("Actisense serial"), YDWG RAW,
// iKonvert, Actisense ASCII … lines in (format sniffed like the
// native reader), analyzer-shaped JSON out.
//            camel  name-value  SI    coalesced
const d = new Decoder(true, true, true, false)
const json = d.decodeLine('2017-04-15T14:57:58.468Z,7,65359,204,255,8,3b,9f,ff,ff,ff,18,60,ff')
// -> '{"seatalkPilotHeading":{...,"description":"Seatalk: Pilot Heading",...}}'

// JSON record (canboatjs or analyzer dialect) -> wire
const line  = encodeToPlain(JSON.stringify(pgnObject), true)
const bytes = encodeData(JSON.stringify(pgnObject), true) // Uint8Array of the PGN payload
```

`coalesced`: pass `true` when every line is a complete record (what the
native converter assumes for plain text, e.g. logs written by the
canboat gateway readers); `false` applies the canboatjs convention —
lines with exactly 8 payload bytes go through fast-packet reassembly.

### canboatjs-compatibility shim

```js
const { FromPgn, toPgn, pgnToActisenseSerialFormat } =
  require('@canboat/wasm').compat
```

Drop-in for the surface most consumers use: `FromPgn` (`parseString` +
`'pgn'`/`'error'` events, canboatjs-shaped output objects), `toPgn`
(Buffer of payload bytes), `pgnToActisenseSerialFormat`.

## Scope

This package is a **brain, not a transport**: it has no I/O. Bytes are
moved by whatever you have — `node:net` for TCP gateways (YDWG, W2K-1,
NavLink2, IPG100), serialport for NGT-1/iKonvert, an `AF_CAN` wrapper
for socketcan (there is no pure-JS CAN socket; on hardware CAN buses
the native `canboat interface` remains the batteries-included choice —
address claiming, NAME responder, TX chunking).

## Building

```sh
npm run build      # wasm-pack build --release --target nodejs
npm test           # pinned-vector smoke tests
```

The crate depends on `canboat-core` and the `canboat` library
(`json-input` feature) via a pinned git revision — see `Cargo.toml`.

## License

Apache-2.0, © Kees Verruijt — same as canboat.
