# ADR-004: Permission Categories and Approval Binding

**Status:** Accepted  
**Date:** 2026-10-22  
**Context:** T-002 benchmark observations (`docs/spike-results.md`), working plan section 5.4

## Context

The T-002 agent benchmark revealed that default desktop agent configurations execute dangerous operations without user awareness. Specifically, outside-workspace reads and inside-workspace writes executed without prompting for permission.

Jarvis requires a defense-in-depth permission model that empowers the assistant on low-risk tasks while giving the user absolute authority over sensitive, destructive, or external operations.

## Decision

1. **Permission Categories:**
   Tool capabilities are categorized into 6 distinct tiers:

| Category | Definition | Default Policy | UI Representation |
| --- | --- | --- | --- |
| `read_in` | Reading files/directories within an approved workspace | **Allowed** | Shown in real-time timeline |
| `read_out` | Reading paths outside approved workspaces (e.g., Desktop, User profile) | **Approval required** | Approval modal with full path |
| `write_in` | Creating/modifying files within approved workspace | **Allowed for new files**; overwrite/deletion requires approval | File creation event in timeline with diff preview |
| `write_out` | Creating/modifying files outside approved workspaces | **Approval required** | Approval modal with target path and content preview |
| `process` | Launching child processes, development servers, shell scripts | **Approval required** | Modal showing executable, arguments, working dir, and environment |
| `network` | Outbound web search, page navigation, external downloads | **Allowed for read-only**; downloads restricted to Jarvis staging folder | Timeline entry with source URLs and byte counts |

2. **Cryptographic Approval Binding:**
   - Approvals are never generic ("allow bash forever").
   - An approval request generates a cryptographically bound token:
     $$\text{Token} = \text{HMAC-SHA256}(\text{ActionType} \parallel \text{WorkspaceID} \parallel \text{CanonicalArgumentsHash}, \text{SessionSecret})$$
   - Tokens have an expiration lifetime of **5 minutes** and are strictly single-use.
   - If the agent or model alters any argument (e.g. changing the target file path or adding a command flag), the token validation fails immediately, requiring a new approval prompt.

3. **Denial and Cancellation Semantics:**
   - When a user clicks **Deny**, the approval token is permanently invalidated.
   - The policy engine returns an immediate `UserDeniedActionError` to the agent runtime.
   - The agent runtime must **never silently retry** a denied action with slight syntactic variations. It must immediately halt that branch of execution, notify the user, and ask for alternative guidance or complete with a partial report.

4. **Process Constraints:**
   - Process execution must never run with Windows Administrator privileges.
   - Jarvis only tracks and stops processes it started itself (`owned_processes` table in SQLite); it never terminates arbitrary OS processes by PID or image name.

## Consequences

- Prevents prompt injection attacks from exfiltrating sensitive files or dropping malicious payloads outside the active project.
- Prevents accidental destruction or silent overwriting of user code.
- Guarantees complete auditability of all side-effecting operations in the local event store.
