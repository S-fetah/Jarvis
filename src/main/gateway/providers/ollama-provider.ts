import { BaseOpenAICompatibleProvider } from './base-openai-provider'

export class OllamaProvider extends BaseOpenAICompatibleProvider {
  constructor(getBaseUrl?: () => string) {
    super({
      id: 'ollama',
      name: 'Local Ollama',
      defaultModel: 'llama3.2',
      getApiKey: () => 'ollama',
      getBaseUrl: getBaseUrl || (() => 'http://localhost:11434/v1')
    })
  }

  public override async testConnection(): Promise<{
    success: boolean
    latencyMs?: number
    models?: string[]
    error?: string
  }> {
    const start = Date.now()
    try {
      const url = this.getEndpoint('models')
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      const latencyMs = Date.now() - start
      if (res.ok) {
        const json = await res.json()
        const models = Array.isArray(json?.data) ? json.data.map((m: any) => m.id) : []
        return { success: true, latencyMs, models }
      }
      return { success: false, error: `Ollama returned HTTP ${res.status}` }
    } catch {
      return { success: false, error: 'Ollama is not running locally on port 11434' }
    }
  }
}
