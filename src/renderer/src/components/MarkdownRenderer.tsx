import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy } from 'lucide-react'

interface CodeBlockProps {
  language?: string
  value: string
}

function CodeBlock({ language, value }: CodeBlockProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch (error) {
      console.error('Failed to copy code:', error)
    }
  }

  return (
    <div className="code-block my-3 overflow-hidden rounded-lg border border-jarvis-border bg-jarvis-code">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-jarvis-codeInk/55">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] text-jarvis-codeInk/60 transition hover:bg-white/10 hover:text-jarvis-codeInk"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-jarvis-accentGlow" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto p-3.5 font-mono text-[11.5px] leading-relaxed text-jarvis-codeInk">
        <code>{value}</code>
      </pre>
    </div>
  )
}

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps): React.JSX.Element {
  return (
    <div className="max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const textContent = String(children).replace(/\n$/, '')
            const isInline = !match && !textContent.includes('\n')

            if (isInline) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            }

            return <CodeBlock language={match ? match[1] : ''} value={textContent} />
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                onClick={(event) => {
                  event.preventDefault()
                  if (!href) return
                  const isFile =
                    href.startsWith('file://') ||
                    href.endsWith('.pdf') ||
                    href.includes('/output/') ||
                    href.includes('\\output\\')
                  const isWeb = href.startsWith('http://') || href.startsWith('https://')

                  if (isFile && window.jarvisAPI?.openPath) {
                    const cleanPath = href.replace(/^file:\/\/\/?/, '')
                    window.jarvisAPI.openPath(cleanPath)
                  } else if (isWeb && window.jarvisAPI?.openExternalUrl) {
                    window.jarvisAPI.openExternalUrl(href)
                  }
                }}
                title={href?.endsWith('.pdf') ? 'Open PDF' : 'Open link'}
              >
                {children}
              </a>
            )
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto">
                <table>{children}</table>
              </div>
            )
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
