# Jarvis Project Handoff — 2026-10-21

## Project objective

Build an open-source, local-first Windows desktop “Jarvis” assistant. It will be its own Electron/React/TypeScript application, with a replaceable model-gateway adapter and a strict policy/approval layer for local tools. FreeLLMAPI is being evaluated as an optional local gateway, not as a permanent required dependency.

## Durable project references

- `README.md` — concise product objective and architecture.
- `Jarvis_Project_Implementation_Plan.md` — full working plan and acceptance criteria.
- `PROGRESS.md` — milestone and ticket status.
- `docs/spike-results.md` — T-001 evidence (complete validation data and observations).
- `docs/decisions/ADR-001-response-latency-and-hedging.md` — Normal/Racing/Multi-agent modes and latency policy.

## Current state

- The repository has been initialized with Git on branch `main`; no implementation commit has been made yet.
- **T-001 (validate FreeLLMAPI locally) is complete** (2026-10-21 22:27). All authenticated checks passed against `http://127.0.0.1:31415/v1`: 278 models (78 ms); basic chat `"PONG"` via `auto` (1,423 ms, routed `google/gemini-robotics-er-2-preview`); streaming `"STREAM_OK"` (connection 3,288 ms, streamed body 66 ms); tool-call `get_time`, never executed (63,965 ms including one transient upstream HTTP 502 recovered by a single retry; routed `google/gemini-flash-lite-latest`). Full data: `docs/spike-results.md`.
- Validated limitations that shape the adapter: `auto` routing is non-deterministic (three different models across one run's requests); the upstream provider occasionally returns 502 and recovers on retry; latency spread is wide (1.4 s to ~64 s).
- The user runs the portable FreeLLMAPI desktop executable locally; the gateway stays bound to `127.0.0.1:31415`.
- Never request, read, log, commit, or paste the FreeLLMAPI unified key or provider keys.

## Current design decisions

1. Normal mode uses one selected model/profile.
2. Racing mode (later) uses a bounded first-valid-response race only for eligible read-only work; cancel losing requests.
3. Multi-agent mode (later) uses separate visible model roles, not unrestricted simultaneous tool control.
4. No response race for tool execution, downloads, file mutations, process control, or sensitive prompts by default.
5. Measure time-to-first-token separately from total duration before choosing performance budgets.
6. (From T-001) Pin a concrete model per Jarvis profile for consistency; treat gateway `auto`/fallback chains as resilience only. Surface upstream 5xx distinctly in the adapter and support at least one bounded retry before failing over.

## Immediate next step — T-002: benchmark an existing desktop agent

Benchmark Open Interpreter Desktop against the same local gateway (`http://127.0.0.1:31415`) using a **disposable test workspace** (created outside the user profile, e.g. under a temp directory). Test only:

- read-only research behavior;
- workspace inspection;
- PDF generation;
- approval/permission behavior;
- integration limits.

Do not grant it unrestricted access to the user profile, and do not treat it as a runtime dependency without evidence of a stable supported integration surface. Record findings in `docs/spike-results.md` (T-002 section) and update `PROGRESS.md`.

## Re-running the T-001 validator (regression check)

`scripts/validate-freellmapi.mjs` is kept for re-checking the gateway after provider or gateway changes. It reads the key only from the process environment and never saves or prints it:

```powershell
Set-Location C:\work\softwares\jarvis
$env:FREELLMAPI_API_KEY = [System.Net.NetworkCredential]::new('', (Read-Host -Prompt 'FreeLLMAPI key (input is hidden)' -AsSecureString)).Password
node .\scripts\validate-freellmapi.mjs
Remove-Item Env:\FREELLMAPI_API_KEY -ErrorAction SilentlyContinue
```

Run the three lines one at a time. The validator runs all four checks even when one fails, retries 502/503/504 once, and falls back from model `auto` to a concrete model when needed. Known pitfalls:

- `Read-Host -AsSecureString` without `-Prompt` shows no prompt text, so the console looks frozen while it waits for the key. With `-Prompt` the prompt is visible; typed characters never appear on screen — that is expected.
- Pressing Enter with empty input assigns an empty string, which PowerShell treats as deleting the variable; rerun and enter the key.
- If the block gets pasted onto one line, separate the statements with semicolons; a collapsed paste causes an "Unexpected token" parse error.
- A multi-minute wait while the validator runs is normal: checks run sequentially, each with a 120-second timeout and observed latencies up to ~64 s.
