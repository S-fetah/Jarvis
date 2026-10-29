import { BaseOpenAICompatibleProvider } from './base-openai-provider'

export class GroqProvider extends BaseOpenAICompatibleProvider {
  constructor(getApiKey: () => string | null, getBaseUrl?: () => string) {
    super({
      id: 'groq',
      name: 'Groq Cloud',
      defaultModel: 'llama-3.3-70b-versatile',
      getApiKey,
      getBaseUrl: getBaseUrl || (() => 'https://api.groq.com/openai/v1')
    })
  }
}
