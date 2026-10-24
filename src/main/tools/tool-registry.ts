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
  }
]
