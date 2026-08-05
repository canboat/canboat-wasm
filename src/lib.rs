// (C) 2009-2026, Kees Verruijt, Harlingen, The Netherlands.

//! WebAssembly bindings for the canboat decoder/encoder.
//!
//! The npm-facing surface of the one wire brain: an in-process,
//! no-native-addon decode/encode path for JavaScript consumers, sharing
//! byte-identical output code with the native `canboat` binary (same
//! JSON writer, same encoder, same schema tables).
//!
//! Strings cross the boundary, not object graphs: [`Decoder::decode_line`]
//! returns the analyzer-shaped JSON line for `JSON.parse` on the JS side.
//! That keeps u64-width values exact and guarantees parity with
//! `canboat convert` for free.

use canboat_core::output::json::{CamelCase, JsonOptions, write_json};
use canboat_core::{
    FramePacketType, PacketType, PgnDatabase, RawFrame, Reassembled, Reassembler, Units, format,
};
use wasm_bindgen::prelude::*;

/// The canboat schema version compiled into this build.
#[wasm_bindgen]
pub fn version() -> String {
    canboat_core::CANBOAT_JSON_VERSION.to_string()
}

fn database(si: bool) -> &'static PgnDatabase {
    PgnDatabase::embedded(if si { Units::Si } else { Units::Metric })
}

/// Stateful line decoder: plain-format ("Actisense serial") lines in,
/// analyzer-shaped JSON lines out. Owns a fast-packet reassembler, so
/// multi-frame PGNs decode once complete — feed lines in bus order,
/// exactly like canboatjs' `FromPgn`.
#[wasm_bindgen]
pub struct Decoder {
    db: &'static PgnDatabase,
    reasm: Reassembler,
    opts: JsonOptions,
    /// Every line is an already-coalesced record (`# format=FAST`
    /// header seen): skip reassembly entirely. Without the header, a
    /// coalesced fast-packet that fits 8 bytes is indistinguishable
    /// from a wire fragment.
    coalesced: bool,
    /// Line format, sniffed from the first parseable line and then
    /// sticky — mirrors canboat-io's LineFrameReader.
    active: Option<format::InputFormat>,
}

#[wasm_bindgen]
impl Decoder {
    /// `camel`: field keys + wrapper as camelCase ids (`-camel`).
    /// `name_value`: lookups as `{"value":N,"name":"…"}` (`-nv`).
    /// `si`: SI units (`-si`) — what canboatjs and signalk-server use.
    /// `coalesced`: every line is a complete record (what the native
    /// `canboat convert` assumes for plain text); false enables the
    /// canboatjs-style heuristic — lines with more than 8 payload
    /// bytes are complete, 8-and-under go through fast-packet
    /// reassembly.
    #[wasm_bindgen(constructor)]
    pub fn new(camel: bool, name_value: bool, si: bool, coalesced: bool) -> Decoder {
        Decoder {
            db: database(si),
            reasm: Reassembler::new(),
            opts: JsonOptions {
                name_value,
                camel_case: if camel {
                    CamelCase::Lower
                } else {
                    CamelCase::Off
                },
                ..JsonOptions::default()
            },
            coalesced,
            active: None,
        }
    }

    /// Decode one plain-format line. Returns the JSON record once a
    /// complete PGN is available, `undefined` while a fast-packet is
    /// still assembling, and throws (as a JS exception carrying the
    /// message) on unparseable input or undecodable frames.
    #[wasm_bindgen(js_name = decodeLine)]
    pub fn decode_line(&mut self, line: &str) -> Result<Option<String>, JsError> {
        let line = line.trim();
        // Comment lines are not frames; the FAST-format header flips
        // this decoder into coalesced mode for the rest of the stream.
        if line.is_empty() || line.starts_with('#') {
            if line.contains("format=FAST") {
                self.coalesced = true;
            }
            return Ok(None);
        }
        // Sniff the line format once and stick with it, exactly like
        // canboat-io's LineFrameReader (plain when nothing matches).
        let fmt = match self.active {
            Some(f) => f,
            None => {
                let f = format::detect(line).unwrap_or(format::InputFormat::Plain);
                self.active = Some(f);
                f
            }
        };
        let frame = match format::parse_with(fmt, line) {
            Ok(Some(f)) => f,
            // Control sentences / headers of the active format.
            Ok(None) => return Ok(None),
            Err(e) => return Err(JsError::new(&format!("parse: {e}"))),
        };
        // Which lines are complete records vs wire frames needing
        // reassembly is a property of the format. Plain is ambiguous:
        // a wire frame is always exactly 8 padded bytes, so any other
        // length is a complete record; only 8-byte lines of fast PGNs
        // go through the reassembler — the same convention canboatjs
        // uses. (An 8-byte *coalesced* fast-packet is misread by both;
        // pass `coalesced` when the stream is known to be complete
        // records, as the native converter assumes.)
        let complete = match fmt {
            format::InputFormat::Ydwg02 | format::InputFormat::Airmar => false,
            format::InputFormat::Plain | format::InputFormat::PlainMixFast => {
                self.coalesced || frame.data.len() != 8
            }
            // Actisense ASCII, iKonvert, Chetco, Garmin CSV all carry
            // complete payloads per line.
            _ => true,
        };
        let assembled = if complete {
            frame
        } else {
            let packet_type = self
                .db
                .first_pgn(frame.pgn)
                .or_else(|| self.db.fallback_pgn(frame.pgn))
                .map(|p| match p.packet_type {
                    PacketType::Fast => FramePacketType::Fast,
                    PacketType::Single => FramePacketType::Single,
                    _ => FramePacketType::Other,
                })
                .unwrap_or(FramePacketType::Other);
            match self.reasm.push(frame, packet_type) {
                Reassembled::PassThrough(f) | Reassembled::Complete(f) => f,
                Reassembled::Partial => return Ok(None),
                Reassembled::Error(e) => {
                    return Err(JsError::new(&format!("reassembly: {e}")));
                }
            }
        };
        let decoded = self
            .db
            .decode(&assembled)
            .map_err(|e| JsError::new(&format!("decode: {e}")))?;
        let mut out = String::with_capacity(256);
        write_json(&mut out, &decoded, &self.opts)
            .map_err(|e| JsError::new(&format!("format: {e}")))?;
        Ok(Some(out))
    }
}

fn frame_from_json_str(json: &str, si: bool) -> Result<RawFrame, JsError> {
    match canboat::json_input::frame_from_json(database(si), json.trim()) {
        Ok(Some(frame)) => Ok(frame),
        Ok(None) => Err(JsError::new("record is synthetic (no wire form)")),
        Err(e) => Err(JsError::new(&format!("{e:#}"))),
    }
}

/// Encode one analyzer/canboatjs-shaped JSON record to a plain-format
/// line (the inverse of [`Decoder::decode_line`]). `si` must match the
/// units the record's values are in.
#[wasm_bindgen(js_name = encodeToPlain)]
pub fn encode_to_plain(json: &str, si: bool) -> Result<String, JsError> {
    let frame = frame_from_json_str(json, si)?;
    let mut out = String::with_capacity(64);
    format::plain::write_line(&mut out, &frame)
        .map_err(|e| JsError::new(&format!("format: {e}")))?;
    Ok(out)
}

/// Encode one JSON record and return just the PGN payload bytes —
/// what canboatjs' `toPgn` returns.
#[wasm_bindgen(js_name = encodeData)]
pub fn encode_data(json: &str, si: bool) -> Result<Vec<u8>, JsError> {
    Ok(frame_from_json_str(json, si)?.data.to_vec())
}

/// Stateful TX encoder: analyzer/canboatjs-shaped JSON records in,
/// gateway-dialect wire lines out. Stateful because YDWG RAW transmits
/// wire frames — a fast-packet payload leaves as multiple 8-byte
/// frames whose sequence counter must advance per (pgn, dst) between
/// sends, like any real transmitter.
#[wasm_bindgen]
pub struct TxEncoder {
    si: bool,
    seqs: std::collections::HashMap<(u32, u8), u8>,
}

#[wasm_bindgen]
impl TxEncoder {
    /// `si`: the unit system the JSON records' values are in.
    #[wasm_bindgen(constructor)]
    pub fn new(si: bool) -> TxEncoder {
        TxEncoder {
            si,
            seqs: std::collections::HashMap::new(),
        }
    }

    /// Encode one record for `format`: `"plain"` (Actisense serial) and
    /// `"n2k-ascii"` (Actisense W2K-1 ASCII) yield one coalesced line;
    /// `"ydwg-raw"` yields one line per wire frame, fragmenting
    /// fast-packet payloads per ISO 11783-3.
    pub fn encode(&mut self, json: &str, format_name: &str) -> Result<Vec<String>, JsError> {
        let frame = frame_from_json_str(json, self.si)?;
        let mut line = String::with_capacity(64);
        match format_name {
            "plain" => {
                format::plain::write_line(&mut line, &frame)
                    .map_err(|e| JsError::new(&format!("format: {e}")))?;
                Ok(vec![line])
            }
            "n2k-ascii" => {
                format::actisense_ascii::write_line(&mut line, &frame)
                    .map_err(|e| JsError::new(&format!("format: {e}")))?;
                Ok(vec![line])
            }
            "ydwg-raw" => {
                use canboat_io::fastpacket;
                use std::fmt::Write as _;
                // The device's transmit shape is a bare `<CANID> <bytes…>`
                // line — no timestamp, no direction marker — exactly what
                // the native line_gateway encoder writes.
                let canid = format::iso11783_compose(frame.prio, frame.pgn, frame.src, frame.dst);
                let write_one = |data: &[u8]| {
                    let mut l = String::with_capacity(40);
                    let _ = write!(l, "{canid:08X}");
                    for b in data {
                        let _ = write!(l, " {b:02X}");
                    }
                    l
                };
                if fastpacket::packet_type(frame.pgn) != FramePacketType::Fast {
                    return Ok(vec![write_one(&frame.data)]);
                }
                let seq = {
                    let slot = self.seqs.entry((frame.pgn, frame.src)).or_insert(0);
                    let s = *slot;
                    *slot = (s + 1) & 0x07;
                    s
                };
                Ok(fastpacket::fragment(seq, &frame.data)
                    .iter()
                    .map(|chunk| write_one(&chunk[..]))
                    .collect())
            }
            other => Err(JsError::new(&format!(
                "unknown TX format '{other}' (plain | n2k-ascii | ydwg-raw)"
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ydwg_lines_do_not_panic() {
        let mut d = Decoder::new(true, true, true, false);
        let lines = [
            "17:29:52.256 R 19F9050A 20 59 01 00 03 00 00 00",
            "17:29:52.256 R 19F9050A 21 00 00 00 00 00 00 00",
        ];
        for l in lines {
            let _ = d.decode_line(l);
        }
    }
}
