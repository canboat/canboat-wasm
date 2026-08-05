export { Decoder, TxEncoder, encodeData, encodeToPlain, version } from '../pkg/canboat_wasm.js';
import { EventEmitter } from 'node:events';

/** A decoded PGN in canboatjs field conventions. */
interface PgnObject {
    pgn: number;
    prio?: number;
    src?: number;
    dst?: number;
    timestamp?: string;
    description?: string;
    fields: Record<string, unknown>;
    [key: string]: unknown;
}
interface FromPgnOptions {
    /** Accepted for canboatjs signature compatibility; camelCase output
     * is always on — it is the convention the whole pipeline expects. */
    useCamel?: boolean;
}
declare class FromPgn extends EventEmitter {
    private readonly decoder;
    readonly options: FromPgnOptions;
    constructor(options?: FromPgnOptions);
    parseString(line: string): PgnObject | undefined;
}
/** Encode a PGN object and return its payload bytes — the canboatjs
 * `toPgn` contract. */
declare function toPgn(pgnObject: PgnObject): Buffer;
/** Encode a PGN object as a plain-format ("Actisense serial") line. */
declare function pgnToActisenseSerialFormat(pgnObject: PgnObject): string;

/**
 * Turn one parsed line of `analyzer -json -si -camel -nv` output into the
 * flat, canboatjs-shaped PGN object the downstream pipeline expects.
 * Passes through anything that is not a single-key camel envelope (already
 * flat output from a pre-v6 analyzer, or unrecognised shapes) unchanged.
 */
declare function unwrapAnalyzerOutput(parsed: Record<string, unknown>): Record<string, unknown>;

export { FromPgn, type FromPgnOptions, type PgnObject, pgnToActisenseSerialFormat, toPgn, unwrapAnalyzerOutput };
