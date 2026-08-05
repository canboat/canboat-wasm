"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ts/index.ts
var index_exports = {};
__export(index_exports, {
  Decoder: () => import_canboat_wasm2.Decoder,
  FromPgn: () => FromPgn,
  encodeData: () => import_canboat_wasm2.encodeData,
  encodeToPlain: () => import_canboat_wasm2.encodeToPlain,
  pgnToActisenseSerialFormat: () => pgnToActisenseSerialFormat,
  toPgn: () => toPgn,
  unwrapAnalyzerOutput: () => unwrapAnalyzerOutput,
  version: () => import_canboat_wasm2.version
});
module.exports = __toCommonJS(index_exports);
var import_canboat_wasm2 = require("../pkg/canboat_wasm.js");

// ts/compat.ts
var import_node_events = require("events");
var import_canboat_wasm = require("../pkg/canboat_wasm.js");

// ts/vendor/analyzerOutput.ts
var import_ts_pgns = require("@canboat/ts-pgns");
var isNameValue = (v) => typeof v === "object" && v !== null && !Array.isArray(v) && "value" in v;
var isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function fieldTypesForId(id) {
  const types = {};
  const definition = (0, import_ts_pgns.getPGNWithId)(id);
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
var FromPgn = class extends import_node_events.EventEmitter {
  decoder;
  options;
  constructor(options = {}) {
    super();
    this.decoder = new import_canboat_wasm.Decoder(true, true, true, false);
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
  return Buffer.from((0, import_canboat_wasm.encodeData)(JSON.stringify(pgnObject), true));
}
function pgnToActisenseSerialFormat(pgnObject) {
  return (0, import_canboat_wasm.encodeToPlain)(JSON.stringify(pgnObject), true);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Decoder,
  FromPgn,
  encodeData,
  encodeToPlain,
  pgnToActisenseSerialFormat,
  toPgn,
  unwrapAnalyzerOutput,
  version
});
//# sourceMappingURL=index.cjs.map