import test from "node:test";
import assert from "node:assert/strict";
import { runFounderWorkProof } from "../../scripts/demos/demo-founder-work-v0a.mjs";

test("Founder product command binds Work and Runtime runs it through restart", async () => {
  const result = await runFounderWorkProof();
  assert.equal(result.manualCoordinationAfterCreate, 0);
  assert.equal(result.taskCount, 2);
});
