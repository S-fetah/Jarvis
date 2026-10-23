import React, { useState } from 'react'
import { X, Key, Globe, Folder, Check, ShieldCheck } from 'lucide-react'
import { JarvisSettings } from '../../../shared/types'

interface SettingsModalProps {
  settings: JarvisSettings
  isOpen: boolean
  onClose: () => void
  onSave: (updated: Partial<JarvisSettings>) => Promise<void>
}

export function SettingsModal({
  settings,
  isOpen,
  onClose,
  onSave
}: SettingsModalProps): React.JSX.Element | null {
  const [gatewayUrl, setGatewayUrl] = useState(settings.gatewayUrl || 'http://127.0.0.1:31415/v1')
  const [apiKey, setApiKey] = useState('')
  const [mascotEnabled, setMascotEnabled] = useState(settings.mascotEnabled !== false)
  const [reduceMotion, setReduceMotion] = useState(settings.reduceMotion === true)
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  if (!isOpen) return null

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSave({
        gatewayUrl,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        mascotEnabled,
        reduceMotion
      })
      setSavedSuccess(true)
      setTimeout(() => {
        setSavedSuccess(false)
        onClose()
      }, 800)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-jarvis-surface border border-jarvis-borderStrong rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-jarvis-border">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-jarvis-accent/20 text-jarvis-accentGlow">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-jarvis-ivory">Gateway & Model Settings</h2>
              <p className="text-[11px] text-jarvis-muted">FreeLLMAPI & Local Provider Configuration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-jarvis-muted hover:text-jarvis-ivory transition p-1 rounded-md hover:bg-jarvis-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          {/* Gateway Endpoint */}
          <div>
            <label className="block text-[11px] font-semibold text-jarvis-muted uppercase tracking-wider mb-1">
              Gateway URL
            </label>
            <div className="relative">
              <Globe className="w-3.5 h-3.5 absolute left-3 top-3 text-jarvis-muted" />
              <input
                type="text"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                placeholder="http://127.0.0.1:31415/v1"
                className="w-full bg-jarvis-base border border-jarvis-border rounded-lg pl-9 pr-3 py-2 text-jarvis-ivory placeholder-jarvis-muted focus:outline-none focus:border-jarvis-accent font-mono text-xs"
              />
            </div>
            <p className="text-[10px] text-jarvis-muted mt-1">
              Standard local FreeLLMAPI gateway runs on port 31415.
            </p>
          </div>

          {/* Unified API Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-jarvis-muted uppercase tracking-wider">
                FreeLLMAPI Unified Key
              </label>
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-[10px] text-jarvis-accentGlow hover:underline font-medium"
              >
                {showKey ? 'Hide' : 'Reveal'}
              </button>
            </div>
            <div className="relative">
              <Key className="w-3.5 h-3.5 absolute left-3 top-3 text-jarvis-muted" />
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  settings.hasApiKey
                    ? '•••••••• (Encrypted key saved — enter new key to replace)'
                    : 'Leave blank for auto-detected local key'
                }
                className="w-full bg-jarvis-base border border-jarvis-border rounded-lg pl-9 pr-3 py-2 text-jarvis-ivory placeholder-jarvis-muted focus:outline-none focus:border-jarvis-accent font-mono text-xs"
              />
            </div>
            {settings.hasApiKey ? (
              <div className="flex items-center space-x-1.5 mt-1.5 text-[11px] text-emerald-400 bg-jarvis-elevated border border-emerald-900/50 p-2 rounded">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                <span>
                  Encrypted API key securely saved in local hardware-backed storage.
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 mt-1.5 text-[11px] text-jarvis-accentGlow bg-jarvis-elevated border border-jarvis-border p-2 rounded">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Jarvis auto-detects your FreeLLMAPI desktop key from local database if left blank.
                </span>
              </div>
            )}
          </div>

          {/* Workspace Path Preview */}
          <div>
            <label className="block text-[11px] font-semibold text-jarvis-muted uppercase tracking-wider mb-1">
              Active Workspace
            </label>
            <div className="flex items-center space-x-2 bg-jarvis-base border border-jarvis-border rounded-lg px-3 py-2 text-jarvis-sage font-mono text-[11px]">
              <Folder className="w-3.5 h-3.5 text-jarvis-accentGlow flex-shrink-0" />
              <span className="truncate">{settings.workspacePaths[0] || 'Default'}</span>
            </div>
          </div>

          {/* Mascot Companion Preferences */}
          <div className="pt-2 border-t border-jarvis-border space-y-2">
            <label className="block text-[11px] font-semibold text-jarvis-muted uppercase tracking-wider">
              3D Mascot Desktop Companion
            </label>
            <div className="space-y-1.5">
              <label className="flex items-center space-x-2 text-jarvis-sage cursor-pointer">
                <input
                  type="checkbox"
                  checked={mascotEnabled}
                  onChange={(e) => setMascotEnabled(e.target.checked)}
                  className="rounded bg-jarvis-base border-jarvis-border text-jarvis-accent focus:ring-0"
                />
                <span>Enable Floating 3D Owl Desktop Companion</span>
              </label>
              <label className="flex items-center space-x-2 text-jarvis-muted cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={reduceMotion}
                  onChange={(e) => setReduceMotion(e.target.checked)}
                  className="rounded bg-jarvis-base border-jarvis-border text-jarvis-accent focus:ring-0"
                />
                <span>Reduce Motion (Minimal low-frequency animation)</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-jarvis-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-jarvis-border bg-jarvis-elevated text-jarvis-sage hover:bg-jarvis-hover hover:text-jarvis-ivory transition text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg bg-jarvis-accent hover:bg-jarvis-accentHover text-jarvis-base font-bold flex items-center space-x-1.5 transition text-xs shadow-md"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-jarvis-base" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Settings</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
