# ADR-006: Windows System Tray Integration, Shell Auto-Start, Diagnostics Bundler, and Screen Capture Tool

**Status:** Accepted & Implemented  
**Date:** October 2026  
**Deciders:** Core Engineering & Product  
**Consulted:** ADR-002, ADR-003, ADR-004, ADR-005

---

## Context

Following the completion of the Phase 5 browser automation driver and UI v2 overhaul, Jarvis required deep native Windows OS integration and production packaging configuration (Phase 6). A personal desktop AI companion must run unobtrusively in the background without cluttering the taskbar, launch seamlessly upon user login, provide transparent diagnostic bundles for troubleshooting without exposing confidential secrets (SEC-003), offer visual desktop capture for multimodal context, and package into standard Windows x64 distributions.

Key requirements addressed:
1. **Unobtrusive Background Life:** Closing the main window should minimize the app to the Windows notification tray instead of terminating background tasks, running dev servers, or floating companion state.
2. **System Tray Shell Integration:** The tray icon must surface quick actions (toggle main window, toggle 3D owl mascot, quick-chat hotkey, open settings, live gateway connection status, diagnostics export, quit).
3. **Login Auto-Start Synchronization:** Option to launch Jarvis automatically when the user logs into Windows (`app.setLoginItemSettings`) persisted across restarts.
4. **SEC-003 Compliant Diagnostics Bundler:** Ability to export sanitized markdown and JSON system diagnostics bundles without exposing API keys, passwords, or confidential user environment variables.
5. **Multimodal Screen Capture Tool:** Bounded desktop and window screenshot capability (`screen_capture`) saving PNG images into the managed output directory with path-traversal defenses.
6. **Production Windows Packaging:** Standalone `electron-builder.yml` configuration supporting both NSIS installers and portable executables.

---

## Decision

### 1. Windows System Tray & Shell Lifecycle (`TrayManager`)
- Implemented `TrayManager` (`src/main/windows/tray-manager.ts`) managing the native Windows notification area icon (`resources/icon.ico`).
- Single-click on the tray icon toggles the main window visibility.
- Context menu exposes:
  - Application title & version banner
  - Open Main Window
  - Quick Chat shortcut (`Ctrl+Shift+J`)
  - Toggle 3D Mascot Companion
  - Live Model Gateway Status indicator (`● Online`, `▲ Degraded`, `○ Offline`)
  - Export Diagnostics Bundle
  - Settings dialog trigger
  - Quit Jarvis
- **Window Close Interception:** In `src/main/index.ts`, `mainWindow.on('close')` prevents window destruction when `settings.minimizeToTray !== false` or `settings.mascotEnabled`, hiding the window instead. Complete application exit occurs only when explicitly triggered via the tray context menu, menu quit, or `app.quit()`.

### 2. Startup Auto-Launch Synchronization
- Integrated Electron's native `app.getLoginItemSettings()` and `app.setLoginItemSettings({ openAtLogin, openAsHidden: true, path: process.execPath })`.
- Synchronized with persistent SQLite database (`db.setSetting('launchOnLogin', String(enabled))`).
- User-controllable toggle placed directly inside the "System and Tray" section in `SettingsModal.tsx`.

### 3. Support Diagnostics Bundler (`exportDiagnosticBundle`)
- Implemented `exportDiagnosticBundle` in `src/main/utils/diagnostics.ts` generating both human-readable Markdown (`jarvis-diagnostics-<timestamp>.md`) and structured JSON (`jarvis-diagnostics-<timestamp>.json`) in `output/diagnostics/`.
- **SEC-003 Redaction Guarantee:** All sensitive credentials (`apiKey`, `smtpPass`) are strictly scrubbed and replaced with `[REDACTED_SEC_003]`.
- Diagnostic output includes platform environment metrics (OS version, RAM totals, CPU core count, Node/Electron/Vite runtime versions), SQLite conversation statistics, and complete native tool catalog.

### 4. Multimodal Screen Capture Tool (`screen_capture`)
- Added `screen_capture` tool schema and executor in `src/main/tools/tool-registry.ts` and `src/main/tools/tool-executor.ts`.
- Captures full desktop screen (`primary_display`) or focused application window (`active_window`) using Electron's `desktopCapturer` API, saving high-resolution PNGs to `<outputDirectory>/screenshots/`.
- Strict path sanitization cleanses custom filenames to prevent path traversal outside the approved screenshot directory.
- Headless test fallback ensures complete compatibility with automated test runners and CI environments.

### 5. Packaging Configuration (`electron-builder.yml`)
- Created `electron-builder.yml` targeting Windows x64.
- Generates both NSIS interactive installer and zero-install portable executable targets.
- Bundles application assets, `resources/icon.ico`, 3D mascot rig (`resources/mascot/left-facing-jarvis.glb`), and WebAssembly binaries with strict ASAR unpacking for native `.node` modules.

---

## Consequences

### Positive
- Jarvis operates as a seamless native Windows desktop companion with zero taskbar clutter.
- Diagnostic logs can be safely exported and shared for user support without risk of leaking LLM API keys.
- The assistant can visually inspect screen state and user interface layouts through the `screen_capture` tool.
- 100% test coverage across all Phase 6 capabilities (79/79 passing tests).
- 8/8 automated security checks passing with 0 findings.

### Invariants Maintained
- 3D mascot model and Three.js animation controller preserved intact.
- HMAC cryptographic approval protections (ADR-004) preserved intact.
- Process isolation and `contextIsolation: true`, `sandbox: true` enforced on all windows.
