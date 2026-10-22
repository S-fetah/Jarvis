# ADR-002: Desktop Shell and Security Model

**Status:** Accepted  
**Date:** 2026-10-22  
**Context:** T-002 benchmark conclusions (`docs/spike-results.md`), working plan sections 2 & 5.2

## Context

Jarvis requires a local Windows desktop application that can coordinate natural-language instructions, present live plans and activity timelines, gate sensitive actions with approval modals, and run tools against local files and processes.

During T-002, we benchmarked Open Interpreter 0.0.56 (Rust TUI) against the local FreeLLMAPI gateway in a dedicated sandbox to evaluate whether an existing agent could be embedded as the Jarvis core. The spike demonstrated:
1. **Weak default security boundaries:** In-workspace writes and outside-workspace reads occurred with zero user approval or notification.
2. **Subprocess environment contamination:** The agent spawned shells that inherited the host user's PowerShell profile, triggering permission errors (`oh-my-posh` init access denials) on every turn.
3. **Implicit provider switching:** The TUI model selector silently bypassed the configured local gateway when picking built-in provider names.
4. **Lack of embeddability:** Open Interpreter does not expose a stable, headless IPC/library interface suitable for driving a custom UI without fragile subprocess wrapping.

## Decision

1. **Technology Stack:** Build Jarvis as a standalone desktop application using **Electron**, **React**, **Vite**, and **TypeScript**.
2. **Process Separation:**
   - **Renderer Process (UI):** Strictly unprivileged. Runs React + Vite. Context isolation enabled (`contextIsolation: true`), Node integration disabled (`nodeIntegration: false`), and native OS sandboxing enabled.
   - **Preload Bridge:** Exposes a typed, strictly allowlisted interface via `contextBridge.exposeInMainWorld()`. The renderer never receives raw Node streams, direct filesystem handles, or process spawning capabilities.
   - **Main Process (Trusted):** Owns application lifecycle, native Windows tray/window management, SQLite storage, the security policy engine, tool executors, and model gateway communication.
3. **Custom Orchestrator over Embedded Agent:** Implement a purpose-built, thin agent runtime in TypeScript within the main process instead of embedding Open Interpreter or other external agent TUIs.
4. **Sanitized Subprocess Execution:**
   - All tool-driven shell executions must use `powershell.exe -NoProfile` (or `cmd.exe /d /c`) with an explicitly declared, minimal environment.
   - User profiles and prompt customizers (such as Oh My Posh or Starship) must never execute in Jarvis tool child processes.
   - Commands must be launched with distinct argument arrays rather than concatenated shell strings whenever possible.
5. **Content Security Policy (CSP):** The renderer window enforces a strict CSP preventing arbitrary inline script execution or unapproved remote network requests from the web frame.

## Consequences

- Complete control over approval UI, timeline presentation, and event streams.
- Zero risk of background agent tools executing arbitrary operations without crossing the trusted main process policy broker.
- Clean execution environment free from host shell profile errors.
- Maintenance is focused on our own lightweight orchestration loop rather than patching or wrapping a large external TUI application.
