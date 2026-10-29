import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { CredentialVault } from '../src/main/gateway/credential-vault'
import { ModelBalancer } from '../src/main/gateway/model-balancer'

describe('ModelBalancer (Phase 7 Native Routing & Balancing Engine)', () => {
  const testUserData = path.resolve(__dirname, '../userData/test-balancer')
  let vault: CredentialVault
  let balancer: ModelBalancer

  beforeEach(() => {
    if (fs.existsSync(testUserData)) {
      fs.rmSync(testUserData, { recursive: true, force: true })
    }
    fs.mkdirSync(testUserData, { recursive: true })
    vault = new CredentialVault(testUserData)
    balancer = new ModelBalancer(vault)
  })

  afterEach(() => {
    if (fs.existsSync(testUserData)) {
      fs.rmSync(testUserData, { recursive: true, force: true })
    }
  })

  it('routes coding prompt to deepseek when configured', () => {
    vault.setKey('deepseek', 'sk-deepseek-test-key')
    const routing = balancer.resolveModelForTask('write a typescript function to parse AST nodes')
    expect(routing.category).toBe('coding')
    expect(routing.providerId).toBe('deepseek')
    expect(routing.model).toBe('deepseek-chat')
  })

  it('routes deep reasoning prompt to R1 or Claude when available', () => {
    vault.setKey('deepseek', 'sk-deepseek-test-key')
    const routing = balancer.resolveModelForTask('why is quicksort faster than bubblesort? analyze the mathematical proof')
    expect(routing.category).toBe('reasoning')
    expect(routing.model).toBe('deepseek-reasoner')
  })

  it('routes low-latency greeting to fast tier', () => {
    vault.setKey('groq', 'gsk-groq-test-key')
    const routing = balancer.resolveModelForTask('hello jarvis')
    expect(routing.category).toBe('fast_chat')
    expect(routing.providerId).toBe('groq')
    expect(routing.model).toContain('8b')
  })

  it('places provider on 429 cooldown and cascades to next provider', () => {
    vault.setKey('gemini', 'AIzaSy-gemini-key')
    vault.setKey('groq', 'gsk-groq-key')

    expect(balancer.isProviderReady('gemini')).toBe(true)

    // Simulate 429 cooldown
    balancer.recordCooldown('gemini', 60)
    expect(balancer.isProviderReady('gemini')).toBe(false)

    // Routing should now cascade to groq
    const routing = balancer.resolveModelForTask('hello jarvis')
    expect(routing.providerId).toBe('groq')
  })

  it('maps model names to matching providers accurately', () => {
    vault.setKey('gemini', 'AIza-key')
    vault.setKey('openai', 'sk-openai-key')
    vault.setKey('anthropic', 'sk-ant-key')

    expect(balancer.resolveProviderForModel('gemini-2.0-flash').providerId).toBe('gemini')
    expect(balancer.resolveProviderForModel('gpt-4o').providerId).toBe('openai')
    expect(balancer.resolveProviderForModel('claude-3-5-sonnet-20241022').providerId).toBe('anthropic')
  })

  it('aggregates all models across active providers into catalog', async () => {
    vault.setKey('gemini', 'AIza-key')
    vault.setKey('groq', 'gsk-key')

    const catalog = await balancer.listAllModels()
    expect(catalog.all).toContain('auto')
    expect(catalog.all).toContain('gemini-2.0-flash')
    expect(catalog.all).toContain('llama-3.3-70b-versatile')
    expect(catalog.light.length).toBeGreaterThan(0)
  })
})
