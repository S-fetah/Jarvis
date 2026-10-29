import { BaseOpenAICompatibleProvider } from './base-openai-provider'

export class DeepSeekProvider extends BaseOpenAICompatibleProvider {
  constructor(getApiKey: () => string | null, getBaseUrl?: () => string) {
    super({
      id: 'deepseek',
      name: 'DeepSeek Platform',
      defaultModel: 'deepseek-chat',
      getApiKey,
      getBaseUrl: getBaseUrl || (() => 'https://api.deepseek.com')
    })
  }
}
