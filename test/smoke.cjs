// Self-contained smoke tests over pinned wire vectors — no corpus, no
// network. The deep parity gates (byte-identity vs the native binary
// over live captures, Signal K delta parity, TX corpus sweeps) run in
// the canboat/signalk harnesses; this guards the bindings.
'use strict'

const assert = require('node:assert')
const wasm = require('../pkg/canboat_wasm.js')
const compat = require('../js/compat.js')

// version() reports the compiled-in schema version
assert.match(wasm.version(), /^\d+\.\d+\.\d+/)

// decode: Seatalk 65359, camel + name-value — analyzer-exact output,
// human description (the camel wrapper key is the camel id).
{
  const d = new wasm.Decoder(true, true, true, false)
  const out = d.decodeLine(
    '2017-04-15T14:57:58.468Z,7,65359,204,255,8,3b,9f,ff,ff,ff,18,60,ff'
  )
  const obj = JSON.parse(out)
  assert.ok(obj.seatalkPilotHeading, 'camel wrapper key')
  assert.strictEqual(obj.seatalkPilotHeading.description, 'Seatalk: Pilot Heading')
  assert.strictEqual(obj.seatalkPilotHeading.fields.headingMagnetic, 2.46)
}

// decode: coalesced fast-packet line (payload > 8 bytes) decodes
// without reassembly state.
{
  const d = new wasm.Decoder(true, true, true, false)
  const out = d.decodeLine(
    '2026-08-03T22:23:33.273Z,6,126996,7,255,134,34,08,fd,70,46,4d,2d,34,38,35,30,00,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,30,35,35,30,32,35,38,2d,30,31,2e,30,31,00,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,02,01'
  )
  assert.ok(JSON.parse(out).productInformation, '126996 decodes as one record')
}

// encode: group-function Command for a multi-variant proprietary
// target — parameter 5 must use the Furuno variant's 16-bit/0.01
// layout (canboat's encode-side variant matching).
{
  const line = wasm.encodeToPlain(JSON.stringify({
    pgn: 126208, prio: 3, dst: 42,
    fields: {
      'Function Code': 'Command', PGN: 130833,
      list: [
        { parameter: 1, value: 1855 },
        { parameter: 3, value: 4 },
        { parameter: 5, value: 3.21 }
      ]
    }
  }), true)
  assert.strictEqual(
    line,
    ',3,126208,0,42,14,01,11,ff,01,ff,03,01,3f,07,03,04,05,41,01'
  )
}

// encodeData: ISO Address Claim payload bytes — the canboatjs toPgn
// contract (the canName source bytes).
{
  const data = Buffer.from(wasm.encodeData(JSON.stringify({
    pgn: 60928,
    fields: {
      uniqueNumber: 1072, manufacturerCode: 'Yacht Devices',
      deviceInstanceLower: 0, deviceInstanceUpper: 0, deviceFunction: 130,
      deviceClass: 'Sensor Communication Interface', systemInstance: 0,
      industryGroup: 'Marine Industry', spare: 1, arbitraryAddressCapable: 'Yes'
    }
  }), true))
  assert.strictEqual(data.toString('hex'), '3004a059008297c0')
}

// compat shim: FromPgn returns canboatjs-shaped objects; toPgn returns
// a Buffer of the payload bytes.
{
  const p = new compat.FromPgn()
  const pgn = p.parseString(
    '2017-04-15T14:58:08.982Z,6,60928,44,172,8,30,04,a0,59,00,82,97,c0'
  )
  assert.strictEqual(pgn.pgn, 60928)
  assert.strictEqual(pgn.fields.manufacturerCode, 'Yacht Devices')
  assert.strictEqual(pgn.fields.uniqueNumber, 1072)
  const buf = compat.toPgn({ pgn: 60928, fields: pgn.fields })
  assert.ok(Buffer.isBuffer(buf))
  assert.strictEqual(buf.length, 8)
}

// error path: garbage input throws on the raw API, is an 'error' event
// (not an exception) on the shim.
{
  const d = new wasm.Decoder(true, true, true, false)
  assert.throws(() => d.decodeLine('not a frame at all'))
  const p = new compat.FromPgn()
  let errored = false
  p.on('error', () => { errored = true })
  assert.strictEqual(p.parseString('not a frame at all'), undefined)
  assert.ok(errored, 'shim reports bad input via the error event')
}

console.log('smoke: all assertions passed')
