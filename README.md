# @canboat/wasm

The [canboat](https://github.com/canboat/canboat) NMEA 2000 decoder/encoder
compiled to WebAssembly. It runs in-process as an ordinary npm dependency,
with no native addon to build and no binary to download.

The Rust source is the same source the native `canboat` binary is built from,
here targeting `wasm32-unknown-unknown`. One codebase, two build targets.

## Install

```sh
npm install @canboat/wasm
```

The package version names the canboat release it compiles, so
`@canboat/wasm@8.0.0-beta3` carries the wire brain from canboat `v8.0.0-beta3`.

## Parity

Checked against the canboat and Signal K test harnesses:

- RX output is byte-identical to native `canboat convert` over a 7595-record
  live NMEA 2000 capture.
- Signal K deltas match the native analyzer baseline across the canboatjs test
  corpus.
- TX output matches the native encoder on every corpus object both can encode,
  with 1311/1311 canName byte parity against canboatjs `toPgn`.

The wasm binary is 1.55 MB (about 530 KB gzipped). Decoding costs roughly 5 µs
per line in-process, which is about 2.8× faster than canboatjs and faster than
the native binary run as a child process, since that pays pipe overhead.

## API

TypeScript types are included. The package is ESM-first with a CJS build, so
`import` and `require` both work.

```ts
import { Decoder, encodeToPlain, encodeData, version } from "@canboat/wasm";

// Stateful line decoder: plain ("Actisense serial"), YDWG RAW,
// iKonvert, Actisense ASCII … lines in (format sniffed like the
// native reader), analyzer-shaped JSON out.
//            camel  name-value  SI    coalesced
const d = new Decoder(true, true, true, false);
const json = d.decodeLine(
  "2017-04-15T14:57:58.468Z,7,65359,204,255,8,3b,9f,ff,ff,ff,18,60,ff",
);
// -> '{"seatalkPilotHeading":{...,"description":"Seatalk: Pilot Heading",...}}'

// JSON record (canboatjs or analyzer dialect) -> wire
const line = encodeToPlain(JSON.stringify(pgnObject), true);
const bytes = encodeData(JSON.stringify(pgnObject), true); // Uint8Array of the PGN payload
```

Set `coalesced` to `true` when every line is a complete record, which is what
the native converter assumes for plain text such as logs written by the canboat
gateway readers. Setting it to `false` applies the canboatjs convention, where
lines with exactly 8 payload bytes go through fast-packet reassembly.

### canboatjs-compatibility shim

```ts
import { FromPgn, toPgn, pgnToActisenseSerialFormat } from "@canboat/wasm";
```

These cover the surface most consumers use: `FromPgn` (`parseString` plus
`'pgn'` and `'error'` events, returning canboatjs-shaped objects), `toPgn`
(a Buffer of payload bytes), and `pgnToActisenseSerialFormat`.

## Scope

This package decodes and encodes. It does no I/O, so moving bytes is left to
whatever you already have: `node:net` for TCP gateways (YDWG, W2K-1, NavLink2,
IPG100), serialport for NGT-1 and iKonvert, or an `AF_CAN` wrapper for
socketcan. There is no pure-JS CAN socket, and on hardware CAN buses the native
`canboat interface` still does more for you, including address claiming, the
NAME responder, and TX chunking.

## Building

```sh
npm run build      # wasm-pack build --release --target nodejs
npm test           # pinned-vector smoke tests
```

The crate depends on `canboat-core` and the `canboat` library (`json-input`
feature) at a pinned git revision. See `Cargo.toml`.

## License

Apache-2.0, © Kees Verruijt, same as canboat.
