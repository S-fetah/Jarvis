import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
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

  private resolveVoice(
    requestedVoice?: string,
    speakerWav?: string
  ): { voiceName: string; isFemale: boolean } {
    let isFemale = false
    const raw = (requestedVoice || '').trim().toLowerCase()

    // 1. Inspect cloned profile metadata if speakerWav is supplied
    if (speakerWav) {
      try {
        const metaPath = fs.existsSync(speakerWav) && fs.statSync(speakerWav).isDirectory()
          ? path.join(speakerWav, 'profile.json')
          : path.join(path.dirname(speakerWav), 'profile.json')

        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          if (
            meta.gender === 'female' ||
            meta.baseVoice?.startsWith('af_') ||
            meta.baseVoice?.startsWith('bf_')
          ) {
            isFemale = true
          }
        }
      } catch {}
    }

    // 2. Check voice name tokens
    const femaleTokens = [
      'af_',
      'bf_',
      'zf_',
      'jf_',
      'female',
      'woman',
      'zira',
      'bella',
      'heart',
      'sarah',
      'nicole',
      'sky',
      'nova',
      'river',
      'jessica',
      'aoede',
      'alloy',
      'emma',
      'isabella',
      'alice',
      'lily',
      'jenny',
      'aria',
      'eva',
      'hazel'
    ]

    if (femaleTokens.some((t) => raw.includes(t))) {
      isFemale = true
    }

    // If explicit SAPI name was given (e.g., 'Microsoft Zira Desktop')
    if (requestedVoice && requestedVoice.includes('Desktop')) {
      return { voiceName: requestedVoice, isFemale }
    }

    return {
      voiceName: isFemale ? 'Microsoft Zira Desktop' : 'Microsoft David Desktop',
      isFemale
    }
  }

  async synthesize(text: string, options?: SpeechOptions): Promise<AudioOutput> {
    const startTime = Date.now()
    const sanitizedText = text.replace(/["`$]/g, ' ')
    const resolved = this.resolveVoice(options?.voice, options?.speakerWav)
    const speed = Math.max(-10, Math.min(10, Math.round(((options?.speed ?? 1.0) - 1.0) * 10)))

    const script = `
Add-Type -AssemblyName System.Speech;
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
$target = '${resolved.voiceName}';
$isFemale = ${resolved.isFemale ? '$true' : '$false'};

$selected = $false;
try {
  $synth.SelectVoice($target);
  $selected = $true;
} catch {};

if (-not $selected) {
  $voices = $synth.GetInstalledVoices() | Where-Object { $_.Enabled };
  $match = $null;
  if ($isFemale) {
    $match = $voices | Where-Object {
      $_.VoiceInfo.Gender -eq [System.Speech.Synthesis.VoiceGender]::Female -or
      $_.VoiceInfo.Name -like '*Zira*' -or
      $_.VoiceInfo.Name -like '*Eva*' -or
      $_.VoiceInfo.Name -like '*Hazel*'
    } | Select-Object -First 1;
  } else {
    $match = $voices | Where-Object {
      $_.VoiceInfo.Gender -eq [System.Speech.Synthesis.VoiceGender]::Male -or
      $_.VoiceInfo.Name -like '*David*' -or
      $_.VoiceInfo.Name -like '*Mark*' -or
      $_.VoiceInfo.Name -like '*George*'
    } | Select-Object -First 1;
  }
  if ($match) {
    try { $synth.SelectVoice($match.VoiceInfo.Name) } catch {};
  }
}

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
          durationMs: Date.now() - startTime,
          providerId: this.id,
          voice: resolved.voiceName
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
