import fs from 'fs'
import path from 'path'
import type { VoiceFeatureStatus } from './types'

/**
 * Checks whether optional local voice assets have been downloaded into the user's
 * voice add-on directory without forcing any runtime dependency on base installs.
 */
export function detectVoiceFeatureStatus(
  modelsDirectory: string,
  enabled = false
): VoiceFeatureStatus {
  const resolvedDir = path.resolve(modelsDirectory)
  let installedModels: string[] = []

  if (fs.existsSync(resolvedDir)) {
    try {
      installedModels = fs
        .readdirSync(resolvedDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() || /\.(onnx|bin|json)$/i.test(entry.name))
        .map((entry) => entry.name)
    } catch {
      installedModels = []
    }
  }

  return {
    optional: true,
    installed: installedModels.length > 0,
    enabled,
    modelsDirectory: resolvedDir,
    installedModels
  }
}
