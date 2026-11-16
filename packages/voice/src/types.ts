export type VoiceState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'error'

export interface AudioInput {
  /** Mono 16-bit PCM or encoded buffer depending on format */
  data: Uint8Array
  sampleRateHz: number
  channels: 1 | 2
  format: 'pcm16' | 'wav' | 'ogg' | 'webm'
}

export interface AudioChunk {
  data: Uint8Array
  sampleRateHz: number
  isFinal?: boolean
}

export interface AudioOutput {
  data: Uint8Array
  sampleRateHz: number
  format: 'pcm16' | 'wav' | 'mp3' | 'ogg'
  durationMs?: number
}

export interface ProviderHealth {
  ok: boolean
  providerId: string
  latencyMs?: number
  message?: string
}

export interface TranscriptionOptions {
  language?: string
  signal?: AbortSignal
}

export interface Transcript {
  text: string
  language?: string
  confidence?: number
  durationMs?: number
}

export interface SpeechOptions {
  voice?: string
  speed?: number
  language?: string
  /** Path or URI to a 3–6 second reference audio sample for zero-shot voice cloning (e.g. XTTS-v2) */
  speakerWav?: string
  signal?: AbortSignal
}

export interface SpeechToTextProvider {
  readonly id: string
  readonly locality: 'local' | 'cloud'
  transcribe(audio: AudioInput, options?: TranscriptionOptions): Promise<Transcript>
  supportsStreaming(): boolean
  healthCheck(): Promise<ProviderHealth>
}

export interface TextToSpeechProvider {
  readonly id: string
  readonly locality: 'local' | 'cloud'
  readonly supportsVoiceCloning?: boolean
  synthesize(text: string, options?: SpeechOptions): Promise<AudioOutput>
  synthesizeStream?(chunks: AsyncIterable<string>, options?: SpeechOptions): AsyncIterable<AudioChunk>
  supportsStreaming(): boolean
  healthCheck(): Promise<ProviderHealth>
}

export interface VADProvider {
  readonly id: string
  processFrame(pcm16Frame: Int16Array, sampleRateHz: number): boolean
  reset(): void
}

export interface WakeWordProvider {
  readonly id: string
  detect(pcm16Frame: Int16Array, sampleRateHz: number): boolean
  reset(): void
}

export interface VoiceConfig {
  enabled: boolean
  privacyMode: 'local_only' | 'hybrid_opt_in'
  sttProvider: string
  ttsProvider: string
  ttsFallbackProvider?: string
  /** Reference audio file path for voice cloning (used by XTTS-v2) */
  ttsSpeakerWav?: string
  vadEnabled: boolean
  interruptOnUserSpeech: boolean
  language: string
  speed: number
  volume: number
}

export interface VoiceFeatureStatus {
  optional: true
  installed: boolean
  enabled: boolean
  modelsDirectory: string
  installedModels: string[]
}

export type VoiceEvent =
  | { type: 'voice:state_change'; state: VoiceState; previousState?: VoiceState }
  | { type: 'voice:listening_started' }
  | { type: 'voice:listening_stopped' }
  | { type: 'voice:transcript_partial'; text: string }
  | { type: 'voice:transcript_final'; text: string; language?: string }
  | { type: 'voice:speech_started' }
  | { type: 'voice:speech_chunk'; text: string }
  | { type: 'voice:speech_finished' }
  | { type: 'voice:interrupted' }
  | { type: 'voice:error'; provider: string; message: string }
