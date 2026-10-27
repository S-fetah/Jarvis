import React, { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Cpu, Search, Sparkles, Zap } from 'lucide-react'
import type { ModelCatalog } from '../../../shared/types'
import { cn } from '../lib/cn'

interface ModelSelectorProps {
  currentModel: string
  isLightMode: boolean
  catalog: ModelCatalog
  onSelectModel: (model: string) => void
  onToggleLightMode: (enabled: boolean) => void
}

export function ModelSelector({
  currentModel,
  isLightMode,
  catalog,
  onSelectModel,
  onToggleLightMode
}: ModelSelectorProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const activeModel = isLightMode ? 'gemini-flash-lite' : currentModel
  const filtered = catalog.all.filter((model) =>
    model.toLowerCase().includes(query.trim().toLowerCase())
  )

  const isFast = (model: string): boolean =>
    catalog.light.includes(model) ||
    model.includes('lite') ||
    model.includes('flash') ||
    model.includes('mini') ||
    model.includes('haiku')

  const chooseModel = (model: string): void => {
    onSelectModel(model)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Choose the active model"
          className={cn(
            'inline-flex h-8 max-w-[210px] items-center gap-2 rounded-md border border-jarvis-border bg-jarvis-elevated px-2.5',
            'text-[11px] text-jarvis-sage shadow-hairline transition hover:border-jarvis-borderStrong hover:text-jarvis-ivory',
            'data-[state=open]:border-jarvis-accent/45 data-[state=open]:text-jarvis-ivory',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jarvis-accent'
          )}
        >
          {isLightMode ? (
            <Zap className="h-3.5 w-3.5 shrink-0 fill-jarvis-signal text-jarvis-signal" />
          ) : (
            <Cpu className="h-3.5 w-3.5 shrink-0 text-jarvis-accent" />
          )}
          <span className="truncate font-mono text-[10.5px]">{activeModel}</span>
          {isLightMode && (
            <span className="rounded-full border border-jarvis-signal/30 bg-jarvis-signalSoft px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-wide text-jarvis-signal">
              fast
            </span>
          )}
          <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-60" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={7}
          collisionPadding={12}
          className="z-[70] w-[330px] animate-scale-in overflow-hidden rounded-lg border border-jarvis-borderStrong bg-jarvis-surface shadow-floating focus:outline-none"
        >
          <div className="border-b border-jarvis-border p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-jarvis-muted" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the model catalog…"
                aria-label="Search models"
                className="h-8 w-full rounded-md border border-jarvis-border bg-jarvis-base pl-8 pr-3 text-[11.5px] text-jarvis-ivory placeholder:text-jarvis-muted/75 focus:border-jarvis-accent focus:outline-none"
                autoFocus
              />
            </div>

            <button
              type="button"
              onClick={() => onToggleLightMode(!isLightMode)}
              aria-pressed={isLightMode}
              className={cn(
                'mt-2 flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition',
                isLightMode
                  ? 'border-jarvis-signal/35 bg-jarvis-signalSoft'
                  : 'border-jarvis-border bg-jarvis-base hover:border-jarvis-borderStrong hover:bg-jarvis-elevated'
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                  isLightMode
                    ? 'border-jarvis-signal/30 bg-jarvis-signal text-jarvis-signalContrast'
                    : 'border-jarvis-border bg-jarvis-surface text-jarvis-muted'
                )}
              >
                <Zap className={cn('h-3.5 w-3.5', isLightMode && 'fill-current')} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-semibold text-jarvis-ivory">Fast mode</span>
                <span className="mt-0.5 block text-[10px] leading-snug text-jarvis-muted">
                  Route to flash-lite for lower latency.
                </span>
              </span>
              <span
                className={cn(
                  'relative h-4 w-7 shrink-0 rounded-full border transition',
                  isLightMode
                    ? 'border-jarvis-signal/40 bg-jarvis-signal/80'
                    : 'border-jarvis-borderStrong bg-jarvis-hover'
                )}
                aria-hidden="true"
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-2.5 w-2.5 rounded-full bg-jarvis-surface shadow-sm transition-all',
                    isLightMode ? 'left-3.5' : 'left-0.5'
                  )}
                />
              </span>
            </button>
          </div>

          <div className="max-h-[310px] overflow-y-auto p-1.5">
            {!query && catalog.light.length > 0 && (
              <div className="mb-1.5">
                <div className="flex items-center gap-1.5 px-2 py-1 text-3xs font-semibold uppercase tracking-[0.15em] text-jarvis-signal">
                  <Zap className="h-2.5 w-2.5" />
                  Low latency
                </div>
                {catalog.light.slice(0, 5).map((model) => (
                  <ModelRow
                    key={model}
                    model={model}
                    selected={!isLightMode && currentModel === model}
                    onSelect={chooseModel}
                  />
                ))}
              </div>
            )}

            <div>
              <div className="flex items-center gap-1.5 px-2 py-1 text-3xs font-semibold uppercase tracking-[0.15em] text-jarvis-muted">
                <Sparkles className="h-2.5 w-2.5" />
                {query ? `Matches (${filtered.length})` : 'All models'}
              </div>
              {filtered.length === 0 ? (
                <p className="px-2 py-6 text-center text-[11px] text-jarvis-muted">No models found.</p>
              ) : (
                filtered.slice(0, 40).map((model) => (
                  <ModelRow
                    key={model}
                    model={model}
                    selected={!isLightMode && currentModel === model}
                    onSelect={chooseModel}
                    fast={isFast(model)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-jarvis-border bg-jarvis-base px-2.5 py-1.5 text-3xs text-jarvis-muted">
            <span>{catalog.all.length} models available</span>
            <span className="font-mono">FreeLLMAPI</span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function ModelRow({
  model,
  selected,
  onSelect,
  fast = false
}: {
  model: string
  selected: boolean
  onSelect: (model: string) => void
  fast?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(model)}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition',
        selected ? 'bg-jarvis-accentSoft' : 'hover:bg-jarvis-hover'
      )}
    >
      <span
        className={cn(
          'min-w-0 flex-1 truncate font-mono text-[10.5px]',
          selected ? 'text-jarvis-ivory' : 'text-jarvis-sage'
        )}
      >
        {model}
      </span>
      {fast && (
        <span className="shrink-0 rounded border border-jarvis-signal/25 bg-jarvis-signalSoft px-1 py-0.5 font-mono text-[8px] uppercase tracking-wide text-jarvis-signal">
          fast
        </span>
      )}
      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-jarvis-accent" />}
    </button>
  )
}
