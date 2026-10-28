import { describe, it, expect } from 'vitest'
import { ModelGatewayAdapter } from '../src/main/gateway/model-adapter'

describe('ModelGatewayAdapter', () => {
  it('initializes with default config and resolves models', async () => {
    const adapter = new ModelGatewayAdapter({
      baseUrl: 'http://127.0.0.1:31415/v1',
      model: 'gemini-3.6-flash',
      lightModel: 'gemini-flash-lite'
    })

    const catalog = await adapter.listModels()
    expect(catalog).toBeDefined()
    expect(catalog.all.length).toBeGreaterThan(0)
    expect(catalog.light.length).toBeGreaterThan(0)
    expect(catalog.light).toContain('gemini-flash-lite')
  })

  it('generates a direct response for identity queries without tool execution', async () => {
    const adapter = new ModelGatewayAdapter({
      baseUrl: 'http://127.0.0.1:31415/v1',
      model: 'gemini-3.6-flash'
    })

    const res = await adapter.generatePlanForGoal('who are u ?', 'C:\\work\\softwares\\jarvis')
    expect(res.directResponse).toBeDefined()
    expect(res.directResponse).toContain('Jarvis')
    expect(res.steps).toHaveLength(1)
    expect(res.steps[0].category).toBe('read_in')
  })

  it('correctly categorizes light models vs pro models', async () => {
    const adapter = new ModelGatewayAdapter({
      baseUrl: 'http://127.0.0.1:31415/v1',
      model: 'gemini-3.6-flash'
    })

    const catalog = await adapter.listModels()
    // Verify light models prioritize fast models
    const hasFastModel = catalog.light.some(
      (m) => m.includes('lite') || m.includes('mini') || m.includes('haiku') || m.includes('flash')
    )
    expect(hasFastModel).toBe(true)
  })

  it('generates an ADR-004 process step for opening Gmail in Chrome', async () => {
    const adapter = new ModelGatewayAdapter({
      baseUrl: 'http://127.0.0.1:31415/v1',
      model: 'gemini-3.6-flash'
    })

    const res = await adapter.generatePlanForGoal('open my gmail from chrome', 'C:\\work\\softwares\\jarvis')
    expect(res.steps).toBeDefined()
    expect(res.steps.length).toBeGreaterThan(0)
    const browserStep = res.steps.find((s) => s.category === 'process')
    expect(browserStep).toBeDefined()
    expect(browserStep?.title.toLowerCase()).toContain('chrome')
    const desc = browserStep?.description.toLowerCase() || ''
    expect(desc.includes('mail.google.com') || desc.includes('gmail')).toBe(true)
  }, 20000)

  it('intelligently routes tasks to coding, reasoning, fast_chat, and general models', () => {
    const adapter = new ModelGatewayAdapter({
      baseUrl: 'http://127.0.0.1:31415/v1',
      model: 'auto'
    })

    // 1. Coding task
    const codingRouting = adapter.resolveModelForTask('write a typescript function to sort an array')
    expect(codingRouting.category).toBe('coding')
    expect(codingRouting.model).toBeDefined()

    // 2. Analytical reasoning task
    const reasoningRouting = adapter.resolveModelForTask('why is quicksort faster than bubblesort? compare the tradeoffs')
    expect(reasoningRouting.category).toBe('reasoning')
    expect(reasoningRouting.model).toBeDefined()

    // 3. Fast chat / greeting
    const fastRouting = adapter.resolveModelForTask('hi jarvis, how are you?')
    expect(fastRouting.category).toBe('fast_chat')
    expect(fastRouting.model).toContain('lite')

    // 4. General / document task
    const generalRouting = adapter.resolveModelForTask('create a summary of this document and save to pdf')
    expect(generalRouting.category).toBe('general')
    expect(generalRouting.model).toBeDefined()
  })
})
