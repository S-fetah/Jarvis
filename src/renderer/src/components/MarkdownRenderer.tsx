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
    <div className="my-3 rounded-lg overflow-hidden border border-[#30363d] bg-[#0d1117] text-slate-200">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] text-xs font-mono text-slate-400">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 hover:text-slate-200 transition px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d]"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed text-slate-100">
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
    <div className="prose prose-invert max-w-none text-sm text-slate-200 leading-relaxed space-y-2">
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
                  className="bg-[#21262d] text-blue-300 font-mono text-[12px] px-1.5 py-0.5 rounded border border-[#30363d]"
                  {...props}
                >
                  {children}
                </code>
              )
            }

            return <CodeBlock language={match ? match[1] : ''} value={textContent} />
          },
          p({ children }) {
            return <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>
          },
          li({ children }) {
            return <li className="text-slate-300 text-sm leading-relaxed">{children}</li>
          },
          h1({ children }) {
            return <h1 className="text-lg font-bold text-white mt-4 mb-2 pb-1 border-b border-[#30363d]">{children}</h1>
          },
          h2({ children }) {
            return <h2 className="text-base font-semibold text-slate-100 mt-3 mb-1.5">{children}</h2>
          },
          h3({ children }) {
            return <h3 className="text-sm font-semibold text-slate-200 mt-2.5 mb-1">{children}</h3>
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-blue-500 pl-3 py-1 my-2 text-slate-400 italic bg-[#161b22]/50 rounded-r">
                {children}
              </blockquote>
            )
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className="min-w-full divide-y divide-[#30363d] border border-[#30363d] text-xs">
                  {children}
                </table>
              </div>
            )
          },
          th({ children }) {
            return <th className="px-3 py-2 bg-[#161b22] text-left font-semibold text-slate-200">{children}</th>
          },
          td({ children }) {
            return <td className="px-3 py-1.5 border-t border-[#21262d] text-slate-300">{children}</td>
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
