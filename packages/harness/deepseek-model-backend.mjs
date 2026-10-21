// DeepSeek-specific configuration of the generic OpenAI-compatible backend.
// Only the endpoint URL, model name and credential name are DeepSeek's; the
// transport, retry discipline and result protocol live in
// model-backends/openai-compat.mjs.
//
// The current DeepSeek API model list is deepseek-v4-flash / deepseek-v4-pro
// (deepseek-chat and deepseek-reasoner were retired on 2026-07-24). The model
// and endpoint stay configurable: FLOWCREDIT_DEEPSEEK_MODEL and
// FLOWCREDIT_DEEPSEEK_ENDPOINT override the defaults without code changes.
import { createOpenAICompatBackend, verifiedModelInvocations } from "./model-backends/openai-compat.mjs";

export const DEEPSEEK_SECRET_NAME = "model.deepseek";
export const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_MODEL = "deepseek-v4-flash";

// A process-local observation made by the real transport after a complete
// HTTP response — never by model output or a backendType string. Kept as the
// count-only shape the Host provenance readout has always consumed.
export function verifiedDeepSeekInvocations(backend, workerRunId) {
  return verifiedModelInvocations(backend, workerRunId).calls;
}

export function createDeepSeekModelBackend({
  secretProvider, fetchImpl = fetch, timeoutMs = 45_000, maxAttempts = 3, model, endpoint,
} = {}) {
  const resolvedModel = model ?? process.env.FLOWCREDIT_DEEPSEEK_MODEL ?? DEEPSEEK_MODEL;
  const resolvedEndpoint = endpoint ?? process.env.FLOWCREDIT_DEEPSEEK_ENDPOINT ?? DEEPSEEK_ENDPOINT;
  return createOpenAICompatBackend({
    endpoint: resolvedEndpoint,
    model: resolvedModel,
    secretName: DEEPSEEK_SECRET_NAME,
    secretProvider,
    fetchImpl,
    timeoutMs,
    maxAttempts,
  });
}
