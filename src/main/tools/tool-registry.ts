import { z } from 'zod'

/**
 * Zod Schemas for Read-Only Agent Tools (Phase 2)
 */

export const WorkspaceListSchema = z.object({
  subpath: z
    .string()
    .optional()
    .default('')
    .describe('Relative subpath inside the workspace to inspect (e.g. "src" or "").'),
  maxDepth: z
    .number()
    .optional()
    .default(2)
    .describe('Maximum directory depth to traverse (1 to 3).')
})

export type WorkspaceListArgs = z.infer<typeof WorkspaceListSchema>

export const FileReadSchema = z.object({
  path: z
    .string()
    .describe('Relative file path to read from the workspace root (e.g. "package.json", "src/main/index.ts").'),
  startLine: z
    .number()
    .optional()
    .default(1)
    .describe('Line number to start reading from (1-indexed).'),
  maxLines: z
    .number()
    .optional()
    .default(250)
    .describe('Maximum number of lines to return (capped at 300).')
})

export type FileReadArgs = z.infer<typeof FileReadSchema>

export const ProjectInspectSchema = z.object({
  detail: z
    .enum(['summary', 'full'])
    .optional()
    .default('summary')
    .describe('Level of inspection detail to return.')
})

export type ProjectInspectArgs = z.infer<typeof ProjectInspectSchema>

export const WebSearchSchema = z.object({
  query: z.string().describe('Search query string to research online.'),
  maxResults: z
    .number()
    .optional()
    .default(5)
    .describe('Maximum number of search results to return (1 to 8).')
})

export type WebSearchArgs = z.infer<typeof WebSearchSchema>

export const CreatePdfSchema = z.object({
  title: z.string().describe('Document title of the PDF report.'),
  content: z.string().describe('Report body content formatted in clean Markdown or text sections.'),
  filename: z
    .string()
    .optional()
    .describe('Optional destination PDF filename (e.g. "auth-summary.pdf"). Defaults to sanitized title.'),
  sources: z
    .array(z.string())
    .optional()
    .default([])
    .describe('List of reference URLs or cited documentation links.'),
  author: z
    .string()
    .optional()
    .default('Jarvis Personal AI Assistant')
    .describe('Document author or attribution header.')
})

export type CreatePdfArgs = z.infer<typeof CreatePdfSchema>

export const FileWriteNewSchema = z.object({
  path: z
    .string()
    .describe('Relative path inside workspace or output directory (e.g. "output/notes.md" or "src/config.json").'),
  content: z.string().describe('Full text content to write into the file.'),
  overwrite: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to overwrite if file already exists.')
})

export type FileWriteNewArgs = z.infer<typeof FileWriteNewSchema>

export const DownloadFileSchema = z.object({
  url: z.string().url().describe('HTTP or HTTPS URL of the file to download.'),
  filename: z
    .string()
    .optional()
    .describe('Destination filename inside output directory. If omitted, inferred from URL.')
})

export type DownloadFileArgs = z.infer<typeof DownloadFileSchema>

export const OpenBrowserSchema = z.object({
  url: z
    .string()
    .optional()
    .default('https://google.com')
    .describe('URL or web address to open in the browser (e.g. "https://google.com", "https://mail.google.com", "http://localhost:3000").'),
  browser: z
    .enum(['chrome', 'default'])
    .optional()
    .default('chrome')
    .describe('Target browser. Defaults to "chrome" with fallback to system default.'),
  profile: z
    .string()
    .optional()
    .describe('Optional Chrome profile directory or account name (e.g. "Default", "Profile 4", "fennec", "abdelfetah").')
})

export type OpenBrowserArgs = z.infer<typeof OpenBrowserSchema>

export const StartDevServerSchema = z.object({
  script: z
    .string()
    .optional()
    .default('dev')
    .describe('The npm run script to execute (e.g. "dev", "start", "serve"). Defaults to "dev".'),
  command: z
    .string()
    .optional()
    .describe('Optional custom command to start the dev server (e.g. "npm run dev" or "npx vite").'),
  preferredPort: z
    .number()
    .optional()
    .describe('Expected or preferred port the server listens on (e.g. 3000, 5173, 8080).')
})

export type StartDevServerArgs = z.infer<typeof StartDevServerSchema>

export const StopProcessSchema = z.object({
  processId: z
    .string()
    .describe('ID of the running managed process or dev server to terminate.')
})

export type StopProcessArgs = z.infer<typeof StopProcessSchema>

export const FilePatchSchema = z.object({
  path: z
    .string()
    .describe('Relative path to the existing file inside the workspace to patch.'),
  findTarget: z
    .string()
    .describe('Exact substring or code block to find and replace in the file.'),
  replaceContent: z
    .string()
    .describe('Replacement content to insert in place of findTarget.'),
  backup: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to create an automatic .bak backup file before patching.')
})

export type FilePatchArgs = z.infer<typeof FilePatchSchema>

export const SendGmailSchema = z.object({
  to: z.string().describe('Recipient email address (e.g. "team@example.com").'),
  subject: z.string().describe('Subject line of the email.'),
  body: z.string().describe('Email message body text.'),
  profile: z
    .string()
    .optional()
    .describe('Optional Chrome profile directory or account name (e.g. "Default", "Profile 4", "fennec", "abdelfetah").'),
  autoSend: z
    .boolean()
    .optional()
    .default(false)
    .describe('Set to true to automatically press Send (Ctrl+Enter) in Gmail to dispatch the email immediately.'),
  closeTabAfter: z
    .boolean()
    .optional()
    .default(true)
    .describe('Set to true to automatically close the compose tab (Ctrl+W) after dispatching, preventing tab clutter.')
})

export type SendGmailArgs = z.infer<typeof SendGmailSchema>

export const SendEmailDirectSchema = z.object({
  to: z.string().describe('Recipient email address (e.g. "user@example.com").'),
  subject: z.string().describe('Subject line of the email.'),
  body: z.string().describe('Email message body text.'),
  from: z
    .string()
    .optional()
    .describe('Sender email address. If omitted, uses SMTP user or environment defaults.'),
  smtpUser: z
    .string()
    .optional()
    .describe('Optional SMTP or Gmail username / address. Overrides env SMTP_USER or GMAIL_USER.'),
  smtpPass: z
    .string()
    .optional()
    .describe('Optional SMTP or Gmail App Password. Overrides env SMTP_PASS or GMAIL_APP_PASS.')
})

export type SendEmailDirectArgs = z.infer<typeof SendEmailDirectSchema>

export const BrowserShortcutSchema = z.object({
  action: z
    .enum([
      'reopen_tab',
      'close_tab',
      'new_tab',
      'refresh',
      'next_tab',
      'prev_tab',
      'focus_address_bar',
      'send_email',
      'click_send',
      'submit',
      'enter'
    ])
    .describe('Browser shortcut action to execute (e.g. "reopen_tab" for Ctrl+Shift+T, "send_email" or "click_send" for Ctrl+Enter to send email in Gmail, "close_tab" for Ctrl+W).'),
  targetApp: z
    .string()
    .optional()
    .default('Chrome')
    .describe('Target browser window (defaults to "Chrome").')
})

export type BrowserShortcutArgs = z.infer<typeof BrowserShortcutSchema>

export const ListChromeProfilesSchema = z.object({})

export type ListChromeProfilesArgs = z.infer<typeof ListChromeProfilesSchema>

export const BrowseGithubSchema = z.object({
  query: z
    .string()
    .describe('GitHub repository name (e.g. "facebook/react"), topic, or search term.'),
  section: z
    .enum(['repo', 'search', 'trending', 'issues', 'pulls'])
    .optional()
    .default('search')
    .describe('Target GitHub view (defaults to "search").')
})

export type BrowseGithubArgs = z.infer<typeof BrowseGithubSchema>

export const BrowserListTabsSchema = z.object({
  port: z.number().optional().default(9222).describe('Chrome remote debugging port (default: 9222).')
})

export type BrowserListTabsArgs = z.infer<typeof BrowserListTabsSchema>

export const BrowserInspectPageSchema = z.object({
  targetIdOrUrl: z
    .string()
    .optional()
    .describe('Optional target tab ID, URL substring, or tab title match. If omitted, inspects active/first tab.'),
  port: z.number().optional().default(9222).describe('Chrome remote debugging port (default: 9222).')
})

export type BrowserInspectPageArgs = z.infer<typeof BrowserInspectPageSchema>

export const BrowserClickElementSchema = z.object({
  selector: z
    .string()
    .describe('CSS selector of the DOM element to click (e.g. "button[type=\'submit\']", "div[aria-label=\'Send\']", "a.profile-link").'),
  targetIdOrUrl: z
    .string()
    .optional()
    .describe('Target tab ID, URL, or title match.'),
  port: z.number().optional().default(9222).describe('Chrome remote debugging port (default: 9222).')
})

export type BrowserClickElementArgs = z.infer<typeof BrowserClickElementSchema>

export const BrowserCloseTabSchema = z.object({
  targetId: z.string().describe('Target tab ID to close (obtained via browser_list_tabs).'),
  port: z.number().optional().default(9222).describe('Chrome remote debugging port (default: 9222).')
})

export type BrowserCloseTabArgs = z.infer<typeof BrowserCloseTabSchema>

export const BrowserScrollSchema = z.object({
  distanceY: z
    .number()
    .describe('Vertical scroll distance in pixels (positive scrolls down, negative scrolls up).'),
  distanceX: z
    .number()
    .optional()
    .default(0)
    .describe('Horizontal scroll distance in pixels.'),
  targetIdOrUrl: z.string().optional().describe('Target tab ID, URL, or title match.'),
  port: z.number().optional().default(9222).describe('Chrome remote debugging port (default: 9222).')
})

export type BrowserScrollArgs = z.infer<typeof BrowserScrollSchema>

export const ManageUserMemorySchema = z.object({
  action: z.enum(['read', 'update']).describe('Whether to read current persistent memory or update it.'),
  updates: z
    .object({
      name: z.string().optional().describe('User name.'),
      preferredChromeProfile: z.string().optional().describe('Preferred Chrome profile directory (e.g. "fennec", "Default").'),
      defaultEmail: z.string().optional().describe('Default email account name or address.'),
      preferredDevCommand: z.string().optional().describe('Preferred dev server start script (e.g. "npm run dev").'),
      defaultDevPort: z.number().optional().describe('Preferred default dev port (e.g. 5173).'),
      noteToAdd: z.string().optional().describe('A persistent preference note to append to USER.md.')
    })
    .optional()
    .describe('Key-value updates to persist when action is "update".')
})

export type ManageUserMemoryArgs = z.infer<typeof ManageUserMemorySchema>

/**
 * Standard OpenAI Function Calling Tool Specification
 */
export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export const JARVIS_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'workspace_list',
      description:
        'Lists files and directories in the user\'s active workspace. Use this to discover folder structure, source files, and project layout.',
      parameters: {
        type: 'object',
        properties: {
          subpath: {
            type: 'string',
            description: 'Relative subpath inside the workspace (e.g. "src/main" or empty string for root).'
          },
          maxDepth: {
            type: 'number',
            description: 'Traversal depth (default: 2).'
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'file_read',
      description:
        'Reads text content from a file inside the active workspace. Output is bounded and returns line numbers.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative file path from workspace root (e.g. "package.json", "README.md").'
          },
          startLine: {
            type: 'number',
            description: 'Starting line number (1-indexed).'
          },
          maxLines: {
            type: 'number',
            description: 'Maximum lines to return (default: 250).'
          }
        },
        required: ['path'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'project_inspect',
      description:
        'Inspects project metadata (package.json manifests, scripts, dependencies, git branch) safely without running code.',
      parameters: {
        type: 'object',
        properties: {
          detail: {
            type: 'string',
            enum: ['summary', 'full'],
            description: 'Detail level (default: "summary").'
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Searches the web for documentation, libraries, guides, or error fixes. Returns titles, links, and snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query.'
          },
          maxResults: {
            type: 'number',
            description: 'Number of results to return (default: 5).'
          }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_pdf',
      description:
        'Generates a formatted, publication-ready PDF document in the output directory. Ideal for summaries, research reports, and documentation with sources.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Document title of the PDF report.'
          },
          content: {
            type: 'string',
            description: 'Markdown or structured text content of the report.'
          },
          filename: {
            type: 'string',
            description: 'Optional destination filename (e.g. "report.pdf").'
          },
          sources: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of cited URLs or references.'
          },
          author: {
            type: 'string',
            description: 'Author or attribution header.'
          }
        },
        required: ['title', 'content'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'file_write_new',
      description:
        'Writes text content to a new file within the approved workspace or output directory. Refuses accidental overwrites unless overwrite is true.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative destination path inside workspace or output (e.g. "output/notes.md").'
          },
          content: {
            type: 'string',
            description: 'Full text content to write.'
          },
          overwrite: {
            type: 'boolean',
            description: 'Set to true only if overwriting an existing file is explicitly intended.'
          }
        },
        required: ['path', 'content'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'download_file',
      description:
        'Downloads a file from a secure HTTP/HTTPS URL directly into the output directory with size limits and validation.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'HTTP or HTTPS download URL.'
          },
          filename: {
            type: 'string',
            description: 'Optional destination filename. If omitted, inferred from URL.'
          }
        },
        required: ['url'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_browser',
      description:
        'Opens Google Chrome (or default system browser) on the user desktop to view a website, URL, or local development server. When the user asks to open Chrome or browse a web page, call this tool.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to navigate to (e.g. "https://google.com", "https://mail.google.com", "http://localhost:3000").'
          },
          browser: {
            type: 'string',
            enum: ['chrome', 'default'],
            description: 'Browser application to use (default: "chrome").'
          },
          profile: {
            type: 'string',
            description: 'Optional Chrome profile directory or account name (e.g. "Default", "Profile 4", "fennec", "abdelfetah").'
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_chrome_profiles',
      description:
        'Discovers and lists all Google Chrome user profiles and email accounts configured on the Windows machine. Use this to check available profiles and ask the user which one they wish to use before launching Chrome or sending emails.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'start_dev_server',
      description:
        'Starts a local development server (e.g. npm run dev, npx vite) in the active workspace. Automatically tracks process PID, streams logs, and detects listening port.',
      parameters: {
        type: 'object',
        properties: {
          script: {
            type: 'string',
            description: 'npm run script name (default: "dev").'
          },
          command: {
            type: 'string',
            description: 'Optional custom command string (e.g. "npm run dev" or "npx vite").'
          },
          preferredPort: {
            type: 'number',
            description: 'Expected port number (e.g. 3000, 5173).'
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'stop_process',
      description:
        'Stops a running dev server or child process by its ID.',
      parameters: {
        type: 'object',
        properties: {
          processId: {
            type: 'string',
            description: 'ID of the process to stop.'
          }
        },
        required: ['processId'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'file_patch',
      description:
        'Applies a controlled patch to an existing file in the workspace by replacing findTarget with replaceContent. Creates an automatic .bak backup.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path to the existing file in the workspace.'
          },
          findTarget: {
            type: 'string',
            description: 'Exact block of text or code to find and replace in the file.'
          },
          replaceContent: {
            type: 'string',
            description: 'New replacement text or code.'
          },
          backup: {
            type: 'boolean',
            description: 'Create an automatic .bak backup file before patching (default: true).'
          }
        },
        required: ['path', 'findTarget', 'replaceContent'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_gmail',
      description:
        'Opens Google Chrome with a pre-filled Gmail compose window and can automatically click Send to dispatch the email. When the user asks to compose or send via browser, call this tool.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient email address (e.g. "team@example.com").'
          },
          subject: {
            type: 'string',
            description: 'Subject line of the email.'
          },
          body: {
            type: 'string',
            description: 'Body content of the email.'
          },
          profile: {
            type: 'string',
            description: 'Optional Chrome profile directory or account name (e.g. "Default", "Profile 4", "fennec", "abdelfetah").'
          },
          autoSend: {
            type: 'boolean',
            description: 'Set to true to automatically press Send (Ctrl+Enter) in Gmail to dispatch the email immediately.'
          },
          closeTabAfter: {
            type: 'boolean',
            description: 'Automatically close the compose tab (Ctrl+W) after dispatching to prevent tab accumulation (default: true).'
          }
        },
        required: ['to', 'subject', 'body'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_email_direct',
      description:
        'Direct, verified SMTP email delivery. Dispatches email directly to mail server via RFC 5321 TLS and awaits server delivery confirmation (250 OK) without opening browser tabs or cluttering desktop.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient email address (e.g. "team@example.com").'
          },
          subject: {
            type: 'string',
            description: 'Subject line of the email.'
          },
          body: {
            type: 'string',
            description: 'Body content of the email.'
          },
          from: {
            type: 'string',
            description: 'Optional sender address (defaults to configured SMTP account).'
          },
          smtpUser: {
            type: 'string',
            description: 'Optional SMTP user/address. Overrides env SMTP_USER / GMAIL_USER.'
          },
          smtpPass: {
            type: 'string',
            description: 'Optional SMTP or Gmail App Password. Overrides env SMTP_PASS / GMAIL_APP_PASS.'
          }
        },
        required: ['to', 'subject', 'body'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_shortcut',
      description:
        'Simulates desktop browser keyboard shortcuts. Use "reopen_tab" to reopen the last closed tab (Ctrl+Shift+T), "send_email" or "click_send" to click Send in Gmail (Ctrl+Enter), "close_tab" for Ctrl+W, "new_tab" for Ctrl+T, "refresh" for Ctrl+R, "next_tab" for Ctrl+Tab, or "focus_address_bar" for Ctrl+L.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'reopen_tab',
              'close_tab',
              'new_tab',
              'refresh',
              'next_tab',
              'prev_tab',
              'focus_address_bar',
              'send_email',
              'click_send',
              'submit',
              'enter'
            ],
            description: 'The shortcut action to execute (e.g. "reopen_tab" for Ctrl+Shift+T, "send_email" for Ctrl+Enter in Gmail).'
          },
          targetApp: {
            type: 'string',
            description: 'Target browser window name (defaults to "Chrome").'
          }
        },
        required: ['action'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browse_github',
      description:
        'Navigates directly to GitHub repositories, searches, trending projects, issues, or PRs in Google Chrome.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'GitHub repository path (e.g. "facebook/react"), user/org, or search query.'
          },
          section: {
            type: 'string',
            enum: ['repo', 'search', 'trending', 'issues', 'pulls'],
            description: 'GitHub section to view (defaults to "search").'
          }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_list_tabs',
      description:
        'Lists all open tabs in Google Chrome via Chrome DevTools Protocol (CDP), returning their titles, URLs, and target IDs.',
      parameters: {
        type: 'object',
        properties: {
          port: {
            type: 'number',
            description: 'Chrome remote debugging port (default: 9222).'
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_inspect_page',
      description:
        'Inspects the real DOM of a webpage via CDP. Extracts headings, readable text content, links, and interactive buttons/inputs for closed-loop verification.',
      parameters: {
        type: 'object',
        properties: {
          targetIdOrUrl: {
            type: 'string',
            description: 'Optional tab ID, URL, or title substring to inspect. If omitted, inspects active tab.'
          },
          port: {
            type: 'number',
            description: 'Chrome remote debugging port (default: 9222).'
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_click_element',
      description:
        'Clicks an element on a webpage matching a CSS selector (e.g. "button[type=\'submit\']", "div[aria-label=\'Send\']", "a.profile") via CDP DOM automation with instant verification.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector of the element to click.'
          },
          targetIdOrUrl: {
            type: 'string',
            description: 'Optional tab ID, URL, or title substring.'
          },
          port: {
            type: 'number',
            description: 'Chrome remote debugging port (default: 9222).'
          }
        },
        required: ['selector'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_close_tab',
      description:
        'Deterministically closes a specific Chrome tab by its target ID via CDP, preventing tab clutter and zombie tabs.',
      parameters: {
        type: 'object',
        properties: {
          targetId: {
            type: 'string',
            description: 'Target tab ID to close.'
          },
          port: {
            type: 'number',
            description: 'Chrome remote debugging port (default: 9222).'
          }
        },
        required: ['targetId'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_scroll',
      description:
        'Scrolls the active or specified webpage vertically or horizontally (e.g. distanceY: 500 to scroll down).',
      parameters: {
        type: 'object',
        properties: {
          distanceY: {
            type: 'number',
            description: 'Vertical scroll distance in pixels (positive down, negative up).'
          },
          distanceX: {
            type: 'number',
            description: 'Horizontal scroll distance in pixels.'
          },
          targetIdOrUrl: {
            type: 'string',
            description: 'Optional tab ID, URL, or title substring.'
          },
          port: {
            type: 'number',
            description: 'Chrome remote debugging port (default: 9222).'
          }
        },
        required: ['distanceY'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'manage_user_memory',
      description:
        'Reads or updates persistent user preferences and memory notes in USER.md (e.g. remember preferred Chrome profile, dev command/port, or custom user instructions).',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['read', 'update'],
            description: 'Whether to read current memory or update it.'
          },
          updates: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'User name.' },
              preferredChromeProfile: { type: 'string', description: 'Preferred Chrome profile directory (e.g. "fennec").' },
              defaultEmail: { type: 'string', description: 'Default email account.' },
              preferredDevCommand: { type: 'string', description: 'Preferred dev command.' },
              defaultDevPort: { type: 'number', description: 'Preferred dev port.' },
              noteToAdd: { type: 'string', description: 'New persistent note/directive to append.' }
            },
            description: 'Updates to persist into USER.md.'
          }
        },
        required: ['action'],
        additionalProperties: false
      }
    }
  }
]
