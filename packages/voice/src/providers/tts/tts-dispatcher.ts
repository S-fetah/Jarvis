import type {
  AudioChunk,
  AudioOutput,
  SpeechOptions,
  TextToSpeechProvider
} from '../../types'
import { SentenceChunker } from '../../utils/sentence-chunker'

export interface TTSDispatcherOptions {
  providers: TextToSpeechProvider[]
  primaryId: string
  fallbackId?: string
}

export class TTSDispatcher {
  private providers = new Map<string, TextToSpeechProvider>()
  private primaryId: string
  private fallbackId?: string

  constructor(options: TTSDispatcherOptions) {
    this.primaryId = options.primaryId
    this.fallbackId = options.fallbackId
    for (const p of options.providers) {
      this.registerProvider(p)
    }
  }

  registerProvider(provider: TextToSpeechProvider): void {
    this.providers.set(provider.id, provider)
  }

  setPrimary(id: string): void {
    this.primaryId = id
  }

  setFallback(id?: string): void {
    this.fallbackId = id
  }

  getPrimary(): TextToSpeechProvider | undefined {
    return this.providers.get(this.primaryId)
  }

  getFallback(): TextToSpeechProvider | undefined {
    return this.fallbackId ? this.providers.get(this.fallbackId) : undefined
  }

  /**
   * Synthesize full text with automatic failover to fallback provider.
   */
  async synthesize(text: string, options?: SpeechOptions): Promise<AudioOutput> {
    const primary = this.getPrimary()
    const fallback = this.getFallback()

    if (options?.signal?.aborted) {
      throw new Error('Synthesis aborted by user or barge-in')
    }

    if (primary) {
      try {
        return await primary.synthesize(text, options)
      } catch (primaryErr) {
        if (options?.signal?.aborted) throw primaryErr
        console.warn(`[TTSDispatcher] Primary provider '${this.primaryId}' failed:`, primaryErr)
        if (!fallback) throw primaryErr
      }
    }

    if (fallback) {
      return await fallback.synthesize(text, options)
    }

    throw new Error('No working TTS provider available in TTSDispatcher.')
  }

  /**
   * Sentence-by-sentence streaming synthesis yielding audio chunks in real-time.
   */
  async *synthesizeStream(
    textStream: AsyncIterable<string>,
    options?: SpeechOptions
  ): AsyncGenerator<AudioChunk, void, unknown> {
    const chunker = new SentenceChunker()
    const sentenceStream = chunker.processStream(textStream)

    for await (const sentence of sentenceStream) {
      if (options?.signal?.aborted) {
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
        if (options?.signal?.aborted) break
        console.error(`[TTSDispatcher] Failed to synthesize sentence chunk "${sentence}":`, err)
      }
    }
  }
}
