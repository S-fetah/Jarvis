import React, { useState, useEffect } from 'react'
import {
  ShieldAlert,
  Play,
  FolderOpen,
  Compass,
  Cpu
} from 'lucide-react'
import { TaskState, TimelineEvent, ApprovalRequest } from '../../shared/types'

export default function App(): React.JSX.Element {
  const [goal, setGoal] = useState('')
  const [taskState, setTaskState] = useState<TaskState | null>(null)
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [workspace, setWorkspace] = useState('C:\\work\\softwares\\jarvis')

  useEffect(() => {
    if (!window.jarvisAPI) return

    const unsubTask = window.jarvisAPI.onTaskUpdated((state) => {
      setTaskState(state)
    })

    const unsubTimeline = window.jarvisAPI.onTimelineEvent((event) => {
      setTimelineEvents((prev) => [...prev, event])
    })

    window.jarvisAPI.getSettings().then((s) => {
      if (s.workspacePaths.length > 0) {
        setWorkspace(s.workspacePaths[0])
      }
    })

    return () => {
      unsubTask()
      unsubTimeline()
    }
  }, [])

  const handleStartTask = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!goal.trim()) return

    if (!window.jarvisAPI) {
      console.error('[Jarvis Renderer] window.jarvisAPI is not available!')
      alert('Jarvis IPC bridge is not connected. Check dev console.')
      return
    }

    setTimelineEvents([])
    try {
      const initial = await window.jarvisAPI.submitGoal(goal, workspace)
      setTaskState(initial)
    } catch (err) {
      console.error('[Jarvis Renderer] Error submitting goal:', err)
    }
  }

  const handleResolveApproval = async (
    approval: ApprovalRequest,
    decision: 'granted' | 'denied'
  ): Promise<void> => {
    if (!window.jarvisAPI) return
    await window.jarvisAPI.resolveApproval(approval.id, decision)
  }

  const handleSelectWorkspace = async (): Promise<void> => {
    if (!window.jarvisAPI) return
    const selected = await window.jarvisAPI.selectWorkspaceFolder()
    if (selected) {
      setWorkspace(selected)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-slate-200">
      {/* Top Header */}
      <header className="h-14 border-b border-[#30363d] px-4 flex items-center justify-between bg-[#161b22]">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md">
            J
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white">Jarvis for Windows</h1>
            <p className="text-[11px] text-slate-400">Assistive Autonomy & Local Tool Security</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSelectWorkspace}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded border border-[#30363d] bg-[#21262d] hover:bg-[#30363d] transition"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span className="truncate max-w-[200px]">{workspace}</span>
          </button>
          <div className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-300 border border-[#30363d]">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>gemini-3.6-flash</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Input & Plan */}
        <div className="w-1/2 border-r border-[#30363d] p-4 flex flex-col space-y-4">
          <form onSubmit={handleStartTask} className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Instruction / Goal
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Inspect workspace, build summary PDF, and run development server"
                className="flex-1 bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              <button
                type="submit"
                disabled={taskState?.status === 'running' || taskState?.status === 'waiting_for_approval'}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center space-x-1.5 transition"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Run</span>
              </button>
            </div>
          </form>

          {/* Plan Section */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#161b22] rounded-lg border border-[#30363d] p-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#30363d]">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Structured Task Plan
              </span>
              {taskState && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    taskState.status === 'completed'
                      ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                      : taskState.status === 'waiting_for_approval'
                        ? 'bg-amber-900/60 text-amber-300 border border-amber-700 animate-pulse'
                        : 'bg-blue-900/60 text-blue-300 border border-blue-700'
                  }`}
                >
                  {taskState.status.replace(/_/g, ' ')}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pt-3 space-y-2.5">
              {!taskState || taskState.steps.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center p-6">
                  <Compass className="w-8 h-8 mb-2 opacity-40 text-blue-400" />
                  <span>Enter a goal to generate an approval-verified execution plan.</span>
                </div>
              ) : (
                taskState.steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className={`p-3 rounded-lg border text-xs transition ${
                      step.status === 'in_progress'
                        ? 'bg-[#1c2128] border-blue-500/60 shadow-sm'
                        : step.status === 'completed'
                          ? 'bg-[#161b22] border-[#30363d] opacity-80'
                          : 'bg-[#0d1117] border-[#21262d] text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-slate-500">#{idx + 1}</span>
                        <span className="font-semibold text-slate-200">{step.title}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-[#21262d] text-[10px] uppercase font-mono text-slate-400">
                        {step.category}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px]">{step.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Activity Timeline */}
        <div className="w-1/2 p-4 flex flex-col space-y-2">
          <div className="flex items-center justify-between pb-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Audit & Activity Timeline
            </label>
            <span className="text-[11px] text-slate-500">{timelineEvents.length} events</span>
          </div>

          <div className="flex-1 bg-[#161b22] rounded-lg border border-[#30363d] p-3 overflow-y-auto space-y-2.5 font-mono text-xs">
            {timelineEvents.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                Timeline logs and tool outputs will appear here in real time.
              </div>
            ) : (
              timelineEvents.map((ev) => (
                <div key={ev.id} className="p-2.5 rounded bg-[#0d1117] border border-[#21262d]">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span className="font-semibold text-slate-300">{ev.title}</span>
                    <span className="text-slate-500">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {ev.details && <p className="text-slate-400 text-[11px]">{ev.details}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Approval Modal (ADR-004 Gating) */}
      {taskState?.currentApproval && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#161b22] border border-amber-500/60 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3 text-amber-400">
              <ShieldAlert className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base text-white">
                    {taskState.currentApproval.title || 'Action Requires Approval'}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-950/80 border border-amber-700 text-amber-300">
                    {taskState.currentApproval.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  ADR-004 Policy Engine: Gated execution requires explicit permission.
                </p>
              </div>
            </div>

            <div className="bg-[#0d1117] rounded-lg p-3.5 border border-[#30363d] space-y-3 text-xs">
              {/* Command Box */}
              {taskState.currentApproval.command && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                    Exact Command to Execute:
                  </span>
                  <div className="bg-[#05080f] p-2.5 rounded border border-[#1e293b] font-mono text-emerald-400 text-xs flex items-center justify-between">
                    <code>{taskState.currentApproval.command}</code>
                    <span className="text-[10px] text-slate-500 font-sans">powershell -NoProfile</span>
                  </div>
                </div>
              )}

              {/* Working Directory */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-0.5 uppercase tracking-wider">
                  Target Directory:
                </span>
                <code className="text-slate-300 font-mono text-[11px] break-all">
                  {taskState.currentApproval.workingDirectory || taskState.currentApproval.workspacePath}
                </code>
              </div>

              {/* Plain English Purpose */}
              {taskState.currentApproval.explanation && (
                <div className="p-2.5 rounded bg-blue-950/30 border border-blue-900/50 text-blue-200 text-xs">
                  <strong className="block text-blue-300 font-semibold mb-0.5">Purpose:</strong>
                  {taskState.currentApproval.explanation}
                </div>
              )}

              {/* Safety Impact */}
              {taskState.currentApproval.safetyImpact && (
                <div className="p-2.5 rounded bg-slate-900/50 border border-slate-800 text-slate-300 text-[11px]">
                  <strong className="block text-slate-200 font-semibold mb-0.5">Safety & Process Impact:</strong>
                  {taskState.currentApproval.safetyImpact}
                </div>
              )}

              {/* Collapsible Arguments Details */}
              <details className="pt-1 text-[11px] text-slate-400">
                <summary className="cursor-pointer hover:text-slate-300 select-none">
                  View Technical Argument Digest & Payload
                </summary>
                <div className="mt-2 p-2 bg-[#161b22] rounded border border-[#21262d] font-mono">
                  <div className="mb-1 text-slate-500">
                    Token Hash: {taskState.currentApproval.argumentsHash.slice(0, 16)}...
                  </div>
                  <pre className="text-slate-300 text-[10px] overflow-x-auto">
                    {JSON.stringify(taskState.currentApproval.arguments, null, 2)}
                  </pre>
                </div>
              </details>
            </div>

            <div className="flex justify-end space-x-3 pt-1">
              <button
                onClick={() =>
                  handleResolveApproval(taskState.currentApproval!, 'denied')
                }
                className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-700/60 rounded-lg text-xs font-semibold transition"
              >
                Deny Action
              </button>
              <button
                onClick={() =>
                  handleResolveApproval(taskState.currentApproval!, 'granted')
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-950/50 transition"
              >
                Approve & Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
