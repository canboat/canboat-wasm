// Smoke tests over pinned wire vectors — ESM entry. The deep parity
// gates (byte-identity vs the native binary over live captures, delta
// parity, TX corpus sweeps) run in the canboat/signalk harnesses; this
// guards the bindings and the package entry points.
import assert from "node:assert";
import {
  Decoder,
  encodeToPlain,
  encodeData,
  version,
  FromPgn,
  toPgn,
} from "../dist/index.js";

assert.match(version(), /^\d+\.\d+\.\d+/);

// decode: Seatalk 65359 — analyzer-exact output, human description.
{
  const d = new Decoder(true, true, true, false);
  const out = d.decodeLine(
    "2017-04-15T14:57:58.468Z,7,65359,204,255,8,3b,9f,ff,ff,ff,18,60,ff",
  );
  const obj = JSON.parse(out);
  assert.ok(obj.seatalkPilotHeading, "camel wrapper key");
  assert.strictEqual(
    obj.seatalkPilotHeading.description,
    "Seatalk: Pilot Heading",
  );
  assert.strictEqual(obj.seatalkPilotHeading.fields.headingMagnetic, 2.46);
}

// decode: coalesced fast-packet line (payload > 8 bytes).
{
  const d = new Decoder(true, true, true, false);
  const out = d.decodeLine(
    "2026-08-03T22:23:33.273Z,6,126996,7,255,134,34,08,fd,70,46,4d,2d,34,38,35,30,00,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,30,35,35,30,32,35,38,2d,30,31,2e,30,31,00,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,ff,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,02,01",
  );
  assert.ok(JSON.parse(out).productInformation, "126996 decodes as one record");
}

// encode: group-function Command for a multi-variant proprietary
// target — parameter 5 must use the Furuno variant's 16-bit/0.01
// layout (canboat's encode-side variant matching).
{
  const line = encodeToPlain(
    JSON.stringify({
      pgn: 126208,
      prio: 3,
      dst: 42,
      fields: {
        "Function Code": "Command",
        PGN: 130833,
        list: [
          { parameter: 1, value: 1855 },
          { parameter: 3, value: 4 },
          { parameter: 5, value: 3.21 },
        ],
      },
    }),
    true,
  );
  assert.strictEqual(
    line,
    ",3,126208,0,42,14,01,11,ff,01,ff,03,01,3f,07,03,04,05,41,01",
  );
}

// encodeData: ISO Address Claim payload bytes (the canName source).
{
  const data = Buffer.from(
    encodeData(
      JSON.stringify({
        pgn: 60928,
        fields: {
          uniqueNumber: 1072,
          manufacturerCode: "Yacht Devices",
          deviceInstanceLower: 0,
          deviceInstanceUpper: 0,
          deviceFunction: 130,
          deviceClass: "Sensor Communication Interface",
          systemInstance: 0,
          industryGroup: "Marine Industry",
          spare: 1,
          arbitraryAddressCapable: "Yes",
        },
      }),
      true,
    ),
  );
  assert.strictEqual(data.toString("hex"), "3004a059008297c0");
}

// compat shim: canboatjs-shaped objects, Buffer toPgn.
{
  const p = new FromPgn();
  const pgn = p.parseString(
    "2017-04-15T14:58:08.982Z,6,60928,44,172,8,30,04,a0,59,00,82,97,c0",
  );
  assert.strictEqual(pgn.pgn, 60928);
  assert.strictEqual(pgn.fields.manufacturerCode, "Yacht Devices");
  assert.strictEqual(pgn.fields.uniqueNumber, 1072);
  const buf = toPgn({ pgn: 60928, fields: pgn.fields });
  assert.ok(Buffer.isBuffer(buf));
  assert.strictEqual(buf.length, 8);
}

// error path: raw API throws, shim reports via the 'error' event.
{
  const d = new Decoder(true, true, true, false);
  assert.throws(() => d.decodeLine("not a frame at all"));
  const p = new FromPgn();
  let errored = false;
  p.on("error", () => {
    errored = true;
  });
  assert.strictEqual(p.parseString("not a frame at all"), undefined);
  assert.ok(errored, "shim reports bad input via the error event");
}

// J1939 flavor: candump pretty input, EEC1 resolves in the J1939
// table (the default flavor only has the range catch-all there), and
// the shim stamps a timestamp for the timestamp-less candump shape.
{
  const p = new FromPgn({ j1939: true });
  const pgn = p.parseString("  can0  0CF00400   [8]  FF FF FF 8A 03 FF FF FF");
  assert.strictEqual(pgn.pgn, 61444);
  assert.strictEqual(pgn.description, "ECU #1");
  assert.strictEqual(pgn.fields.engineRpm, 113.2);
  assert.ok(pgn.timestamp, "candump lines get a receive timestamp");
  const n2k = new FromPgn();
  const fallback = n2k.parseString(
    "  can0  0CF00400   [8]  FF FF FF 8A 03 FF FF FF",
  );
  assert.notStrictEqual(fallback.description, "ECU #1");
}

// J1939 flavor: ISO-TP BAM reassembly (DM1 trouble codes across
// TP.CM + two TP.DT frames).
{
  const d = new Decoder(true, true, true, false, true);
  assert.strictEqual(
    d.decodeLine("  can0  1CECFF00   [8]  20 0A 00 02 FF CA FE 00"),
    undefined,
  );
  assert.strictEqual(
    d.decodeLine("  can0  1CEBFF00   [8]  01 00 FF 01 02 03 04 05"),
    undefined,
  );
  const out = d.decodeLine("  can0  1CEBFF00   [8]  02 06 07 08 FF FF FF FF");
  assert.ok(out.includes('"activeTroubleCodes"'), "BAM reassembles to DM1");
}

console.log("smoke (esm): all assertions passed");

// ByteDecoder: kind validation, init/keepalive/TX byte builders.
{
  const { ByteDecoder } = await import("../dist/index.js");
  const m = new ByteDecoder("maretron-ipg", true, true, true);
  assert.ok(m.initBytes("secret").length > 0, "maretron CONNECT bytes");
  assert.strictEqual(m.keepaliveBytes(), undefined);
  const n = new ByteDecoder("ngt1", true, true, true);
  assert.ok(n.initBytes("").length > 0, "ngt1 startup ping");
  assert.ok(n.keepaliveBytes().length > 0, "ngt1 keepalive");
  const claim = JSON.stringify({
    pgn: 60928,
    prio: 6,
    dst: 255,
    src: 0,
    fields: {
      uniqueNumber: 1072,
      manufacturerCode: "Yacht Devices",
      deviceInstanceLower: 0,
      deviceInstanceUpper: 0,
      deviceFunction: 130,
      deviceClass: "Sensor Communication Interface",
      systemInstance: 0,
      industryGroup: "Marine Industry",
      spare: 1,
      arbitraryAddressCapable: "Yes",
    },
  });
  assert.ok(
    Buffer.from(n.encodeFrame(claim, true)).length > 10,
    "ngt1 BEM tx frame",
  );
  assert.ok(
    Buffer.from(m.encodeFrame(claim, true)).length > 10,
    "maretron tx frame",
  );
  assert.throws(() => new ByteDecoder("nope", true, true, true));
}
