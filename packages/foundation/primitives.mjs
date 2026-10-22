// Foundation primitives — the leaf every domain package may import.
//
// This package is the reason the package graph stays a DAG
// (scripts/check.mjs §6): generic helpers that more than one domain needs live
// here, BELOW every domain package, never across them. It imports nothing but
// node: builtins, and it must stay that way.
import { createHash } from "node:crypto";

// The canonical content digest. Once duplicated across packages, converged
// here by the dependency-direction guard: any package may digest, no package
// may re-implement.
export function digestOf(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}
