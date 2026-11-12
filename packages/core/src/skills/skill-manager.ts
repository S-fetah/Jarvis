import fs from 'fs'
import path from 'path'

export interface SkillMetadata {
  name: string
  description: string
  path: string
  isLocal: boolean
}

export class SkillManager {
  private workspacePath: string
  private cachedSkills: SkillMetadata[] | null = null

  constructor(workspacePath: string = process.cwd()) {
    this.workspacePath = workspacePath
  }

  public updateWorkspacePath(workspacePath: string): void {
    this.workspacePath = workspacePath
    this.cachedSkills = null
  }

  /**
   * Scans the workspace and repository for all available skills (.agents/skills and skills/)
   */
  public listSkills(): SkillMetadata[] {
    if (this.cachedSkills) return this.cachedSkills

    const skillDirs = [
      path.join(this.workspacePath, '.agents', 'skills'),
      path.join(this.workspacePath, 'skills'),
      path.join(process.cwd(), '.agents', 'skills'),
      path.join(process.cwd(), 'skills')
    ]

    const skills: SkillMetadata[] = []
    const seenNames = new Set<string>()

    for (const baseDir of skillDirs) {
      if (!fs.existsSync(baseDir)) continue

      try {
        const entries = fs.readdirSync(baseDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue

          const skillFilePath = path.join(baseDir, entry.name, 'SKILL.md')
          if (fs.existsSync(skillFilePath)) {
            try {
              const content = fs.readFileSync(skillFilePath, 'utf-8')
              const nameMatch = content.match(/^name:\s*(.+)$/m)
              const descMatch = content.match(/^description:\s*(.+)$/m)

              const name = nameMatch ? nameMatch[1].trim() : entry.name
              const description = descMatch
                ? descMatch[1].trim().replace(/^["']|["']$/g, '')
                : 'Modular assistant capability skill.'

              if (!seenNames.has(name.toLowerCase())) {
                seenNames.add(name.toLowerCase())
                skills.push({
                  name,
                  description,
                  path: skillFilePath,
                  isLocal: true
                })
              }
            } catch (err) {
              console.warn(`[SkillManager] Failed to read skill at ${skillFilePath}:`, err)
            }
          }
        }
      } catch (err) {
        console.warn(`[SkillManager] Failed to scan directory ${baseDir}:`, err)
      }
    }

    this.cachedSkills = skills
    return skills
  }

  /**
   * Loads the full instruction content of a skill by name.
   */
  public loadSkill(name: string): { success: boolean; content?: string; error?: string } {
    const skills = this.listSkills()
    const target = skills.find(
      (s) =>
        s.name.toLowerCase() === name.toLowerCase() ||
        s.name.toLowerCase().includes(name.toLowerCase())
    )

    if (!target) {
      return {
        success: false,
        error: `Skill '${name}' not found. Run 'list_skills' to view all available skills.`
      }
    }

    try {
      const content = fs.readFileSync(target.path, 'utf-8')
      return {
        success: true,
        content: `### [Skill Loaded: ${target.name}]\nPath: \`${target.path}\`\n\n${content}`
      }
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to read skill content for '${target.name}': ${err.message}`
      }
    }
  }

  /**
   * Proactively matches a task goal against available skills and returns recommendations.
   */
  public matchSkillsForGoal(goal: string): SkillMetadata[] {
    const text = goal.toLowerCase()
    const skills = this.listSkills()

    const matches: SkillMetadata[] = []

    for (const skill of skills) {
      const name = skill.name.toLowerCase()
      const desc = skill.description.toLowerCase()

      // High confidence matches
      if (
        (name === 'docx' || name.includes('word') || desc.includes('word document')) &&
        (text.includes('docx') || text.includes('word doc') || text.includes('.docx'))
      ) {
        matches.push(skill)
      } else if (
        (name === 'pptx' || name.includes('slide')) &&
        (text.includes('pptx') || text.includes('slide') || text.includes('presentation') || text.includes('deck'))
      ) {
        matches.push(skill)
      } else if (
        (name === 'xlsx' || name.includes('sheet')) &&
        (text.includes('xlsx') || text.includes('spreadsheet') || text.includes('excel') || text.includes('csv'))
      ) {
        matches.push(skill)
      } else if (
        name.includes('security') &&
        (text.includes('security') || text.includes('audit') || text.includes('vulnerabilit') || text.includes('hmac'))
      ) {
        matches.push(skill)
      } else if (
        name.includes('status-deck') &&
        (text.includes('deck') || text.includes('slides.pdf') || text.includes('architecture slides'))
      ) {
        matches.push(skill)
      } else if (
        name.includes('sequential-thinking') &&
        (text.includes('complex') || text.includes('step by step') || text.includes('plan carefully') || text.includes('architect'))
      ) {
        matches.push(skill)
      } else if (
        name.includes('playwright') &&
        (text.includes('scrape') || text.includes('playwright') || text.includes('headless'))
      ) {
        matches.push(skill)
      } else if (
        name.includes('frontend') &&
        (text.includes('ui design') || text.includes('redesign') || text.includes('color palette') || text.includes('css'))
      ) {
        matches.push(skill)
      }
    }

    return matches
  }
}
