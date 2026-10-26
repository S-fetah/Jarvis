import React from 'react'
import {
  X,
  Sparkles,
  ExternalLink,
  RotateCcw,
  Layers
} from 'lucide-react'

interface FreeProvider {
  id: string
  name: string
  models: string[]
  speed: string
  limits: string
  description: string
  getKeyUrl: string
  isConfigured?: boolean
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
      'Google provides completely free API keys with access to flagship Gemini models. You can add 2 to 3 keys in FreeLLMAPI to automatically rotate across them and eliminate rate limits!',
    getKeyUrl: 'https://aistudio.google.com/app/apikey'
  },
  {
    id: 'groq',
    name: 'Groq Cloud (Ultra-Fast)',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma-2-9b-it'],
    speed: '500 - 1000 tokens/sec',
    limits: '30 RPM / 14.4k RPD (100% Free)',
    description:
      'World-record inference speed running open-weights Llama 3.3 and Mixtral models. Ideal for instant coding and real-time reasoning.',
    getKeyUrl: 'https://console.groq.com/keys'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (Free Models Tier)',
    models: ['meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat:free', 'qwen/qwen-2.5-72b-instruct:free'],
    speed: '~2s latency',
    limits: 'Free models have :free suffix',
    description:
      'Aggregator offering top open models for free. Generate a key without adding any credit card and access DeepSeek V3 and Llama 3.3.',
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
    speed: 'Local GPU/CPU',
    limits: '100% Unlimited & Private',
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
  if (!isOpen) return null

  const handleOpenLink = async (url: string): Promise<void> => {
    if (window.jarvisAPI) {
      await window.jarvisAPI.openExternalUrl(url)
    }
  }

  const handleOpenFreeLLM = async (): Promise<void> => {
    if (window.jarvisAPI) {
      await window.jarvisAPI.openFreeLLMDashboard()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-jarvis-surface border border-jarvis-borderStrong rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-jarvis-border flex items-center justify-between bg-jarvis-surface">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-jarvis-accent to-jarvis-accentGlow text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-jarvis-ivory flex items-center space-x-2">
                <span>Free Models & Providers Hub</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-normal">
                  Zero-Cost AI
                </span>
              </h2>
              <p className="text-[11px] text-jarvis-muted">
                Get free API keys and add them to FreeLLMAPI for automatic key rotation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-jarvis-muted hover:text-jarvis-ivory transition p-1 rounded-md hover:bg-jarvis-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FreeLLMAPI Rotation Banner */}
        <div className="px-4 py-3 bg-jarvis-base border-b border-jarvis-border flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-jarvis-sage">
            <Layers className="w-4 h-4 text-jarvis-accent flex-shrink-0" />
            <span>
              <strong className="text-jarvis-ivory">Key Rotation Tip:</strong> Add 2 or 3 Google Gemini keys into FreeLLMAPI. It automatically rotates requests across them to eliminate rate limits!
            </span>
          </div>
          <button
            onClick={handleOpenFreeLLM}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-jarvis-accent hover:bg-jarvis-accentHover text-white font-bold text-xs shadow transition flex-shrink-0 ml-3"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open FreeLLMAPI UI</span>
          </button>
        </div>

        {/* Providers Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {FREE_PROVIDERS.map((provider) => (
            <div
              key={provider.id}
              className="p-3.5 rounded-xl bg-jarvis-elevated border border-jarvis-border hover:border-jarvis-borderStrong transition space-y-2.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-xs text-jarvis-ivory flex items-center space-x-2">
                    <span>{provider.name}</span>
                    <span className="text-[10px] text-jarvis-accent font-mono bg-jarvis-surface border border-jarvis-border px-1.5 py-0.5 rounded">
                      {provider.speed}
                    </span>
                  </h3>
                  <span className="text-[10px] text-jarvis-muted font-mono">{provider.limits}</span>
                </div>

                <button
                  onClick={() => handleOpenLink(provider.getKeyUrl)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-jarvis-surface hover:bg-jarvis-hover text-jarvis-accent hover:text-jarvis-accentHover border border-jarvis-border text-xs font-medium transition"
                >
                  <span>Get Free Key</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <p className="text-[11px] text-jarvis-muted leading-relaxed">{provider.description}</p>

              {/* Models Available */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {provider.models.map((model) => (
                  <span
                    key={model}
                    className="px-2 py-0.5 rounded bg-jarvis-base text-jarvis-sage text-[10px] font-mono border border-jarvis-border"
                  >
                    {model}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-jarvis-border bg-jarvis-surface flex items-center justify-between text-xs">
          <button
            onClick={onRefreshCatalog}
            className="flex items-center space-x-1.5 text-jarvis-muted hover:text-jarvis-ivory transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reload Model Catalog</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-jarvis-elevated hover:bg-jarvis-hover text-jarvis-sage hover:text-jarvis-ivory border border-jarvis-border transition font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
