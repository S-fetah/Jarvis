# Jarvis — Vision and Roadmap

**Status:** Agreed with the owner on 2026-11-09 (three interview rounds, all decisions accepted).
**Supersedes:** the direction of `Jarvis_Project_Implementation_Plan.md` from Phase 8 onward. Phases 0–7 stay as recorded in `PROGRESS.md`.
**Architecture decisions:** [ADR-007 — Core service architecture](decisions/ADR-007-core-service-architecture.md) · [ADR-008 — Autonomy, trust and learning](decisions/ADR-008-autonomy-trust-and-learning.md)

## 1. What Jarvis is for

An assistant in the spirit of Iron Man's Jarvis: one agent the owner can rely on for everything, eventually trusted with the whole PC and then several PCs. It learns by trying, failing and recording what worked. It pushes its own options to the limit before asking for help, and asks early only for decisions that belong to the owner.

Later, two extensions:

- **A local model** (8–10B parameters, on the owner's own GPU) trained on Jarvis's own task history and playbooks.
- **Jarvis-hub**, a blog where Jarvis instances publish what they learned, so every instance can learn from other people's experience.

The architecture below is chosen so that both extensions, and multi-PC control, arrive without a rewrite.

## 2. Product decisions

| Area | Decision |
| --- | --- |
| Audience | Personal first. One owner per install. Other people run their own copy; copies share only through Jarvis-hub. |
| Trust | Graduated trust: autonomy is earned per action class (tool + scope) after 5 clean approved runs in 30 days, reset by any rollback or complaint, always revocable from a settings page. |
| Red lines (always ask) | Spending money; messaging new recipients as the owner; deleting or overwriting data without a backup; using or changing credentials; installing software or changing security settings; acting on other people's accounts or machines. Hub publishing counts as "speaking as the owner" and is never automatic. |
| PC control, in order | 1. PowerShell tool (commands parsed; read-only commands run freely in approved folders; never elevated). 2. Windows UI Automation tree. 3. Screenshot + vision as a last resort. 4. System settings, services and installs behind the red lines. Each level gets its own permission class and acceptance tests before the next starts. |
| Several PCs | One core (brain, memory, models) plus a small node agent on each of the owner's machines, over an encrypted private network such as Tailscale. Designed now, built after single-PC is reliable. |
| Models | Hybrid. Free and local models by default; a capped paid frontier model ($10–20/month) for hard tasks; spend always visible. Models live in config, are assigned to roles (planner, reflector, worker, private), and are checked weekly for retirement. |
| Privacy | Two levels. Private data (files, mail, credentials, screenshots) never goes to anonymous or keyless providers and prefers the local model once it exists. Public research may go to any provider. Nothing leaves the PC without approval except normal model calls. |
| Persistence | Default budget per task: 15 minutes or 8 genuinely different strategies, adjustable per task. Then Jarvis reports everything it tried and asks for help. |
| Initiative | Proactive: background jobs and watchers, approved when created, notifying through the tray, the mascot and later voice. |
| Voice | Part of the core experience, built after the reliable core. |
| Records | Every task is stored as a structured record (goal, plan, steps, tool calls, results, failures, what worked, feedback), locally, with secrets stripped. Kept indefinitely; raw tool output older than 90 days is compressed to a summary. The owner can delete anything. |
| Measuring progress | Safety acceptance tests on every change; a weekly eval suite of about 20 real tasks with a trend chart showing success rate, time, strategies and repeat-task improvement. |

## 3. How Jarvis tries (the escalation ladder)

Jarvis works in a loop: **plan → act → verify → reflect → next strategy**. A strategy ledger records every approach and why it failed, so Jarvis never repeats an approach. Planning and reflection use the strongest available model when the task is hard; routine actions use cheap or local models.

For getting information from the web, the ladder is:

1. Known API or direct URL (starting from playbooks).
2. Fetch the raw HTML and extract the data.
3. Jarvis's own isolated headless browser (empty profile, never logged in to the owner's accounts).
4. Crawl several pages, respecting `robots.txt` and rate limits — asks once per site, remembered.
5. The owner's real, logged-in Chrome over CDP — asks once per site, remembered.
6. Look for alternative sources with the same information.
7. Ask the owner, with a report of every attempt.

## 4. How Jarvis learns

- **Task records** are the raw history and the future training data.
- **Playbooks** are short lessons (10–40 lines) Jarvis writes after a task: what worked, what failed and why, tied to a site, app or task type. They are retrieved before similar tasks. A playbook that keeps working is promoted to a **runtime skill**. Runtime skills are short and purpose-built; long imported skills are retired.
- **Jarvis-hub** shares playbooks. Jarvis drafts a post (playbook plus a readable blog version), a scrubber removes personal data, and the owner approves every post. Playbooks imported from other instances are untrusted suggestions: kept apart, never able to change policy or trust, and adopted only after they work locally. Posts are signed per instance so bad sources can be blocked.
- **The local model** is one more provider in the gateway. Fine-tuning (LoRA) is a separate offline step from exported, cleaned records and playbooks.

## 5. Roadmap

Rule: fix safety first, then migrate one module at a time with the tests green after every step. Never a rewrite.

| Phase | Goal | Exit criteria |
| --- | --- | --- |
| **8 — Safety baseline** (next) | Close the 8 acceptance failures in the current code: route email, Gmail send, file patch, overwrite and browser actions through the policy engine; fail closed when no approval channel exists; label tool output as untrusted; make tasks cancellable; put a token and Origin check on the local gateway; move data out of the working directory. | `npm run test:acceptance` 20/20; unit tests green. |
| **9 — Monorepo** | npm workspaces: `packages/protocol` (shared types and API schema), `packages/core` (agent, policy, gateway, storage, tools) — still hosted by Electron main — and `apps/desktop`. | App behaves as before; all suites green. |
| **10 — `jarvis-core` service** | Core runs as its own per-user background process with the locked-down API (ADR-007); the desktop app becomes a client; core and tray start at login; storage moves to `%APPDATA%\Jarvis\` on `node:sqlite`. | Closing every window leaves Jarvis running; acceptance suite runs against the core. |
| **11 — Durable tasks** | Tasks as saved state machines: pause for approval and resume with the result back to the model, cancel, reboot recovery, scheduled jobs; structured task records; per-task file checkpoints with one-click rollback. | Approve-then-continue works end to end; rollback restores files; records are written for every task. |
| **12 — Persistent agent** | Plan–act–verify–reflect loop with strategy ledger and budgets; models in config with roles, retirement check and paid cap with spend counter. | Eval tasks that need more than 5 turns succeed. |
| **13 — Learning loop** | Playbooks written and retrieved (FTS5); promotion to runtime skills; long imported runtime skills replaced; weekly eval suite with trend chart. | Measurable improvement on repeated eval tasks. |
| **14 — Web ladder** | HTML extraction, isolated headless browser, crawler and logged-in Chrome with per-site approval. | Ladder acceptance tests pass; eval web tasks succeed. |
| **15 — PC control, level 1** | Tool servers (MCP) for new tool families; PowerShell tool with parser-based gating; graduated-trust ledger and settings page. | Shell acceptance tests pass; trust can be earned and revoked. |

**Three-month target (early February 2027):** phases 8–13 done and phase 14 started — the safety suite green, research-to-document and coding tasks done end to end on real projects, measurable improvement on repeated tasks, and the core running as a background service.

**After that, in order:** Windows UI Automation (control level 2), vision fallback (level 3), proactive watchers, voice, the local model and fine-tuning export, multi-PC nodes over Tailscale, Jarvis-hub. Each of these gets its own short design interview when it is reached.
