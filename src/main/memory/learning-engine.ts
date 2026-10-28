import { loadUserMemory, saveUserMemory } from './user-memory'

export interface LearningProposal {
  category: 'user_preference' | 'workspace_convention' | 'tool_workaround'
  detectedInsight: string
  suggestedNote: string
}

export class LearningEngine {
  private workspacePath: string

  constructor(workspacePath: string = process.cwd()) {
    this.workspacePath = workspacePath
  }

  public updateWorkspacePath(workspacePath: string): void {
    this.workspacePath = workspacePath
  }

  /**
   * Analyzes user prompts and tool outputs to detect potential autonomous learning opportunities.
   */
  public detectLearningOpportunity(
    userPrompt: string,
    toolExecutionSummary?: string
  ): LearningProposal | null {
    const text = userPrompt.trim()
    const lower = text.toLowerCase()

    // 1. Explicit User Corrections & Mandates
    if (
      lower.includes('never ') ||
      lower.includes('always ') ||
      lower.includes('don\'t ') ||
      lower.includes('do not ') ||
      lower.includes('remember that ') ||
      lower.includes('remember to ') ||
      lower.includes('i prefer ') ||
      lower.includes('from now on ') ||
      lower.includes('correction:') ||
      lower.includes('stop doing ')
    ) {
      // Clean up into a concise note
      const cleanedNote = text
        .replace(/^(please\s+|jarvis,\s*|hey jarvis,\s*)/i, '')
        .trim()

      return {
        category: 'user_preference',
        detectedInsight: `User provided a direct guideline/correction: "${cleanedNote}"`,
        suggestedNote: cleanedNote
      }
    }

    // 2. Browser Profile or Identity Preferences
    if (
      (lower.includes('profile') || lower.includes('account')) &&
      (lower.includes('use ') || lower.includes('prefer ') || lower.includes('my profile is'))
    ) {
      return {
        category: 'user_preference',
        detectedInsight: 'User specified a browser profile preference.',
        suggestedNote: `Chrome profile preference: ${text}`
      }
    }

    // 3. Development / Workspace Tool Conventions
    if (
      (lower.includes('port ') || lower.includes('build command') || lower.includes('test command') || lower.includes('package manager')) &&
      (lower.includes('is ') || lower.includes('use ') || lower.includes('run '))
    ) {
      return {
        category: 'workspace_convention',
        detectedInsight: 'User specified a workspace convention or command preference.',
        suggestedNote: `Workspace convention: ${text}`
      }
    }

    // 4. Recovered Tool Workarounds
    if (toolExecutionSummary && (toolExecutionSummary.includes('workaround') || toolExecutionSummary.includes('recovered'))) {
      return {
        category: 'tool_workaround',
        detectedInsight: 'A successful tool workaround was applied during task execution.',
        suggestedNote: `Tool execution note: ${toolExecutionSummary.slice(0, 150)}`
      }
    }

    return null
  }

  /**
   * Appends an approved learning note into the persistent USER.md store.
   */
  public saveLearnedNote(note: string): { success: boolean; message: string } {
    try {
      const memory = loadUserMemory(this.workspacePath)
      const existingNotes = memory.notes || []

      // Avoid exact duplicates
      if (existingNotes.some((n) => n.toLowerCase().trim() === note.toLowerCase().trim())) {
        return {
          success: true,
          message: 'Note is already saved in persistent memory.'
        }
      }

      const updatedNotes = [...existingNotes, note.trim()]
      saveUserMemory({ notes: updatedNotes }, this.workspacePath)

      return {
        success: true,
        message: `Successfully saved to USER.md: "${note}"`
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to save learned note: ${err.message}`
      }
    }
  }
}
