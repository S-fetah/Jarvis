---
name: security-audit
description: >-
  Conducts a comprehensive, evidence-based security audit, vulnerability assessment,
  and release-readiness review for Jarvis desktop and Electron/AI applications.
  Use this skill whenever asked to run a security audit, scan for vulnerabilities,
  check Electron boundaries, test HMAC approval anti-tampering, or verify release safety.
---

# Jarvis Security Audit & Vulnerability Assessment Skill

This skill guides the agent through performing a rigorous, evidence-based application security audit and release readiness review on the Jarvis desktop assistant.

## Quick Audit Run

Execute the automated multi-layer security scanner:

```powershell
npm run security:scan
```

This verifies 8 critical control categories in under 10 seconds:
1. **Secrets & Hygiene:** No uncommitted `.env` files, `.gitignore` excludes.
2. **Process Sandboxing:** Chromium sandbox enabled across all BrowserWindows (`sandbox: true`, `nodeIntegration: false`).
3. **Command Parameterization (SEC-001):** Child process spawning uses parameter arrays (`spawn`, `shell: false`) with URL protocol validation, preventing shell metacharacter injection.
4. **Cryptographic HMAC Binding (SEC-002):** Approval tokens bound via HMAC-SHA256 signature verification in `ipcMain.handle('approval:resolve')`.
5. **Secrets Redaction & Encryption (SEC-003):** API keys redacted from renderer IPC (`hasApiKey` boolean flag) and encrypted via Electron `safeStorage` (Windows DPAPI) in SQLite.
6. **Navigation Lifecycle (SEC-005):** `setWindowOpenHandler` and `will-navigate` lifecycle guards on all WebContents.
7. **Filesystem Boundaries (SEC-006, SEC-007):** Native `realpathSync` symlink traversal prevention and executable file extension gating (`.bat`, `.cmd`, `.ps1`, `.exe`, etc.).
8. **Automated Test Suite:** 22/22 unit and regression tests passing.

---

## Comprehensive 7-Stage Audit Workflow

When conducting a full release readiness review, follow these stages:

### Stage 1: Repository Secrets & Git History Scan
- Run `git status` to ensure working tree status is understood.
- Inspect `git log -n 10 --oneline` and check for any accidental credential commits.
- Verify `.gitignore` excludes `.env`, `*.env`, `.env.*`, `userData/*.sqlite`.

### Stage 2: Electron Process & IPC Boundary Verification
- Check all `new BrowserWindow` instances in `src/main/`:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true`
  - `webSecurity: true`
- Check Preload scripts (`src/preload/`):
  - Must expose only typed wrappers via `contextBridge.exposeInMainWorld()`.
  - Must NOT expose raw `ipcRenderer`, Node built-in modules (`fs`, `child_process`), or internal handles.
- Check IPC handlers in `src/main/index.ts`:
  - Every `ipcMain.handle` must validate `isAuthorizedSender(event.sender)`.

### Stage 3: Tool Execution & Shell Safety
- Ensure `child_process.exec()` is NEVER used for external tool or browser execution.
- Validate all URL arguments with `new URL()` checking `protocol === 'http:' || protocol === 'https:'`.
- Use `spawn(executable, args, { shell: false })`.

### Stage 4: Policy Engine & Assistive Autonomy (ADR-004)
- Verify `policyEngine.evaluateAction()` categorizes operations:
  - `read_in`: inside workspace (allowed).
  - `read_out`: outside workspace (approval gated).
  - `write_in`: inside workspace (executable extensions approval gated).
  - `write_out`: outside workspace (approval gated).
  - `process`: command / dev server execution (approval gated).
- Verify `approval:resolve` re-checks `policyEngine.verifyApprovedAction(approvalId, currentArgs)`.

### Stage 5: Supply Chain & Dependency Inspection
- Run read-only audit:
  ```powershell
  npm audit --json
  ```
- Identify Critical / High CVEs in direct vs devDependencies.
- Note any unpatched vulnerabilities in audit reports.

### Stage 6: Database & Persistence Integrity
- Verify atomic database file writes using `.tmp` file and rename in `src/main/storage/database.ts`.
- Verify credentials stored in SQLite are encrypted with `safeStorage`.

### Stage 7: Automated Regression Test Run
- Execute Vitest test suite:
  ```powershell
  npm test
  ```
- Ensure 100% of tests pass before signing off on release readiness.

---

## Generating the Audit Report

Record findings in `docs/security/SECURITY_AUDIT_vX.X.X.md` and link it from `README.md`.
Use the findings classification:
- **CRITICAL:** Immediate remote or unprompted local code execution.
- **HIGH:** Gated command injection, policy bypass, or plaintext credential leak.
- **MEDIUM:** Sandboxing omission, symlink traversal, or missing window navigation guard.
- **LOW:** Repository hygiene, version mismatch, or logging gap.
