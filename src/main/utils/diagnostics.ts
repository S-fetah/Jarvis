import fs from 'fs'
import path from 'path'
import os from 'os'
import { app } from 'electron'
import { JarvisSettings } from '../../shared/types'
import { JARVIS_TOOLS } from '../tools/tool-registry'
import { JarvisDatabase } from '../storage/database'

export interface DiagnosticBundleResult {
  success: boolean
  filePath: string
  jsonFilePath: string
  error?: string
}

export async function exportDiagnosticBundle(
  settings: JarvisSettings,
  db: JarvisDatabase,
  outputDirectory: string
): Promise<DiagnosticBundleResult> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const diagDir = path.resolve(outputDirectory, 'diagnostics')
    if (!fs.existsSync(diagDir)) {
      fs.mkdirSync(diagDir, { recursive: true })
    }

    const mdPath = path.join(diagDir, `jarvis-diagnostics-${timestamp}.md`)
    const jsonPath = path.join(diagDir, `jarvis-diagnostics-${timestamp}.json`)

    // Safe redacted copy of settings
    const safeSettings: Record<string, unknown> = { ...settings }
    if (safeSettings.apiKey) safeSettings.apiKey = '[REDACTED_SEC_003]'
    if (safeSettings.smtpPass) safeSettings.smtpPass = '[REDACTED_SEC_003]'

    // System metrics
    const systemInfo = {
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      platform: process.platform,
      hostname: os.hostname(),
      totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
      freeMemMB: Math.round(os.freemem() / 1024 / 1024),
      cpus: os.cpus().length,
      electron: process.versions.electron || 'N/A',
      node: process.versions.node,
      chrome: process.versions.chrome || 'N/A',
      appVersion: app?.getVersion?.() || '0.1.0'
    }

    // Database summary
    const conversations = db.getConversations()
    const dbSummary = {
      totalConversations: conversations.length,
      activeConversationId: db.getSetting('active_conversation_id') || 'none',
      theme: db.getSetting('theme') || 'system',
      registeredWorkspaces: settings.workspacePaths
    }

    // Tools inventory
    const toolsInventory = JARVIS_TOOLS.map((t) => ({
      name: t.function.name,
      description: t.function.description
    }))

    const bundleData = {
      timestamp: new Date().toISOString(),
      system: systemInfo,
      database: dbSummary,
      settings: safeSettings,
      tools: toolsInventory
    }

    // Write JSON bundle
    fs.writeFileSync(jsonPath, JSON.stringify(bundleData, null, 2), 'utf8')

    // Write Markdown report
    const mdContent = [
      `# Jarvis Diagnostic & Support Bundle`,
      ``,
      `**Generated:** ${bundleData.timestamp}  `,
      `**App Version:** v${systemInfo.appVersion}  `,
      `**OS:** ${systemInfo.os}  `,
      ``,
      `---`,
      ``,
      `## 1. System Environment`,
      `- **Platform:** \`${systemInfo.platform}\` (\`${systemInfo.os}\`)`,
      `- **Memory:** ${systemInfo.freeMemMB} MB free / ${systemInfo.totalMemMB} MB total`,
      `- **CPU Cores:** ${systemInfo.cpus}`,
      `- **Electron Runtime:** v${systemInfo.electron} (Node v${systemInfo.node}, Chrome v${systemInfo.chrome})`,
      ``,
      `## 2. Model Gateway & Configuration`,
      `- **Gateway URL:** \`${settings.gatewayUrl}\``,
      `- **Active Model:** \`${settings.defaultModel}\``,
      `- **Fast Light Mode:** \`${settings.lightMode}\``,
      `- **Theme:** \`${settings.theme}\``,
      `- **API Key Stored:** \`${Boolean(settings.hasApiKey || settings.apiKey)}\` (redacted)`,
      `- **Workspaces:** ${settings.workspacePaths.map((p) => `\`${p}\``).join(', ')}`,
      `- **Output Directory:** \`${settings.outputDirectory}\``,
      ``,
      `## 3. Storage & Persistence`,
      `- **Conversations in SQLite:** ${conversations.length}`,
      `- **Active Conversation ID:** \`${dbSummary.activeConversationId}\``,
      ``,
      `## 4. Native Tool Capabilities (${toolsInventory.length} Registered)`,
      toolsInventory.map((t) => `- **\`${t.name}\`**: ${t.description}`).join('\n'),
      ``,
      `---`,
      `*Confidentiality Notice: All credentials, tokens, and local passwords have been redacted pursuant to SEC-003.*`
    ].join('\n')

    fs.writeFileSync(mdPath, mdContent, 'utf8')

    return {
      success: true,
      filePath: mdPath,
      jsonFilePath: jsonPath
    }
  } catch (err: any) {
    return {
      success: false,
      filePath: '',
      jsonFilePath: '',
      error: err?.message || String(err)
    }
  }
}
