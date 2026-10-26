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
- `docs/architecture-slides.pdf` (+ `.html` source) — 16-slide architecture deck (idea, stack, approach, goals, security, operation, roadmap); regenerate via the `status-deck` skill (`.agents/skills/status-deck/SKILL.md`) with `node scripts/render-architecture-slides.cjs`.

## Current state

- Git on branch `main`; ahead of origin with verified local commits (**NO PUSH rule strictly observed**).
- **Phase 0 through Phase 4 Complete.**
- **Phase 5 (Browser Automation & Robustness) In Progress:**
  - Native Chrome DevTools Protocol (CDP) engine implemented in `src/main/utils/cdp.ts`.
  - 5 CDP browser tools added: `browser_list_tabs`, `browser_inspect_page`, `browser_click_element`, `browser_close_tab`, `browser_scroll`.
  - RFC 5321 TLS SMTP engine implemented in `src/main/utils/smtp.ts` (`send_email_direct`) for verified email delivery with server receipts (250 OK) and zero browser tabs.
  - Closed-loop Gmail DOM ready detection, minimized/offscreen background launch, and automatic tab closing (`Ctrl+W`) in `send_gmail`.
  - Persistent user memory & preferences system (`src/main/memory/user-memory.ts`, `USER.md`, `manage_user_memory`).
  - Active tool suite: 20 native tools across filesystem, process, network, browser, and memory.
  - Automated test suite: 73/73 tests passing across 12 test files (`tests/user-memory.test.ts`, `tests/cdp-browser.test.ts`, `tests/phase4-process.test.ts`, `tests/tool-executor.test.ts`, etc.).
  - Security scanner: 8/8 checks passing (0 Critical, 0 High findings).
  - Production build: Passing cleanly via `electron-vite build`.

## Current design decisions

1. Normal mode uses one selected model/profile.
2. Racing mode (later) uses a bounded first-valid-response race only for eligible read-only work; cancel losing requests.
3. Multi-agent mode (later) uses separate visible model roles, not unrestricted simultaneous tool control.
4. No response race for tool execution, downloads, file mutations, process control, or sensitive prompts by default.
5. Measure time-to-first-token separately from total duration before choosing performance budgets.
6. (T-001 / ADR-003) Pin a concrete model per Jarvis profile; treat gateway `auto`/fallback chains as resilience only; surface upstream 5xx distinctly and retry once before failing over.
7. (T-002 / ADR-002 / ADR-004) Jarvis must be **stricter** than the benchmarked default: gate outside-workspace reads by approval, surface every in-workspace mutation in an activity timeline; tool shells run `-NoProfile` with a minimal explicit environment; the UI always shows the actual endpoint + model and never switches providers implicitly.
8. (Phase 5) Browser automation uses zero-dependency Chrome DevTools Protocol (CDP) connecting to Chrome (`--remote-debugging-port=9222`) for deterministic DOM inspection and tab control rather than blind OS keystrokes.
9. (Phase 5) Persistent user habits and preferences are stored in human-readable `USER.md` in the workspace and injected into the agent's system prompt so Jarvis remembers user defaults (e.g. Chrome profile `fennec`, dev port `5173`).

## Immediate next step — Phase 5: Vision & Multimodal Desktop Screen Capture

1. Wire up `desktopCapturer` in Electron Main to allow Jarvis to take screenshots of the user's workspace or active screen upon request.
2. Support vision-based multimodal analysis in `ModelGatewayAdapter` for models that support image input.

## Re-running gateway checks (regression)

`scripts/validate-freellmapi.mjs` re-checks the gateway (models, chat, streaming, non-executed tool call); `scripts/list-gateway-models.mjs` lists model ids. Both read the key only from the `FREELLMAPI_API_KEY` process environment — never stored, never printed:

```powershell
Set-Location C:\work\softwares\jarvis
$env:FREELLMAPI_API_KEY = [System.Net.NetworkCredential]::new('', (Read-Host -Prompt 'FreeLLMAPI key (input is hidden)' -AsSecureString)).Password
node .\scripts\validate-freellmapi.mjs
Remove-Item Env:\FREELLMAPI_API_KEY -ErrorAction SilentlyContinue
```

Run the three lines one at a time. Multi-minute waits are normal (observed latencies up to ~64 s per request; 120 s timeout each).
