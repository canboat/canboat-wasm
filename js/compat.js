// canboatjs-compatibility shim over the canboat WASM bindings: the
// drop-in surface plugins actually use — FromPgn (parseString + events),
// toPgn, pgnToActisenseSerialFormat — backed by the same Rust wire brain
// as the native `canboat` binary. Spike scope: plain/Actisense-serial
// input lines; other line formats (YDWG RAW, iKonvert) are a later
// binding, not a redesign.
'use strict'

const { EventEmitter } = require('events')
const wasm = require('../pkg/canboat_wasm.js')
const { unwrapAnalyzerOutput } = require('./vendor/analyzerOutput.js')

class FromPgn extends EventEmitter {
  constructor (options = {}) {
    super()
    // camel + name-value + SI: the lossless analyzer form, normalized
    // below to the exact canboatjs field conventions. Each instance
    // owns its fast-packet reassembler, like canboatjs.
    this.decoder = new wasm.Decoder(true, true, true, false)
    this.options = options
  }

  parseString (line) {
    if (typeof line !== 'string' || line.trim() === '') {
      return undefined
    }
    let out
    try {
      out = this.decoder.decodeLine(line)
    } catch (err) {
      this.emit('error', line, err)
      return undefined
    }
    if (out === undefined) {
      return undefined // fast-packet still assembling
    }
    const pgn = unwrapAnalyzerOutput(JSON.parse(out))
    this.emit('pgn', pgn)
    return pgn
  }
}

function toPgn (pgnObject) {
  return Buffer.from(wasm.encodeData(JSON.stringify(pgnObject), true))
}

function pgnToActisenseSerialFormat (pgnObject) {
  return wasm.encodeToPlain(JSON.stringify(pgnObject), true)
}

module.exports = {
  FromPgn,
  toPgn,
  pgnToActisenseSerialFormat,
  version: wasm.version
}
