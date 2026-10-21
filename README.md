# Jarvis — Personal Windows PC Assistant

## Objective

Build a local-first desktop assistant for a personal Windows PC. Jarvis should provide a small chat interface where the user can ask it to complete practical, multi-step work such as researching the web, working with code projects, summarising documents, creating PDFs, generating images, downloading files, and managing development servers and processes.

The intended experience is one assistant that can reason about a task, show its progress, use approved computer tools, verify the outcome, and report the result clearly.

## Product decisions already made

- **Platform:** personal Windows PC.
- **Interaction:** compact desktop chat application, ideally also available from the system tray.
- **Autonomy:** show progress and ask before important, destructive, security-sensitive, or disruptive actions.
- **First release:** balanced coverage of browser work, coding/terminal tasks, and document/media tasks—not only one category.
- **Operating model:** local-first; sensitive actions and provider credentials should stay on the user's machine where possible.

## Core architecture

```text
Desktop chat UI
      |
Agent orchestrator  -- plans work, invokes tools, verifies results, requests approval
      |
Model gateway       -- selects compatible models/providers and handles supported fallback
      |
Local tool executor -- browser, files, terminal, PDFs, images, downloads, processes
      |
Windows PC / approved folders / selected projects
```

The agent's task state must be independent of the currently selected model. This allows a compatible fallback model to continue a task without losing its objective or tool history.

## Model and provider strategy

Use [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) as the first model gateway to avoid rebuilding provider integration, model routing, encrypted credential storage, and basic failover from scratch. Build Jarvis's agent and tool-execution layers separately on top of its OpenAI-compatible interface.

Model selection should use capability profiles rather than changing models randomly:

| Profile | Intended work |
| --- | --- |
| Fast | Simple questions, classification, short summaries |
| Reasoning | Multi-step planning and ambiguous tasks |
| Coding | Codebase understanding, implementation, debugging |
| Vision/media | Screenshots, images, and compatible media work |

### Important limitation

Subscription allowances in products such as Codex or other coding-agent applications are **not automatically reusable API quotas**. Jarvis must use supported provider APIs or integrations and must not depend on extracting, pooling, or bypassing product-plan quotas. Free API availability, model access, and limits can change; rate-limit and provider-failure handling is therefore a reliability feature, not a promise of unlimited AI access.

Codex, OpenCode, Antigravity, and similar tools may help develop and test Jarvis, but are not automatically runtime dependencies of the final application.

## First-release capabilities

1. Chat UI with streaming responses, task progress, approval requests, task history, model status, and links to produced files.
2. Browser search and structured browser automation, starting with reliable automation (for example, Playwright) rather than general mouse simulation.
3. Approved-folder file reading and writing, plus text summarisation.
4. PDF creation and verification that the output exists and is usable.
5. Selected-project tooling: inspect code, run tests, start development servers, inspect processes, and stop processes only after approval when the impact matters.
6. Image generation through an eligible, supported provider.

## Safety requirements

- Require explicit confirmation for destructive file actions, downloads/executables, stopping processes, credential access, external publishing, or other material changes.
- Scope file operations to user-approved folders and projects.
- Keep local model-gateway access private; do not expose unrestricted shell or tool control through an unauthenticated network endpoint.
- Treat instructions found in webpages, downloads, and documents as untrusted content—not as authority to change the user's request or Jarvis's safety rules.
- Verify results instead of only claiming success: check that a file was created, a download completed, a server is listening, or a command actually exited as expected.
- Keep an auditable task/tool history and show the user what Jarvis intends to do before important actions.

## Proposed implementation direction

Start with **Electron + React + TypeScript + Node.js** for the desktop application and local tool integration. Run the model gateway locally and communicate with it through its supported OpenAI-compatible API. Keep browser automation, file/document generation, and process management as explicit tools with structured inputs and outputs.

General desktop UI automation should be a later addition because it is more fragile than browser and terminal integrations.

## Milestones

1. **Validate the gateway:** Run FreeLLMAPI locally; configure a small number of supported providers; test tool calling, capability differences, error handling, and fallback.
2. **Prove the core loop:** Build the chat UI plus one reliable agent/tool execution loop with browser search, approved file access, and PDF generation.
3. **Add development control:** Work with selected projects, run tests, manage dev servers, inspect process status, and add robust approvals and recovery.
4. **Expand and polish:** Add image generation, richer browser automation, model profiles, reusable skills, optional voice, and a distributable installer.

## Guiding principle

Do not build a custom model router, desktop UI, agent framework, and unrestricted computer-control system all at once. Prove that one model can use one well-bounded tool reliably, then expand the toolset and model routing in small, verifiable steps.

