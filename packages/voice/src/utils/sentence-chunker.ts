/**
 * SentenceChunker
 * 
 * Streams incoming LLM text chunks and emits synthesized sentence segments
 * on natural punctuation boundaries. This enables sub-second Time-To-First-Audio (TTFA)
 * by synthesizing sentence 1 while sentence 2 is still being streamed from the LLM.
 */

const COMMON_ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'vs',
  'etc',
  'ie',
  'eg',
  'inc',
  'ltd',
  'approx',
  'dept',
  'fig',
  'st',
  'ave',
  'blvd'
])

export interface SentenceChunkerOptions {
  /** Minimum character count before emitting a sentence (default: 20) */
  minChunkLength?: number
  /** Maximum character count before forcing a clause break on comma/semicolon (default: 120) */
  maxChunkLength?: number
}

export class SentenceChunker {
  private buffer = ''
  private readonly minChunkLength: number
  private readonly maxChunkLength: number

  constructor(options?: SentenceChunkerOptions) {
    this.minChunkLength = options?.minChunkLength ?? 20
    this.maxChunkLength = options?.maxChunkLength ?? 120
  }

  /**
   * Appends text chunk to the buffer and extracts complete sentence segments.
   */
  push(textChunk: string): string[] {
    this.buffer += textChunk
    const segments: string[] = []

    let extracted: string | null = null
    while ((extracted = this.extractNextSentence()) !== null) {
      if (extracted.trim().length > 0) {
        segments.push(extracted.trim())
      }
    }

    return segments
  }

  /**
   * Flushes remaining text buffer at end-of-stream.
   */
  flush(): string[] {
    const remaining = this.buffer.trim()
    this.buffer = ''
    return remaining.length > 0 ? [remaining] : []
  }

  /**
   * Async generator that consumes an async iterable stream of tokens
   * and yields complete sentences.
   */
  async *processStream(stream: AsyncIterable<string>): AsyncGenerator<string, void, unknown> {
    for await (const chunk of stream) {
      const sentences = this.push(chunk)
      for (const s of sentences) {
        yield s
      }
    }
    const finalSentences = this.flush()
    for (const s of finalSentences) {
      yield s
    }
  }

  private extractNextSentence(): string | null {
    if (this.buffer.length < this.minChunkLength) {
      return null
    }

    // Look for terminal punctuation: . ! ? followed by space or newline
    const terminalRegex = /([.!?])(\s+|$)/g
    let match: RegExpExecArray | null = null

    while ((match = terminalRegex.exec(this.buffer)) !== null) {
      const punctIndex = match.index
      const punct = match[1]
      const beforePunct = this.buffer.slice(0, punctIndex)

      // Check if this punctuation is part of a common abbreviation (e.g. "Dr.", "e.g.")
      if (this.isAbbreviation(beforePunct)) {
        continue
      }

      // Check if it's a decimal number like "3.14"
      if (punct === '.' && this.isDecimalNumber(this.buffer, punctIndex)) {
        continue
      }

      // If the sentence is excessively long before terminal punctuation, check if we should break at a clause first
      if (punctIndex > this.maxChunkLength) {
        const earlyClause = this.findClauseBreak(this.buffer.slice(0, punctIndex))
        if (earlyClause) {
          const clause = this.buffer.slice(0, earlyClause.index + 1)
          this.buffer = this.buffer.slice(earlyClause.index + earlyClause.matchLen)
          return clause
        }
      }

      // Valid sentence split
      const sentence = this.buffer.slice(0, punctIndex + 1)
      const afterPunctIndex = match.index + match[0].length
      this.buffer = this.buffer.slice(afterPunctIndex)
      return sentence
    }

    // If buffer exceeds maxChunkLength without terminal punctuation, break on clause separators
    if (this.buffer.length >= this.maxChunkLength) {
      const earlyClause = this.findClauseBreak(this.buffer)
      if (earlyClause) {
        const clause = this.buffer.slice(0, earlyClause.index + 1)
        this.buffer = this.buffer.slice(earlyClause.index + earlyClause.matchLen)
        return clause
      }
    }

    return null
  }

  private findClauseBreak(text: string): { index: number; matchLen: number } | null {
    const clauseRegex = /([,;:—–\n])\s+/g
    let clauseMatch: RegExpExecArray | null = null
    let bestClauseIndex = -1
    let bestClauseMatchLen = 0

    while ((clauseMatch = clauseRegex.exec(text)) !== null) {
      if (clauseMatch.index >= this.minChunkLength && clauseMatch.index <= this.maxChunkLength) {
        bestClauseIndex = clauseMatch.index
        bestClauseMatchLen = clauseMatch[0].length
      }
    }

    if (bestClauseIndex > 0) {
      return { index: bestClauseIndex, matchLen: bestClauseMatchLen }
    }
    return null
  }

  private isAbbreviation(textBeforePunct: string): boolean {
    const lastWordMatch = textBeforePunct.match(/\b([A-Za-z]{1,8})$/)
    if (!lastWordMatch) return false
    const lastWord = lastWordMatch[1].toLowerCase()
    return COMMON_ABBREVIATIONS.has(lastWord)
  }

  private isDecimalNumber(fullText: string, dotIndex: number): boolean {
    const prevChar = dotIndex > 0 ? fullText[dotIndex - 1] : ''
    const nextChar = dotIndex + 1 < fullText.length ? fullText[dotIndex + 1] : ''
    return /\d/.test(prevChar) && /\d/.test(nextChar)
  }
}
