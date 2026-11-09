# ADR-008: Autonomy, Trust and Learning

**Status:** Accepted
**Date:** 2026-11-09
**Context:** Owner interview (docs/VISION.md); extends ADR-004 (permission categories and approval binding)

## Context

The owner wants an agent that can eventually control the whole PC, keeps trying until it succeeds, and improves from its own history — and later from other Jarvis instances through Jarvis-hub. ADR-004 defines per-action approval but not how autonomy is earned, how far the agent should push before asking, or how experience is stored and reused.

## Decision

1. **Graduated trust.** An action class is a tool plus a scope (for example "edit files in `C:\work\softwares\jarvis`", "browse github.com"). New classes always ask. A class becomes autonomous after 5 clean approved runs within 30 days; "clean" means no rollback and no complaint. Any rollback or complaint resets the class to "ask". A settings page lists earned classes with revoke buttons. Every autonomous action is logged.

2. **Red lines never earn autonomy:** spending money; messaging new recipients as the owner; deleting or overwriting data without a backup; using or changing credentials; installing software or changing security settings; acting on other people's accounts or machines; publishing to Jarvis-hub.

3. **Control levels are added in order**, each with its own permission class and acceptance tests: PowerShell tool → Windows UI Automation → screenshot and vision → system settings, services and installs. The PowerShell tool parses every command with PowerShell's own parser; read-only commands run freely inside approved folders; everything else asks until trust is earned for that command family and folder; commands never run elevated; every run is logged with output; file-mutating commands get a checkpoint where possible.

4. **The agent loop is plan → act → verify → reflect → next strategy.** A strategy ledger records each approach and its failure reason; an approach is never repeated. The default budget is 15 minutes or 8 distinct strategies, adjustable per task. Jarvis asks early only for owner-only decisions (a preference, a credential, money, a gated action); otherwise it exhausts its strategies, then reports everything it tried.

5. **Web escalation ladder:** known API or URL → raw HTML extraction → Jarvis's own isolated headless browser → crawl (per-site approval, remembered; `robots.txt` and rate limits respected) → the owner's logged-in Chrome over CDP (per-site approval, remembered) → alternative sources → ask the owner with a report.

6. **Privacy levels.** Private data never goes to anonymous or keyless providers and prefers the local model once it exists. Public research may go to any provider. Content returned by tools (web pages, files, imported playbooks) is labelled untrusted before the model reads it and can never change policy or trust.

7. **Learning artifacts.**
   - *Task records*: structured, local, secrets stripped, kept indefinitely; raw tool output older than 90 days compressed to a summary; deletable by the owner.
   - *Playbooks*: 10–40 line lessons written after tasks, retrieved before similar tasks, promoted to runtime skills when proven. Runtime skills stay short and purpose-built.
   - *Jarvis-hub*: Jarvis drafts and scrubs posts (playbook plus readable blog version); the owner approves every post; imported playbooks are untrusted suggestions until they work locally; posts are signed per instance and sources can be blocked.
   - *Local model*: a gateway provider; LoRA fine-tuning is an offline step from exported records and playbooks.

8. **Progress is measured.** Safety acceptance tests run on every change. A weekly eval suite of about 20 real tasks tracks success rate, time, strategies used and repeat-task improvement, shown as a trend chart.

## Consequences

- Autonomy grows with evidence instead of by configuration, and is reversible.
- Undo (per-task checkpoints, ADR-007) becomes a prerequisite for trust, not a convenience.
- The strategy ledger and budgets make long, stubborn runs possible without infinite loops.
- Task records and playbooks must be designed for export and scrubbing from the first version, because they become training data and hub content.
- Imported hub content is treated as a prompt-injection vector by design.
