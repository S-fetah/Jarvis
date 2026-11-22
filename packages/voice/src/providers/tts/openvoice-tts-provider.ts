import path from 'path'
import fs from 'fs'
import { execFile, spawn, type ChildProcess } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import type {
  AudioOutput,
  ProviderHealth,
  SpeechOptions,
  TextToSpeechProvider
} from '../../types'
import { cleanTextForSpeech } from '../../utils/text-cleaner'

const execFileAsync = promisify(execFile)

export interface OpenVoiceConfig {
  endpointUrl?: string // Default: 'http://127.0.0.1:8020'
  sampleRate?: number // Default: 24000
  pythonPath?: string // Default: 'python'
  targetSePath?: string
  autoStartService?: boolean // Default: true
}

export class OpenVoiceTTSProvider implements TextToSpeechProvider {
  readonly id = 'openvoice-v2'
  readonly locality = 'local' as const
  readonly supportsVoiceCloning = true

  private readonly endpointUrl: string
  private readonly sampleRate: number
  private readonly pythonPath: string
  private readonly targetSePath: string
  private readonly autoStartService: boolean
  private serviceProcess: ChildProcess | null = null
  private serviceStarting = false

  constructor(config?: OpenVoiceConfig) {
    this.endpointUrl = config?.endpointUrl || 'http://127.0.0.1:8020'
    this.sampleRate = config?.sampleRate || 24000
    this.pythonPath = config?.pythonPath || 'python'
    this.autoStartService = config?.autoStartService ?? true
    this.targetSePath =
      config?.targetSePath ||
      this.findRepoFile('packages', 'voice', 'models', 'openvoice', 'jarvis_target_se.pth')
  }

  private findRepoFile(...relativeSegments: string[]): string {
    const startDirs = [__dirname, process.cwd()]
    for (const start of startDirs) {
      let curr = start
      for (let i = 0; i < 6; i++) {
        const candidate = path.join(curr, ...relativeSegments)
        if (fs.existsSync(candidate)) {
          return candidate
        }
        const parent = path.dirname(curr)
        if (parent === curr) break
        curr = parent
      }
    }
    return path.resolve(process.cwd(), ...relativeSegments)
  }

  private getRunnerScript(): string {
    return this.findRepoFile('packages', 'voice', 'server', 'openvoice_cli_runner.py')
  }

  private getServiceScript(): string {
    return this.findRepoFile('packages', 'voice', 'server', 'openvoice_service.py')
  }

  supportsStreaming(): boolean {
    return false
  }

  public async isServiceHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpointUrl}/health`, {
        signal: AbortSignal.timeout(600)
      })
      if (res.ok) {
        const data = (await res.json()) as any
        return data?.ok === true
      }
    } catch {
      // not running
    }
    return false
  }

  public async ensureServiceRunning(): Promise<boolean> {
    if (!this.autoStartService) return false
    if (await this.isServiceHealthy()) return true
    if (this.serviceStarting) return false

    this.serviceStarting = true
    try {
      const serviceScript = this.getServiceScript()
      if (!fs.existsSync(serviceScript)) return false

      const child = spawn(this.pythonPath, [serviceScript], {
        detached: false,
        stdio: 'ignore'
      })
      child.unref()
      this.serviceProcess = child

      process.on('exit', () => {
        try {
          child.kill()
        } catch {
          // ignore
        }
      })

      // Probe up to 4 seconds for service availability
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 500))
        if (await this.isServiceHealthy()) {
          this.serviceStarting = false
          return true
        }
      }
    } catch {
      // ignore spawn errors
    } finally {
      this.serviceStarting = false
    }
    return false
  }

  public getServiceProcess(): ChildProcess | null {
    return this.serviceProcess
  }

  public stopService(): void {
    if (this.serviceProcess) {
      try {
        this.serviceProcess.kill()
      } catch {
        // ignore
      }
      this.serviceProcess = null
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    // 1. Check if HTTP microservice is running
    if (await this.isServiceHealthy()) {
      return {
        ok: true,
        providerId: this.id,
        message: `OpenVoice V2 neural clone service active at ${this.endpointUrl}`
      }
    }

    // Attempt background warmup
    if (this.autoStartService) {
      void this.ensureServiceRunning().catch(() => {})
    }

    // 2. Fall back to Python CLI runner verification
    try {
      const runnerScript = this.getRunnerScript()
      if (fs.existsSync(runnerScript)) {
        return {
          ok: true,
          providerId: this.id,
          message: 'OpenVoice V2 standalone CLI runner ready'
        }
      }
    } catch {
      // CLI not available
    }

    return {
      ok: false,
      providerId: this.id,
      message: 'OpenVoice V2 runner not available'
    }
  }

  /**
   * Synthesizes text with zero-shot J.A.R.V.I.S. tone color transformation.
   */
  async synthesize(text: string, options?: SpeechOptions): Promise<AudioOutput> {
    if (options?.signal?.aborted) {
      throw new Error('Synthesis aborted by user or barge-in')
    }

    // Clean text of emojis, markdown, and list numbering for natural speech
    const cleanedText = cleanTextForSpeech(text) || text.trim()
    if (!cleanedText) {
      throw new Error('No synthesizable text after cleaning')
    }

    // Attempt 1: Fast HTTP microservice
    try {
      if (this.autoStartService) {
        void this.ensureServiceRunning().catch(() => {})
      }

      const response = await fetch(`${this.endpointUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanedText,
          speed: options?.speed || 0.95,
          pitch: '+0Hz',
          tau: 0.05,
          speaker_se_path: this.resolveSpeakerSe(options?.speakerWav),
          speaker_wav_path: options?.speakerWav
        }),
        signal: options?.signal
      })

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer()
        return {
          data: new Uint8Array(audioBuffer),
          sampleRateHz: this.sampleRate,
          format: 'wav',
          providerId: this.id
        }
      }
    } catch {
      // Fall through to direct CLI execution
    }

    // Attempt 2: Direct Python CLI execution
    return await this.synthesizeViaCli(cleanedText, options)
  }

  private async synthesizeViaCli(text: string, options?: SpeechOptions): Promise<AudioOutput> {
    const tmpOut = path.join(
      os.tmpdir(),
      `jarvis-openvoice-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`
    )
    const tmpTextFile = path.join(
      os.tmpdir(),
      `jarvis-openvoice-text-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
    )
    const runnerScript = this.getRunnerScript()
    if (!fs.existsSync(runnerScript)) {
      throw new Error(`OpenVoice runner script not found: ${runnerScript}`)
    }
    const sePath = this.resolveSpeakerSe(options?.speakerWav)

    // Write text to utf-8 file to prevent Windows CLI argument encoding and length bugs
    fs.writeFileSync(tmpTextFile, text, 'utf-8')

    const args = [
      runnerScript,
      '--text-file',
      tmpTextFile,
      '--output',
      tmpOut,
      '--speed',
      String(options?.speed || 0.95)
    ]

    if (sePath && fs.existsSync(sePath)) {
      args.push('--se', sePath)
    } else if (options?.speakerWav && fs.existsSync(options.speakerWav)) {
      args.push('--ref', options.speakerWav)
    }

    try {
      await execFileAsync(this.pythonPath, args, {
        signal: options?.signal,
        timeout: 60000
      })

      if (!fs.existsSync(tmpOut)) {
        throw new Error('OpenVoice CLI completed without generating output file')
      }

      const fileData = fs.readFileSync(tmpOut)
      try {
        fs.unlinkSync(tmpOut)
      } catch {
        // ignore cleanup error
      }
      try {
        fs.unlinkSync(tmpTextFile)
      } catch {
        // ignore cleanup error
      }

      return {
        data: new Uint8Array(fileData),
        sampleRateHz: this.sampleRate,
        format: 'wav',
        providerId: this.id
      }
    } catch (err: unknown) {
      if (fs.existsSync(tmpOut)) {
        try {
          fs.unlinkSync(tmpOut)
        } catch {
          // ignore
        }
      }
      if (fs.existsSync(tmpTextFile)) {
        try {
          fs.unlinkSync(tmpTextFile)
        } catch {
          // ignore
        }
      }
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`OpenVoice synthesis failed: ${msg}`)
    }
  }

  private resolveSpeakerSe(speakerWav?: string): string | undefined {
    if (speakerWav) {
      // 1. Direct check if speakerWav is a folder containing openvoice_se.pth
      const candidateInFolder = path.join(speakerWav, 'openvoice_se.pth')
      if (fs.existsSync(candidateInFolder)) {
        return candidateInFolder
      }

      // 2. If speakerWav is a file (e.g. reference.wav), check its parent directory
      const dir = path.dirname(speakerWav)
      const profileSe = path.join(dir, 'openvoice_se.pth')
      if (fs.existsSync(profileSe)) {
        return profileSe
      }
    }

    // 3. Check AppData profile directory for javis-original
    const appDataPath =
      process.env.APPDATA ||
      (process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support')
        : path.join(os.homedir(), '.config'))
    const javisOriginalSe = path.join(
      appDataPath,
      'Jarvis',
      'profiles',
      'voice',
      'javis-original',
      'openvoice_se.pth'
    )
    if (fs.existsSync(javisOriginalSe)) {
      return javisOriginalSe
    }

    // 4. Fallback to repo target SE path
    if (fs.existsSync(this.targetSePath)) {
      return this.targetSePath
    }

    return undefined
  }
}
