import { BaseOpenAICompatibleProvider } from './base-openai-provider'

export class GroqProvider extends BaseOpenAICompatibleProvider {
  constructor(getApiKey: () => string | null, getBaseUrl?: () => string) {
    super({
      id: 'groq',
      name: 'Groq Cloud',
      defaultModel: 'qwen/qwen3.8-27b',
      getApiKey,
      getBaseUrl: getBaseUrl || (() => 'https://api.groq.com/openai/v1')
    })
  }
}
