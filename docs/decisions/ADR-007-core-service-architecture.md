# ADR-007: Core Service Architecture

**Status:** Accepted
**Date:** 2026-11-09
**Context:** Owner interview (docs/VISION.md), technical architecture review (docs/architecture-slides.pdf), acceptance results (PROGRESS.md 2026-11-09)

## Context

Today the agent loop, tools, policy, gateway and storage all live in the Electron main process (`src/main/index.ts` wires everything). This blocks the agreed goals:

- Jarvis stops when the app quits, so background jobs and watchers cannot exist.
- No other device (other PCs, a phone, voice) can reach the brain.
- The 26 tools sit in one switch statement (`tool-executor.ts`, 1,755 lines); a crash or a new tool family touches everything.
- Data lives under `process.cwd()/userData`, which changes with the launch folder.
- The optional local gateway server accepts unauthenticated requests with `Access-Control-Allow-Origin: *`.
- An approval ends the agent run, so the model never learns the result, and tasks cannot be cancelled or resumed.

## Decision

1. **`jarvis-core` is a separate per-user background service** written in Node/TypeScript. It runs as the owner's Windows user (never SYSTEM or administrator), starts at login and keeps running when every window is closed. The Electron app becomes a UI client. The tray app also starts at login and is the notification and approval surface. "Quit Jarvis" stops both. One installer and one runtime ship both; whether the core runs on an upgraded Electron's bundled Node or on a single-file Node build is decided at implementation time.

2. **Repository: npm workspaces monorepo**, plain npm with no extra build orchestration.

   ```
   apps/desktop        Electron UI client
   packages/core       agent loop, task engine, policy, memory, gateway, storage
   packages/protocol   shared types and the client↔core API schema (zod)
   packages/tools-*    tool servers: files, browser, shell, uia, email…
   apps/node           (later) node agent for other PCs
   apps/hub            (later) Jarvis-hub web app
   ```

3. **Tools are tool servers that speak MCP** (Model Context Protocol), one per tool family. The core is their only client and every call passes through the core's policy engine. A node on another PC is a remote tool server, so multi-PC needs no separate tool design. New families (shell, UI automation, crawler) are built this way first; existing tools migrate gradually.

4. **Durable task engine.** Each task is a saved state machine; every step is written to storage as it happens. Tasks can pause for approval and resume with the result returned to the model, be cancelled at any point, recover after a reboot (asking before re-running any risky step) and run on a schedule. The step log is also the structured task record used for learning (ADR-008).

5. **Storage:** one SQLite database per owner in `%APPDATA%\Jarvis\`, using Node's built-in `node:sqlite` behind a single storage module (verified on Node 24.13: SQLite 3.50.4 with FTS5; the API still prints an experimental warning, so the module boundary allows a switch to `better-sqlite3` in one file). FTS5 provides full-text search over records and playbooks; embeddings come later with the local GPU. Secrets stay in the DPAPI vault; records are stripped of secrets before saving. Every file change made by a task goes through a checkpoint store so the whole task can be rolled back.

6. **Core API: one locked door.**
   - JSON-RPC 2.0 over WebSocket, listening on `127.0.0.1` only.
   - Each client pairs once (owner approval) and receives its own revocable token, stored with DPAPI. Connections without a valid token are refused.
   - The `Origin` header is checked and any connection from a website is refused (browsers do not apply CORS to WebSockets). The `Host` header is checked to block DNS rebinding.
   - Later, nodes on other PCs connect over Tailscale with the same pairing and mutual authentication.
   - The OpenAI-compatible endpoint for IDEs remains but requires a token.
   - No unauthenticated endpoint exists anywhere.

7. **Models are configuration, not code.** Provider and model lists live in config with a settings screen, are assigned to roles (planner, reflector, worker, private), are checked weekly against each provider's live model list, and the paid model has a monthly cap with a visible spend counter. The local model is one more provider.

8. **Migration is incremental.** Safety fixes land first in the current code (Phase 8). Then modules move one at a time (Phases 9–11) with unit and acceptance tests green after every step. No rewrite.

## Consequences

- Background jobs, multi-PC control, voice and other clients become additions instead of rewrites.
- Tool families are isolated and individually permissioned; third-party MCP tools can be added.
- The core API is a new attack surface; it is designed locked from the start and gets its own acceptance tests (token, Origin, Host, pairing, revocation).
- Two processes must be packaged, started and monitored; the tray app shows core health.
- `node:sqlite` is still experimental; the single storage module limits the cost of switching.
- Supersedes the gateway exposure in ADR-003 (local gateway must now require a token) and extends ADR-002 (the trusted boundary moves from Electron main to `jarvis-core`).
