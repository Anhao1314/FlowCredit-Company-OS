// Shared bounded-validation primitives — one canonical implementation per
// semantic. Call sites must pick by meaning, not by convenience: helpers whose
// semantics intentionally differ (a stricter prototype check, an error-throwing
// input gate) stay local to their module on purpose. This module holds only
// pure predicates; it never throws and never reads Runtime state.
export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The value's own keys are exactly the expected set (no missing, no extra).
export function hasExactlyKeys(value, keys) {
  return isPlainObject(value) && Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
}

// Every key the value carries is on the allowlist; missing keys are allowed
// and must be rejected by the caller's own presence checks.
export function onlyAllowedKeys(value, keys) {
  return isPlainObject(value) && Object.keys(value).every((key) => keys.includes(key));
}

export function boundedText(value, max) {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

export function boundedTrimmedText(value, max) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

export function jsonByteLength(value) {
  return Buffer.byteLength(JSON.stringify(value));
}
