import { describe, it, expect } from 'vitest'
import { cleanTextForSpeech } from '../packages/voice/src/utils/text-cleaner'

describe('cleanTextForSpeech', () => {
  it('strips emojis and markdown bold/italic formatting', () => {
    const raw = 'Yes, absolutely! I can search the web in real-time. 🌐 **Important**: *Fast* results!'
    const cleaned = cleanTextForSpeech(raw)
    expect(cleaned).toBe('Yes, absolutely! I can search the web in real-time. Important: Fast results!')
  })

  it('removes bullet points and list numbering so numbers are not spoken as headings', () => {
    const raw = `
Here is what I can do:
* **First Item**: Does something cool.
* **Second Item**: Does something else.
1. Numbered step
2) Another step
`
    const cleaned = cleanTextForSpeech(raw)
    expect(cleaned).not.toContain('*')
    expect(cleaned).not.toContain('1.')
    expect(cleaned).not.toContain('2)')
    expect(cleaned).toContain('First Item: Does something cool')
    expect(cleaned).toContain('Numbered step')
  })

  it('strips code blocks completely so code is not read aloud', () => {
    const raw = `
I have created the function:
\`\`\`typescript
function add(a: number, b: number): number {
  return a + b;
}
\`\`\`
All tests are passing.
`
    const cleaned = cleanTextForSpeech(raw)
    expect(cleaned).not.toContain('function add')
    expect(cleaned).not.toContain('return a + b')
    expect(cleaned).toContain('I have created the function:')
    expect(cleaned).toContain('All tests are passing.')
  })

  it('strips think blocks', () => {
    const raw = '<think>I should check the database first.</think>Here is your answer.'
    const cleaned = cleanTextForSpeech(raw)
    expect(cleaned).toBe('Here is your answer.')
  })

  it('replaces & with and, % with percent, @ with at', () => {
    const raw = 'We achieved 99% accuracy & 100% precision @ 24kHz.'
    const cleaned = cleanTextForSpeech(raw)
    expect(cleaned).toContain('99 percent accuracy and 100 percent precision at 24kHz.')
  })

  it('extracts conversational opening and closing when spokenIntroOnly is true', () => {
    const raw = `Yes, absolutely! I can search the web in real-time. 🌐

Here is what I can do for you on the web:
* **Real-time Web Search**: Find up-to-date information, documentation, news, or answers to any topic.
* **Deep Page Research & Inspection**: Visit specific websites, read articles, extract key details, and summarize them clearly.
* **GitHub & Tech Research**: Search repositories, code snippets, documentation, or tech topics.

What would you like me to look up for you? Just give me the topic, question, or search query, and I'll jump right on it! 🚀`

    const cleaned = cleanTextForSpeech(raw, { spokenIntroOnly: true })
    expect(cleaned).toContain('Yes, absolutely! I can search the web in real-time.')
    expect(cleaned).toContain('What would you like me to look up for you?')
    expect(cleaned).not.toContain('Real-time Web Search:')
    expect(cleaned).not.toContain('🌐')
    expect(cleaned).not.toContain('🚀')
  })

  it('preserves comprehensive multi-paragraph list answers and cleans emojis and formatting', () => {
    const raw = `I can search for almost anything on the open web! Here are some specific examples of what I can look up for you:

📰 News & Current Events: Breaking news, sports scores, weather, or recent updates on any topic.
💻 Tech & Programming: Documentation for libraries (React, Python, Node.js, etc.), code snippets, bug fixes, GitHub repositories, or API references.
📚 General Knowledge & Research: Definitions, historical facts, scientific concepts, or deep dives into specific subjects.
🛒 Products & Comparisons: Tech specs, product reviews, or comparisons between different items.
📄 Specific Websites: I can visit a specific URL, read the page, and extract exactly what you need from it.
Basically, if it's on the internet, I can find it and summarize it for you. What are you curious about? 🚀`

    const cleaned = cleanTextForSpeech(raw)
    expect(cleaned).toContain('I can search for almost anything on the open web!')
    expect(cleaned).toContain('News and Current Events: Breaking news, sports scores, weather, or recent updates on any topic.')
    expect(cleaned).toContain('Tech and Programming: Documentation for libraries')
    expect(cleaned).toContain('General Knowledge and Research: Definitions, historical facts')
    expect(cleaned).toContain('Products and Comparisons: Tech specs, product reviews')
    expect(cleaned).toContain('Specific Websites: I can visit a specific URL, read the page, and extract exactly what you need from it.')
    expect(cleaned).toContain("Basically, if it's on the internet, I can find it and summarize it for you.")
    expect(cleaned).toContain('What are you curious about?')
    expect(cleaned).not.toContain('📰')
    expect(cleaned).not.toContain('💻')
    expect(cleaned).not.toContain('📚')
    expect(cleaned).not.toContain('🛒')
    expect(cleaned).not.toContain('📄')
    expect(cleaned).not.toContain('🚀')
    expect(cleaned).not.toContain('&')
  })
})
