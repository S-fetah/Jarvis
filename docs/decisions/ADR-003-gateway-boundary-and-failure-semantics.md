# ADR-003: Gateway Boundary and Failure Semantics

**Status:** Accepted  
**Date:** 2026-10-22  
**Context:** T-001 validation results (`docs/spike-results.md`), ADR-001

## Context

T-001 validated the local FreeLLMAPI gateway (`http://127.0.0.1:31415/v1`) across model listing, basic chat, streaming, and structured tool-call requests. Key observations from the spike included:
1. **Non-deterministic `auto` routing:** Multiple requests using model `"auto"` routed inconsistently to different upstream models (`gemini-robotics-er-2-preview`, `gemini-3.6-flash`, `gemini-flash-lite-latest`).
2. **Transient upstream `HTTP 502` errors:** Occurred intermittently during chat and tool-call requests while the local gateway process itself remained healthy.
3. **Wide latency spread:** Request durations ranged from 1.4 seconds to over 64 seconds.
4. **TTFT measurement discrepancy:** Streamed connections had initial hold times (~3.3 s) that must be captured from the instant of request dispatch, not when the body stream opens.

## Decision

1. **Replaceable Gateway Adapter:** Access the gateway via an internal `IModelGateway` interface adhering to the OpenAI Chat Completions and Streaming specifications. The application logic must remain decoupled from FreeLLMAPI-specific implementation details so alternative backends (Ollama, LM Studio, direct provider APIs) can be substituted.
2. **Deterministic Model Pinning:**
   - Normal mode must pin concrete model IDs (queried dynamically via `GET /v1/models`) per task profile (e.g., fast research vs. complex coding).
   - The gateway's `"auto"` routing will not be used for primary execution; it may only be used as a resilience fallback if a configured model is unavailable.
3. **Upstream 5xx and Network Failure Semantics:**
   - Differentiate local gateway unreachability (`ECONNREFUSED`) from upstream provider errors (`HTTP 502 / 503 / 504`).
   - For transient upstream 5xx errors, perform exactly **one bounded retry** after a 3-second delay with exponential backoff before surfacing the failure.
   - Never retry non-idempotent side effects (e.g. file mutations, process commands) automatically upon upstream LLM failure; retries apply only to model inference requests.
4. **Precise Latency Instrumentation:**
   - Time-to-First-Token (TTFT) clock starts immediately upon invoking the network dispatch (`fetch()`), incorporating connection negotiation and queueing.
   - Telemetry captures: request timestamp, pinned model ID, actual routed model (from response headers), TTFT, total elapsed duration, and completion token count.
5. **Credential Security Boundary:**
   - Gateway unified API keys or provider keys are read solely from process environment variables or secure local stores.
   - Keys must never be written to SQLite, committed to Git, passed into the unprivileged renderer process, or displayed in UI event streams.

## Consequences

- Consistent, reproducible agent behavior by avoiding erratic routing shifts.
- Graceful recovery from transient upstream drops without stalling the user.
- Accurate benchmarks to guide future hedged request budgets (as specified in ADR-001).
- Strong protection against credential exposure across the IPC boundary.
