# Jarvis Project Handoff — 2026-10-22

## Project objective

Build an open-source, local-first Windows desktop “Jarvis” assistant. It will be its own Electron/React/TypeScript application, with a replaceable model-gateway adapter and a strict policy/approval layer for local tools. FreeLLMAPI is the validated reference gateway, not a permanent required dependency.

## Durable project references

- `README.md` — concise product objective and architecture.
- `Jarvis_Project_Implementation_Plan.md` — full working plan and acceptance criteria.
- `PROGRESS.md` — milestone and ticket status.
- `docs/spike-results.md` — T-001 and T-002 evidence, including the benchmarked permission model and conclusions.
- `docs/t002-benchmark.md` — full T-002 protocol and per-test records.
- `docs/decisions/ADR-001-response-latency-and-hedging.md` — Normal/Racing/Multi-agent modes and latency policy.

## Current state

- Git on branch `main`; commits: `46cda5f` (T-001 baseline), `2780ff3` + `7d4c142` (T-002 setup/model pin), plus the T-002 closure commit.
- **T-001 (validate FreeLLMAPI locally) complete** (2026-10-21): all authenticated checks passed against `http://127.0.0.1:31415/v1`. Limitations recorded: non-deterministic `auto` routing, transient upstream 502s, latency spread 1.4 s–64 s.
- **T-002 (benchmark an existing agent) complete** (2026-10-22): Open Interpreter 0.0.56 (Rust TUI; the plan's "Desktop" app no longer ships) benchmarked via the gateway (session: `gpt-6-astra`, high reasoning, Native harness, non-admin sandbox). Headline findings: outside-workspace reads and in-workspace writes run with **no approval**; outside-workspace writes are approval-gated and denial honored; ~1–2 min turns at high reasoning; the TUI model picker can silently bypass the configured gateway; agent shells inherit the user's PowerShell profile (noise/errors). Full records: `docs/t002-benchmark.md`; conclusions: `docs/spike-results.md` (T-002 section).
- **Cleanup pending after the user closes the TUI session:** delete `C:\work\t002-sandbox` and `%USERPROFILE%\.openinterpreter\config.toml`; optionally uninstall Open Interpreter (`%LOCALAPPDATA%\Programs\Open Interpreter\bin\interpreter.exe`).
- Never request, read, log, commit, or paste the FreeLLMAPI unified key or provider keys.

## Current design decisions

1. Normal mode uses one selected model/profile.
2. Racing mode (later) uses a bounded first-valid-response race only for eligible read-only work; cancel losing requests.
3. Multi-agent mode (later) uses separate visible model roles, not unrestricted simultaneous tool control.
4. No response race for tool execution, downloads, file mutations, process control, or sensitive prompts by default.
5. Measure time-to-first-token separately from total duration before choosing performance budgets.
6. (T-001) Pin a concrete model per Jarvis profile; treat gateway `auto`/fallback chains as resilience only; surface upstream 5xx distinctly and retry once before failing over.
7. (T-002) Jarvis must be **stricter** than the benchmarked default: gate outside-workspace reads by approval, surface every in-workspace mutation in an activity timeline; tool shells run `-NoProfile` with a minimal explicit environment; the UI always shows the actual endpoint + model and never switches providers implicitly.

## Immediate next step — T-003: record architecture decisions

Create ADRs in `docs/decisions/` (follow ADR-001's format):

- **ADR-002 — Desktop shell and security model**: Electron/React/TypeScript shell; process separation; why a custom runtime rather than embedding Open Interpreter (use T-002 conclusions: not embeddable, weaker default gates).
- **ADR-003 — Gateway boundary and failure semantics**: OpenAI-compatible adapter over FreeLLMAPI; upstream 5xx handling, single bounded retry, concrete model pinning, TTFT measured from request issuance.
- **ADR-004 — Permission categories and approval binding**: categories for read-in/read-out/write-in/write-out/process/network; defaults informed by the T-002 permission-model table; approval binding, expiry, and denial semantics (denial must never be retried silently).

Then update `PROGRESS.md` (T-003 complete, Phase 0 exit check) and proceed to T-004 (scaffold the Electron/React/TypeScript app).

## Re-running gateway checks (regression)

`scripts/validate-freellmapi.mjs` re-checks the gateway (models, chat, streaming, non-executed tool call); `scripts/list-gateway-models.mjs` lists model ids. Both read the key only from the `FREELLMAPI_API_KEY` process environment — never stored, never printed:

```powershell
Set-Location C:\work\softwares\jarvis
$env:FREELLMAPI_API_KEY = [System.Net.NetworkCredential]::new('', (Read-Host -Prompt 'FreeLLMAPI key (input is hidden)' -AsSecureString)).Password
node .\scripts\validate-freellmapi.mjs
Remove-Item Env:\FREELLMAPI_API_KEY -ErrorAction SilentlyContinue
```

Run the three lines one at a time. Multi-minute waits are normal (observed latencies up to ~64 s per request; 120 s timeout each).
