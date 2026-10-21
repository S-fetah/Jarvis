# ADR-001: Response latency and hedged model requests

**Status:** Accepted for implementation after the read-only agent loop exists  
**Date:** 2026-10-21

## Context

During T-001, a user-performed basic gateway request completed successfully but took approximately **58 seconds**. One result is not a benchmark, but it is enough to make response latency a first-class product requirement.

FreeLLMAPI can rank one route using observed reliability, time-to-first-byte, and throughput. It also falls back after failures. That is useful as the default path, but it is not the same as asking multiple independent candidates and returning the first usable response.

## Decision

Jarvis will use a staged response-latency policy:

1. **Default to a single fast, capable route.** Select a model/profile based on task requirements and measured gateway telemetry. Prefer the gateway's fastest routing strategy when the task does not require a specific stronger model.
2. **Measure before optimizing.** Record redacted latency metrics per request: time-to-first-token, total completion time, selected model/provider, streaming status, outcome, and error class.
3. **Use a bounded hedge only when appropriate.** If a read-only request has not produced useful output inside its latency budget, or the user explicitly prefers speed, send the same request to at most two additional compatible candidates.
4. **Commit to the first valid result, not merely the first byte.** For prose, require meaningful visible text; for structured planning, require schema-valid output. When one candidate wins, abort the remaining requests through `AbortController` and log that they were cancelled.
5. **Never hedge actions with side effects.** Do not race model calls that can independently invoke tools, write files, send data, download files, start processes, or request approval for an action. Use a single selected model once a task reaches an execution step.

## Planned user modes

These modes are a later product feature, not part of the first spike:

| Mode | Behavior | Intended use |
| --- | --- | --- |
| Normal | One selected model/profile handles the task. | Default, predictable quota use. |
| Racing | A bounded set of compatible models competes for the first valid **read-only** result. | Time-sensitive research, summaries, and planning. |
| Multi-agent | Several explicitly named roles work on separate parts of a task and return reviewable results. | Larger work requiring comparison, planning, implementation, or review. |

The UI must disclose the chosen mode, participating model profiles, expected quota/latency tradeoff, and whether the task is eligible. Multi-agent mode must keep side-effecting work behind the same policy and approval broker; it is not permission for concurrent unrestricted computer control.

## Guardrails

- Default hedge fan-out: maximum 3 total requests (primary plus two hedges).
- Start with conservative budgets: approximately 8 seconds without useful streamed output before the first hedge, then a hard request deadline. Tune these only from measured data.
- Do not hedge sensitive prompts across multiple external providers unless the user has explicitly enabled that behavior.
- Do not use hedging as a replacement for timeouts, retries, cancellation, or fallback classification.
- Track duplicate token/call cost against free-tier quotas; turn hedging off when its benefit does not justify the quota cost.
- Preserve one task state and one approved action path regardless of which model generated the plan.

## Consequences

The UI will show whether Jarvis is waiting for a primary model, racing compatible candidates, or has selected a winning response. It must also explain when speed mode is unavailable because the request is sensitive, tool-bearing, or quota-limited.

This is intentionally deferred until the read-only agent loop and model adapter exist. T-001 will first collect multiple latency samples to establish a realistic budget.

