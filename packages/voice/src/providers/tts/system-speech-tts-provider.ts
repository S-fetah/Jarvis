import { spawn } from 'child_process'
import type {
  AudioOutput,
  ProviderHealth,
  SpeechOptions,
  TextToSpeechProvider
} from '../../types'

export class SystemSpeechTTSProvider implements TextToSpeechProvider {
  readonly id = 'system-speech'
  readonly locality = 'local' as const

  supportsStreaming(): boolean {
    return false
  }

  async synthesize(text: string, options?: SpeechOptions): Promise<AudioOutput> {
    const startTime = Date.now()
    const sanitizedText = text.replace(/["`$]/g, ' ')
    const voiceName = options?.voice || 'Microsoft David Desktop'
    const speed = Math.max(-10, Math.min(10, Math.round(((options?.speed ?? 1.0) - 1.0) * 10)))

    const script = `
Add-Type -AssemblyName System.Speech;
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
try { $synth.SelectVoice('${voiceName}') } catch {};
$synth.Rate = ${speed};
$ms = New-Object System.IO.MemoryStream;
$synth.SetOutputToWaveStream($ms);
$synth.Speak("${sanitizedText}");
$bytes = $ms.ToArray();
[Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length);
`

    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    })

    const chunks: Buffer[] = []
    return new Promise<AudioOutput>((resolve, reject) => {
      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          child.kill()
          reject(new Error('TTS synthesis aborted.'))
        })
      }

      child.stdout.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      child.on('error', (err) => {
        reject(err)
      })

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`System speech synthesis exited with code ${code}`))
          return
        }

        const fullBuffer = Buffer.concat(chunks)
        if (fullBuffer.length < 44) {
          reject(new Error('System speech synthesis generated empty or invalid audio.'))
          return
        }

        resolve({
          data: new Uint8Array(fullBuffer),
          sampleRateHz: 16000,
          format: 'wav',
          durationMs: Date.now() - startTime
        })
      })
    })
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      ok: true,
      providerId: this.id,
      message: 'Windows System.Speech native engine available'
    }
  }
}
