import React, { useEffect, useState } from 'react'
import { AlertTriangle, Clock, ExternalLink, KeyRound, RefreshCw, Zap } from 'lucide-react'
import { Badge, Button } from './ui'

interface RateLimitCardProps {
  initialSeconds?: number
  model?: string
  onSwitchLightMode: () => void
  onOpenHub: () => void
  onRetry: () => void
}

export function RateLimitCard({
  initialSeconds = 75,
  model = 'gemini-3.6-flash',
  onSwitchLightMode,
  onOpenHub,
  onRetry
}: RateLimitCardProps): React.JSX.Element {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [secondsLeft])

  return (
    <div className="rounded-lg border border-jarvis-signal/30 bg-jarvis-signalSoft/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-jarvis-signal/25 bg-jarvis-surface text-jarvis-signal">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h4 className="text-[12.5px] font-semibold text-jarvis-ivory">
              Provider rate limit reached
            </h4>
            <p className="mt-0.5 font-mono text-[10px] text-jarvis-muted">{model}</p>
          </div>
        </div>
        <Badge variant="signal" mono className="shrink-0 gap-1">
          <Clock className="h-3 w-3" />
          {secondsLeft > 0 ? `~${secondsLeft}s` : 'ready'}
        </Badge>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-jarvis-sage">
        The free-tier quota for this key is exhausted. Add{' '}
        <strong className="font-semibold text-jarvis-ivory">multiple free keys</strong> or a{' '}
        <strong className="font-semibold text-jarvis-ivory">Groq / OpenRouter</strong> key in FreeLLMAPI
        and it will rotate requests automatically.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button variant="signal" size="sm" onClick={onSwitchLightMode} className="gap-1.5">
          <Zap className="h-3.5 w-3.5" />
          Switch to flash-lite
        </Button>
        <Button variant="secondary" size="sm" onClick={onOpenHub} className="gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-jarvis-accent" />
          Get more keys
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void window.jarvisAPI?.openFreeLLMDashboard()}
          className="gap-1.5"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          FreeLLMAPI UI
        </Button>
        {secondsLeft === 0 && (
          <Button variant="primary" size="sm" onClick={onRetry} className="ml-auto gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry now
          </Button>
        )}
      </div>
    </div>
  )
}
