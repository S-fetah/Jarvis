import fs from 'fs'
import path from 'path'

export interface UserPreferences {
  name?: string
  preferredChromeProfile?: string
  defaultEmail?: string
  preferredDevCommand?: string
  defaultDevPort?: number
  preferredLanguage?: string
  talkingStyle?: string
  taskMode?: string
  thinkingDepth?: string
  notes?: string[]
}

const DEFAULT_PREFERENCES: UserPreferences = {
  name: 'Abdelfetah',
  preferredChromeProfile: 'fennec',
  defaultEmail: 'fennec',
  preferredDevCommand: 'npm run dev',
  defaultDevPort: 5173,
  preferredLanguage: 'TypeScript',
  talkingStyle: 'balanced',
  taskMode: 'chat',
  thinkingDepth: 'standard',
  notes: [
    'Always keep git commits local on main branch (never git push).',
    'Maintain browser tab hygiene (auto-close temporary tabs).',
    'Prefer verified direct delivery or closed-loop confirmation before assuming actions succeeded.'
  ]
}

/**
 * Resolves the path to the persistent USER.md file.
 * Prioritizes active workspace root, with fallback to current directory or AppData.
 */
export function getUserMemoryFilePath(workspacePath?: string): string {
  if (workspacePath && fs.existsSync(workspacePath)) {
    return path.join(workspacePath, 'USER.md')
  }
  return path.join(process.cwd(), 'USER.md')
}

/**
 * Ensures USER.md exists on disk with sensible initial defaults.
 */
export function ensureUserMemoryFile(workspacePath?: string): string {
  const filePath = getUserMemoryFilePath(workspacePath)
  if (!fs.existsSync(filePath)) {
    saveUserMemory(DEFAULT_PREFERENCES, workspacePath)
  }
  return filePath
}

/**
 * Reads and parses user preferences from USER.md.
 */
export function loadUserMemory(workspacePath?: string): UserPreferences {
  const filePath = getUserMemoryFilePath(workspacePath)

  if (!fs.existsSync(filePath)) {
    return { ...DEFAULT_PREFERENCES }
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const prefs: UserPreferences = { ...DEFAULT_PREFERENCES, notes: [] }

    const lines = content.split(/\r?\n/)
    let inNotesSection = false

    for (const rawLine of lines) {
      const line = rawLine.trim()

      if (line.startsWith('## Persistent Memory & Notes')) {
        inNotesSection = true
        continue
      }
      if (line.startsWith('## ') && inNotesSection) {
        inNotesSection = false
      }

      if (inNotesSection) {
        if (line.startsWith('- ') || line.startsWith('* ')) {
          const note = line.slice(2).trim()
          if (note && !prefs.notes?.includes(note)) {
            prefs.notes = prefs.notes || []
            prefs.notes.push(note)
          }
        }
        continue
      }

      // Parse key-value bullet lines like "- **Preferred Chrome Profile**: fennec"
      const match = line.match(/^[-*]\s+\*\*([^*]+)\*\*:\s*(.*)$/)
      if (match) {
        const key = match[1].trim().toLowerCase()
        const val = match[2].trim()

        if (key.includes('name')) prefs.name = val
        else if (key.includes('chrome profile')) prefs.preferredChromeProfile = val
        else if (key.includes('email')) prefs.defaultEmail = val
        else if (key.includes('dev command')) prefs.preferredDevCommand = val
        else if (key.includes('dev port')) prefs.defaultDevPort = parseInt(val, 10) || undefined
        else if (key.includes('language')) prefs.preferredLanguage = val
        else if (key.includes('talking style')) prefs.talkingStyle = val
        else if (key.includes('task mode')) prefs.taskMode = val
        else if (key.includes('thinking depth')) prefs.thinkingDepth = val
      }
    }

    return prefs
  } catch (err) {
    console.warn('[UserMemory] Failed to read USER.md, using defaults:', err)
    return { ...DEFAULT_PREFERENCES }
  }
}

/**
 * Writes updated user preferences to USER.md in human-readable Markdown format.
 */
export function saveUserMemory(updates: Partial<UserPreferences>, workspacePath?: string): UserPreferences {
  const current = loadUserMemory(workspacePath)
  const merged: UserPreferences = {
    ...current,
    ...updates,
    notes: updates.notes ? updates.notes : current.notes
  }

  const filePath = getUserMemoryFilePath(workspacePath)

  const markdownContent = [
    '# Jarvis User Profile & Preferences (USER.md)',
    '',
    'This file stores persistent user preferences and habits across sessions. Jarvis reads this to personalize behavior and remember your choices (e.g. Chrome profile, dev ports, notes). You or Jarvis can edit this anytime.',
    '',
    '## Profile & Identity',
    `- **Name**: ${merged.name || 'User'}`,
    `- **Preferred Chrome Profile**: ${merged.preferredChromeProfile || 'fennec'}`,
    `- **Default Email**: ${merged.defaultEmail || 'fennec'}`,
    '',
    '## Development Preferences',
    `- **Preferred Dev Command**: ${merged.preferredDevCommand || 'npm run dev'}`,
    `- **Default Dev Port**: ${merged.defaultDevPort || 5173}`,
    `- **Preferred Language**: ${merged.preferredLanguage || 'TypeScript'}`,
    '',
    '## Agent Interaction',
    `- **Default Talking Style**: ${merged.talkingStyle || 'balanced'}`,
    `- **Default Task Mode**: ${merged.taskMode || 'chat'}`,
    `- **Default Thinking Depth**: ${merged.thinkingDepth || 'standard'}`,
    '',
    '## Persistent Memory & Notes',
    ...(merged.notes && merged.notes.length > 0
      ? merged.notes.map((n) => `- ${n}`)
      : ['- Keep git commits local on main branch (never git push).']),
    ''
  ].join('\n')

  try {
    fs.writeFileSync(filePath, markdownContent, 'utf-8')
  } catch (err) {
    console.error('[UserMemory] Failed to write USER.md:', err)
  }

  return merged
}

/**
 * Formats user preferences into a clean Markdown block for inclusion in the system prompt.
 */
export function formatUserMemoryPrompt(prefs: UserPreferences): string {
  const parts: string[] = []

  parts.push(`User Persona & Identity: ${prefs.name || 'User'}`)
  if (prefs.preferredChromeProfile) {
    parts.push(`- Preferred Google Chrome Profile: '${prefs.preferredChromeProfile}' (Use this by default when launching Chrome or sending emails unless specified otherwise).`)
  }
  if (prefs.defaultEmail) {
    parts.push(`- Default Email Address/Account: '${prefs.defaultEmail}'`)
  }
  if (prefs.preferredDevCommand) {
    parts.push(`- Preferred Dev Server Command: '${prefs.preferredDevCommand}' (Port: ${prefs.defaultDevPort || 5173})`)
  }
  if (prefs.notes && prefs.notes.length > 0) {
    parts.push(`- User Directives & Habits:`)
    for (const note of prefs.notes) {
      parts.push(`  * ${note}`)
    }
  }

  return parts.join('\n')
}
