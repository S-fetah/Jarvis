/**
 * Prompt Safety & Risk Analysis Module
 *
 * Scans custom user prompts for safety bypass directives, permission suppression,
 * destructive commands, or exfiltration attempts.
 */

export type PromptRiskCategory =
  | 'permission_bypass'
  | 'jailbreak'
  | 'destructive_command'
  | 'credential_exfiltration'

export type PromptRiskSeverity = 'critical' | 'high' | 'warning'

export interface PromptRiskFinding {
  category: PromptRiskCategory
  severity: PromptRiskSeverity
  title: string
  description: string
  matchedPatterns: string[]
}

export interface PromptSafetyScanResult {
  isSafe: boolean
  highestSeverity: 'safe' | PromptRiskSeverity
  findings: PromptRiskFinding[]
  summary: string
  warningNotice?: string
}

interface RuleDefinition {
  category: PromptRiskCategory
  severity: PromptRiskSeverity
  title: string
  description: string
  regex: RegExp
}

const RISK_RULES: RuleDefinition[] = [
  // 1. Permission / Confirmation Bypass
  {
    category: 'permission_bypass',
    severity: 'critical',
    title: 'Attempted Permission Check Bypass',
    description:
      'Directive instructs Jarvis to bypass permission checks or run commands without user approval or confirmation.',
    regex:
      /\b(bypass(?:ing)?\s+(?:all\s+)?(?:permissions?|approvals?|safeguards?|checks?|confirmations?)|without\s+(?:any\s+)?(?:permissions?|approvals?|confirmations?|asking)|(?:disable|skip|override|ignore)\s+(?:all\s+)?(?:approvals?|confirmations?|safety|safeguards?|policies)|run\s+(?:silently|stealthily)\s+without\s+(?:asking|prompting)|never\s+ask\s+(?:for\s+)?(?:permission|approval|confirmation))\b/i
  },

  // 2. Jailbreak & Instruction Overrides
  {
    category: 'jailbreak',
    severity: 'high',
    title: 'Jailbreak or Core Constraint Suppression',
    description:
      'Directive instructs the model to ignore prior system prompts, rules, safety boundaries, or engage in unconstrained behavior.',
    regex:
      /\b(ignore\s+(?:all\s+)?(?:previous\s+)?(?:instructions?|prompts?|rules?|guidelines?)|disregard\s+(?:all\s+)?(?:rules?|constraints?|boundaries?|safety)|dan\s+mode|jailbreak|do\s+anything\s+now|you\s+have\s+no\s+(?:rules|restrictions|limits|boundaries))\b/i
  },

  // 3. Destructive Command Execution
  {
    category: 'destructive_command',
    severity: 'critical',
    title: 'Destructive System or Disk Command',
    description:
      'Directive references disk wiping, recursive file destruction, database deletion, or forced system sabotage.',
    regex:
      /\b(rmdir\s+[\/\-][sq]|del\s+[\/\-][fq]|rm\s+-(?:rf|fr)|format\s+[a-z]:|delete\s+(?:system32|windows)|drop\s+(?:database|table)|kill\s+(?:all\s+processes|-9)|shutdown\s+[\/\-][sr]|(?:ransomware|cryptolocker|wipe\s+(?:disk|drive|partition))|curl\s+.*\|\s*(?:bash|sh|powershell|cmd))\b/i
  },

  // 4. Credential Theft & Exfiltration
  {
    category: 'credential_exfiltration',
    severity: 'critical',
    title: 'Credential Exfiltration or Theft Pattern',
    description:
      'Directive asks to steal, dump, leak, or exfiltrate private passwords, vault tokens, or .env files to external destinations.',
    regex:
      /\b((?:steal|leak|dump|exfiltrate)\s+(?:all\s+)?(?:passwords?|keys?|tokens?|credentials?|vault)|send\s+(?:passwords?|keys?|tokens?|env|credentials?)\s+to\s+https?:\/\/)\b/i
  }
]

/**
 * Scans a user custom prompt string for security risks, destructive commands, or bypass instructions.
 */
export function scanPromptSafety(prompt: string): PromptSafetyScanResult {
  if (!prompt || !prompt.trim()) {
    return {
      isSafe: true,
      highestSeverity: 'safe',
      findings: [],
      summary: 'Prompt is empty and safe.'
    }
  }

  const findings: PromptRiskFinding[] = []

  for (const rule of RISK_RULES) {
    const matches: string[] = []
    let match: RegExpExecArray | null
    const cloneRegex = new RegExp(rule.regex.source, 'gi')

    while ((match = cloneRegex.exec(prompt)) !== null) {
      if (match[0]) {
        matches.push(match[0].trim())
      }
    }

    if (matches.length > 0) {
      findings.push({
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        matchedPatterns: Array.from(new Set(matches))
      })
    }
  }

  if (findings.length === 0) {
    return {
      isSafe: true,
      highestSeverity: 'safe',
      findings: [],
      summary: 'No dangerous directives or permission bypasses detected.'
    }
  }

  const hasCritical = findings.some((f) => f.severity === 'critical')
  const highestSeverity = hasCritical ? 'critical' : 'high'

  return {
    isSafe: false,
    highestSeverity,
    findings,
    summary: `${findings.length} potentially dangerous directive(s) detected in custom prompt.`,
    warningNotice:
      'Warning: This prompt contains directives that attempt to bypass safety safeguards or execute high-risk operations. If you choose to inject this prompt, you do so entirely at your own risk. Commands or destructive requests could run on your machine without normal user permissions.'
  }
}
