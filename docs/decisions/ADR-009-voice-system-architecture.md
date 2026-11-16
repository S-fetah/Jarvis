# ADR-009: Voice System Architecture — CPU-Optimized Voice Cloning, Streaming Pipeline & Add-on Distribution

**Status:** Accepted  
**Date:** 2026-11-16  
**Deciders:** Project Owner, AI Systems Architect  
**Consulted:** `docs/decisions/ADR-001` through `ADR-008`, `docs/VISION.md`, `packages/voice/`  

---

## 1. Context and Problem Statement

JARVIS is evolving toward an autonomous, persistent, agentic personal computer assistant. Voice must be treated as a **first-class interface to the core agent intelligence**, rather than an isolated speech feature. The same orchestrator, memory ledger, planning loop, and safety policies must be accessible whether the prompt originates from keyboard, quick-chat drawer, background scheduler, or microphone.

When running on **CPU-only desktop hardware** without an NVIDIA GPU, voice cloning presents a significant technical bottleneck:
1. **Repeated Cloning Latency:** Running zero-shot voice cloning (like raw XTTS-v2 or diffusion models) on every turn from scratch takes 4,000–9,000 ms on CPU, causing unacceptable lag.
2. **CPU Contention with UI:** Unbounded matrix multiplication threads cause Electron's 60 FPS UI thread and 3D mascot animations to stutter.
3. **Voice Resemblance vs. Inference Speed:** High-resemblance models are computationally heavy, while ultra-fast models often sound generic or lack exact acoustic timbre matching.

We need a clean, provider-agnostic voice architecture tailored for **CPU-only execution** that achieves:
- **Exact-speaker voice cloning** (cloned from a 3–10s audio sample).
- **Sub-second Time-To-First-Audio (<600ms TTFA)**.
- **Hardware-level barge-in interruption (<150ms)**.
- **Strict CPU thread throttling** to maintain 60 FPS desktop fluidity.

---

## 2. Decision Tree & Architecture Resolutions (Design Interview)

Through our interactive design interview, the following decisions were finalized:

1. **Voice Cloning Paradigm: Pre-baked / One-Time Cached Profiles**
   - Reference audio (3–10s WAV) is analyzed **once** during setup to produce persistent speaker embedding artifacts (`xtts_speaker.bin` and `kokoro_style.bin`).
   - At runtime, synthesis runs directly against the precomputed profile with **zero repeated cloning latency**.
2. **Dual-Engine Balancing for CPU**:
   - **Priority 1 (Maximum Resemblance)**: Coqui XTTS-v2 running INT8 / OpenVINO with precomputed `gpt_cond_latent` (~700–900ms TTFA on sentence chunks on modern multi-core CPU).
   - **Automatic Fallback (Zero-Lag Native)**: Kokoro-82M ONNX using the pre-baked style vector (<150ms TTFA on CPU) if XTTS-v2 times out (>1000ms) or when system load is high.
   - **Cloud Fallback**: Edge-TTS (Azure Neural) for zero-weight out-of-the-box operation.
3. **Voice Library & Setup Workflow (Hybrid Approach)**:
   - **Pre-baked Iconic Profiles**: Ships with out-of-the-box assistant profiles (e.g., *British Butler / Jarvis*, *Calm Analyst*) with pre-extracted style embeddings for instant use with zero setup.
   - **In-App Voice Studio (Settings)**: Allows uploading or recording a custom 5-second sample, analyzing it in ~10 seconds on CPU, and previewing the cloned voice with one click.
4. **CPU Thread Throttling & Process Isolation**:
   - Inference runs in a dedicated Electron `utilityProcess` capped at `max(1, CPU_cores - 2)` threads (`OMP_NUM_THREADS`).
   - A **200ms adaptive jitter queue** in the Web Audio renderer guarantees smooth continuous playback without stutter while keeping the UI render thread locked at 60 FPS.
5. **Speech-to-Text (STT) Strategy**:
   - **Cloud Fast-Lane (Default)**: Groq Whisper API (~150ms latency) for near-instant response.
   - **Offline Local STT**: Automatically cascades to Local Quantized Whisper ONNX (`base.en` / `tiny.en`, ~400ms on CPU) when offline or in Strict Local Mode.
   - **VAD**: Silero VAD v5 ONNX (<1% CPU on a single core, 32ms frame chunking).
6. **Desktop UI Integration & Mascot Reactivity**:
   - Omnipresent microphone button in Main Window and Quick-Chat composer supporting both **click-to-talk** and **push-to-talk hotkey** (`Ctrl+Shift+Space` or `Space`).
   - Real-time animated audio waveform indicator.
   - Reactive 3D Owl mascot state bindings: `listening` (alert ears/eyes), `thinking` (glow), `speaking` (beak/head sync), `interrupted` (instant snap).

---

## 3. Technology Evaluation Matrix (CPU Baseline)

| Component | Selected Engine | Execution Runtime | CPU Latency | Memory / Footprint | License |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **VAD** | **Silero VAD v5** | `onnxruntime-node` | ~30 ms (32ms frames) | ~2 MB | MIT |
| **STT (Fast Cloud)** | **Groq Whisper** | HTTPS REST | ~150 ms | 0 MB | Cloud API |
| **STT (Local Offline)** | **Whisper ONNX (`base.en`)** | `onnxruntime-node` | ~350–500 ms | ~75 MB | MIT |
| **TTS (Primary Cloned)** | **Coqui XTTS-v2 (INT8)** | Python/OpenVINO Sidecar | ~700–900 ms (chunked) | ~1.8 GB | CPML v1.0.0 (non-comm) |
| **TTS (Fast Fallback)** | **Kokoro-82M ONNX** | `onnxruntime-node` | ~150–250 ms | ~80 MB | Apache 2.0 |
| **TTS (Zero-Weight)** | **Edge-TTS** | Streaming HTTPS MP3 | ~200 ms | 0 MB | Free / Unofficial |
| **Wake Word (Phase V5)** | **openWakeWord** | `onnxruntime-node` | ~80 ms | ~8 MB | Apache 2.0 |

---

## 4. System Topology & Data Flow

```text
       ┌────────────────────────────────────────────────────────┐
       │                ELECTRON RENDERER PROCESS               │
       │                                                        │
       │   ┌────────────────────┐      ┌────────────────────┐   │
       │   │  Microphone Input  │      │ AudioContext Play  │   │
       │   │  (16kHz AudioWork) │      │ (200ms Jitter Que) │   │
       │   └─────────┬──────────┘      └─────────▲──────────┘   │
       └─────────────┼───────────────────────────┼──────────────┘
                     │ PCM 16kHz stream          │ Audio chunks
                     ▼                           │
       ┌────────────────────────────────────────────────────────┐
       │     DEDICATED VOICE UTILITY PROCESS (@jarvis/voice)    │
       │     (Capped at CPU_CORES - 2 threads, OMP_NUM_THREADS) │
       │                                                        │
       │   ┌────────────────────┐      ┌────────────────────┐   │
       │   │   Silero VAD v5    │      │   TTS Dispatcher   │   │
       │   │  (Speech Boundary) │      │  (Cascading Router)│   │
       │   └─────────┬──────────┘      └─────────▲──────────┘   │
       │             │ Speech Frame              │              │
       │             ▼                           ├── Priority 1: XTTS-v2 Precomputed Latent (~800ms)
       │   ┌────────────────────┐                ├── Fallback 1: Kokoro-82M Style Vector (<150ms)
       │   │   STT Dispatcher   │                └── Fallback 2: Edge-TTS / Cloud
       │   │ (Groq -> Whisper)  │                │ Sentence chunk
       │   └─────────┬──────────┘      ┌─────────┴──────────┐   │
       │                               │  Sentence Chunker  │   │
       │                               │  Buffer & Tokenizer│   │
       │                               └─────────▲──────────┘   │
       └─────────────┼───────────────────────────┼──────────────┘
                     │ Final Transcript          │ Token Stream
                     ▼                           │
       ┌────────────────────────────────────────────────────────┐
       │             PACKAGES/CORE (AGENT ORCHESTRATOR)         │
       │                                                        │
       │   Intent Router -> Memory -> Policy Engine -> Gateway  │
       └────────────────────────────────────────────────────────┘
```

---

## 5. Conversational State Machine with Barge-in

```text
[IDLE] ──(Mic Click / Push-to-Talk / Wake Word)──> [LISTENING]
  ▲                                                      │
  │                                                      ▼ (Silence > 500ms)
  │                                                 [TRANSCRIBING]
  │                                                      │
  │                                                      ▼ (Transcript Ready)
  │                                                   [THINKING] (LLM Streaming)
  │                                                      │
  │                                                      ▼ (First Sentence Chunk Ready)
  │                                                   [SPEAKING] (XTTS-v2 -> Kokoro Fallback)
  │                                                      │
  └───(Playback Finished / User Silent)──────────────────┼──(VAD Speech Detected)──> [INTERRUPTED]
                                                                                         │
                                                                                         ▼
                                                                                     [LISTENING]
```

---

## 6. Phased Implementation Roadmap

### Phase V1: Streaming Audio Pipeline & Cloud Providers (Zero-Weight Foundation)
- Web Audio API microphone capture (`AudioWorklet`, 16kHz mono PCM).
- Web Audio output playback queue with instant `stop()` and 200ms jitter buffer.
- Cloud STT: Groq Whisper API (`SpeechToTextProvider`).
- Cloud TTS: Edge-TTS (`TextToSpeechProvider`).
- Omnipresent mic button in Main & Quick-Chat composer with click and push-to-talk (`Space`).
- End-to-end voice loop operational with **0 MB local model downloads**.

### Phase V2: Silero VAD & Instant Barge-in
- Silero VAD v5 ONNX integration in `packages/voice`.
- Frame streaming evaluation (32ms frames @ 16kHz).
- Barge-in controller: auto-mute audio output (<150ms) and dispatch `AbortSignal` to LLM/TTS streams when user speaks.
- 3D Mascot visual state bindings (`listening`, `thinking`, `speaking`, `interrupted`).

### Phase V3: CPU-Optimized Voice Cloning & Dual-Engine TTS
- **Phase V3.1 (Kokoro-82M Universal Baseline)**: `KokoroTTSProvider` (`kokoro-js`) on ONNX Runtime with sentence chunker (<150ms TTFA on CPU).
- **Phase V3.2 (Voice Profile Pre-baking)**: Voice Profile Studio in Settings (audio sample upload/record $\rightarrow$ precomputes persistent `xtts_speaker.bin` and `kokoro_style.bin`).
- **Phase V3.3 (XTTS-v2 Precomputed Inference)**: `XttsV2Provider` streaming adapter with cached latents for exact voice resemblance.
- **Phase V3.4 (Cascading Failover)**: `TTSDispatcher` cascading router (XTTS-v2 $\rightarrow$ Kokoro-82M $\rightarrow$ Edge-TTS).

### Phase V4: Local Offline STT (Whisper ONNX)
- Quantized Whisper `base.en` ONNX provider for 100% offline air-gapped speech recognition.
- Automatic failover matrix (Cloud Groq $\rightarrow$ Local Whisper ONNX).

### Phase V5: Wake Word Engine ("Jarvis")
- `openWakeWord` pipeline in background listener for hands-free wake word activation.
