/**
 * T-001 local gateway validation.
 *
 * The key is read only from FREELLMAPI_API_KEY for this process. It is never
 * written to disk, logged, or included in an error message. All four checks
 * run even when one fails, so a single bad response cannot hide the rest.
 */

const baseUrl = (process.env.FREELLMAPI_BASE_URL ?? "http://127.0.0.1:31415/v1").replace(/\/$/, "");
const apiKey = process.env.FREELLMAPI_API_KEY;

if (!apiKey) {
  console.error("Set FREELLMAPI_API_KEY for this process, then run this script again. (If the key prompt appeared and you pressed Enter without typing anything, just rerun and paste the key.)");
  process.exit(2);
}

const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

function elapsedMs(startedAt) {
  return Math.round(performance.now() - startedAt);
}

function fetchOptions(body) {
  return {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120_000),
  };
}

const RETRYABLE_STATUSES = new Set([502, 503, 504]);

async function apiRequest(path, body) {
  const startedAt = performance.now();
  let response = await fetch(`${baseUrl}${path}`, fetchOptions(body));

  if (RETRYABLE_STATUSES.has(response.status)) {
    console.log(`… HTTP ${response.status} from ${path}; retrying once in 3 s`);
    if (response.body) await response.body.cancel().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 3000));
    response = await fetch(`${baseUrl}${path}`, fetchOptions(body));
  }

  return { response, durationMs: elapsedMs(startedAt) };
}

async function requireJson(response, label) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message;
    const detail = typeof message === "string" && message.trim()
      ? ` Gateway reported: ${JSON.stringify(message.slice(0, 200))}`
      : "";
    throw new Error(`${label} failed with HTTP ${response.status}.${detail}`);
  }
  return payload;
}

let firstListedModel = null;
let resolvedModel = "auto";

async function validateModels() {
  const { response, durationMs } = await apiRequest("/models");
  const payload = await requireJson(response, "Model listing");
  const models = Array.isArray(payload.data) ? payload.data : [];
  firstListedModel = models[0]?.id ?? null;
  console.log(`✓ Models: ${models.length} available (${durationMs} ms)`);
}

async function validateChat() {
  const attempts = ["auto"];
  if (firstListedModel && firstListedModel !== "auto") attempts.push(firstListedModel);

  let lastError;
  for (const model of attempts) {
    try {
      const { response, durationMs } = await apiRequest("/chat/completions", {
        model,
        messages: [{ role: "user", content: "Reply with exactly: PONG" }],
      });
      const payload = await requireJson(response, `Chat completion (model "${model}")`);
      const text = payload.choices?.[0]?.message?.content?.trim();
      resolvedModel = model;
      console.log(`✓ Basic chat (model ${JSON.stringify(model)}): ${JSON.stringify(text)} (${durationMs} ms; routed via ${response.headers.get("x-routed-via") ?? "unknown"})`);
      return;
    } catch (error) {
      lastError = error;
      if (attempts.length > 1 && model !== attempts.at(-1)) {
        console.log(`… model ${JSON.stringify(model)} failed: ${error.message}`);
      }
    }
  }
  throw lastError;
}

async function validateStreaming() {
  const { response, durationMs: connectionMs } = await apiRequest("/chat/completions", {
    model: resolvedModel,
    stream: true,
    messages: [{ role: "user", content: "Reply with exactly: STREAM_OK" }],
  });
  if (!response.ok || !response.body) {
    throw new Error(`Streaming request failed with HTTP ${response.status}.`);
  }

  const startedAt = performance.now();
  const decoder = new TextDecoder();
  let buffer = "";
  let firstTokenMs = null;
  let text = "";

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\n");
      if (!data || data === "[DONE]") continue;
      const event = JSON.parse(data);
      const delta = event.choices?.[0]?.delta?.content;
      if (delta) {
        firstTokenMs ??= elapsedMs(startedAt);
        text += delta;
      }
    }
  }

  console.log(`✓ Streaming (model ${JSON.stringify(resolvedModel)}): ${JSON.stringify(text.trim())} (connection ${connectionMs} ms; first token ${firstTokenMs ?? "not observed"} ms; total ${elapsedMs(startedAt)} ms; routed via ${response.headers.get("x-routed-via") ?? "unknown"})`);
}

async function validateToolCall() {
  const { response, durationMs } = await apiRequest("/chat/completions", {
    model: resolvedModel,
    messages: [{ role: "user", content: "Call the get_time function now. Do not explain." }],
    tools: [{
      type: "function",
      function: {
        name: "get_time",
        description: "Returns the current time. This test function is never executed.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    }],
    tool_choice: "required",
  });
  const payload = await requireJson(response, "Tool-call request");
  const toolCalls = payload.choices?.[0]?.message?.tool_calls ?? [];
  const requested = toolCalls.map((call) => call.function?.name).filter(Boolean).join(", ");
  console.log(`✓ Tool-call request (model ${JSON.stringify(resolvedModel)}): ${requested || "no tool call returned"} (${durationMs} ms; routed via ${response.headers.get("x-routed-via") ?? "unknown"})`);
}

const checks = [
  ["Model listing", validateModels],
  ["Basic chat", validateChat],
  ["Streaming", validateStreaming],
  ["Tool-call request", validateToolCall],
];

console.log(`Validating local gateway at ${baseUrl}…`);
let failures = 0;
for (const [name, check] of checks) {
  try {
    await check();
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}: ${error.message}`);
  }
}

if (failures === 0) {
  console.log("All checks passed. T-001 validation completed. Share the output; never share the API key.");
} else {
  console.error(`${failures} of ${checks.length} checks failed. Share the full output; never share the API key.`);
  process.exitCode = 1;
}
