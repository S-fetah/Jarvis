import { describe, it, expect, vi } from 'vitest'
import path from 'path'
import { AgentOrchestrator } from '../src/main/agent/agent-orchestrator'
import { ToolExecutor } from '../src/main/tools/tool-executor'
import { PolicyEngine } from '../src/main/policy/policy-engine'
import { ModelGatewayAdapter } from '../src/main/gateway/model-adapter'

describe('AgentOrchestrator (Multi-Turn Tool Execution Loop)', () => {
  const workspacePath = path.resolve(__dirname, '..')
  const policyEngine = new PolicyEngine()
  const toolExecutor = new ToolExecutor(policyEngine)

  it('handles direct answer without tool calls in 1 turn', async () => {
    const mockAdapter = {
      chatWithTools: vi.fn().mockResolvedValue({
        message: {
          role: 'assistant',
          content: 'Hello! I am Jarvis, your desktop companion.',
          tool_calls: undefined
        },
        finishReason: 'stop'
      })
    } as unknown as ModelGatewayAdapter

    const orchestrator = new AgentOrchestrator(mockAdapter, toolExecutor, {
      maxTurns: 3,
      defaultWorkspacePath: workspacePath
    })

    const statusUpdates: string[] = []
    const result = await orchestrator.runLoop(
      [{ role: 'user', content: 'Hi Jarvis' }],
      {
        onStatusUpdate: (st) => statusUpdates.push(st)
      }
    )

    expect(result.reply).toBe('Hello! I am Jarvis, your desktop companion.')
    expect(result.turnsCount).toBe(1)
    expect(result.toolsUsed).toHaveLength(0)
    expect(mockAdapter.chatWithTools).toHaveBeenCalledTimes(1)
    expect(statusUpdates).toContain('completed')
  })

  it('executes tool call on turn 1 and synthesizes final answer on turn 2', async () => {
    const mockAdapter = {
      chatWithTools: vi
        .fn()
        // Turn 1: Model requests workspace_list
        .mockResolvedValueOnce({
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'workspace_list',
                  arguments: JSON.stringify({ subpath: 'src' })
                }
              }
            ]
          },
          finishReason: 'tool_calls'
        })
        // Turn 2: Model synthesizes answer based on tool output
        .mockResolvedValueOnce({
          message: {
            role: 'assistant',
            content: 'The workspace contains `src/main` and `src/renderer`.',
            tool_calls: undefined
          },
          finishReason: 'stop'
        })
    } as unknown as ModelGatewayAdapter

    const timelineEvents: any[] = []
    const orchestrator = new AgentOrchestrator(mockAdapter, toolExecutor, {
      maxTurns: 3,
      defaultWorkspacePath: workspacePath
    })

    const result = await orchestrator.runLoop(
      [{ role: 'user', content: 'What is inside src?' }],
      {
        onTimelineEvent: (ev) => timelineEvents.push(ev)
      }
    )

    expect(result.reply).toBe('The workspace contains `src/main` and `src/renderer`.')
    expect(result.turnsCount).toBe(2)
    expect(result.toolsUsed).toHaveLength(1)
    expect(result.toolsUsed[0].toolName).toBe('workspace_list')
    expect(result.toolsUsed[0].success).toBe(true)
    expect(result.toolsUsed[0].output).toContain('### Workspace Directory')
    expect(mockAdapter.chatWithTools).toHaveBeenCalledTimes(2)
    expect(timelineEvents.length).toBeGreaterThanOrEqual(2)
  })

  it('caps at maxTurns to prevent runaway loops', async () => {
    // Model keeps requesting tools endlessly
    const mockAdapter = {
      chatWithTools: vi.fn().mockResolvedValue({
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_loop',
              type: 'function',
              function: {
                name: 'project_inspect',
                arguments: '{}'
              }
            }
          ]
        },
        finishReason: 'tool_calls'
      })
    } as unknown as ModelGatewayAdapter

    const orchestrator = new AgentOrchestrator(mockAdapter, toolExecutor, {
      maxTurns: 2,
      defaultWorkspacePath: workspacePath
    })

    const result = await orchestrator.runLoop(
      [{ role: 'user', content: 'Loop forever' }]
    )

    // Should stop at maxTurns (2) and attempt final synthesis
    expect(result.turnsCount).toBe(2)
    expect(result.toolsUsed.length).toBe(2)
    expect(result.reply).toBeDefined()
  })

  it('Action Verification Layer intercepts false refusal on turn 1 and guides model to tool execution', async () => {
    const mockAdapter = {
      chatWithTools: vi
        .fn()
        // Turn 1: Model falsely claims inability due to historical bias
        .mockResolvedValueOnce({
          message: {
            role: 'assistant',
            content: "As an AI, I cannot open applications or Google Chrome on your computer.",
            tool_calls: undefined
          },
          finishReason: 'stop'
        })
        // Turn 2: After Action Verification Alert, model calls open_browser
        .mockResolvedValueOnce({
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_browser',
                type: 'function',
                function: {
                  name: 'open_browser',
                  arguments: JSON.stringify({ url: 'https://google.com' })
                }
              }
            ]
          },
          finishReason: 'tool_calls'
        })
        // Turn 3: Final synthesis
        .mockResolvedValueOnce({
          message: {
            role: 'assistant',
            content: "I have opened Google Chrome to https://google.com.",
            tool_calls: undefined
          },
          finishReason: 'stop'
        })
    } as unknown as ModelGatewayAdapter

    const timelineEvents: any[] = []
    const orchestrator = new AgentOrchestrator(mockAdapter, toolExecutor, {
      maxTurns: 4,
      defaultWorkspacePath: workspacePath
    })

    const result = await orchestrator.runLoop(
      [{ role: 'user', content: 'Can you open Chrome?' }],
      {
        onTimelineEvent: (ev) => timelineEvents.push(ev)
      }
    )

    expect(result.reply).toBe('I have opened Google Chrome to https://google.com.')
    // Turn 1 was intercepted and re-evaluated
    expect(mockAdapter.chatWithTools).toHaveBeenCalledTimes(3)
    // Verification timeline event was recorded
    const verificationEvent = timelineEvents.find((e) => e.title === 'Action Verification Layer')
    expect(verificationEvent).toBeDefined()
  })
})
