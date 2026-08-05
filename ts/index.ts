// Public entry point. Two surfaces:
//   - the raw wasm API (Decoder, encodeToPlain, encodeData, version)
//   - the canboatjs-compatibility shim (FromPgn, toPgn,
//     pgnToActisenseSerialFormat) for drop-in use by existing consumers.
export {
  Decoder,
  encodeToPlain,
  encodeData,
  version,
} from "../pkg/canboat_wasm.js";

export {
  FromPgn,
  toPgn,
  pgnToActisenseSerialFormat,
  type PgnObject,
  type FromPgnOptions,
} from "./compat.js";

export { unwrapAnalyzerOutput } from "./vendor/analyzerOutput.js";
