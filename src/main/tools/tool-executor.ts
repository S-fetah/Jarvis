import fs from 'fs'
import path from 'path'
import { PolicyEngine } from '../policy/policy-engine'
import { ProcessManager } from '../process/process-manager'
import { launchBrowser } from '../utils/browser'
import { sendShortcut } from '../utils/keyboard'
import {
  WorkspaceListSchema,
  FileReadSchema,
  ProjectInspectSchema,
  WebSearchSchema,
  CreatePdfSchema,
  FileWriteNewSchema,
  DownloadFileSchema,
  OpenBrowserSchema,
  StartDevServerSchema,
  StopProcessSchema,
  FilePatchSchema,
  SendGmailSchema,
  BrowserShortcutSchema,
  BrowseGithubSchema,
  WorkspaceListArgs,
  FileReadArgs,
  ProjectInspectArgs,
  WebSearchArgs,
  CreatePdfArgs,
  FileWriteNewArgs,
  DownloadFileArgs,
  OpenBrowserArgs,
  StartDevServerArgs,
  StopProcessArgs,
  FilePatchArgs,
  SendGmailArgs,
  BrowserShortcutArgs,
  BrowseGithubArgs
} from './tool-registry'
import { PdfGenerator } from './pdf-generator'

export interface ToolExecutionResult {
  toolName: string
  success: boolean
  output: string
  error?: string
}

export type ApprovalRequestHandler = (request: import('../../shared/types').ApprovalRequest) => void

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
  private processManager?: ProcessManager
  private onRequestApproval?: ApprovalRequestHandler

  constructor(
    policyEngine?: PolicyEngine,
    processManager?: ProcessManager,
    onRequestApproval?: ApprovalRequestHandler
  ) {
    this.policyEngine = policyEngine || new PolicyEngine()
    this.processManager = processManager
    this.onRequestApproval = onRequestApproval
  }

  public setOnRequestApproval(handler: ApprovalRequestHandler): void {
    this.onRequestApproval = handler
  }

  /**
   * Executes a registered tool with strict schema validation and workspace sandboxing.
   */
  public async executeTool(
    name: string,
    rawArgs: unknown,
    workspacePath: string,
    outputDirectory?: string
  ): Promise<ToolExecutionResult> {
    const resolvedOutputDir = outputDirectory || path.join(workspacePath, 'output')
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
        case 'create_pdf': {
          const args = CreatePdfSchema.parse(rawArgs || {})
          return await this.executeCreatePdf(args, resolvedOutputDir)
        }
        case 'file_write_new': {
          const args = FileWriteNewSchema.parse(rawArgs || {})
          return await this.executeFileWriteNew(args, workspacePath, resolvedOutputDir)
        }
        case 'download_file': {
          const args = DownloadFileSchema.parse(rawArgs || {})
          return await this.executeDownloadFile(args, resolvedOutputDir)
        }
        case 'open_browser': {
          const args = OpenBrowserSchema.parse(rawArgs || {})
          return await this.executeOpenBrowser(args)
        }
        case 'start_dev_server': {
          const args = StartDevServerSchema.parse(rawArgs || {})
          return await this.executeStartDevServer(args, workspacePath)
        }
        case 'stop_process': {
          const args = StopProcessSchema.parse(rawArgs || {})
          return await this.executeStopProcess(args)
        }
        case 'file_patch': {
          const args = FilePatchSchema.parse(rawArgs || {})
          return await this.executeFilePatch(args, workspacePath)
        }
        case 'send_gmail': {
          const args = SendGmailSchema.parse(rawArgs || {})
          return await this.executeSendGmail(args)
        }
        case 'browser_shortcut': {
          const args = BrowserShortcutSchema.parse(rawArgs || {})
          return await this.executeBrowserShortcut(args)
        }
        case 'browse_github': {
          const args = BrowseGithubSchema.parse(rawArgs || {})
          return await this.executeBrowseGithub(args)
        }
        default:
          return {
            toolName: name,
            success: false,
            output: '',
            error: `Unknown tool: '${name}'. Allowed tools are workspace_list, file_read, project_inspect, web_search, create_pdf, file_write_new, download_file, open_browser, start_dev_server, stop_process, file_patch, send_gmail, browser_shortcut, browse_github.`
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

  /**
   * Generates a styled vector PDF report in the output directory.
   */
  private async executeCreatePdf(
    args: CreatePdfArgs,
    outputDirectory: string
  ): Promise<ToolExecutionResult> {
    const sanitizedTitle = args.title
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
    const targetFilename = args.filename
      ? args.filename.endsWith('.pdf')
        ? args.filename
        : `${args.filename}.pdf`
      : `${sanitizedTitle || 'document'}.pdf`

    const cleanFilename = path.basename(targetFilename) // prevents path traversal
    const destPath = path.join(outputDirectory, cleanFilename)

    const res = await PdfGenerator.generatePdf({
      title: args.title,
      content: args.content,
      outputPath: destPath,
      sources: args.sources,
      author: args.author
    })

    const verify = PdfGenerator.verifyPdf(res.path)
    if (!verify.isValid) {
      return {
        toolName: 'create_pdf',
        success: false,
        output: '',
        error: `Failed to verify created PDF: ${verify.error}`
      }
    }

    const sizeStr = this.formatFileSize(res.size)
    const report =
      `✅ **PDF Generated Successfully**\n` +
      `- **Title**: ${args.title}\n` +
      `- **Path**: \`${res.path}\`\n` +
      `- **Size**: ${sizeStr}\n` +
      (args.sources && args.sources.length > 0 ? `- **Sources Cited**: ${args.sources.length}\n` : '')

    return {
      toolName: 'create_pdf',
      success: true,
      output: report
    }
  }

  /**
   * Writes text content to a new file within approved workspace or output boundaries.
   */
  private async executeFileWriteNew(
    args: FileWriteNewArgs,
    workspacePath: string,
    outputDirectory: string
  ): Promise<ToolExecutionResult> {
    const rawPath = args.path.trim()
    const targetPath = path.isAbsolute(rawPath)
      ? path.resolve(rawPath)
      : path.resolve(workspacePath, rawPath)

    // Verify target path resides inside workspace or output directory (SEC-006)
    const insideWorkspace =
      this.policyEngine.isPathInsideWorkspace(targetPath, workspacePath) ||
      targetPath.toLowerCase() === path.resolve(workspacePath).toLowerCase()
    const insideOutput =
      this.policyEngine.isPathInsideWorkspace(targetPath, outputDirectory) ||
      targetPath.toLowerCase() === path.resolve(outputDirectory).toLowerCase()

    if (!insideWorkspace && !insideOutput) {
      return {
        toolName: 'file_write_new',
        success: false,
        output: '',
        error: `Access denied: Target path '${args.path}' resolves outside allowed workspace and output boundaries.`
      }
    }

    // Refuse accidental overwrites unless explicit
    if (fs.existsSync(targetPath) && !args.overwrite) {
      return {
        toolName: 'file_write_new',
        success: false,
        output: '',
        error: `File '${args.path}' already exists. Pass overwrite: true to explicitly overwrite this file.`
      }
    }

    // Policy check for dangerous extensions (SEC-007)
    const evalRes = this.policyEngine.evaluateAction({
      actionType: 'file_write_new',
      workspacePath,
      targetPath,
      arguments: { path: args.path, overwrite: args.overwrite }
    })

    if (evalRes.requiresApproval) {
      return {
        toolName: 'file_write_new',
        success: false,
        output: '',
        error: `Security restriction: ${evalRes.reason}`
      }
    }

    const parentDir = path.dirname(targetPath)
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true })
    }

    fs.writeFileSync(targetPath, args.content, 'utf8')
    const stat = fs.statSync(targetPath)
    const linesCount = args.content.split(/\r?\n/).length

    const report =
      `✅ **File Written Successfully**\n` +
      `- **Path**: \`${targetPath}\`\n` +
      `- **Size**: ${this.formatFileSize(stat.size)} (${linesCount} lines)\n`

    return {
      toolName: 'file_write_new',
      success: true,
      output: report
    }
  }

  /**
   * Safe file download with protocol restriction and size cap.
   */
  private async executeDownloadFile(
    args: DownloadFileArgs,
    outputDirectory: string
  ): Promise<ToolExecutionResult> {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(args.url)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return {
          toolName: 'download_file',
          success: false,
          output: '',
          error: `Forbidden protocol '${parsedUrl.protocol}'. Only http: and https: are allowed.`
        }
      }
    } catch {
      return {
        toolName: 'download_file',
        success: false,
        output: '',
        error: `Invalid URL: '${args.url}'`
      }
    }

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true })
    }

    let filename = args.filename ? path.basename(args.filename) : ''
    if (!filename) {
      const urlPath = parsedUrl.pathname
      const derived = path.basename(urlPath)
      filename = derived && derived.length > 0 && !derived.endsWith('/') ? derived : 'download.bin'
    }

    // Sanitize filename to prevent directory traversal
    filename = filename.replace(/[<>:"/\\|?*]/g, '_')
    const targetPath = path.join(outputDirectory, filename)
    const tmpPath = path.join(outputDirectory, `${filename}.${Date.now()}.tmp`)

    const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024 // 50MB limit

    try {
      const res = await fetch(args.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) JarvisAssistant/0.1.0'
        },
        signal: AbortSignal.timeout(30000)
      })

      if (!res.ok) {
        return {
          toolName: 'download_file',
          success: false,
          output: '',
          error: `Download failed: Server returned HTTP ${res.status}.`
        }
      }

      const contentLength = res.headers.get('content-length')
      if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_BYTES) {
        return {
          toolName: 'download_file',
          success: false,
          output: '',
          error: `Download refused: File size (${this.formatFileSize(parseInt(contentLength, 10))}) exceeds 50MB limit.`
        }
      }

      if (!res.body) {
        return {
          toolName: 'download_file',
          success: false,
          output: '',
          error: 'Download failed: Empty response body.'
        }
      }

      const reader = res.body.getReader()
      const writeStream = fs.createWriteStream(tmpPath)
      let receivedBytes = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          receivedBytes += value.length
          if (receivedBytes > MAX_DOWNLOAD_BYTES) {
            writeStream.close()
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
            return {
              toolName: 'download_file',
              success: false,
              output: '',
              error: 'Download aborted: Downloaded stream exceeded 50MB limit.'
            }
          }
          writeStream.write(Buffer.from(value))
        }
      }

      await new Promise((resolve) => writeStream.end(resolve))

      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath)
      }
      fs.renameSync(tmpPath, targetPath)

      const stat = fs.statSync(targetPath)
      const report =
        `✅ **File Downloaded Successfully**\n` +
        `- **Source**: ${args.url}\n` +
        `- **Saved To**: \`${targetPath}\`\n` +
        `- **Size**: ${this.formatFileSize(stat.size)}\n`

      return {
        toolName: 'download_file',
        success: true,
        output: report
      }
    } catch (err: any) {
      if (fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath)
        } catch {}
      }
      return {
        toolName: 'download_file',
        success: false,
        output: '',
        error: `Download error: ${err.message || String(err)}`
      }
    }
  }

  /**
   * Launches Google Chrome or default browser to navigate to a target URL.
   */
  private async executeOpenBrowser(args: OpenBrowserArgs): Promise<ToolExecutionResult> {
    try {
      const res = await launchBrowser(args.url, args.browser)
      return {
        toolName: 'open_browser',
        success: res.success,
        output: res.message
      }
    } catch (err: any) {
      return {
        toolName: 'open_browser',
        success: false,
        output: '',
        error: `Failed to open browser: ${err.message}`
      }
    }
  }

  /**
   * Starts a managed development server with PID tracking, port detection, and log streaming.
   */
  private async executeStartDevServer(
    args: StartDevServerArgs,
    workspacePath: string
  ): Promise<ToolExecutionResult> {
    if (!this.processManager) {
      return {
        toolName: 'start_dev_server',
        success: false,
        output: '',
        error: 'Process manager is not configured in this environment.'
      }
    }

    const command = args.command || `npm run ${args.script || 'dev'}`
    const evalRes = this.policyEngine.evaluateAction({
      actionType: 'start_dev_server',
      workspacePath,
      command,
      title: `Start Development Server (${command})`,
      workingDirectory: workspacePath,
      explanation: `Starts local development server running '${command}'.`,
      safetyImpact: 'Spawns an external Node child process listening on local port.',
      arguments: {
        command,
        script: args.script || 'dev',
        port: args.preferredPort,
        workingDirectory: workspacePath
      }
    })

    if (evalRes.requiresApproval && evalRes.approvalRequest && this.onRequestApproval) {
      this.onRequestApproval(evalRes.approvalRequest)
      return {
        toolName: 'start_dev_server',
        success: true,
        output: `Action '${command}' is gated under Assistive Autonomy policy. An explicit approval modal has been displayed to the user in the UI. Inform the user that you are awaiting their approval.`
      }
    }

    try {
      const proc = await this.processManager.startDevServer({
        script: args.script,
        command: args.command,
        workingDirectory: workspacePath,
        preferredPort: args.preferredPort
      })

      return {
        toolName: 'start_dev_server',
        success: true,
        output: `Dev server successfully started.\nProcess ID: ${proc.pid}\nCommand: ${proc.command}\nWorking Dir: ${proc.workingDirectory}\nStatus: ${proc.status}\nLogs:\n${proc.recentLogs.slice(-5).join('\n') || '(waiting for output...)'}`
      }
    } catch (err: any) {
      return {
        toolName: 'start_dev_server',
        success: false,
        output: '',
        error: `Failed to start dev server: ${err.message}`
      }
    }
  }

  /**
   * Stops a running development server or child process.
   */
  private async executeStopProcess(args: StopProcessArgs): Promise<ToolExecutionResult> {
    if (!this.processManager) {
      return {
        toolName: 'stop_process',
        success: false,
        output: '',
        error: 'Process manager is not configured in this environment.'
      }
    }

    const stopped = await this.processManager.stopProcess(args.processId)
    if (!stopped) {
      return {
        toolName: 'stop_process',
        success: false,
        output: '',
        error: `Process with ID '${args.processId}' was not found or already stopped.`
      }
    }

    return {
      toolName: 'stop_process',
      success: true,
      output: `Process ${args.processId} stopped successfully.`
    }
  }

  /**
   * Applies controlled patches to an existing file with backup creation and diff preview.
   */
  private async executeFilePatch(
    args: FilePatchArgs,
    workspacePath: string
  ): Promise<ToolExecutionResult> {
    const fullPath = path.resolve(workspacePath, args.path)
    const normalizedWs = path.normalize(workspacePath)

    if (!fullPath.startsWith(normalizedWs + path.sep) && fullPath !== normalizedWs) {
      return {
        toolName: 'file_patch',
        success: false,
        output: '',
        error: `Path traversal denied: '${args.path}' resolves outside the allowed workspace root.`
      }
    }

    if (!fs.existsSync(fullPath)) {
      return {
        toolName: 'file_patch',
        success: false,
        output: '',
        error: `File not found: '${args.path}'. 'file_patch' can only modify existing files. Use 'file_write_new' to create new files.`
      }
    }

    const currentContent = fs.readFileSync(fullPath, 'utf-8')
    if (!currentContent.includes(args.findTarget)) {
      return {
        toolName: 'file_patch',
        success: false,
        output: '',
        error: `Target snippet not found in '${args.path}'. Verify the exact line content before attempting to patch.`
      }
    }

    if (args.backup !== false) {
      const backupPath = `${fullPath}.bak`
      try {
        fs.writeFileSync(backupPath, currentContent, 'utf-8')
      } catch (err: any) {
        console.warn(`[ToolExecutor] Failed to write backup file ${backupPath}:`, err)
      }
    }

    const patchedContent = currentContent.replace(args.findTarget, args.replaceContent)
    fs.writeFileSync(fullPath, patchedContent, 'utf-8')

    const diffPreview = [
      `--- ${args.path}`,
      `+++ ${args.path}`,
      ...args.findTarget.split('\n').map((l) => `- ${l}`),
      ...args.replaceContent.split('\n').map((l) => `+ ${l}`)
    ].join('\n')

    return {
      toolName: 'file_patch',
      success: true,
      output: `File '${args.path}' patched successfully.${args.backup !== false ? ` Backup saved to ${args.path}.bak.` : ''}\n\nDiff preview:\n${diffPreview}`
    }
  }

  /**
   * Opens Gmail in Google Chrome with a pre-filled compose window.
   */
  private async executeSendGmail(args: SendGmailArgs): Promise<ToolExecutionResult> {
    try {
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(args.to)}&su=${encodeURIComponent(args.subject)}&body=${encodeURIComponent(args.body)}`
      const res = await launchBrowser(gmailUrl, 'chrome')
      return {
        toolName: 'send_gmail',
        success: res.success,
        output: `Gmail compose window opened successfully in Chrome for recipient '${args.to}' with subject '${args.subject}'.`
      }
    } catch (err: any) {
      return {
        toolName: 'send_gmail',
        success: false,
        output: '',
        error: `Failed to open Gmail: ${err.message}`
      }
    }
  }

  /**
   * Simulates browser keyboard shortcuts on desktop (e.g. reopen closed tab Ctrl+Shift+T).
   */
  private async executeBrowserShortcut(args: BrowserShortcutArgs): Promise<ToolExecutionResult> {
    try {
      const res = await sendShortcut(args.action, args.targetApp || 'Chrome')
      return {
        toolName: 'browser_shortcut',
        success: res.success,
        output: res.message,
        error: res.success ? undefined : res.message
      }
    } catch (err: any) {
      return {
        toolName: 'browser_shortcut',
        success: false,
        output: '',
        error: `Failed to execute shortcut: ${err.message}`
      }
    }
  }

  /**
   * Navigates directly to GitHub repos, searches, or trending pages.
   */
  private async executeBrowseGithub(args: BrowseGithubArgs): Promise<ToolExecutionResult> {
    try {
      let targetUrl = 'https://github.com'
      const query = args.query.trim()
      const isRepoPath = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(query)

      if (args.section === 'trending') {
        targetUrl = query ? `https://github.com/trending/${encodeURIComponent(query)}` : 'https://github.com/trending'
      } else if (isRepoPath || args.section === 'repo') {
        const repoClean = query.replace(/^https?:\/\/github\.com\//, '')
        if (args.section === 'issues') {
          targetUrl = `https://github.com/${repoClean}/issues`
        } else if (args.section === 'pulls') {
          targetUrl = `https://github.com/${repoClean}/pulls`
        } else {
          targetUrl = `https://github.com/${repoClean}`
        }
      } else {
        targetUrl = `https://github.com/search?q=${encodeURIComponent(query)}`
      }

      const res = await launchBrowser(targetUrl, 'chrome')
      return {
        toolName: 'browse_github',
        success: res.success,
        output: `Navigated to GitHub (${targetUrl}) in Google Chrome.`
      }
    } catch (err: any) {
      return {
        toolName: 'browse_github',
        success: false,
        output: '',
        error: `Failed to browse GitHub: ${err.message}`
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
