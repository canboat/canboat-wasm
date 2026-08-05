// ts/index.ts
import {
  Decoder as Decoder2,
  TxEncoder,
  encodeToPlain as encodeToPlain2,
  encodeData as encodeData2,
  version
} from "../pkg/canboat_wasm.js";

// ts/compat.ts
import { EventEmitter } from "events";
import { Decoder, encodeData, encodeToPlain } from "../pkg/canboat_wasm.js";

// ts/vendor/analyzerOutput.ts
import { getPGNWithId } from "@canboat/ts-pgns";
var isNameValue = (v) => typeof v === "object" && v !== null && !Array.isArray(v) && "value" in v;
var isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function fieldTypesForId(id) {
  const types = {};
  const definition = getPGNWithId(id);
  if (definition) {
    for (const field of definition.Fields) {
      types[field.Id] = field.FieldType;
    }
  }
  return types;
}
var isSpareOrReserved = (fieldType) => fieldType === "SPARE" || fieldType === "RESERVED";
function normalizeValue(value, fieldType, types) {
  if (Array.isArray(value)) {
    if (fieldType === "BITLOOKUP") {
      return value.map((entry) => isNameValue(entry) ? entry.name : entry).filter((name) => typeof name === "string");
    }
    return value.map(
      (entry) => isNameValue(entry) ? entry.name ?? entry.value : isPlainObject(entry) ? normalizeFields(entry, types) : entry
    );
  }
  if (isNameValue(value)) {
    return fieldType === "INDIRECT_LOOKUP" ? value.value : value.name ?? value.value;
  }
  if (isPlainObject(value)) {
    return normalizeFields(value, types);
  }
  return value;
}
function normalizeFields(fields, types) {
  const result = {};
  for (const [id, value] of Object.entries(fields)) {
    result[id] = normalizeValue(value, types[id], types);
  }
  return result;
}
function unwrapAnalyzerOutput(parsed) {
  const keys = Object.keys(parsed);
  const id = keys.length === 1 ? keys[0] : void 0;
  if (id === void 0) {
    return parsed;
  }
  const inner = parsed[id];
  if (!isPlainObject(inner) || typeof inner.pgn !== "number") {
    return parsed;
  }
  const types = fieldTypesForId(id);
  const result = { ...inner };
  const fields = isPlainObject(inner.fields) ? normalizeFields(inner.fields, types) : {};
  for (const [fieldId, fieldType] of Object.entries(types)) {
    if (isSpareOrReserved(fieldType) && !(fieldId in fields)) {
      fields[fieldId] = 0;
    }
    if (fieldType === "BITLOOKUP" && !(fieldId in fields)) {
      fields[fieldId] = [];
    }
  }
  result.fields = fields;
  return result;
}

// ts/compat.ts
var FromPgn = class extends EventEmitter {
  decoder;
  options;
  constructor(options = {}) {
    super();
    this.decoder = new Decoder(true, true, true, false);
    this.options = options;
  }
  parseString(line) {
    if (typeof line !== "string" || line.trim() === "") {
      return void 0;
    }
    let out;
    try {
      out = this.decoder.decodeLine(line);
    } catch (err) {
      this.emit("error", line, err);
      return void 0;
    }
    if (out === void 0) {
      return void 0;
    }
    const pgn = unwrapAnalyzerOutput(JSON.parse(out));
    this.emit("pgn", pgn);
    return pgn;
  }
};
function toPgn(pgnObject) {
  return Buffer.from(encodeData(JSON.stringify(pgnObject), true));
}
function pgnToActisenseSerialFormat(pgnObject) {
  return encodeToPlain(JSON.stringify(pgnObject), true);
}
export {
  Decoder2 as Decoder,
  FromPgn,
  TxEncoder,
  encodeData2 as encodeData,
  encodeToPlain2 as encodeToPlain,
  pgnToActisenseSerialFormat,
  toPgn,
  unwrapAnalyzerOutput,
  version
};
//# sourceMappingURL=index.js.map