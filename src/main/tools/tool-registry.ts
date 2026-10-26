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
    .describe('Target browser. Defaults to "chrome" with fallback to system default.')
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
          }
        },
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
  }
]
