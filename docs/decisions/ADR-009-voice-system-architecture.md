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
| **TTS (Neural Voice Cloning)** | **OpenVoice V2 (Tone Color Converter)** | Python CPU / FastAPI (`:8020`) | ~0.58x RTF (~4.6s for 8s audio) | ~131 MB | MIT |
| **TTS (High-Resemblance GPU)** | **Coqui XTTS-v2 (INT8)** | Python/OpenVINO Sidecar | ~700–900 ms (chunked) | ~1.8 GB | CPML v1.0.0 (non-comm) |
| **TTS (Fast Fallback)** | **Kokoro-82M ONNX** | `onnxruntime-node` | ~150–250 ms | ~80 MB | Apache 2.0 |
| **TTS (Zero-Weight Base)** | **Edge-TTS** | Streaming HTTPS MP3 | ~200 ms | 0 MB | Free / Unofficial |
| **TTS (Offline SAPI Fallback)** | **Windows System.Speech** | SAPI5 / PowerShell interop | ~50 ms | 0 MB | Built into Windows |
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
- **Phase V3.1 (Kokoro-82M Universal Baseline)**: `KokoroTTSProvider` (`kokoro-js`, `onnx-community/Kokoro-82M-v1.0-ONNX` q8, ~86MB) running 100% locally on CPU (<150ms TTFA) with 28 native expressive voices across female (`af_heart`, `af_bella`, `af_sarah`, `bf_emma`) and male (`bm_george` [British Butler], `am_michael`, `am_adam`, `bm_lewis`) personas.
- **Phase V3.2 (Voice Profile Pre-baking & Persona Matching)**: Voice Profile Studio in Settings (audio sample upload/record $\rightarrow$ precomputes persistent `xtts_speaker.bin` and `kokoro_style.bin` with automatic acoustic pitch/keyword gender detection and companion CPU base voice assignment).
- **Phase V3.3 (XTTS-v2 Precomputed Inference)**: `XttsV2Provider` streaming adapter with cached latents for exact zero-shot voice resemblance when server is online.
- **Phase V3.4 (Cascading Failover & SAPI Gender Preservation)**: `VoiceManager` intelligent engine routing (Auto $\rightarrow$ XTTS-v2 for neural cloning when server active $\rightarrow$ Kokoro-82M CPU companion $\rightarrow$ Edge-TTS $\rightarrow$ Windows System.Speech SAPI with strict gender preservation: female $\rightarrow$ `Microsoft Zira Desktop`, male $\rightarrow$ `Microsoft David Desktop`).
- **Phase V3.5 (Interactive Voice & Cloned Profile Playground)**: Dedicated Settings test studio supporting custom paragraphs, speed adjustment (0.5x–2.0x), quick presets, audio playback, and active engine/voice resolution badges.
- **Phase V3.6 (High-Fidelity J.A.R.V.I.S. Neural Voice Cloning via OpenVoice V2)**:
  - **Acoustic Challenge Resolved**: Static LibriTTS models (e.g. Kokoro `bm_george`) fail to reproduce Paul Bettany's iconic J.A.R.V.I.S. vocal signature due to flat formant contours, absent vocal fry, and mismatched fundamental frequency.
  - **Model Architecture**: Integrated **OpenVoice V2 Tone Color Converter** (`ToneColorConverter`, ~131MB checkpoint), which decouples style and prosody from speaker tone color.
  - **Two-Stage Generation Pipeline**:
    1. *Stage 1 (Base Prosody)*: Generates articulate British Received Pronunciation (RP) base speech via `en-GB-RyanNeural` or Kokoro `bm_george`.
    2. *Stage 2 (Timbre Transformation)*: Converts the base mel-spectrogram into the exact acoustic timbre of J.A.R.V.I.S. using pre-extracted speaker embedding tensors (`torch.Size([1, 256, 1])`).
  - **Empirical Acoustic Benchmarks**:
    - **Fundamental Pitch ($F_0$)**: Reference J.A.R.V.I.S. sample = `162.8 Hz`. Cloned outputs = `161.8 Hz` (**$\Delta$ 1.0 Hz**), eliminating the 40 Hz pitch deviation of un-tuned models.
    - **Acoustic Timbre Cosine Similarity (20-dim MFCC)**: **99.09% to 99.40%** cosine similarity across all generated evaluation phrases.
    - **Inference Speed on Pure CPU**: **0.57x – 0.63x RTF** (converting ~8.4s of high-quality speech in 4.8s without GPU acceleration).
  - **Artifact Locations**:
    - Reference audio: `docs/jarvis-reference-audio/jarvis-sample-1-24k.wav` (15.3s) and `jarvis-sample-2-24k.wav` (13.8s).
    - Persistent J.A.R.V.I.S. speaker vector: `packages/voice/models/openvoice/jarvis_target_se.pth` and `%APPDATA%/Jarvis/profiles/voice/javis-original/openvoice_se.pth`.
    - Generated reference audio samples: `docs/voice-samples/jarvis-cloned-1.wav`, `jarvis-cloned-2.wav`, `jarvis-cloned-3.wav` (and corresponding `.mp3` web artifacts).
  - **Runtime Delivery**:
    - Dual execution path: Fast HTTP daemon at `http://127.0.0.1:8020` via FastAPI (`packages/voice/server/openvoice_service.py`) with automatic fallback to standalone child-process CLI runner (`packages/voice/server/openvoice_cli_runner.py`).
    - Smart routing in Electron main process (`voice:synthesize`): Automatically detects cloned profiles with `openvoice_se.pth` and routes to `openvoice-v2`, while routing known Kokoro voice strings (`af_*`, `am_*`, `bf_*`, `bm_*`) directly to `kokoro-82m`.

### Phase V3.7: Redesigned Voice & Cloning Studio UI/UX & Default J.A.R.V.I.S. Persona
- **Active J.A.R.V.I.S. Persona Hero Card**: Dynamic visual status card showcasing the current speaking persona, active engine badge (`OpenVoice V2 (Deterministic Latents)`), 100% offline CPU status, one-click audition audio playback, and instantaneous speech cadence controls (0.95x J.A.R.V.I.S. cadence vs 1.0x standard).
- **Categorized Persona Library**: Segregated into Cloned Personas (with precomputed embeddings), Built-in Kokoro-82M CPU personas (with gender and UK/US accent breakdowns), and Cloud & SAPI voices. Every persona features a one-click "Set as Active Voice" button that atomically persists `ttsVoice`, `ttsProvider`, and cadence settings, alongside a one-click live preview button.
- **Intuitive Voice Studio (Zero-Shot Cloning)**: Clean file picker with instant embedded `<audio controls>` waveform preview so users can listen to their uploaded sample prior to cloning, one-click latent extraction, and optional "Make this newly cloned voice the active Jarvis voice immediately" toggle.
- **Interactive Speech Playground**: Comprehensive paragraph tester with scenario presets (Greeting, J.A.R.V.I.S. Line, Technical Code, Long Story, Quick Confirmation), independent engine/voice testing overrides, real-time audio playback stop/start controls, and real-time synthesis metrics (latency ms, duration s, sample rate Hz).
- **Collapsible Advanced Speech & Audio Hardware Drawer**: Cleanly tucks away advanced knobs (Groq Whisper vs OpenAI STT, Silero VAD v5 detection, instant barge-in auto-mute, primary engine override, and Windows SAPI fallback) without overwhelming the user interface.
- **Application-Wide Default J.A.R.V.I.S. Routing & Disk Persistence**:
  - `apps/desktop/src/main/index.ts` loads persisted settings from `%APPDATA%\Jarvis\voice-config.json` on startup.
  - Defaults out-of-the-box to `ttsProvider: 'openvoice-v2'`, `ttsVoice: 'profile:javis-original'`, and `speed: 0.95`.
  - `voice:synthesize` automatically injects configured defaults whenever options are omitted, guaranteeing that J.A.R.V.I.S. speaks with the cloned Paul Bettany voice across all desktop chat responses and autonomous tasks.

### Phase V3.8: Conversational Prompt Engineering, Text Sanitization, Low-Latency Background Daemon & Default Auto-Speech Delivery
- **Dual-Layer Conversational Response Architecture**:
  - **Layer 1 (Spoken Conversational Opening)**: 1–2 calm, articulate British J.A.R.V.I.S. sentences (e.g. addressing user as "sir", direct answers, status summaries, or closing questions). Designed for immediate TTS extraction and synthesis.
  - **Layer 2 (Rich Visual Markdown & Code)**: Structured bullet lists, code blocks, technical tables, and links rendered cleanly for visual reading in the chat interface.
- **Text Sanitization for Natural TTS (`cleanTextForSpeech`)**:
  - Strips `<think>...</think>` internal reasoning tags.
  - Strips fenced code blocks (```` ```...``` ````) and ASCII/markdown tables.
  - Strips all emojis (`EMOJI_REGEX`) and Windows console mojibake characters (`≡ƒîÉ`, `≡ƒÜÇ`, etc.).
  - Strips bullet points (`* `, `- `, `+ `) and list numbers (`1. `, `2) `), avoiding robotic "asterisk asterisk" or "one dot" pronunciation.
  - Normalizes punctuation and symbols (`&` $\rightarrow$ `and`, `%` $\rightarrow$ `percent`, `@` $\rightarrow$ `at`).
  - Spoken Intro Extraction (`spokenIntroOnly: true`): Condenses multi-paragraph markdown down to the primary conversational statement and closing sentence, reducing TTS generation time from >30s down to **~1.5s**.
- **UTF-8 Temporary File Passing for CLI Runner**:
  - Added `--text-file` argument to `openvoice_cli_runner.py` with explicit UTF-8 decoding to completely bypass Windows CLI string character limits and code page corruption.
- **OpenVoice Background Daemon Pre-warming**:
  - `startOpenVoiceDaemon()` automatically spawns and manages `openvoice_service.py` on port 8020 upon `app.whenReady()`.
  - Eliminates per-turn Python/PyTorch cold-start import overhead (saving 4–5s per synthesis request).
- **Default Auto-Voice Answering & Header Toggle**:
  - Jarvis automatically speaks its conversational response upon task or chat completion without requiring the user to click the speaker icon first.
  - Dedicated, accessible `Voice ON / OFF` toggle button integrated directly into the `ChatHeader` (Main Window) and Quick-Chat drawer header.
  - Provides real-time audio playback feedback (pulsing emerald volume indicator when speaking) and persists preference across sessions via `localStorage`.

### Phase V3.9: Temporary Session Audio Cache Architecture (<5ms Instant Playback & Session Purging)
- **Deterministic SHA-256 Cache Keying (`AudioCacheManager`)**:
  - Computes cryptographic hash from normalized text, voice persona, provider ID, speech speed, and cloned reference audio path.
  - Guarantees identical utterances with matching voice settings map to the exact same cache slot.
- **Instantaneous Zero-Latency Playback (<5ms)**:
  - `VoiceManager.synthesize()` checks the session cache before invoking neural TTS or CLI runners.
  - Serves cached audio binary (`.bin`) and metadata (`.meta.json`) immediately with zero GPU/CPU computation, zero lag, and `{ cached: true }`.
- **Strict Session Lifecycle Cleanup**:
  - **On Startup (`app.whenReady()`)**: Automatically sweeps and purges any stale temporary audio files left from previous application runs.
  - **On Exit (`app.on('before-quit')`)**: Automatically unlinks all session audio files, preventing disk bloating across restarts.
  - **Manual Clear (`voiceClearAudioCache`)**: One-click purge available in Settings Studio with live disk usage indicators.
- **Interactive Studio Feedback**:
  - Playground metrics display an animated `⚡ Session Cache Hit` badge alongside latency readings when serving from cache.

### Phase V4: Local Offline STT (Whisper ONNX) & Real-Time Interim Tracking
- Real-time interim STT recognition (1.8s sliding window with simultaneous request lifecycle) for immediate visual feedback of spoken words.
- Quantized Whisper `base.en` ONNX provider for 100% offline air-gapped speech recognition.
- Automatic failover matrix (Cloud Groq $\rightarrow$ Local Whisper ONNX).

### Phase V5: Wake Word Engine ("Jarvis")
- `openWakeWord` pipeline in background listener for hands-free wake word activation.
