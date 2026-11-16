import fs from 'fs'
import path from 'path'
import { KokoroTTSProvider } from '../packages/voice/src/providers/tts/kokoro-tts-provider.ts'

async function generateSamples() {
  const outputDir = path.resolve(process.cwd(), 'docs/voice-samples')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const provider = new KokoroTTSProvider()

  console.log('[Sample Generator] Initializing Kokoro-82M ONNX model...')
  
  // 1. Female sample: af_bella
  console.log('[Sample Generator] Generating female sample (af_bella)...')
  const femaleStart = Date.now()
  const femaleOut = await provider.synthesize(
    'Hello! This is Bella speaking from the Jarvis neural voice engine. All speech systems are functioning with high clarity and low latency.',
    { voice: 'af_bella' }
  )
  const femalePath = path.join(outputDir, 'sample-female-bella.wav')
  fs.writeFileSync(femalePath, Buffer.from(femaleOut.data))
  console.log(
    `[Sample Generator] Saved female sample: ${femalePath} (${femaleOut.durationMs}ms, ${Date.now() - femaleStart}ms inference)`
  )

  // 2. Male sample: bm_george (Jarvis British Butler)
  console.log('[Sample Generator] Generating male sample (bm_george - Jarvis British persona)...')
  const maleStart = Date.now()
  const maleOut = await provider.synthesize(
    'Good evening, sir. I am Jarvis, your personal desktop AI companion. All security protocols and background tasks are running at peak efficiency.',
    { voice: 'bm_george' }
  )
  const malePath = path.join(outputDir, 'sample-male-jarvis-george.wav')
  fs.writeFileSync(malePath, Buffer.from(maleOut.data))
  console.log(
    `[Sample Generator] Saved male sample: ${malePath} (${maleOut.durationMs}ms, ${Date.now() - maleStart}ms inference)`
  )

  console.log('[Sample Generator] Successfully generated real voice samples!')
}

generateSamples().catch(console.error)
