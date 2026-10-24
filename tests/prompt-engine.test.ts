import { describe, it, expect } from 'vitest'
import { PromptEngine } from '../src/main/gateway/prompt-engine'

describe('PromptEngine (Privacy-First Prompt & Mode Architecture)', () => {
  it('strictly conceals internal storage paths, localhost ports, and ADR codes', () => {
    const prompt = PromptEngine.buildSystemPrompt({
      talkingStyle: 'balanced',
      taskMode: 'chat',
      thinkingDepth: 'standard'
    })

    // Must never leak internal storage location or ports
    expect(prompt).not.toContain('userData/jarvis.sqlite')
    expect(prompt).not.toContain('http://127.0.0.1:31415')
    expect(prompt).not.toContain('ADR-004')
    expect(prompt).toContain('Jarvis')
    expect(prompt).toContain('private')
  })

  it('generates direct style instructions with focus on brevity', () => {
    const directPrompt = PromptEngine.buildSystemPrompt({ talkingStyle: 'direct' })
    expect(directPrompt).toContain('Talking Style: Direct')
    expect(directPrompt).toContain('concise')
  })

  it('generates detailed style instructions with focus on step-by-step depth', () => {
    const detailedPrompt = PromptEngine.buildSystemPrompt({ talkingStyle: 'detailed' })
    expect(detailedPrompt).toContain('Talking Style: Detailed')
    expect(detailedPrompt).toContain('step-by-step')
  })

  it('generates specialized prompts for debug, build, and plan modes', () => {
    const debugPrompt = PromptEngine.buildSystemPrompt({ taskMode: 'debug' })
    expect(debugPrompt).toContain('Task Mode: Debug & Troubleshoot')
    expect(debugPrompt).toContain('diagnostics')

    const buildPrompt = PromptEngine.buildSystemPrompt({ taskMode: 'build' })
    expect(buildPrompt).toContain('Task Mode: Build & Code')
    expect(buildPrompt).toContain('production-quality')

    const planPrompt = PromptEngine.buildSystemPrompt({ taskMode: 'plan' })
    expect(planPrompt).toContain('Task Mode: Plan & Architect')
    expect(planPrompt).toContain('milestones')
  })

  it('adjusts thinking depth protocols between quick, standard, and deep', () => {
    const quickPrompt = PromptEngine.buildSystemPrompt({ thinkingDepth: 'quick' })
    expect(quickPrompt).toContain('Thinking Protocol: Quick')

    const deepPrompt = PromptEngine.buildSystemPrompt({ thinkingDepth: 'deep' })
    expect(deepPrompt).toContain('Thinking Protocol: Deep')
    expect(deepPrompt).toContain('multi-perspective')
  })

  it('returns polished, privacy-preserving identity response without leaking sqlite path', () => {
    const res = PromptEngine.getIdentityResponse('balanced')
    expect(res).toContain('Jarvis')
    expect(res).not.toContain('userData/jarvis.sqlite')
    expect(res).not.toContain('127.0.0.1')
    expect(res).not.toContain('ADR-004')
  })
})
