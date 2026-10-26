import React, { useState, useEffect } from 'react'
import { AlertTriangle, Clock, Zap, Key, RefreshCw, ExternalLink } from 'lucide-react'

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
    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [secondsLeft])

  const handleOpenDashboard = async (): Promise<void> => {
    if (window.jarvisAPI) {
      await window.jarvisAPI.openFreeLLMDashboard()
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-50/70 dark:bg-gradient-to-br dark:from-jarvis-elevated dark:to-jarvis-base p-4 text-xs shadow-md space-y-3.5">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2.5 text-amber-700 dark:text-amber-400">
          <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-amber-950 dark:text-amber-200">
              Provider Rate Limit Hit ({model})
            </h4>
            <p className="text-[11px] text-amber-700 dark:text-amber-400/80">
              Free-tier model quota exhausted for current key
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 font-mono text-[11px]">
          <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Reset in ~{secondsLeft}s</span>
        </div>
      </div>

      <div className="text-[11px] text-jarvis-sage leading-relaxed bg-jarvis-surface dark:bg-jarvis-base/80 p-3 rounded-lg border border-jarvis-border">
        <p>
          Your active Google AI Studio key has hit its temporary request limit. In FreeLLMAPI, you can add{' '}
          <strong className="text-amber-800 dark:text-amber-300 font-semibold">multiple free keys</strong> or add{' '}
          <strong className="text-amber-800 dark:text-amber-300 font-semibold">Groq / OpenRouter</strong>. FreeLLMAPI will automatically rotate across them so you never get rate limited!
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={onSwitchLightMode}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs shadow-md transition"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Switch to Flash-Lite</span>
        </button>

        <button
          onClick={onOpenHub}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-jarvis-accent/20 hover:bg-jarvis-accent/30 border border-jarvis-accent/50 text-jarvis-accentGlow font-medium text-xs transition"
        >
          <Key className="w-3.5 h-3.5" />
          <span>Get More Free Keys</span>
        </button>

        <button
          onClick={handleOpenDashboard}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-jarvis-surface hover:bg-jarvis-hover border border-jarvis-border text-jarvis-sage text-xs transition"
          title="Open FreeLLMAPI dashboard to paste keys"
        >
          <ExternalLink className="w-3.5 h-3.5 text-jarvis-muted" />
          <span>Open FreeLLMAPI UI</span>
        </button>

        {secondsLeft === 0 && (
          <button
            onClick={onRetry}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-jarvis-accent hover:bg-jarvis-accentHover text-jarvis-base font-bold text-xs transition ml-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Now</span>
          </button>
        )}
      </div>
    </div>
  )
}
