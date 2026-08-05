//! Dev harness: render a canboat PLAIN capture as the NGT-1 *serial*
//! byte stream (BEM `N2K_MSG_RECEIVED` records, DLE framing, checksum)
//! — what an Actisense NGT-1 emits on its serial port. Feeds the
//! serial-transport e2e over a pty pair.
//!
//! Usage: cargo run --example make_ngt_stream <capture.txt> > stream.bin

use std::io::Write;

use canboat_core::format::ngt1::{N2K_MSG_RECEIVED, encode_ngt_message};
use canboat_core::format::plain;

fn main() {
    let path = std::env::args()
        .nth(1)
        .expect("usage: make_ngt_stream <capture>");
    let text = std::fs::read_to_string(path).expect("read capture");
    let stdout = std::io::stdout();
    let mut out = stdout.lock();
    let mut buf = Vec::with_capacity(512);
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Ok(frame) = plain::parse_line(line) else {
            continue;
        };
        // Synthetic canboat-internal PGNs never appear on a real wire.
        if frame.pgn >= 0x40000 {
            continue;
        }
        // 0x93 payload: prio, pgn (3 LE), dst, src, ts (4 LE), len, data.
        let mut payload = Vec::with_capacity(11 + frame.data.len());
        payload.push(frame.prio);
        payload.extend_from_slice(&frame.pgn.to_le_bytes()[..3]);
        payload.push(frame.dst);
        payload.push(frame.src);
        payload.extend_from_slice(&0u32.to_le_bytes());
        payload.push(frame.data.len() as u8);
        payload.extend_from_slice(&frame.data);
        buf.clear();
        encode_ngt_message(N2K_MSG_RECEIVED, &payload, &mut buf);
        out.write_all(&buf).expect("write");
    }
}
