# `@jarvis/voice` — Optional Voice Subsystem

This package isolates JARVIS's voice capabilities (Speech-to-Text, Text-to-Speech, Voice Activity Detection, and optional Wake Word) into its own workspace folder so it remains **optional for downloaders**.

## Design Principles

- **Zero forced download bloat:** The base `@jarvis/desktop` installer does not bundle large local ONNX/speech weights or audio runtimes.
- **Interface-first:** All intelligence stays in `@jarvis/core`; voice is an optional I/O layer behind `SpeechToTextProvider`, `TextToSpeechProvider`, `VADProvider`, and `WakeWordProvider`.
- **Hybrid audio architecture:** Renderer `AudioWorklet` capture (with OS Acoustic Echo Cancellation for safe barge-in) paired with pluggable local ONNX (`sherpa-onnx-node` / `kokoro-js`) or explicit opt-in cloud endpoints.
