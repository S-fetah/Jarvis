import { EventEmitter } from 'events'
import type {
  AudioChunk,
  AudioInput,
  AudioOutput,
  SpeechOptions,
  SpeechToTextProvider,
  TextToSpeechProvider,
  Transcript,
  TranscriptionOptions,
  VADProvider,
  VoiceConfig,
  VoiceEvent,
  VoiceState
} from './types'
import { SileroVADProvider } from './providers/vad/silero-vad-provider'
import { SpeechBoundaryDetector } from './vad/speech-boundary-detector'
import { SentenceChunker } from './utils/sentence-chunker'
import { SystemSpeechTTSProvider } from './providers/tts/system-speech-tts-provider'
import { KokoroTTSProvider } from './providers/tts/kokoro-tts-provider'
import { XTTSv2Provider } from './providers/tts/xtts-tts-provider'
import { OpenVoiceTTSProvider } from './providers/tts/openvoice-tts-provider'

export interface VoiceManagerOptions {
  config?: Partial<VoiceConfig>
  sttProviders?: SpeechToTextProvider[]
  ttsProviders?: TextToSpeechProvider[]
  vadProvider?: VADProvider
}

export class VoiceManager extends EventEmitter {
  private state: VoiceState = 'idle'
  private config: VoiceConfig
  private sttProviders = new Map<string, SpeechToTextProvider>()
  private ttsProviders = new Map<string, TextToSpeechProvider>()
  private vadProvider: VADProvider
  private speechBoundaryDetector: SpeechBoundaryDetector
  private currentAbortController: AbortController | null = null

  constructor(options?: VoiceManagerOptions) {
    super()

    this.config = {
      enabled: options?.config?.enabled ?? false,
      privacyMode: options?.config?.privacyMode ?? 'hybrid_opt_in',
      sttProvider: options?.config?.sttProvider ?? 'groq-whisper',
      ttsProvider: options?.config?.ttsProvider ?? 'edge-tts',
      ttsFallbackProvider: options?.config?.ttsFallbackProvider ?? 'system-speech',
      ttsVoice: options?.config?.ttsVoice ?? 'bm_george',
      ttsSpeakerWav: options?.config?.ttsSpeakerWav,
      vadEnabled: options?.config?.vadEnabled ?? true,
      interruptOnUserSpeech: options?.config?.interruptOnUserSpeech ?? true,
      language: options?.config?.language ?? 'en',
      speed: options?.config?.speed ?? 1.0,
      volume: options?.config?.volume ?? 1.0
    }

    if (options?.sttProviders) {
      for (const provider of options.sttProviders) {
        this.registerSTTProvider(provider)
      }
    }

    if (options?.ttsProviders && options.ttsProviders.length > 0) {
      for (const provider of options.ttsProviders) {
        this.registerTTSProvider(provider)
      }
    } else {
      this.registerTTSProvider(new SystemSpeechTTSProvider())
      this.registerTTSProvider(new KokoroTTSProvider())
      this.registerTTSProvider(new XTTSv2Provider())
      this.registerTTSProvider(new OpenVoiceTTSProvider())
    }

    this.vadProvider = options?.vadProvider || new SileroVADProvider()
    this.speechBoundaryDetector = new SpeechBoundaryDetector({
      vadProvider: this.vadProvider,
      speechThreshold: 0.5,
      silenceTimeoutMs: options?.config?.silenceTimeoutMs ?? 500
    })

    this.speechBoundaryDetector.on('speechStart', () => {
      // Barge-in check: if currently speaking, interrupt immediately!
      if (this.state === 'speaking' && this.config.interruptOnUserSpeech) {
        this.interrupt()
        this.emitEvent({ type: 'voice:interrupted' })
        this.setState('listening')
      } else if (this.state === 'idle') {
        this.setState('listening')
        this.emitEvent({ type: 'voice:listening_started' })
      }
    })

    this.speechBoundaryDetector.on('speechEnd', async (audio: AudioInput) => {
      if (this.state === 'listening') {
        this.emitEvent({ type: 'voice:listening_stopped' })
        try {
          await this.transcribe(audio)
        } catch (err) {
          console.error('[VoiceManager] Auto-transcribe error on speechEnd:', err)
        }
      }
    })

    this.speechBoundaryDetector.on('frame', (data) => {
      this.emit('vadFrame', data)
    })
  }

  registerSTTProvider(provider: SpeechToTextProvider): void {
    this.sttProviders.set(provider.id, provider)
  }

  registerTTSProvider(provider: TextToSpeechProvider): void {
    this.ttsProviders.set(provider.id, provider)
  }

  getState(): VoiceState {
    return this.state
  }

  setState(newState: VoiceState): void {
    if (this.state === newState) return
    const previous = this.state
    this.state = newState
    this.emitEvent({
      type: 'voice:state_change',
      state: newState,
      previousState: previous
    })
    this.emit('stateChange', newState, previous)
  }

  getConfig(): VoiceConfig {
    return { ...this.config }
  }

  updateConfig(partial: Partial<VoiceConfig>): VoiceConfig {
    this.config = { ...this.config, ...partial }
    return { ...this.config }
  }

  getVADProvider(): VADProvider {
    return this.vadProvider
  }

  getSpeechBoundaryDetector(): SpeechBoundaryDetector {
    return this.speechBoundaryDetector
  }

  async processAudioStreamChunk(pcm16Chunk: Int16Array): Promise<void> {
    if (!this.config.vadEnabled) return
    await this.speechBoundaryDetector.processAudioChunk(pcm16Chunk)
  }

  interrupt(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort()
      this.currentAbortController = null
    }
    this.setState('interrupted')
  }

  async transcribe(audio: AudioInput, options?: TranscriptionOptions): Promise<Transcript> {
    this.setState('transcribing')
    this.currentAbortController = new AbortController()

    const combinedSignal = options?.signal
      ? anySignal(options.signal, this.currentAbortController.signal)
      : this.currentAbortController.signal

    const providerId = this.config.sttProvider
    const provider = this.sttProviders.get(providerId)

    if (!provider) {
      this.setState('error')
      throw new Error(`STT Provider '${providerId}' is not registered.`)
    }

    try {
      const transcript = await provider.transcribe(audio, {
        ...options,
        signal: combinedSignal,
        language: options?.language || this.config.language
      })

      this.setState('idle')
      this.emitEvent({
        type: 'voice:transcript_final',
        text: transcript.text,
        language: transcript.language
      })
      return transcript
    } catch (err: unknown) {
      // If primary failed and there is an alternative registered, attempt fallback
      const fallbackProvider = Array.from(this.sttProviders.values()).find(
        (p) => p.id !== providerId
      )

      if (fallbackProvider && !combinedSignal.aborted) {
        try {
          const fallbackResult = await fallbackProvider.transcribe(audio, {
            ...options,
            signal: combinedSignal,
            language: options?.language || this.config.language
          })
          this.setState('idle')
          return fallbackResult
        } catch {
          // Ignore and throw original error
        }
      }

      this.setState(combinedSignal.aborted ? 'interrupted' : 'error')
      throw err
    } finally {
      this.currentAbortController = null
    }
  }

  /**
   * Resolves the primary TTS provider considering requested provider, auto mode,
   * voice name, and voice profile characteristics.
   */
  resolveTTSProvider(options?: SpeechOptions): TextToSpeechProvider | undefined {
    const requested = options?.providerId || this.config.ttsProvider

    // 1. If explicit provider is requested and it is not 'auto', use it if registered
    if (requested && requested !== 'auto') {
      const match = this.ttsProviders.get(requested)
      if (match) return match
    }

    // 2. Intelligent Auto-Routing:
    // If a cloned voice profile (speakerWav) is passed
    if (options?.speakerWav) {
      // If XTTS-v2 provider is available and its server is active, route to XTTS-v2 for true neural cloning
      const xtts = this.ttsProviders.get('xtts-v2')
      if (xtts) return xtts
    }

    // If explicit voice is specified
    const v = (options?.voice || '').toLowerCase()
    if (
      v.startsWith('af_') ||
      v.startsWith('am_') ||
      v.startsWith('bf_') ||
      v.startsWith('bm_') ||
      v.includes('kokoro')
    ) {
      const kokoro = this.ttsProviders.get('kokoro-82m')
      if (kokoro) return kokoro
    }

    if (v.includes('neural')) {
      const edge = this.ttsProviders.get('edge-tts')
      if (edge) return edge
    }

    if (v.includes('desktop') || v.includes('microsoft')) {
      const sys = this.ttsProviders.get('system-speech')
      if (sys) return sys
    }

    // Default preference for local CPU instant neural
    if (this.ttsProviders.has('kokoro-82m')) {
      return this.ttsProviders.get('kokoro-82m')
    }

    if (this.ttsProviders.has('edge-tts')) {
      return this.ttsProviders.get('edge-tts')
    }

    if (this.ttsProviders.has('system-speech')) {
      return this.ttsProviders.get('system-speech')
    }

    return Array.from(this.ttsProviders.values())[0]
  }

  /**
   * Resolves fallback TTS provider ensuring it differs from the primary provider.
   */
  resolveFallbackTTSProvider(primaryId?: string): TextToSpeechProvider | undefined {
    const configuredFallback = this.config.ttsFallbackProvider
    if (configuredFallback && configuredFallback !== primaryId) {
      const match = this.ttsProviders.get(configuredFallback)
      if (match) return match
    }

    const cascadeOrder = ['kokoro-82m', 'edge-tts', 'system-speech']
    for (const id of cascadeOrder) {
      if (id !== primaryId && this.ttsProviders.has(id)) {
        return this.ttsProviders.get(id)
      }
    }

    return Array.from(this.ttsProviders.values()).find((p) => p.id !== primaryId)
  }

  async synthesize(text: string, options?: SpeechOptions): Promise<AudioOutput> {
    this.setState('speaking')
    this.currentAbortController = new AbortController()

    const combinedSignal = options?.signal
      ? anySignal(options.signal, this.currentAbortController.signal)
      : this.currentAbortController.signal

    const primary = this.resolveTTSProvider(options)
    const fallback = this.resolveFallbackTTSProvider(primary?.id)

    if (!primary && !fallback) {
      this.setState('error')
      throw new Error(`No valid TTS provider registered (configured: ${this.config.ttsProvider}).`)
    }

    const mergedOptions: SpeechOptions = {
      ...options,
      voice: options?.voice ?? this.config.ttsVoice,
      speed: options?.speed ?? this.config.speed,
      language: options?.language ?? this.config.language,
      speakerWav: options?.speakerWav ?? this.config.ttsSpeakerWav,
      signal: combinedSignal
    }

    // Try primary
    if (primary) {
      try {
        const output = await primary.synthesize(text, mergedOptions)
        this.setState('idle')
        return {
          ...output,
          providerId: output.providerId || primary.id
        }
      } catch (primaryErr) {
        if (combinedSignal.aborted) {
          this.setState('interrupted')
          throw primaryErr
        }
        if (!fallback) {
          this.setState('error')
          throw primaryErr
        }
        console.warn(
          `[VoiceManager] Primary TTS (${primary.id}) failed, falling back to ${fallback.id}:`,
          primaryErr
        )
      }
    }

    // Try fallback
    if (fallback) {
      try {
        const output = await fallback.synthesize(text, mergedOptions)
        this.setState('idle')
        return {
          ...output,
          providerId: output.providerId || fallback.id
        }
      } catch (fallbackErr) {
        this.setState(combinedSignal.aborted ? 'interrupted' : 'error')
        throw fallbackErr
      } finally {
        this.currentAbortController = null
      }
    }

    this.setState('error')
    throw new Error('TTS synthesis failed on all available providers.')
  }

  /**
   * Sentence-streaming TTS synthesis using SentenceChunker for sub-second TTFA.
   */
  async *synthesizeStream(
    textStream: AsyncIterable<string>,
    options?: SpeechOptions
  ): AsyncGenerator<AudioChunk, void, unknown> {
    const chunker = new SentenceChunker()
    const sentenceStream = chunker.processStream(textStream)

    for await (const sentence of sentenceStream) {
      if (options?.signal?.aborted || this.currentAbortController?.signal.aborted) {
        break
      }
      if (sentence.trim().length === 0) continue

      try {
        const audio = await this.synthesize(sentence, options)
        yield {
          data: audio.data,
          sampleRateHz: audio.sampleRateHz,
          isFinal: false
        }
      } catch (err) {
        if (options?.signal?.aborted || this.currentAbortController?.signal.aborted) break
        console.error(`[VoiceManager] Sentence synthesis failed: "${sentence}":`, err)
      }
    }
  }

  onVoiceEvent(callback: (event: VoiceEvent) => void): () => void {
    this.on('voiceEvent', callback)
    return () => this.off('voiceEvent', callback)
  }

  private emitEvent(event: VoiceEvent): void {
    this.emit('voiceEvent', event)
  }
}

function anySignal(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const s of signals) {
    if (s.aborted) {
      controller.abort()
      return controller.signal
    }
    s.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return controller.signal
}
