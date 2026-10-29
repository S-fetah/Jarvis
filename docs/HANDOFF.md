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
- `docs/decisions/ADR-005-ui-design-system-and-window-chrome.md` — "The Quiet Instrument" Parchment & Pine design tokens and native window chrome.
- `docs/decisions/ADR-006-windows-integration-tray-and-diagnostics.md` — System tray lifecycle, auto-launch, diagnostics bundler, screen capture, and packaging.
- `docs/architecture-slides.pdf` (+ `.html` source) — 16-slide architecture deck (idea, stack, approach, goals, security, operation, roadmap); regenerate via the `status-deck` skill (`.agents/skills/status-deck/SKILL.md`) with `node scripts/render-architecture-slides.cjs`.

## Current state

- Git on branch `main`; synchronized with `origin/main`.
- **Phase 0 through Phase 6 Complete:**
  - **Phase 5:** Native Chrome DevTools Protocol (CDP) browser engine (`browser_list_tabs`, `browser_inspect_page`, `browser_click_element`, `browser_close_tab`, `browser_scroll`), RFC 5321 TLS SMTP delivery (`send_email_direct`), closed-loop Gmail DOM ready detection & minimized background dispatch (`send_gmail`), persistent user memory (`USER.md`, `manage_user_memory`), and full UI v2 overhaul ("The Quiet Instrument" / Parchment & Pine design system).
  - **Phase 6:** Windows system tray integration (`TrayManager`) with gateway status and quick actions, startup launch-on-login synchronization (`app.setLoginItemSettings`), minimize-to-tray lifecycle handling, SEC-003 support diagnostics bundle exporter (`exportDiagnosticBundle`), desktop screen capture tool (`screen_capture`), packaging configuration (`electron-builder.yml`), and Phase 6 unit test suite (`tests/phase6-windows.test.ts`).
  - Active tool suite: 21 native tools across filesystem, process, network, browser, memory, and desktop capture.
  - Automated test suite: 89/89 tests passing across 14 test files (`tests/canvas-document-resolver.test.ts`, `tests/phase6-windows.test.ts`, `tests/user-memory.test.ts`, `tests/cdp-browser.test.ts`, `tests/tool-executor.test.ts`, etc.).
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

## Current Status — Phase 7: Real-world user dogfooding & release packaging

1. Windows release packaging verified: `npm run build:win` produces installable NSIS (`dist/Jarvis Setup 0.1.0.exe`, 122.5 MB) and portable standalone package (`dist/Jarvis 0.1.0.exe`, 122.3 MB).
2. Input responsiveness & visual polish complete: zero typing lag, high-contrast #212121 light mode typography, and unclipped floating permission modals across both desktop and QuickChat drawers.
3. Architecture slide deck regenerated: `docs/architecture-slides.pdf` reflects Phase 0–6 completion and active Phase 7 goals.
4. Workspace Canvas & Modern Chat UX: Live in-chat split pane for dev servers, PDFs, and web previews; adaptive wide layout; user prompt hover toolbar; @ context mentions.
5. Deliberation & Learning Engine: Autonomous convention learning into `USER.md` and multi-tier model failover cascade (Claude/Qwen/Mistral/Llama/Gemini) preventing 429 aborts with ~10k token reserve alerts.
6. Next active checkpoint: End-to-end dogfooding across multi-monitor setups and real-world day-to-day assistant workflows.
## Re-running gateway checks (regression)

`scripts/validate-freellmapi.mjs` re-checks the gateway (models, chat, streaming, non-executed tool call); `scripts/list-gateway-models.mjs` lists model ids. Both read the key only from the `FREELLMAPI_API_KEY` process environment — never stored, never printed:

```powershell
Set-Location C:\work\softwares\jarvis
$env:FREELLMAPI_API_KEY = [System.Net.NetworkCredential]::new('', (Read-Host -Prompt 'FreeLLMAPI key (input is hidden)' -AsSecureString)).Password
node .\scripts\validate-freellmapi.mjs
Remove-Item Env:\FREELLMAPI_API_KEY -ErrorAction SilentlyContinue
```

Run the three lines one at a time. Multi-minute waits are normal (observed latencies up to ~64 s per request; 120 s timeout each).
