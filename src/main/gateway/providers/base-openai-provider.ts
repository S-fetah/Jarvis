import { ToolDefinition } from '../../tools/tool-registry'
import {
  ChatCompletionMessage,
  ChatWithToolsResult,
  IModelProvider,
  RequestOptions,
  StreamChunk,
  ToolCall
} from './provider-types'

export interface BaseProviderConfig {
  id: string
  name: string
  getBaseUrl: () => string
  getApiKey: () => string | null
  defaultModel: string
  getCustomHeaders?: () => Record<string, string>
}

export class BaseOpenAICompatibleProvider implements IModelProvider {
  public id: string
  public name: string
  protected config: BaseProviderConfig

  constructor(config: BaseProviderConfig) {
    this.id = config.id
    this.name = config.name
    this.config = config
  }

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    const key = this.config.getApiKey()
    if (key) {
      headers['Authorization'] = `Bearer ${key}`
    }
    if (this.config.getCustomHeaders) {
      Object.assign(headers, this.config.getCustomHeaders())
    }
    return headers
  }

  protected getEndpoint(path: string): string {
    let base = this.config.getBaseUrl().replace(/\/+$/, '')
    if (!base) base = 'http://127.0.0.1:31415/v1'
    if (path.startsWith('/')) {
      return `${base}${path}`
    }
    return `${base}/${path}`
  }

  public async chatStream(
    messages: ChatCompletionMessage[],
    onChunk: (data: StreamChunk) => void,
    options?: RequestOptions
  ): Promise<{ reply: string; reasoning: string }> {
    const model = options?.model || this.config.defaultModel
    const url = this.getEndpoint('chat/completions')
    const headers = this.getHeaders()

    const body: Record<string, any> = {
      model,
      messages,
      stream: true,
      temperature: options?.temperature ?? 0.3
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`[${this.name}] HTTP ${response.status}: ${errText}`)
    }

    if (!response.body) {
      throw new Error(`[${this.name}] Response body is null`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullReply = ''
    let fullReasoning = ''
    let insideThinkTag = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue
        if (trimmed === 'data: [DONE]') continue

        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6))
            const delta = json.choices?.[0]?.delta
            if (!delta) continue

            // DeepSeek native reasoning_content support
            if (delta.reasoning_content) {
              fullReasoning += delta.reasoning_content
              onChunk({ type: 'thought', chunk: delta.reasoning_content })
            }

            if (delta.content) {
              let contentText = delta.content

              // Parse <think> ... </think> tags
              while (contentText.length > 0) {
                if (!insideThinkTag) {
                  const thinkStart = contentText.indexOf('<think>')
                  if (thinkStart !== -1) {
                    if (thinkStart > 0) {
                      const before = contentText.slice(0, thinkStart)
                      fullReply += before
                      onChunk({ type: 'content', chunk: before })
                    }
                    insideThinkTag = true
                    contentText = contentText.slice(thinkStart + 7)
                  } else {
                    fullReply += contentText
                    onChunk({ type: 'content', chunk: contentText })
                    contentText = ''
                  }
                } else {
                  const thinkEnd = contentText.indexOf('</think>')
                  if (thinkEnd !== -1) {
                    const thought = contentText.slice(0, thinkEnd)
                    fullReasoning += thought
                    onChunk({ type: 'thought', chunk: thought })
                    insideThinkTag = false
                    contentText = contentText.slice(thinkEnd + 8)
                  } else {
                    fullReasoning += contentText
                    onChunk({ type: 'thought', chunk: contentText })
                    contentText = ''
                  }
                }
              }
            }
          } catch {
            // Ignore incomplete chunks
          }
        }
      }
    }

    return {
      reply: fullReply.trim(),
      reasoning: fullReasoning.trim()
    }
  }

  public async chatWithTools(
    messages: ChatCompletionMessage[],
    tools?: ToolDefinition[],
    options?: RequestOptions
  ): Promise<ChatWithToolsResult> {
    const model = options?.model || this.config.defaultModel
    const url = this.getEndpoint('chat/completions')
    const headers = this.getHeaders()

    const body: Record<string, any> = {
      model,
      messages,
      temperature: options?.temperature ?? 0.2
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }
      }))
      body.tool_choice = 'auto'
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`[${this.name}] HTTP ${response.status}: ${errText}`)
    }

    const json = await response.json()
    const choice = json.choices?.[0]
    if (!choice || !choice.message) {
      throw new Error(`[${this.name}] Invalid completion payload: missing choice message`)
    }

    const rawMessage = choice.message
    const toolCalls: ToolCall[] = (rawMessage.tool_calls || []).map((tc: any) => ({
      id: tc.id || `call_${Date.now()}`,
      type: 'function',
      function: {
        name: tc.function?.name || '',
        arguments: typeof tc.function?.arguments === 'string'
          ? tc.function.arguments
          : JSON.stringify(tc.function?.arguments || {})
      }
    }))

    return {
      message: {
        role: 'assistant',
        content: rawMessage.content || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined
      },
      finishReason: choice.finish_reason,
      activeModel: model
    }
  }

  public async testConnection(): Promise<{
    success: boolean
    latencyMs?: number
    models?: string[]
    error?: string
  }> {
    const start = Date.now()
    try {
      const url = this.getEndpoint('models')
      const headers = this.getHeaders()
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000)
      })

      const latencyMs = Date.now() - start
      if (res.ok) {
        const json = await res.json()
        const modelList = Array.isArray(json?.data)
          ? json.data.map((m: any) => m.id || m.name || String(m))
          : []
        return { success: true, latencyMs, models: modelList }
      } else {
        // Some providers block GET /models with user keys, test with minimal chat ping
        return await this.testMinimalChat()
      }
    } catch (err: any) {
      // If models listing failed, test with minimal completion
      return await this.testMinimalChat()
    }
  }

  protected async testMinimalChat(): Promise<{
    success: boolean
    latencyMs?: number
    models?: string[]
    error?: string
  }> {
    const start = Date.now()
    try {
      const url = this.getEndpoint('chat/completions')
      const headers = this.getHeaders()
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.config.defaultModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 2
        }),
        signal: AbortSignal.timeout(12000)
      })
      const latencyMs = Date.now() - start
      if (res.ok) {
        return { success: true, latencyMs, models: [this.config.defaultModel] }
      }
      const errText = await res.text()
      return { success: false, latencyMs, error: `HTTP ${res.status}: ${errText.slice(0, 150)}` }
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection failed' }
    }
  }
}
