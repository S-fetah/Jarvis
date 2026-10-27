import React from 'react'
import { CornerDownLeft, Send, Zap } from 'lucide-react'
import type { TalkingStyle, TaskMode, ThinkingDepth } from '../../../../shared/types'
import { cn } from '../../lib/cn'
import { Button, Kbd } from '../ui'
import { PromptControlsBar } from '../PromptControlsBar'

interface ComposerProps {
  inputPrompt: string
  onInputChange: (value: string) => void
  onSubmit: (event?: React.FormEvent) => void
  isStreaming: boolean
  lightMode: boolean
  model: string
  talkingStyle: TalkingStyle
  taskMode: TaskMode
  thinkingDepth: ThinkingDepth
  onStyleChange: (style: TalkingStyle) => void
  onModeChange: (mode: TaskMode) => void
  onDepthChange: (depth: ThinkingDepth) => void
  onToggleLightMode: () => void
}

export function Composer({
  inputPrompt,
  onInputChange,
  onSubmit,
  isStreaming,
  lightMode,
  model,
  talkingStyle,
  taskMode,
  thinkingDepth,
  onStyleChange,
  onModeChange,
  onDepthChange,
  onToggleLightMode
}: ComposerProps): React.JSX.Element {
  const canSend = Boolean(inputPrompt.trim()) && !isStreaming

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    if (canSend) event.currentTarget.form?.requestSubmit()
  }

  return (
    <div className="shrink-0 border-t border-jarvis-border bg-jarvis-base/92 px-5 pb-3 pt-2.5 backdrop-blur">
      <div className="mx-auto w-full max-w-[860px]">
        <form
          onSubmit={onSubmit}
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
            value={inputPrompt}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={isStreaming}
            autoFocus
            placeholder={
              isStreaming
                ? 'Jarvis is working through the request…'
                : lightMode
                  ? 'Ask Jarvis — fast light mode is active…'
                  : 'Ask Jarvis or describe an instruction…'
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
          <span>Shift + Enter for a new line</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-jarvis-accent/70" />
            ADR-004 gated actions
          </span>
        </div>
      </div>
    </div>
  )
}
