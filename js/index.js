// Public entry point. Two surfaces:
//   - the raw wasm API (Decoder, encodeToPlain, encodeData, version)
//   - the canboatjs-compatibility shim (FromPgn, toPgn,
//     pgnToActisenseSerialFormat) for drop-in use by existing consumers.
'use strict'

const wasm = require('../pkg/canboat_wasm.js')
const compat = require('./compat.js')

module.exports = {
  Decoder: wasm.Decoder,
  encodeToPlain: wasm.encodeToPlain,
  encodeData: wasm.encodeData,
  version: wasm.version,
  compat
}
