//! Dev harness: render a canboat PLAIN capture as the NGT-1 *serial*
//! byte stream (BEM `N2K_MSG_RECEIVED` records, DLE framing, checksum)
//! — what an Actisense NGT-1 emits on its serial port. Feeds the
//! serial-transport e2e over a pty pair.
//!
//! Usage: cargo run --example make_ngt_stream <capture.txt> > stream.bin

use std::io::Write;

use canboat::codec::line::{self, InputFormat};
use canboat::codec::ngt1::encode_received;

fn main() {
    let path = std::env::args()
        .nth(1)
        .expect("usage: make_ngt_stream <capture>");
    let text = std::fs::read_to_string(path).expect("read capture");
    let stdout = std::io::stdout();
    let mut out = stdout.lock();
    for text_line in text.lines() {
        let text_line = text_line.trim();
        if text_line.is_empty() || text_line.starts_with('#') {
            continue;
        }
        let Ok(Some(frame)) = line::parse(InputFormat::Plain, text_line) else {
            continue;
        };
        // Synthetic canboat-internal PGNs never appear on a real wire.
        if frame.pgn >= 0x40000 {
            continue;
        }
        // More data than one NGT-1 message carries (> 244 bytes).
        let Some(bytes) = encode_received(&frame, 0) else {
            continue;
        };
        out.write_all(&bytes).expect("write");
    }
}
