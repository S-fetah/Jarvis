import fs from 'fs'
import path from 'path'
import { PolicyEngine } from '../policy/policy-engine'
import {
  WorkspaceListSchema,
  FileReadSchema,
  ProjectInspectSchema,
  WebSearchSchema,
  WorkspaceListArgs,
  FileReadArgs,
  ProjectInspectArgs,
  WebSearchArgs
} from './tool-registry'

export interface ToolExecutionResult {
  toolName: string
  success: boolean
  output: string
  error?: string
}

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  '.vite',
  '.vscode',
  'userData',
  'coverage',
  'build',
  '.idea',
  '__pycache__'
])

const MAX_OUTPUT_BYTES = 32 * 1024 // 32 KB safety truncation limit

export class ToolExecutor {
  private policyEngine: PolicyEngine

  constructor(policyEngine?: PolicyEngine) {
    this.policyEngine = policyEngine || new PolicyEngine()
  }

  /**
   * Executes a registered read-only tool with strict schema validation and workspace sandboxing.
   */
  public async executeTool(
    name: string,
    rawArgs: unknown,
    workspacePath: string
  ): Promise<ToolExecutionResult> {
    try {
      switch (name) {
        case 'workspace_list': {
          const args = WorkspaceListSchema.parse(rawArgs || {})
          return await this.executeWorkspaceList(args, workspacePath)
        }
        case 'file_read': {
          const args = FileReadSchema.parse(rawArgs || {})
          return await this.executeFileRead(args, workspacePath)
        }
        case 'project_inspect': {
          const args = ProjectInspectSchema.parse(rawArgs || {})
          return await this.executeProjectInspect(args, workspacePath)
        }
        case 'web_search': {
          const args = WebSearchSchema.parse(rawArgs || {})
          return await this.executeWebSearch(args)
        }
        default:
          return {
            toolName: name,
            success: false,
            output: '',
            error: `Unknown tool: '${name}'. Allowed tools are workspace_list, file_read, project_inspect, web_search.`
          }
      }
    } catch (err: any) {
      return {
        toolName: name,
        success: false,
        output: '',
        error: `Tool execution error: ${err.message || String(err)}`
      }
    }
  }

  /**
   * Lists files and folders in workspace within bounded depth, skipping noisy directories.
   */
  private async executeWorkspaceList(
    args: WorkspaceListArgs,
    workspacePath: string
  ): Promise<ToolExecutionResult> {
    const rawSubpath = args.subpath || ''
    const targetDir = path.resolve(workspacePath, rawSubpath)

    // Security check: Must be inside or identical to workspace root
    if (
      targetDir.toLowerCase() !== path.resolve(workspacePath).toLowerCase() &&
      !this.policyEngine.isPathInsideWorkspace(targetDir, workspacePath)
    ) {
      return {
        toolName: 'workspace_list',
        success: false,
        output: '',
        error: `Access denied: Target path '${rawSubpath}' is outside active workspace.`
      }
    }

    if (!fs.existsSync(targetDir)) {
      return {
        toolName: 'workspace_list',
        success: false,
        output: '',
        error: `Directory not found: '${rawSubpath}'`
      }
    }

    const stat = fs.statSync(targetDir)
    if (!stat.isDirectory()) {
      return {
        toolName: 'workspace_list',
        success: false,
        output: '',
        error: `Target path '${rawSubpath}' is a file, not a directory. Use 'file_read' instead.`
      }
    }

    const maxDepth = Math.min(Math.max(1, args.maxDepth ?? 2), 3)
    const items: string[] = []
    let totalCount = 0
    const maxEntries = 120

    const walk = (currentDir: string, currentDepth: number, prefix: string): void => {
      if (currentDepth > maxDepth || totalCount >= maxEntries) return

      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true })
        // Sort directories first, then files alphabetically
        entries.sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1
          if (!a.isDirectory() && b.isDirectory()) return 1
          return a.name.localeCompare(b.name)
        })

        for (const entry of entries) {
          if (totalCount >= maxEntries) break
          if (IGNORED_DIRECTORIES.has(entry.name) || entry.name.startsWith('.')) continue

          const fullEntryPath = path.join(currentDir, entry.name)
          const relPath = path.relative(workspacePath, fullEntryPath).replace(/\\/g, '/')

          if (entry.isDirectory()) {
            totalCount++
            items.push(`${prefix}📁 ${entry.name}/`)
            if (currentDepth < maxDepth) {
              walk(fullEntryPath, currentDepth + 1, prefix + '  ')
            }
          } else {
            totalCount++
            try {
              const fileStat = fs.statSync(fullEntryPath)
              const sizeStr = this.formatFileSize(fileStat.size)
              items.push(`${prefix}📄 ${entry.name} (${sizeStr})`)
            } catch {
              items.push(`${prefix}📄 ${entry.name}`)
            }
          }
        }
      } catch (err: any) {
        items.push(`${prefix}[Error reading directory: ${err.message}]`)
      }
    }

    walk(targetDir, 1, '')

    let output = `### Workspace Directory: \`${rawSubpath || '.'}\` (Depth: ${maxDepth})\n`
    if (items.length === 0) {
      output += '_Empty directory or only ignored files present._'
    } else {
      output += items.map((line) => `- ${line}`).join('\n')
      if (totalCount >= maxEntries) {
        output += `\n\n_Note: Results capped at ${maxEntries} items._`
      }
    }

    return {
      toolName: 'workspace_list',
      success: true,
      output: this.truncateOutput(output)
    }
  }

  /**
   * Reads text from a file inside the workspace with line numbers and size bounds.
   */
  private async executeFileRead(
    args: FileReadArgs,
    workspacePath: string
  ): Promise<ToolExecutionResult> {
    const targetFile = path.resolve(workspacePath, args.path)

    // Security check: Must reside within workspace
    if (!this.policyEngine.isPathInsideWorkspace(targetFile, workspacePath)) {
      return {
        toolName: 'file_read',
        success: false,
        output: '',
        error: `Access denied: Path '${args.path}' resolves outside the approved workspace boundary.`
      }
    }

    if (!fs.existsSync(targetFile)) {
      return {
        toolName: 'file_read',
        success: false,
        output: '',
        error: `File not found: '${args.path}'`
      }
    }

    const stat = fs.statSync(targetFile)
    if (stat.isDirectory()) {
      return {
        toolName: 'file_read',
        success: false,
        output: '',
        error: `Path '${args.path}' is a directory, not a file. Use 'workspace_list' instead.`
      }
    }

    if (stat.size > 2 * 1024 * 1024) {
      return {
        toolName: 'file_read',
        success: false,
        output: '',
        error: `File '${args.path}' exceeds 2MB read limit (${this.formatFileSize(stat.size)}).`
      }
    }

    let fileContent: string
    try {
      fileContent = fs.readFileSync(targetFile, 'utf8')
    } catch (err: any) {
      return {
        toolName: 'file_read',
        success: false,
        output: '',
        error: `Could not read file '${args.path}': ${err.message}`
      }
    }

    const allLines = fileContent.split(/\r?\n/)
    const startLine = Math.max(1, args.startLine ?? 1)
    const maxLines = Math.min(Math.max(1, args.maxLines ?? 250), 300)
    const endIndex = Math.min(startLine - 1 + maxLines, allLines.length)
    const selectedLines = allLines.slice(startLine - 1, endIndex)

    const lineNumPadding = String(endIndex).length
    const formattedLines = selectedLines.map((line, idx) => {
      const lineNum = String(startLine + idx).padStart(lineNumPadding, ' ')
      return `${lineNum} | ${line}`
    })

    const header = `### File: \`${args.path}\` (Lines ${startLine}–${endIndex} of ${allLines.length})\n\`\`\`\n`
    const footer = '\n```'
    const fullText = header + formattedLines.join('\n') + footer

    return {
      toolName: 'file_read',
      success: true,
      output: this.truncateOutput(fullText)
    }
  }

  /**
   * Safe project inspection without code execution.
   */
  private async executeProjectInspect(
    args: ProjectInspectArgs,
    workspacePath: string
  ): Promise<ToolExecutionResult> {
    const info: Record<string, any> = {
      workspacePath,
      frameworks: [] as string[],
      git: null as any,
      packageJson: null as any
    }

    // 1. Inspect package.json
    const pkgPath = path.join(workspacePath, 'package.json')
    if (fs.existsSync(pkgPath)) {
      try {
        const pkgRaw = fs.readFileSync(pkgPath, 'utf8')
        const pkg = JSON.parse(pkgRaw)
        info.packageJson = {
          name: pkg.name || 'unnamed',
          version: pkg.version || '0.0.0',
          description: pkg.description || '',
          scripts: pkg.scripts || {},
          dependencies: Object.keys(pkg.dependencies || {}),
          devDependencies: Object.keys(pkg.devDependencies || {})
        }
      } catch (err: any) {
        info.packageJsonError = err.message
      }
    }

    // 2. Inspect Git HEAD safely (read-only file read, no child process)
    const gitHeadPath = path.join(workspacePath, '.git', 'HEAD')
    if (fs.existsSync(gitHeadPath)) {
      try {
        const headContent = fs.readFileSync(gitHeadPath, 'utf8').trim()
        if (headContent.startsWith('ref: refs/heads/')) {
          info.git = { branch: headContent.replace('ref: refs/heads/', '') }
        } else {
          info.git = { branch: headContent.slice(0, 8) + ' (detached)' }
        }
      } catch {}
    }

    // 3. Detect tech stack
    const checkFile = (name: string): boolean => fs.existsSync(path.join(workspacePath, name))
    if (checkFile('electron.vite.config.ts') || checkFile('electron.vite.config.mjs')) {
      info.frameworks.push('Electron + Vite')
    } else if (checkFile('vite.config.ts') || checkFile('vite.config.js')) {
      info.frameworks.push('Vite')
    }
    if (checkFile('tsconfig.json')) info.frameworks.push('TypeScript')
    if (checkFile('tailwind.config.js') || checkFile('tailwind.config.ts')) {
      info.frameworks.push('Tailwind CSS')
    }
    if (checkFile('Cargo.toml')) info.frameworks.push('Rust / Cargo')
    if (checkFile('pyproject.toml') || checkFile('requirements.txt')) {
      info.frameworks.push('Python')
    }

    // Render markdown report
    let md = `### Project Inspection: \`${info.packageJson?.name || path.basename(workspacePath)}\`\n`
    if (info.packageJson?.version) md += `- **Version**: \`${info.packageJson.version}\`\n`
    if (info.git?.branch) md += `- **Git Branch**: \`${info.git.branch}\`\n`
    if (info.frameworks.length > 0) md += `- **Tech Stack**: ${info.frameworks.join(', ')}\n`

    if (info.packageJson?.scripts && Object.keys(info.packageJson.scripts).length > 0) {
      md += `\n**Available NPM Scripts**:\n`
      for (const [scriptName, cmd] of Object.entries(info.packageJson.scripts)) {
        md += `- \`npm run ${scriptName}\`: \`${cmd}\`\n`
      }
    }

    if (info.packageJson?.dependencies && info.packageJson.dependencies.length > 0) {
      const topDeps = info.packageJson.dependencies.slice(0, 15)
      md += `\n**Dependencies (${info.packageJson.dependencies.length})**: `
      md += topDeps.map((d: string) => `\`${d}\``).join(', ')
      if (info.packageJson.dependencies.length > 15) md += `, ...`
      md += '\n'
    }

    if (args.detail === 'full' && info.packageJson?.devDependencies) {
      md += `\n**Dev Dependencies (${info.packageJson.devDependencies.length})**: `
      md += info.packageJson.devDependencies.slice(0, 15).map((d: string) => `\`${d}\``).join(', ')
      if (info.packageJson.devDependencies.length > 15) md += `, ...`
      md += '\n'
    }

    return {
      toolName: 'project_inspect',
      success: true,
      output: this.truncateOutput(md)
    }
  }

  /**
   * Read-only web research using public search engine.
   */
  private async executeWebSearch(args: WebSearchArgs): Promise<ToolExecutionResult> {
    const maxResults = Math.min(Math.max(1, args.maxResults ?? 5), 8)
    const encodedQuery = encodeURIComponent(args.query)

    try {
      // 1. Query DuckDuckGo HTML endpoint
      const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodedQuery}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) {
        return {
          toolName: 'web_search',
          success: false,
          output: '',
          error: `Search provider returned HTTP ${response.status}.`
        }
      }

      const html = await response.text()
      const results: { title: string; link: string; snippet: string }[] = []

      // Parse DuckDuckGo HTML search results
      const resultBlocks = html.split('<div class="result results_links results_links_deep web-result')

      for (let i = 1; i < resultBlocks.length && results.length < maxResults; i++) {
        const block = resultBlocks[i]

        // Extract Title and Link
        const titleMatch = block.match(/<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/s)
        // Extract Snippet
        const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/s)

        if (titleMatch) {
          let rawLink = titleMatch[1]
          // Decode DuckDuckGo redirect link if present (/l/?kh=-1&uddg=...)
          const uddgMatch = rawLink.match(/[?&]uddg=([^&]+)/)
          if (uddgMatch) {
            try {
              rawLink = decodeURIComponent(uddgMatch[1])
            } catch {}
          }

          const rawTitle = titleMatch[2].replace(/<[^>]+>/g, '').trim()
          const rawSnippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : ''

          if (rawTitle && rawLink.startsWith('http')) {
            results.push({
              title: rawTitle,
              link: rawLink,
              snippet: rawSnippet
            })
          }
        }
      }

      if (results.length === 0) {
        // Fallback: Query DuckDuckGo Instant Answer API
        try {
          const apiRes = await fetch(
            `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`,
            { signal: AbortSignal.timeout(6000) }
          )
          if (apiRes.ok) {
            const apiJson = await apiRes.json()
            if (apiJson.AbstractText) {
              results.push({
                title: apiJson.Heading || args.query,
                link: apiJson.AbstractURL || 'https://duckduckgo.com',
                snippet: apiJson.AbstractText
              })
            }
          }
        } catch {}
      }

      if (results.length === 0) {
        return {
          toolName: 'web_search',
          success: true,
          output: `No search results found for query: "${args.query}".`
        }
      }

      let md = `### Web Search Results for: "${args.query}"\n\n`
      results.forEach((r, idx) => {
        md += `${idx + 1}. [${r.title}](${r.link})\n`
        if (r.snippet) {
          md += `   ${r.snippet}\n`
        }
        md += '\n'
      })

      return {
        toolName: 'web_search',
        success: true,
        output: this.truncateOutput(md)
      }
    } catch (err: any) {
      return {
        toolName: 'web_search',
        success: false,
        output: '',
        error: `Web search timed out or was unreachable: ${err.message || String(err)}`
      }
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  private truncateOutput(str: string): string {
    if (Buffer.byteLength(str, 'utf8') <= MAX_OUTPUT_BYTES) {
      return str
    }
    const truncated = str.slice(0, MAX_OUTPUT_BYTES / 2) // conservative byte truncation
    return `${truncated}\n\n[... Output truncated to protect token limits (exceeded 32KB) ...]`
  }
}
