// CJS interop: the same package surface must work through require().
'use strict'
const assert = require('node:assert')
const { Decoder, FromPgn, toPgn, version } = require('../dist/index.cjs')

assert.match(version(), /^\d+\.\d+\.\d+/)
const d = new Decoder(true, true, true, false)
const out = d.decodeLine(
  '2017-04-15T14:57:58.468Z,7,65359,204,255,8,3b,9f,ff,ff,ff,18,60,ff'
)
assert.strictEqual(JSON.parse(out).seatalkPilotHeading.description, 'Seatalk: Pilot Heading')

const p = new FromPgn()
const pgn = p.parseString(
  '2017-04-15T14:58:08.982Z,6,60928,44,172,8,30,04,a0,59,00,82,97,c0'
)
assert.strictEqual(pgn.fields.manufacturerCode, 'Yacht Devices')
assert.strictEqual(toPgn({ pgn: 60928, fields: pgn.fields }).toString('hex'), '3004a059008297c0')

console.log('smoke (cjs): all assertions passed')
