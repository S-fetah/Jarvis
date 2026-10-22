/**
 * T-002 helper: list concrete model ids from the local FreeLLMAPI gateway so a
 * deterministic model can be pinned in the benchmark config.
 *
 * The key is read only from FREELLMAPI_API_KEY for this process. It is never
 * written to disk, logged, or included in an error message.
 */

const baseUrl = (process.env.FREELLMAPI_BASE_URL ?? "http://127.0.0.1:31415/v1").replace(/\/$/, "");
const apiKey = process.env.FREELLMAPI_API_KEY;

if (!apiKey) {
  console.error("Set FREELLMAPI_API_KEY for this process first (same secure-prompt pattern as the validator).");
  process.exit(2);
}

const response = await fetch(`${baseUrl}/models`, {
  headers: { Authorization: `Bearer ${apiKey}` },
  signal: AbortSignal.timeout(30_000),
});

if (!response.ok) {
  console.error(`Model listing failed with HTTP ${response.status}.`);
  process.exit(1);
}

const payload = await response.json();
const ids = (Array.isArray(payload.data) ? payload.data : []).map((model) => model.id);

console.log(`${ids.length} models available. First ${Math.min(20, ids.length)}:`);
for (const id of ids.slice(0, 20)) {
  console.log(`  ${id}`);
}
console.log("Pick one concrete id to pin in %USERPROFILE%\\.openinterpreter\\config.toml (model = \"...\") — that is the ACTIVE config; the sandbox copy is an inert template.");
