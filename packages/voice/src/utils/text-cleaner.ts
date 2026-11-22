/**
 * Text Cleaner for Speech Synthesis
 * 
 * Sanitizes raw LLM markdown responses, stripping emojis, markdown formatting,
 * code blocks, raw URLs, bullet prefixes, and title numbers so speech engines
 * pronounce responses naturally without audible glitches, timeouts, or robotic artifacts.
 */

const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}\u{20E3}\u{E0020}-\u{E007F}]/gu

// Mojibake / encoding artifact patterns from terminal CP1252/UTF8 mismatches
const MOJIBAKE_REGEX = /[\u2261\u0192\u00EE\u00EF\uFFFD]+[^\s]*/g

export interface CleanTextOptions {
  /**
   * If true, extracts the conversational opening and closing hook suitable for
   * natural voice responses, skipping dense lists and code blocks.
   * Default: false.
   */
  spokenIntroOnly?: boolean

  /**
   * Maximum character length for spoken output. Default: 800.
   */
  maxLength?: number
}

/**
 * Strips code blocks, markdown symbols, emojis, URLs, and formatting artifacts.
 */
export function cleanTextForSpeech(rawText: string, options?: CleanTextOptions): string {
  if (!rawText || !rawText.trim()) return ''

  let text = rawText

  // 1. Remove thinking / reasoning blocks (<think>...</think>)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '')

  // 2. Remove code blocks (```lang ... ```)
  text = text.replace(/```[\s\S]*?```/g, ' ')

  // 3. Remove markdown tables (| col | col |)
  text = text.replace(/^\|.*\|$/gm, '')

  // 4. If spokenIntroOnly is requested, prioritize conversational paragraphs
  if (options?.spokenIntroOnly) {
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    // Separate conversational paragraphs from dense bullet/item lists
    const nonListParagraphs = paragraphs.filter((p) => {
      // If paragraph is predominantly list items, skip for spoken hook
      const lines = p.split('\n').map((l) => l.trim())
      const listLines = lines.filter((l) => /^[-*+•]|\d+[.)]/.test(l))
      return listLines.length < lines.length / 2
    })

    if (nonListParagraphs.length > 0) {
      if (nonListParagraphs.length === 1) {
        text = nonListParagraphs[0]
      } else {
        // Take the first conversational paragraph and the last paragraph if it's a question/closing
        const first = nonListParagraphs[0]
        const last = nonListParagraphs[nonListParagraphs.length - 1]
        if (last !== first && (last.includes('?') || last.length < 150)) {
          text = `${first} ${last}`
        } else {
          text = first
        }
      }
    }
  }

  // 5. Replace inline links [label](url) with just the label
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 6. Remove raw URLs
  text = text.replace(/https?:\/\/\S+/gi, '')

  // 7. Strip inline code backticks (`code`)
  text = text.replace(/`([^`]+)`/g, '$1')

  // 8. Strip markdown bold, italic, strikethrough (***, **, *, __, _, ~~)
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/___([^_]+)___/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')
  text = text.replace(/_([^_]+)_/g, '$1')
  text = text.replace(/~~([^~]+)~~/g, '$1')

  // 9. Strip markdown headers (#, ##, ###)
  text = text.replace(/^#{1,6}\s+/gm, '')

  // 10. Strip blockquote indicators (> quote)
  text = text.replace(/^>\s+/gm, '')

  // 11. Remove list bullets and numbered prefixes so they aren't read aloud
  // e.g. "* Real-time Web Search:" -> "Real-time Web Search:"
  // e.g. "1. First step" -> "First step"
  // e.g. "2) Second item" -> "Second item"
  text = text.replace(/^[\s]*[-*+•]\s+/gm, '')
  text = text.replace(/^[\s]*\d+[.)]\s+/gm, '')

  // 12. Strip all Unicode emojis
  text = text.replace(EMOJI_REGEX, '')

  // 13. Strip mojibake / corrupted encoding sequences
  text = text.replace(MOJIBAKE_REGEX, '')

  // 14. Pronounceable symbols and cleanup
  text = text.replace(/&/g, ' and ')
  text = text.replace(/%/g, ' percent ')
  text = text.replace(/@/g, ' at ')

  // Remove residual markdown / punctuation debris
  text = text.replace(/[*_~^|\\<>[\]{}]/g, '')

  // 15. Normalize whitespace and line breaks
  text = text.replace(/\r\n/g, '\n')
  text = text.replace(/\n+/g, '. ')
  text = text.replace(/\s+/g, ' ')
  text = text.replace(/:\s*\./g, ': ')
  text = text.replace(/([.!?])\s*\./g, '$1')
  text = text.replace(/\.{2,}/g, '.')
  text = text.replace(/\s+([.,!?;:])/g, '$1')

  text = text.trim()

  // 16. Enforce maxLength (generous 2500 character ceiling to allow comprehensive spoken answers)
  const maxLen = options?.maxLength ?? 2500
  if (text.length > maxLen) {
    // Find last sentence boundary within maxLen
    const boundary = text.lastIndexOf('.', maxLen)
    if (boundary > maxLen * 0.5) {
      text = text.slice(0, boundary + 1)
    } else {
      text = text.slice(0, maxLen).trim() + '...'
    }
  }

  return text
}
