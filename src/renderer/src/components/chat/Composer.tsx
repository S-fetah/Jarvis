import React, { useEffect, useRef, useState } from 'react'
import {
  AtSign,
  CornerDownLeft,
  FileCode,
  FolderTree,
  Globe,
  Radio,
  Send,
  Zap
} from 'lucide-react'
import type { TalkingStyle, TaskMode, ThinkingDepth } from '../../../../shared/types'
import { cn } from '../../lib/cn'
import { Button, Kbd } from '../ui'
import { PromptControlsBar } from '../PromptControlsBar'

interface ComposerProps {
  initialPrompt?: string
  onSubmit: (prompt: string) => void
  isStreaming: boolean
  lightMode: boolean
  model: string
  talkingStyle: TalkingStyle
  taskMode: TaskMode
  thinkingDepth: ThinkingDepth
  chatWidthMode?: 'adaptive' | 'compact'
  isCanvasOpen?: boolean
  workspacePath?: string
  onStyleChange: (style: TalkingStyle) => void
  onModeChange: (mode: TaskMode) => void
  onDepthChange: (depth: ThinkingDepth) => void
  onToggleLightMode: () => void
}

interface MentionOption {
  id: string
  label: string
  description: string
  icon: typeof AtSign
  value: string
}

export const Composer = React.memo(function Composer({
  initialPrompt = '',
  onSubmit,
  isStreaming,
  lightMode,
  model,
  talkingStyle,
  taskMode,
  thinkingDepth,
  chatWidthMode = 'adaptive',
  isCanvasOpen = false,
  workspacePath,
  onStyleChange,
  onModeChange,
  onDepthChange,
  onToggleLightMode
}: ComposerProps): React.JSX.Element {
  const [inputPrompt, setInputPrompt] = useState(initialPrompt)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (initialPrompt) {
      setInputPrompt(initialPrompt)
    }
  }, [initialPrompt])

  // Load workspace files for @ mentions
  useEffect(() => {
    if (window.jarvisAPI?.listWorkspaceFiles) {
      window.jarvisAPI.listWorkspaceFiles(workspacePath).then((files) => {
        if (Array.isArray(files)) setWorkspaceFiles(files)
      })
    }
  }, [workspacePath])

  const canSend = Boolean(inputPrompt.trim()) && !isStreaming

  // Calculate @ mention options
  const baseOptions: MentionOption[] = [
    {
      id: 'workspace',
      label: '@workspace',
      description: 'Entire current workspace code & structure',
      icon: FolderTree,
      value: '@workspace '
    },
    {
      id: 'web',
      label: '@web',
      description: 'Search web for live external documentation',
      icon: Globe,
      value: '@web '
    },
    {
      id: 'localhost',
      label: '@localhost',
      description: 'Active dev server and web inspection',
      icon: Radio,
      value: '@localhost '
    }
  ]

  const fileOptions: MentionOption[] = workspaceFiles
    .filter((f) => !mentionQuery || f.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 8)
    .map((filePath) => ({
      id: filePath,
      label: `@${filePath}`,
      description: filePath,
      icon: FileCode,
      value: `@${filePath} `
    }))

  const allMentions = [...baseOptions, ...fileOptions].filter(
    (opt) => !mentionQuery || opt.label.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  const handleApplyMention = (mention: MentionOption): void => {
    const lastAtIndex = inputPrompt.lastIndexOf('@')
    if (lastAtIndex !== -1) {
      const beforeAt = inputPrompt.substring(0, lastAtIndex)
      const afterPrompt = beforeAt + mention.value
      setInputPrompt(afterPrompt)
    } else {
      setInputPrompt((prev) => prev + ' ' + mention.value)
    }
    setShowMentions(false)
    textareaRef.current?.focus()
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const value = event.target.value
    setInputPrompt(value)

    // Check for active @ mention trigger
    const cursor = event.target.selectionStart || value.length
    const textBeforeCursor = value.substring(0, cursor)
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_./-]*)$/)

    if (match) {
      setShowMentions(true)
      setMentionQuery(match[1])
      setSelectedMentionIndex(0)
    } else {
      setShowMentions(false)
    }
  }

  const handleSubmit = (event?: React.FormEvent): void => {
    event?.preventDefault()
    const trimmed = inputPrompt.trim()
    if (!trimmed || isStreaming) return
    onSubmit(trimmed)
    setInputPrompt('')
    setShowMentions(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (showMentions && allMentions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedMentionIndex((prev) => (prev + 1) % allMentions.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedMentionIndex((prev) => (prev - 1 + allMentions.length) % allMentions.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        handleApplyMention(allMentions[selectedMentionIndex])
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setShowMentions(false)
        return
      }
    }

    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    if (canSend) {
      handleSubmit()
    }
  }

  const containerMaxWidth =
    chatWidthMode === 'adaptive'
      ? isCanvasOpen
        ? 'max-w-full'
        : 'max-w-[1100px]'
      : 'max-w-[800px]'

  return (
    <div className="shrink-0 border-t border-jarvis-border bg-jarvis-base/92 px-5 pb-3 pt-2.5 backdrop-blur">
      <div className={cn('relative mx-auto w-full transition-all duration-200', containerMaxWidth)}>
        {/* @ Mention Popover Dropdown */}
        {showMentions && allMentions.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 max-h-56 w-80 overflow-y-auto rounded-xl border border-jarvis-borderStrong bg-jarvis-surface p-1 shadow-2xl backdrop-blur-md">
            <div className="px-2.5 py-1 text-3xs font-semibold uppercase tracking-wider text-jarvis-muted">
              Context Mentions
            </div>
            {allMentions.map((opt, idx) => {
              const Icon = opt.icon
              const isSelected = idx === selectedMentionIndex
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleApplyMention(opt)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition',
                    isSelected
                      ? 'bg-jarvis-accent text-jarvis-accentContrast'
                      : 'text-jarvis-ivory hover:bg-jarvis-elevated'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[11.5px] font-medium">{opt.label}</div>
                    <div
                      className={cn(
                        'truncate text-3xs',
                        isSelected ? 'text-jarvis-accentContrast/80' : 'text-jarvis-muted'
                      )}
                    >
                      {opt.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={cn(
            'overflow-hidden rounded-xl border border-jarvis-border bg-jarvis-surface shadow-raised transition-[border-color,box-shadow] duration-200',
            'focus-within:border-jarvis-accent/55 focus-within:ring-1 focus-within:ring-jarvis-accent/20'
          )}
        >
          <div className="px-2.5 pt-2">
            <PromptControlsBar
              talkingStyle={talkingStyle}
              taskMode={taskMode}
              thinkingDepth={thinkingDepth}
              onStyleChange={onStyleChange}
              onModeChange={onModeChange}
              onDepthChange={onDepthChange}
              compact
            />
          </div>

          <textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={isStreaming}
            autoFocus
            placeholder={
              isStreaming
                ? 'Jarvis is working through the request…'
                : lightMode
                  ? 'Ask Jarvis — fast light mode is active… (type @ to mention files)'
                  : 'Ask Jarvis or describe an instruction… (type @ to mention files/context)'
            }
            aria-label="Message Jarvis"
            className="max-h-40 min-h-[52px] w-full resize-none bg-transparent px-3.5 py-2 text-[13.5px] leading-relaxed text-jarvis-ivory placeholder:text-jarvis-muted/80 focus:outline-none disabled:opacity-60"
          />

          <div className="flex items-center justify-between gap-3 border-t border-jarvis-border/70 px-2.5 py-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleLightMode}
                aria-pressed={lightMode}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[10.5px] font-medium transition',
                  lightMode
                    ? 'border-jarvis-signal/35 bg-jarvis-signalSoft text-jarvis-signal'
                    : 'border-jarvis-border bg-jarvis-base text-jarvis-muted hover:border-jarvis-borderStrong hover:text-jarvis-sage'
                )}
                title={lightMode ? 'Disable fast light mode' : 'Switch to the fast flash-lite model'}
              >
                <Zap className={cn('h-3 w-3', lightMode && 'fill-current')} />
                Fast mode
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputPrompt((prev) => prev + (prev.endsWith(' ') || !prev ? '@' : ' @'))
                  setShowMentions(true)
                  textareaRef.current?.focus()
                }}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-jarvis-border bg-jarvis-base px-2 text-[10.5px] font-mono text-jarvis-muted transition hover:border-jarvis-borderStrong hover:text-jarvis-ivory"
                title="Mention files or context"
              >
                <AtSign className="h-3 w-3 text-jarvis-accent" />
                <span>Context</span>
              </button>

              <span className="hidden truncate font-mono text-[10px] text-jarvis-muted/75 sm:inline">
                {lightMode ? 'gemini-flash-lite' : model}
              </span>
              {inputPrompt.length > 0 && (
                <span className="ml-1 font-mono text-3xs text-jarvis-muted/60">
                  {inputPrompt.length}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2.5">
              <span className="hidden items-center gap-1.5 text-3xs text-jarvis-muted md:flex">
                <Kbd>
                  <CornerDownLeft className="h-2.5 w-2.5" />
                </Kbd>
                send
              </span>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!canSend}
                className="min-w-[84px] gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {isStreaming ? 'Working' : 'Send'}
              </Button>
            </div>
          </div>
        </form>

        <div className="mt-1.5 flex items-center justify-between px-1 text-3xs text-jarvis-muted/70">
          <span>Shift + Enter for a new line • Type @ to mention files</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-jarvis-accent/70" />
            ADR-004 gated actions
          </span>
        </div>
      </div>
    </div>
  )
})
