import { BaseOpenAICompatibleProvider } from './base-openai-provider'

export class OpenRouterProvider extends BaseOpenAICompatibleProvider {
  constructor(getApiKey: () => string | null, getBaseUrl?: () => string) {
    super({
      id: 'openrouter',
      name: 'OpenRouter.ai',
      defaultModel: 'anthropic/claude-3.5-sonnet',
      getApiKey,
      getBaseUrl: getBaseUrl || (() => 'https://openrouter.ai/api/v1'),
      getCustomHeaders: () => ({
        'HTTP-Referer': 'https://jarvis.local',
        'X-Title': 'Jarvis AI Desktop'
      })
    })
  }
}
