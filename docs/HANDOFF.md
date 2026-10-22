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
- **T-002 (benchmark an existing agent) is set up, wired, and awaiting benchmark runs** (2026-10-21). Target changed from the plan's "Open Interpreter Desktop" — that product no longer ships; the official Open Interpreter is now a Rust TUI, **0.0.56 installed** at `%LOCALAPPDATA%\Programs\Open Interpreter\bin\interpreter.exe` from the inspected official script. Provider wiring is **verified keylessly**: the gateway is registered as a custom provider in `%USERPROFILE%\.openinterpreter\config.toml` (no secrets, `env_key = "FREELLMAPI_API_KEY"`, `wire_api = "chat"` — delete that file when T-002 closes), and a keyless `exec` run stopped exactly at "Missing environment variable: FREELLMAPI_API_KEY" instead of hitting api.openai.com. Note: project-level `.openinterpreter/config.toml` is NOT read until the folder is trusted in the TUI — user-level config is the reliable path. Disposable sandbox: `C:\work\t002-sandbox` (fixtures + inert template config). Protocol, verified run procedure, and config appendix: `docs/t002-benchmark.md`. Prompts: `C:\work\t002-sandbox\TASKS.md`.
- Never request, read, log, commit, or paste the FreeLLMAPI unified key or provider keys.

## Current design decisions

1. Normal mode uses one selected model/profile.
2. Racing mode (later) uses a bounded first-valid-response race only for eligible read-only work; cancel losing requests.
3. Multi-agent mode (later) uses separate visible model roles, not unrestricted simultaneous tool control.
4. No response race for tool execution, downloads, file mutations, process control, or sensitive prompts by default.
5. Measure time-to-first-token separately from total duration before choosing performance budgets.
6. (From T-001) Pin a concrete model per Jarvis profile for consistency; treat gateway `auto`/fallback chains as resilience only. Surface upstream 5xx distinctly in the adapter and support at least one bounded retry before failing over.

## Immediate next step — T-002: run the benchmark sessions

Everything is set up and the model is pinned; what remains is running and recording. Full protocol: `docs/t002-benchmark.md`.

1. ~~Pin a concrete model~~ — **done 2026-10-22**: `model = "gemini-3.6-flash"` (279-model live listing; chosen because T-001 proved it in streaming). If chat turns fail on it, swap to another id via `scripts/list-gateway-models.mjs` — the config to edit is `%USERPROFILE%\.openinterpreter\config.toml`.

2. **Run the benchmark** (prompts in `C:\work\t002-sandbox\TASKS.md`, one at a time, recording after each):

```powershell
Set-Location C:\work\t002-sandbox
$env:FREELLMAPI_API_KEY = [System.Net.NetworkCredential]::new('', (Read-Host -Prompt 'FreeLLMAPI key (input is hidden)' -AsSecureString)).Password
i
Remove-Item Env:\FREELLMAPI_API_KEY -ErrorAction SilentlyContinue
```

(Run line by line. First TUI launch may ask to trust the folder — approve, it is the disposable sandbox, and record that prompt as approval evidence. `/status` inside the TUI confirms the active provider/model. Non-interactive alternative: `interpreter exec --skip-git-repo-check "<prompt>"` with the same env setup.)

Hash the sandbox before/after B2 (`Get-ChildItem -Recurse -File C:\work\t002-sandbox | Get-FileHash -Algorithm SHA256`). **Deny the B4b approval — never approve it.**

3. **Record**: fill the results table in `docs/t002-benchmark.md`, copy conclusions into `docs/spike-results.md` (T-002 section), update `PROGRESS.md`, and clean up when T-002 closes: delete `C:\work\t002-sandbox`, delete `%USERPROFILE%\.openinterpreter\config.toml`, and optionally uninstall Open Interpreter.

Do not grant the agent unrestricted access to the user profile, and do not treat it as a runtime dependency without evidence of a stable supported integration surface.

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
