# T-001 — FreeLLMAPI local validation

**Status:** Complete (2026-10-21)  
**Started:** 2026-10-21  
**Target version:** FreeLLMAPI `v0.16.7` (commit `ecdc9cb`)

## Environment check

| Requirement | Result |
| --- | --- |
| Windows Git | Available (`2.52.0`) |
| Node.js | Available (`v24.13.0`); upstream documentation requires Node 20+ |
| npm | Available (`11.6.2`) |
| Docker CLI / Compose | Installed |
| Docker engine | **Unavailable** — `com.docker.service` is stopped and no Docker engine pipe is present |
| Docker Desktop | Not installed/detected |
| FreeLLMAPI desktop executable | Running successfully |
| Local gateway endpoint | Available at `http://127.0.0.1:31415` |
| Provider/local endpoint configuration | User reports configured; no credential was accessed or recorded |

## Current upstream installation options

1. **Windows desktop release:** `FreeLLMAPI-Setup-0.16.7.exe` is the upstream-documented easiest Windows option.
2. **Docker Compose:** supported only after the Docker engine is running; default binding is localhost (`127.0.0.1`) on port `3001`.
3. **Local development:** source checkout with Node 20+, `npm install`, an `ENCRYPTION_KEY`, and `npm run dev`. The API/dashboard default ports are `3001` and `5173` respectively.

## Security constraints for this spike

- Keep the gateway bound to localhost; do not set a LAN bind address.
- Do not add or record provider credentials in this repository.
- Use only supported provider APIs or a user-controlled local model endpoint.
- Capture only redacted logs and test outcomes.

## Validation still required

- [x] Start FreeLLMAPI by the desktop-app or Docker route.
- [x] Configure one legitimate provider key or compatible local endpoint outside this repository.
- [x] Verify that the protected `GET /v1/models` API route is reachable (returns `401` without credentials as expected).
- [x] Verify the unauthenticated API contract at `/v1/openapi.json`; it declares model-listing, chat-completion, Responses, streaming, and tool-call fields.
- [x] Verify a basic chat completion.
- [x] Verify streaming.
- [x] Verify a harmless structured tool call.
- [x] Observe and record an intentional/realistic failure response without retrying a mutation.
- [x] Record gateway URL, version, selected provider/model, latency, and outcomes with all secrets redacted.

## Validation results (2026-10-21, 22:27)

All four authenticated checks passed against `http://127.0.0.1:31415/v1` (validator: `scripts/validate-freellmapi.mjs`):

| Check | Result | Latency | Routed via |
| --- | --- | --- | --- |
| Authenticated `GET /v1/models` | 278 models | 78 ms | — |
| Basic chat completion (`auto`) | `"PONG"` | 1,423 ms | `google/gemini-robotics-er-2-preview` |
| Streaming (`auto`) | `"STREAM_OK"` | connection 3,288 ms; first token 0 ms (clock starts when the body opens); streamed body 66 ms | `google/gemini-3.6-flash` |
| Tool-call request (`auto`, never executed) | `get_time` | 63,965 ms total — includes one upstream HTTP 502 plus the 3 s retry pause | `google/gemini-flash-lite-latest` |

A realistic failure was also observed: the first tool-call attempt returned HTTP 502 from the upstream provider and the validator's single retry succeeded. An earlier run (22:22) saw the same transient 502 on basic chat, which succeeded on rerun. Gateway health verified independently during both incidents (`/api/ping` 200; unauthenticated `/v1/models` 401), so the gateway itself was healthy — the 502s originate from the configured upstream provider.

### Observations

1. **`auto` routing is non-deterministic**: the three chat requests in one run were routed to three different models. Jarvis should pin a concrete model per profile for consistent behavior and treat `auto`/fallback chains as a resilience feature only.
2. **Latency spread is large**: 1.4 s for one chat completion versus ~64 s for the tool-call check (including a failed attempt) and ~58 s for the earlier manual PONG. This confirms ADR-001's premise: measure time-to-first-token separately from total duration, and consider bounded racing for eligible read-only requests.
3. **The upstream provider flakes occasionally** (HTTP 502) and recovers on retry. The Jarvis gateway adapter must surface upstream 5xx distinctly and support at least one bounded retry before failing over.
4. **Streaming TTFT measurement caveat**: the validator starts its first-token clock when the response connection opens, so the 3,288 ms connection hold is excluded; true time-to-first-token from request issuance is ≈ 3.3 s for that request. Jarvis must measure from request issuance.

## Conclusion

**T-001 verdict: pass.** FreeLLMAPI `v0.16.7` at `http://127.0.0.1:31415` satisfies the required authenticated checks over its OpenAI-compatible surface — model listing, chat completion, streaming, and structured tool calling — with the limitations recorded above (non-deterministic `auto` routing, occasional upstream 502, wide latency spread). It is confirmed as the reference gateway for the Jarvis adapter, pending the T-002 agent benchmark.

### Runtime observation

The portable Windows executable was launched by the user and is listening at `http://127.0.0.1:31415`. `GET /`, `/health`, and the protected `/v1/models` route respond; `/v1/models` and `/api/health` return `401` without a unified API key, which is the expected boundary. No credentials were accessed or recorded.

### Desktop UI automation observation

The user configured a provider or local endpoint in the desktop dashboard. The desktop app window is visible but does not expose actionable accessibility controls to the Windows automation interface; two screenshot captures timed out. The spike will not attempt to read the unified key, browser session, or encrypted data directory. Complete the remaining authenticated checks either through the app's Playground or by a deliberately configured local test client that reads the key only from the user's own secure environment.

### First observed latency

The user confirmed that a basic prompt returned `PONG`, but reported a total wait of approximately **58 seconds**. This confirms a usable path but is too slow for the interactive Jarvis experience. Future samples must separately record time-to-first-token and total completion time; this one result cannot yet identify whether delay came from model queueing, provider latency, routing, or non-streaming UI behavior.

The planned mitigation is documented in `docs/decisions/ADR-001-response-latency-and-hedging.md`.

### Safe authenticated-validation helper

`scripts/validate-freellmapi.mjs` performs the remaining model-listing, basic-chat, streaming, and non-executed tool-call checks. It reads the unified key only from the `FREELLMAPI_API_KEY` environment variable of the process that runs it and does not write or log that key.

## T-002 — Open Interpreter benchmark (2026-10-22)

Target: Open Interpreter 0.0.56 (Rust TUI) against the local gateway, in a disposable sandbox (`C:\work\t002-sandbox`). Provider registered as a custom OpenAI-compatible endpoint with an env-var key (`FREELLMAPI_API_KEY`, never stored). Session: FreeLLMAPI (local) / `gpt-6-astra`, reasoning high, Native harness, non-admin sandbox. Full protocol and per-test records: `docs/t002-benchmark.md`.

### Results

- **B1 connectivity: PASS** — correct workspace listing, replied READY, 1 m 48 s turn.
- **B2 read-only inspection: PASS** — accurate five-bullet summary; workspace hashes unchanged.
- **B3 file creation: PASS** — valid `summary.pdf` via Python/ReportLab; exactly one new file, originals unchanged. **No approval asked.**
- **B4a outside-workspace read: executed silently** — no approval, no refusal; returned file content correctly.
- **B4b outside-workspace write: approval-gated** — prompt shown, user denial honored, Desktop verified clean.
- **B5 online research: N/A** (no search capability configured).
- **B6 integration limits: see conclusions.**

### Permission model observed (non-admin sandbox, defaults)

| Action | Gate |
| --- | --- |
| Read inside workspace | none |
| Read outside workspace | **none** |
| Write inside workspace | **none** |
| Write outside workspace | approval required; denial honored |

### Conclusions feeding the T-003 ADRs

1. **Jarvis must be stricter than the benchmarked default.** Outside-workspace reads were ungated and in-workspace writes were silent. Jarvis should gate outside-workspace reads by approval and surface (if not gate) every in-workspace mutation in an activity timeline.
2. **Clean tool-shell environment.** The agent inherited the user's PowerShell profile; oh-my-posh init failed inside every spawned shell. Jarvis tool shells must use `-NoProfile` with a minimal, explicit environment.
3. **Explicit provider/model display.** The TUI's model picker silently switched providers: its built-in "Google" section bypassed the configured gateway (failed on `GEMINI_API_KEY`), and the custom-provider list showed GPT ids that do not match the gateway's REST catalog. Jarvis must always show the actual endpoint + model and never switch providers implicitly.
4. **Latency.** ~1–2 min per turn at high reasoning via the gateway — reinforces ADR-001 (pin concrete models, measure TTFT, default to medium reasoning, consider bounded racing for read-only turns).
5. **Embeddability not demonstrated.** Config trust-gating, catalog mismatch, and first-run security choices make Open Interpreter a benchmark reference only — not a runtime dependency for Jarvis.

## Sources checked

- https://github.com/tashfeenahmed/freellmapi
- https://github.com/tashfeenahmed/freellmapi/releases/tag/v0.16.7
- https://github.com/tashfeenahmed/freellmapi/blob/main/docs/en/install/01-install.md
- https://github.com/tashfeenahmed/freellmapi/blob/main/docs/en/api/01-rest-api.md

