import React, { useState } from 'react'
import { ExternalLink, Layers, RotateCcw, Sparkles } from 'lucide-react'
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogTitle } from './ui'

interface FreeProvider {
  id: string
  name: string
  models: string[]
  speed: string
  limits: string
  description: string
  getKeyUrl: string
}

interface FreeModelsHubModalProps {
  isOpen: boolean
  onClose: () => void
  onRefreshCatalog: () => Promise<void>
}

const FREE_PROVIDERS: FreeProvider[] = [
  {
    id: 'google',
    name: 'Google AI Studio (Gemini)',
    models: ['gemini-3.6-flash', 'gemini-flash-lite', 'gemini-2.5-flash', 'gemini-3.5-flash-lite'],
    speed: '~1.5s latency',
    limits: '15 RPM / 1M TPM (Free Tier)',
    description:
      'Google provides completely free API keys with access to flagship Gemini models. Add two or three keys in FreeLLMAPI to rotate across them and eliminate rate limits.',
    getKeyUrl: 'https://aistudio.google.com/app/apikey'
  },
  {
    id: 'groq',
    name: 'Groq Cloud (Ultra-Fast)',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma-2-9b-it'],
    speed: '500–1000 tokens/sec',
    limits: '30 RPM / 14.4k RPD (100% Free)',
    description:
      'World-record inference speed running open-weights Llama 3.3 and Mixtral models. Ideal for instant coding and real-time reasoning.',
    getKeyUrl: 'https://console.groq.com/keys'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (Free Models Tier)',
    models: [
      'meta-llama/llama-3.3-70b-instruct:free',
      'deepseek/deepseek-chat:free',
      'qwen/qwen-2.5-72b-instruct:free'
    ],
    speed: '~2s latency',
    limits: 'Free models have :free suffix',
    description:
      'Aggregator offering top open models for free. Generate a key without a credit card and access DeepSeek V3 and Llama 3.3.',
    getKeyUrl: 'https://openrouter.ai/keys'
  },
  {
    id: 'github',
    name: 'GitHub Models / Azure AI',
    models: ['gpt-4o', 'gpt-4o-mini', 'phi-3-medium'],
    speed: '~2s latency',
    limits: 'Included with GitHub Account',
    description:
      'GitHub provides free access to GPT-4o, GPT-4o-mini, and Mistral via personal access tokens for developers.',
    getKeyUrl: 'https://github.com/settings/tokens'
  },
  {
    id: 'mistral',
    name: 'Mistral AI (La Plateforme)',
    models: ['mistral-small-latest', 'codestral-latest', 'open-mistral-nemo'],
    speed: '~2s latency',
    limits: 'Free tier trial',
    description:
      'European AI leader providing frontier coding models like Codestral and Mistral Small with free developer tiers.',
    getKeyUrl: 'https://console.mistral.ai/api-keys'
  },
  {
    id: 'ollama',
    name: 'Local Ollama (Offline & Unlimited)',
    models: ['deepseek-r1:8b', 'qwen2.5-coder:7b', 'llama3.2:3b'],
    speed: 'Local GPU / CPU',
    limits: '100% unlimited & private',
    description:
      'Run models entirely on your own Windows computer with zero rate limits, zero internet dependency, and total privacy.',
    getKeyUrl: 'https://ollama.com'
  }
]

export function FreeModelsHubModal({
  isOpen,
  onClose,
  onRefreshCatalog
}: FreeModelsHubModalProps): React.JSX.Element | null {
  const [refreshing, setRefreshing] = useState(false)

  if (!isOpen) return null

  const handleOpenLink = async (url: string): Promise<void> => {
    await window.jarvisAPI?.openExternalUrl(url)
  }

  const handleOpenFreeLLM = async (): Promise<void> => {
    await window.jarvisAPI?.openFreeLLMDashboard()
  }

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await onRefreshCatalog()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl" className="max-h-[88vh]">
        <div className="flex items-start gap-3 border-b border-jarvis-border px-5 py-4 pr-12">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-jarvis-accent/20 bg-jarvis-accentSoft text-jarvis-accent">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>Free model providers</DialogTitle>
              <Badge variant="accent">Zero-cost AI</Badge>
            </div>
            <DialogDescription>
              Get free API keys and add them to FreeLLMAPI. Multiple keys rotate automatically to keep
              requests flowing.
            </DialogDescription>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-jarvis-border bg-jarvis-base px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-jarvis-accent" />
            <p className="text-[11px] leading-relaxed text-jarvis-sage">
              <strong className="font-semibold text-jarvis-ivory">Key rotation tip:</strong> add two or
              three Gemini keys to FreeLLMAPI. It spreads requests across them so one exhausted quota
              doesn't stop the session.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={handleOpenFreeLLM} className="shrink-0 gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Open FreeLLMAPI
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-2.5 md:grid-cols-2">
            {FREE_PROVIDERS.map((provider) => (
              <article
                key={provider.id}
                className="flex flex-col rounded-lg border border-jarvis-border bg-jarvis-elevated p-3.5 transition hover:border-jarvis-borderStrong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[12.5px] font-semibold leading-snug text-jarvis-ivory">
                      {provider.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="accent" mono>
                        {provider.speed}
                      </Badge>
                      <span className="font-mono text-[9px] text-jarvis-muted">{provider.limits}</span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenLink(provider.getKeyUrl)}
                    className="shrink-0 gap-1 px-2 text-[10px]"
                  >
                    Get key
                    <ExternalLink className="h-2.5 w-2.5" />
                  </Button>
                </div>

                <p className="mt-2.5 text-[10.5px] leading-relaxed text-jarvis-muted">
                  {provider.description}
                </p>

                <div className="mt-2.5 flex flex-wrap gap-1">
                  {provider.models.map((model) => (
                    <span
                      key={model}
                      className="rounded border border-jarvis-border bg-jarvis-base px-1.5 py-0.5 font-mono text-[9px] text-jarvis-sage"
                    >
                      {model}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-jarvis-border bg-jarvis-base px-5 py-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-[11px] text-jarvis-muted transition hover:text-jarvis-ivory disabled:opacity-50"
          >
            <RotateCcw className={refreshing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            {refreshing ? 'Reloading catalog…' : 'Reload model catalog'}
          </button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
