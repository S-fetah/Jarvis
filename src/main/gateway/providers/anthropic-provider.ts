import { ToolDefinition } from '../../tools/tool-registry'
import {
  ChatCompletionMessage,
  ChatWithToolsResult,
  IModelProvider,
  RequestOptions,
  StreamChunk,
  ToolCall
} from './provider-types'

export class AnthropicProvider implements IModelProvider {
  public id = 'anthropic'
  public name = 'Anthropic Claude'
  private getApiKey: () => string | null
  private getBaseUrl: () => string

  constructor(getApiKey: () => string | null, getBaseUrl?: () => string) {
    this.getApiKey = getApiKey
    this.getBaseUrl = getBaseUrl || (() => 'https://api.anthropic.com/v1')
  }

  private getHeaders(): Record<string, string> {
    const key = this.getApiKey()
    return {
      'Content-Type': 'application/json',
      'x-api-key': key || '',
      'anthropic-version': '2023-06-01'
    }
  }

  private formatMessages(messages: ChatCompletionMessage[]): {
    system?: string
    formatted: Array<{ role: 'user' | 'assistant'; content: any }>
  } {
    let systemPrompt = ''
    const formatted: Array<{ role: 'user' | 'assistant'; content: any }> = []

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n\n' : '') + (msg.content || '')
        continue
      }

      if (msg.role === 'tool') {
        formatted.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id || '',
              content: msg.content || ''
            }
          ]
        })
        continue
      }

      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        const contentBlocks: any[] = []
        if (msg.content) {
          contentBlocks.push({ type: 'text', text: msg.content })
        }
        for (const tc of msg.tool_calls) {
          let inputObj = {}
          try {
            inputObj = JSON.parse(tc.function.arguments)
          } catch {}
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: inputObj
          })
        }
        formatted.push({ role: 'assistant', content: contentBlocks })
        continue
      }

      const role = msg.role === 'assistant' ? 'assistant' : 'user'
      formatted.push({ role, content: msg.content || '' })
    }

    return { system: systemPrompt || undefined, formatted }
  }

  public async chatStream(
    messages: ChatCompletionMessage[],
    onChunk: (data: StreamChunk) => void,
    options?: RequestOptions
  ): Promise<{ reply: string; reasoning: string }> {
    const { system, formatted } = this.formatMessages(messages)
    const model = options?.model || 'claude-3-5-haiku-20241022'
    const url = `${this.getBaseUrl().replace(/\/+$/, '')}/messages`

    const body: Record<string, any> = {
      model,
      max_tokens: options?.maxTokens || 4096,
      messages: formatted,
      stream: true,
      temperature: options?.temperature ?? 0.3
    }
    if (system) body.system = system

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`[Anthropic] HTTP ${response.status}: ${errText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('[Anthropic] Null response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let fullReply = ''
    let fullReasoning = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        try {
          const json = JSON.parse(trimmed.slice(6))
          if (json.type === 'content_block_delta') {
            if (json.delta?.type === 'text_delta') {
              const text = json.delta.text || ''
              fullReply += text
              onChunk({ type: 'content', chunk: text })
            } else if (json.delta?.type === 'thinking_delta') {
              const text = json.delta.thinking || ''
              fullReasoning += text
              onChunk({ type: 'thought', chunk: text })
            }
          }
        } catch {}
      }
    }

    return { reply: fullReply.trim(), reasoning: fullReasoning.trim() }
  }

  public async chatWithTools(
    messages: ChatCompletionMessage[],
    tools?: ToolDefinition[],
    options?: RequestOptions
  ): Promise<ChatWithToolsResult> {
    const { system, formatted } = this.formatMessages(messages)
    const model = options?.model || 'claude-3-5-sonnet-20241022'
    const url = `${this.getBaseUrl().replace(/\/+$/, '')}/messages`

    const body: Record<string, any> = {
      model,
      max_tokens: options?.maxTokens || 4096,
      messages: formatted,
      temperature: options?.temperature ?? 0.2
    }
    if (system) body.system = system

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
      }))
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`[Anthropic] HTTP ${response.status}: ${errText}`)
    }

    const json = await response.json()
    let textReply = ''
    const toolCalls: ToolCall[] = []

    for (const block of json.content || []) {
      if (block.type === 'text') {
        textReply += block.text
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input || {})
          }
        })
      }
    }

    return {
      message: {
        role: 'assistant',
        content: textReply.trim() || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined
      },
      finishReason: json.stop_reason,
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
      const url = `${this.getBaseUrl().replace(/\/+$/, '')}/messages`
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }]
        }),
        signal: AbortSignal.timeout(10000)
      })

      const latencyMs = Date.now() - start
      if (res.ok) {
        return {
          success: true,
          latencyMs,
          models: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
        }
      }
      const errText = await res.text()
      return { success: false, latencyMs, error: `Anthropic HTTP ${res.status}: ${errText.slice(0, 150)}` }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect to Anthropic' }
    }
  }
}
