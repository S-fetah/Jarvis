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
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-jarvis-border bg-jarvis-surface text-jarvis-sage shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-jarvis-elevated border-b border-jarvis-border text-xs font-mono text-jarvis-muted">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 text-jarvis-muted hover:text-jarvis-ivory transition px-2 py-0.5 rounded bg-jarvis-surface hover:bg-jarvis-hover border border-jarvis-border"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-jarvis-accent" />
              <span className="text-[11px] text-jarvis-accent">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-jarvis-muted" />
              <span className="text-[11px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed text-jarvis-ivory bg-jarvis-base/50">
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
    <div className="max-w-none text-xs text-jarvis-sage leading-relaxed space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const textContent = String(children).replace(/\n$/, '')
            const isInline = !match && !textContent.includes('\n')

            if (isInline) {
              return (
                <code
                  className="bg-jarvis-elevated text-jarvis-accent font-mono text-[11px] px-1.5 py-0.5 rounded border border-jarvis-border"
                  {...props}
                >
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
                onClick={(e) => {
                  e.preventDefault()
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
                className="text-[#3ba172] hover:text-[#52c48e] underline underline-offset-2 transition font-medium cursor-pointer"
                title={href?.endsWith('.pdf') ? 'Click to open PDF' : 'Click to open'}
              >
                {children}
              </a>
            )
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0 leading-relaxed text-[#d1d7d0]">{children}</p>
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 my-2 space-y-1 text-[#d1d7d0]">{children}</ul>
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 my-2 space-y-1 text-[#d1d7d0]">{children}</ol>
          },
          li({ children }) {
            return <li className="text-[#d1d7d0] text-xs leading-relaxed">{children}</li>
          },
          h1({ children }) {
            return <h1 className="text-base font-bold text-[#f5f1ee] mt-3 mb-2 pb-1 border-b border-[#1f3832]">{children}</h1>
          },
          h2({ children }) {
            return <h2 className="text-sm font-semibold text-[#f5f1ee] mt-2.5 mb-1.5">{children}</h2>
          },
          h3({ children }) {
            return <h3 className="text-xs font-semibold text-[#f5f1ee] mt-2 mb-1">{children}</h3>
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-[#3ba172] pl-3 py-1 my-2 text-[#8a9992] italic bg-[#111f1e]/60 rounded-r">
                {children}
              </blockquote>
            )
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2.5">
                <table className="min-w-full divide-y divide-[#1f3832] border border-[#1f3832] text-xs">
                  {children}
                </table>
              </div>
            )
          },
          th({ children }) {
            return <th className="px-3 py-1.5 bg-[#111f1e] text-left font-semibold text-[#f5f1ee]">{children}</th>
          },
          td({ children }) {
            return <td className="px-3 py-1 border-t border-[#1f3832] text-[#d1d7d0]">{children}</td>
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
