// canboatjs-compatibility shim over the canboat WASM bindings: the
// drop-in surface plugins actually use — FromPgn (parseString + events),
// toPgn, pgnToActisenseSerialFormat — backed by the same Rust wire brain
// as the native `canboat` binary. Scope: plain/Actisense-serial, YDWG
// RAW, iKonvert and Actisense-ASCII input lines (format sniffed, like
// the native reader).
import { EventEmitter } from "node:events";
import { Decoder, encodeData, encodeToPlain } from "../pkg/canboat_wasm.js";
import { unwrapAnalyzerOutput } from "./vendor/analyzerOutput.js";

/** A decoded PGN in canboatjs field conventions. */
export interface PgnObject {
  pgn: number;
  prio?: number;
  src?: number;
  dst?: number;
  timestamp?: string;
  description?: string;
  fields: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FromPgnOptions {
  /** Accepted for canboatjs signature compatibility; camelCase output
   * is always on — it is the convention the whole pipeline expects. */
  useCamel?: boolean;
}

export class FromPgn extends EventEmitter {
  private readonly decoder: Decoder;
  readonly options: FromPgnOptions;

  constructor(options: FromPgnOptions = {}) {
    super();
    // camel + name-value + SI: the lossless analyzer form, normalized
    // below to the exact canboatjs field conventions. Each instance
    // owns its fast-packet reassembler, like canboatjs.
    this.decoder = new Decoder(true, true, true, false);
    this.options = options;
  }

  parseString(line: string): PgnObject | undefined {
    if (typeof line !== "string" || line.trim() === "") {
      return undefined;
    }
    let out: string | undefined;
    try {
      out = this.decoder.decodeLine(line);
    } catch (err) {
      this.emit("error", line, err);
      return undefined;
    }
    if (out === undefined) {
      return undefined; // fast-packet still assembling
    }
    const pgn = unwrapAnalyzerOutput(JSON.parse(out)) as PgnObject;
    this.emit("pgn", pgn);
    return pgn;
  }
}

/** Encode a PGN object and return its payload bytes — the canboatjs
 * `toPgn` contract. */
export function toPgn(pgnObject: PgnObject): Buffer {
  return Buffer.from(encodeData(JSON.stringify(pgnObject), true));
}

/** Encode a PGN object as a plain-format ("Actisense serial") line. */
export function pgnToActisenseSerialFormat(pgnObject: PgnObject): string {
  return encodeToPlain(JSON.stringify(pgnObject), true);
}
