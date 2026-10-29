import { BaseOpenAICompatibleProvider } from './base-openai-provider'

export class GeminiProvider extends BaseOpenAICompatibleProvider {
  constructor(getApiKey: () => string | null, getBaseUrl?: () => string) {
    super({
      id: 'gemini',
      name: 'Google Gemini',
      defaultModel: 'gemini-2.0-flash',
      getApiKey,
      getBaseUrl: getBaseUrl || (() => 'https://generativelanguage.googleapis.com/v1beta/openai')
    })
  }
}
