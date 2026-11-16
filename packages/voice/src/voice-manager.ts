import { EventEmitter } from 'events'
import type {
  AudioInput,
  AudioOutput,
  SpeechOptions,
  SpeechToTextProvider,
  TextToSpeechProvider,
  Transcript,
  TranscriptionOptions,
  VoiceConfig,
  VoiceEvent,
  VoiceState
} from './types'

export interface VoiceManagerOptions {
  config?: Partial<VoiceConfig>
  sttProviders?: SpeechToTextProvider[]
  ttsProviders?: TextToSpeechProvider[]
}

export class VoiceManager extends EventEmitter {
  private state: VoiceState = 'idle'
  private config: VoiceConfig
  private sttProviders = new Map<string, SpeechToTextProvider>()
  private ttsProviders = new Map<string, TextToSpeechProvider>()
  private currentAbortController: AbortController | null = null

  constructor(options?: VoiceManagerOptions) {
    super()

    this.config = {
      enabled: options?.config?.enabled ?? false,
      privacyMode: options?.config?.privacyMode ?? 'hybrid_opt_in',
      sttProvider: options?.config?.sttProvider ?? 'groq-whisper',
      ttsProvider: options?.config?.ttsProvider ?? 'edge-tts',
      ttsFallbackProvider: options?.config?.ttsFallbackProvider ?? 'system-speech',
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

    if (options?.ttsProviders) {
      for (const provider of options.ttsProviders) {
        this.registerTTSProvider(provider)
      }
    }
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

  async synthesize(text: string, options?: SpeechOptions): Promise<AudioOutput> {
    this.setState('speaking')
    this.currentAbortController = new AbortController()

    const combinedSignal = options?.signal
      ? anySignal(options.signal, this.currentAbortController.signal)
      : this.currentAbortController.signal

    const primaryId = this.config.ttsProvider
    const fallbackId = this.config.ttsFallbackProvider
    const primary = this.ttsProviders.get(primaryId)
    const fallback = fallbackId ? this.ttsProviders.get(fallbackId) : undefined

    if (!primary && !fallback) {
      this.setState('error')
      throw new Error(`No valid TTS provider registered (configured: ${primaryId}).`)
    }

    const mergedOptions: SpeechOptions = {
      ...options,
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
        return output
      } catch (primaryErr) {
        if (combinedSignal.aborted) {
          this.setState('interrupted')
          throw primaryErr
        }
        if (!fallback) {
          this.setState('error')
          throw primaryErr
        }
      }
    }

    // Try fallback
    if (fallback) {
      try {
        const output = await fallback.synthesize(text, mergedOptions)
        this.setState('idle')
        return output
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
