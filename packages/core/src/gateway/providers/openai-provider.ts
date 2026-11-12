import { BaseOpenAICompatibleProvider } from './base-openai-provider'

export class OpenAIProvider extends BaseOpenAICompatibleProvider {
  constructor(getApiKey: () => string | null, getBaseUrl?: () => string) {
    super({
      id: 'openai',
      name: 'OpenAI Platform',
      defaultModel: 'gpt-4o',
      getApiKey,
      getBaseUrl: getBaseUrl || (() => 'https://api.openai.com/v1')
    })
  }
}
