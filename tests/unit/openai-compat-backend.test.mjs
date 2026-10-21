// Unit coverage for the OpenAI-compatible ModelBackend: retry discipline,
// truncation mapping, contract-sized token budgets and the typed-step shape
// contract the GenericModelWorkerAdapter relies on.
import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAICompatBackend, defaultMaxTokensFor } from "../../packages/harness/model-backends/openai-compat.mjs";

const ENDPOINT = "https://model.example/v1/chat/completions";
const secretProvider = { get: async () => "sk-unit-test-secret-0001" };
const ARTIFACT_CONTRACT = { kind: "ARTIFACT_DELIVERY" };
const REVIEW_CONTRACT = { kind: "REVIEW_JUDGMENT" };
const MESSAGES = [{ role: "user", content: "work packet" }];
const NO_SLEEP = async () => {};
const sleepLog = () => {
  const delays = [];
  return { delays, sleep: async (ms) => { delays.push(ms); } };
};

function httpResponse(body, { status = 200 } = {}) {
  const bytes = new TextEncoder().encode(typeof body === "string" ? body : JSON.stringify(body));
  let sent = false;
  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      cancel: async () => {},
      getReader() {
        return {
          read: async () => {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return { done: false, value: bytes };
          },
          releaseLock: () => {},
        };
      },
    },
  };
}

const completion = (content, finish = "stop") => httpResponse({
  choices: [{ finish_reason: finish, message: { role: "assistant", content } }],
  usage: { prompt_tokens: 11, completion_tokens: 7 },
});

const finalResult = (candidate) => completion(JSON.stringify({ type: "FINAL_RESULT", candidate }));

function fakeFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    return typeof next === "function" ? next(calls.length) : next;
  };
  return { calls, fetchImpl };
}

test("defaultMaxTokensFor sizes the budget by result contract", () => {
  assert.equal(defaultMaxTokensFor(ARTIFACT_CONTRACT), 16_384);
  assert.equal(defaultMaxTokensFor(REVIEW_CONTRACT), 4_096);
  assert.equal(defaultMaxTokensFor({ kind: "OTHER" }), 4_096);
});

test("a transient 503 is retried with backoff and then succeeds", async () => {
  const { delays, sleep } = sleepLog();
  const { calls, fetchImpl } = fakeFetch([httpResponse("boom", { status: 503 }), finalResult({ ok: 1 })]);
  const backend = createOpenAICompatBackend({ endpoint: ENDPOINT, model: "test-model",
    secretProvider, secretName: "model.deepseek", fetchImpl, sleep });
  const step = await backend.invoke({ messages: MESSAGES, resultContract: ARTIFACT_CONTRACT });
  assert.equal(step.type, "FINAL_RESULT");
  assert.equal(calls.length, 2);
  assert.equal(delays.length, 1);
  assert.ok(delays[0] >= 400 && delays[0] <= 8_250, `backoff in bounds: ${delays[0]}`);
});

test("a 400 is never retried", async () => {
  const { delays, sleep } = sleepLog();
  const { calls, fetchImpl } = fakeFetch([httpResponse("no", { status: 400 })]);
  const backend = createOpenAICompatBackend({ endpoint: ENDPOINT, model: "test-model",
    secretProvider, secretName: "model.deepseek", fetchImpl, sleep });
  await assert.rejects(
    backend.invoke({ messages: MESSAGES, resultContract: ARTIFACT_CONTRACT }),
    /model request failed \(400\)/,
  );
  assert.equal(calls.length, 1);
  assert.equal(delays.length, 0);
});

test("transport failure exhausts the bounded attempt budget", async () => {
  const { sleep } = sleepLog();
  let attempts = 0;
  const fetchImpl = async () => { attempts += 1; throw new Error("ECONNRESET"); };
  const backend = createOpenAICompatBackend({ endpoint: ENDPOINT, model: "test-model",
    secretProvider, secretName: "model.deepseek", fetchImpl, sleep });
  await assert.rejects(
    backend.invoke({ messages: MESSAGES, resultContract: ARTIFACT_CONTRACT }),
    /model transport failed after 3 attempt/,
  );
  assert.equal(attempts, 3);
});

test("finish_reason=length maps to MODEL_OUTPUT_TRUNCATED and is never retried", async () => {
  const { delays, sleep } = sleepLog();
  const { calls, fetchImpl } = fakeFetch([completion("{\"partial\":", "length")]);
  const backend = createOpenAICompatBackend({ endpoint: ENDPOINT, model: "test-model",
    secretProvider, secretName: "model.deepseek", fetchImpl, sleep });
  await assert.rejects(
    backend.invoke({ messages: MESSAGES, resultContract: ARTIFACT_CONTRACT }),
    (error) => error.code === "MODEL_OUTPUT_TRUNCATED" && /token budget/.test(error.message),
  );
  assert.equal(calls.length, 1);
  assert.equal(delays.length, 0);
});

test("the request carries a contract-sized max_tokens and no cross-protocol thinking param", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push(JSON.parse(init.body));
    return finalResult({ ok: 1 });
  };
  const backend = createOpenAICompatBackend({ endpoint: ENDPOINT, model: "test-model",
    secretProvider, secretName: "model.deepseek", fetchImpl, sleep: NO_SLEEP });
  await backend.invoke({ messages: MESSAGES, resultContract: ARTIFACT_CONTRACT });
  await backend.invoke({ messages: MESSAGES, resultContract: REVIEW_CONTRACT });
  assert.equal(seen[0].max_tokens, 16_384);
  assert.equal(seen[1].max_tokens, 4_096);
  assert.equal(seen[0].model, "test-model");
  assert.ok(!("thinking" in seen[0]), "no Anthropic-style thinking parameter");
  assert.equal(seen[0].stream, false);
  assert.equal(seen[0].response_format.type, "json_object");
});

test("a shape-mismatched final attempt is returned for the adapter to reject", async () => {
  const { fetchImpl } = fakeFetch([completion("{\"not\":\"a step\"}"), completion("{\"still\":\"not a step\"}")]);
  const backend = createOpenAICompatBackend({ endpoint: ENDPOINT, model: "test-model",
    secretProvider, secretName: "model.deepseek", fetchImpl, maxAttempts: 2, sleep: NO_SLEEP });
  const step = await backend.invoke({ messages: MESSAGES, resultContract: ARTIFACT_CONTRACT });
  assert.deepEqual(step, { still: "not a step" });
});

test("a non-object completion is refused, not returned", async () => {
  const { fetchImpl } = fakeFetch([completion("\"just a string\""), completion("42")]);
  const backend = createOpenAICompatBackend({ endpoint: ENDPOINT, model: "test-model",
    secretProvider, secretName: "model.deepseek", fetchImpl, maxAttempts: 2, sleep: NO_SLEEP });
  await assert.rejects(
    backend.invoke({ messages: MESSAGES, resultContract: ARTIFACT_CONTRACT }),
    /model completion is not a JSON object/,
  );
});

test("a short-lived credential fails fast before any transport", async () => {
  const seen = [];
  const backend = createOpenAICompatBackend({ endpoint: ENDPOINT, model: "test-model",
    secretProvider: { get: async () => "short" }, secretName: "model.deepseek",
    fetchImpl: async (...args) => { seen.push(args); return finalResult({ ok: 1 }); }, sleep: NO_SLEEP });
  await assert.rejects(
    backend.invoke({ messages: MESSAGES, resultContract: ARTIFACT_CONTRACT }),
    /model credential unavailable/,
  );
  assert.equal(seen.length, 0);
});

test("a pre-aborted signal never reaches the transport", async () => {
  const seen = [];
  const controller = new AbortController();
  controller.abort();
  const backend = createOpenAICompatBackend({ endpoint: ENDPOINT, model: "test-model",
    secretProvider, secretName: "model.deepseek",
    fetchImpl: async (...args) => { seen.push(args); return finalResult({ ok: 1 }); }, sleep: NO_SLEEP });
  await assert.rejects(
    backend.invoke({ messages: MESSAGES, resultContract: ARTIFACT_CONTRACT, abortSignal: controller.signal }),
    /model invocation aborted/,
  );
  assert.equal(seen.length, 0);
});

test("the factory refuses an unusable endpoint or model", () => {
  assert.throws(() => createOpenAICompatBackend({ endpoint: "not-a-url", model: "m",
    secretProvider, secretName: "model.deepseek", sleep: NO_SLEEP }), /valid endpoint/);
  assert.throws(() => createOpenAICompatBackend({ endpoint: ENDPOINT, model: "has space",
    secretProvider, secretName: "model.deepseek", sleep: NO_SLEEP }), /valid endpoint/);
});

test("the deepseek wrapper keeps the provenance count contract", async () => {
  const { verifiedDeepSeekInvocations } = await import("../../packages/harness/deepseek-model-backend.mjs");
  const { DEEPSEEK_MODEL } = await import("../../packages/harness/deepseek-model-backend.mjs");
  assert.equal(DEEPSEEK_MODEL, "deepseek-v4-flash");
  const { fetchImpl } = fakeFetch([finalResult({ ok: 1 })]);
  const backend = createOpenAICompatBackend({ endpoint: ENDPOINT, model: "test-model",
    secretProvider, secretName: "model.deepseek", fetchImpl, sleep: NO_SLEEP });
  // Provenance counts only the real transport; a fake fetch must stay at zero.
  await backend.invoke({ messages: MESSAGES, resultContract: ARTIFACT_CONTRACT, workerRunId: "run_unit-test" });
  assert.equal(verifiedDeepSeekInvocations(backend, "run_unit-test"), 0);
});
