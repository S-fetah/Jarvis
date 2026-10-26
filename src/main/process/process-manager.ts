import { spawn, ChildProcess } from 'child_process'
import crypto from 'crypto'
import http from 'http'
import { ManagedProcess } from '../../shared/types'

export type ProcessUpdateListener = (proc: ManagedProcess) => void

export class ProcessManager {
  private processes: Map<string, { proc: ChildProcess; state: ManagedProcess }> = new Map()
  private listeners: Set<ProcessUpdateListener> = new Set()
  private portCheckIntervals: Map<string, NodeJS.Timeout> = new Map()

  public onUpdate(listener: ProcessUpdateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(state: ManagedProcess): void {
    for (const listener of this.listeners) {
      try {
        listener({ ...state, recentLogs: [...state.recentLogs] })
      } catch (err) {
        console.error('[ProcessManager] Error in update listener:', err)
      }
    }
  }

  public getActiveProcesses(): ManagedProcess[] {
    return Array.from(this.processes.values())
      .filter((p) => p.state.status === 'running' || p.state.status === 'starting')
      .map((p) => ({ ...p.state }))
  }

  public getProcess(id: string): ManagedProcess | undefined {
    return this.processes.get(id)?.state
  }

  /**
   * Starts a managed development server or command.
   */
  public async startDevServer(options: {
    command?: string
    script?: string
    workingDirectory: string
    preferredPort?: number
  }): Promise<ManagedProcess> {
    const id = crypto.randomUUID()
    const script = options.script || 'dev'
    const commandStr = options.command || `npm run ${script}`
    const workingDir = options.workingDirectory

    let executable = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    let args = ['run', script]

    // If explicit command was supplied (e.g. "npx vite" or "node server.js")
    if (options.command && !options.command.startsWith('npm run')) {
      const tokens = options.command.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((s) => s.replace(/^"(.*)"$/, '$1')) || []
      executable = tokens[0] || (process.platform === 'win32' ? 'npm.cmd' : 'npm')
      if (process.platform === 'win32' && !executable.endsWith('.exe') && !executable.endsWith('.cmd')) {
        if (executable === 'npm') executable = 'npm.cmd'
        else if (executable === 'npx') executable = 'npx.cmd'
        else if (executable === 'node') executable = 'node.exe'
        else executable = `${executable}.cmd`
      }
      args = tokens.slice(1)
    }

    const state: ManagedProcess = {
      id,
      pid: 0,
      command: commandStr,
      script,
      port: options.preferredPort,
      isPortReady: false,
      status: 'starting',
      startedAt: Date.now(),
      workingDirectory: workingDir,
      recentLogs: []
    }

    let child: ChildProcess
    try {
      child = spawn(executable, args, {
        cwd: workingDir,
        shell: false,
        windowsHide: true,
        env: { ...process.env, BROWSER: 'none', FORCE_COLOR: '1' }
      })
    } catch (err: any) {
      state.status = 'failed'
      state.recentLogs.push(`Failed to spawn: ${err.message}`)
      this.notify(state)
      throw err
    }

    state.pid = child.pid || 0
    this.processes.set(id, { proc: child, state })
    this.notify(state)

    const appendLog = (line: string): void => {
      const trimmed = line.trim()
      if (!trimmed) return
      state.recentLogs.push(trimmed)
      if (state.recentLogs.length > 80) {
        state.recentLogs.shift()
      }

      // Automatically detect listening port from output (e.g. "Local: http://localhost:5173/")
      if (!state.port) {
        const portMatch = trimmed.match(/(?:localhost|127\.0\.0\.1):(\d+)/i) || trimmed.match(/port\s+(\d+)/i)
        if (portMatch) {
          state.port = parseInt(portMatch[1], 10)
          this.startPortPolling(id, state.port)
        }
      }

      this.notify(state)
    }

    child.stdout?.on('data', (data) => {
      data.toString().split(/\r?\n/).forEach(appendLog)
    })

    child.stderr?.on('data', (data) => {
      data.toString().split(/\r?\n/).forEach(appendLog)
    })

    child.on('error', (err) => {
      state.status = 'failed'
      state.recentLogs.push(`Process error: ${err.message}`)
      this.clearPortPolling(id)
      this.notify(state)
    })

    child.on('close', (code) => {
      state.status = 'stopped'
      state.stoppedAt = Date.now()
      state.recentLogs.push(`Process exited with code ${code ?? 0}`)
      this.clearPortPolling(id)
      this.notify(state)
    })

    // If a preferred port was passed in, start checking it immediately
    if (state.port) {
      this.startPortPolling(id, state.port)
    }

    // Mark as running after brief initialization
    setTimeout(() => {
      if (state.status === 'starting') {
        state.status = 'running'
        this.notify(state)
      }
    }, 1500)

    return state
  }

  /**
   * Safely terminates a process tree.
   */
  public async stopProcess(id: string): Promise<boolean> {
    const item = this.processes.get(id)
    if (!item) return false

    const { proc, state } = item
    this.clearPortPolling(id)

    if (state.status === 'stopped' || state.status === 'failed') {
      return true
    }

    const pid = proc.pid
    if (pid) {
      if (process.platform === 'win32') {
        try {
          // Terminate entire process tree forcibly
          spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
            windowsHide: true,
            shell: false
          })
        } catch {
          proc.kill('SIGTERM')
        }
      } else {
        proc.kill('SIGTERM')
      }
    }

    state.status = 'stopped'
    state.stoppedAt = Date.now()
    state.recentLogs.push('Process stopped by user.')
    this.notify(state)
    return true
  }

  /**
   * Stops all active processes started by Jarvis (e.g. on application exit).
   */
  public async stopAll(): Promise<void> {
    for (const [id] of this.processes) {
      await this.stopProcess(id)
    }
  }

  private startPortPolling(id: string, port: number): void {
    if (this.portCheckIntervals.has(id)) return

    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      const item = this.processes.get(id)
      if (!item || item.state.status !== 'running' && item.state.status !== 'starting') {
        this.clearPortPolling(id)
        return
      }

      const req = http.get(`http://127.0.0.1:${port}`, { timeout: 1000 }, (res) => {
        item.state.isPortReady = true
        item.state.status = 'running'
        this.clearPortPolling(id)
        this.notify(item.state)
        res.resume()
      })

      req.on('error', () => {
        // Port not ready yet
      })

      if (attempts > 30) {
        // Stop checking after 30 seconds
        this.clearPortPolling(id)
      }
    }, 1000)

    this.portCheckIntervals.set(id, interval)
  }

  private clearPortPolling(id: string): void {
    const interval = this.portCheckIntervals.get(id)
    if (interval) {
      clearInterval(interval)
      this.portCheckIntervals.delete(id)
    }
  }
}
