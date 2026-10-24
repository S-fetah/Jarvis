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
})
