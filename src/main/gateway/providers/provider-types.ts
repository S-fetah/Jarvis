import { TalkingStyle, TaskMode, ThinkingDepth } from '../../../shared/types'
import { ToolDefinition } from '../../tools/tool-registry'

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  name?: string
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

export interface ChatWithToolsResult {
  message: {
    role: 'assistant'
    content: string | null
    tool_calls?: ToolCall[]
  }
  finishReason?: string
  activeModel?: string
  isLowQuota?: boolean
}

export interface StreamChunk {
  type: 'thought' | 'content'
  chunk: string
}

export interface RequestOptions {
  model?: string
  isLightMode?: boolean
  talkingStyle?: TalkingStyle
  taskMode?: TaskMode
  thinkingDepth?: ThinkingDepth
  temperature?: number
  maxTokens?: number
}

export interface IModelProvider {
  id: string
  name: string
  chatStream(
    messages: ChatCompletionMessage[],
    onChunk: (data: StreamChunk) => void,
    options?: RequestOptions
  ): Promise<{ reply: string; reasoning: string }>

  chatWithTools(
    messages: ChatCompletionMessage[],
    tools?: ToolDefinition[],
    options?: RequestOptions
  ): Promise<ChatWithToolsResult>

  testConnection(): Promise<{ success: boolean; latencyMs?: number; models?: string[]; error?: string }>
}
