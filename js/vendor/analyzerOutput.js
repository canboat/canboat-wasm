// Vendored for the spike from signalk-server packages/streams/dist/analyzerOutput.js
// (Apache-2.0, SignalK project) — the battle-tested analyzer→canboatjs-shape
// normalizer, live-verified in the dirkwa image. A real package would port this.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unwrapAnalyzerOutput = unwrapAnalyzerOutput;
const ts_pgns_1 = require("@canboat/ts-pgns");
const isNameValue = (v) => typeof v === 'object' && v !== null && !Array.isArray(v) && 'value' in v;
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
function fieldTypesForId(id) {
    const types = {};
    const definition = (0, ts_pgns_1.getPGNWithId)(id);
    if (definition) {
        for (const field of definition.Fields) {
            types[field.Id] = field.FieldType;
        }
    }
    return types;
}
const isSpareOrReserved = (fieldType) => fieldType === 'SPARE' || fieldType === 'RESERVED';
function normalizeValue(value, fieldType, types) {
    if (Array.isArray(value)) {
        if (fieldType === 'BITLOOKUP') {
            // canboatjs renders a bit lookup as the names of the set bits and
            // yields [] when no named bit is set (incl. the all-ones
            // "unavailable" pattern); entries whose bit has no enumeration name
            // are therefore dropped rather than kept as raw numbers.
            return value
                .map((entry) => (isNameValue(entry) ? entry.name : entry))
                .filter((name) => typeof name === 'string');
        }
        return value.map((entry) => isNameValue(entry)
            ? (entry.name ?? entry.value)
            : isPlainObject(entry)
                ? normalizeFields(entry, types)
                : entry);
    }
    if (isNameValue(value)) {
        return fieldType === 'INDIRECT_LOOKUP'
            ? value.value
            : (value.name ?? value.value);
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
/**
 * Turn one parsed line of `analyzer -json -si -camel -nv` output into the
 * flat, canboatjs-shaped PGN object the downstream pipeline expects.
 * Passes through anything that is not a single-key camel envelope (already
 * flat output from a pre-v6 analyzer, or unrecognised shapes) unchanged.
 */
function unwrapAnalyzerOutput(parsed) {
    const keys = Object.keys(parsed);
    const id = keys.length === 1 ? keys[0] : undefined;
    if (id === undefined) {
        return parsed;
    }
    const inner = parsed[id];
    if (!isPlainObject(inner) || typeof inner.pgn !== 'number') {
        return parsed;
    }
    const types = fieldTypesForId(id);
    const result = { ...inner };
    // A message whose fields are all empty (e.g. a Configuration Information
    // with blank strings) arrives with no fields object at all — the analyzer
    // skips empty values wholesale. canboatjs always emits a fields object,
    // and n2k-signalk's meta-PGN handlers return n2k.fields directly, so a
    // missing object flows through as undefined metadata and crashes the
    // n2kSourceMetadata listener. Normalise to {}.
    const fields = isPlainObject(inner.fields)
        ? normalizeFields(inner.fields, types)
        : {};
    for (const [fieldId, fieldType] of Object.entries(types)) {
        if (isSpareOrReserved(fieldType) && !(fieldId in fields)) {
            fields[fieldId] = 0;
        }
        // The analyzer also omits bit lookups with no set bits; canboatjs
        // emits [], from which n2k-signalk derives "normal" notification
        // states — restore the empty array so those states are not lost.
        if (fieldType === 'BITLOOKUP' && !(fieldId in fields)) {
            fields[fieldId] = [];
        }
    }
    result.fields = fields;
    return result;
}
//# sourceMappingURL=analyzerOutput.js.map