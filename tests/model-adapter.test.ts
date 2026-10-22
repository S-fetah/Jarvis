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
})
