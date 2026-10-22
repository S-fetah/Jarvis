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
  const [apiKey, setApiKey] = useState(settings.apiKey || '')
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
        apiKey: apiKey.trim() ? apiKey.trim() : undefined,
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
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[#30363d]">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Gateway & Model Settings</h2>
              <p className="text-[11px] text-slate-400">FreeLLMAPI & Local Provider Configuration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition p-1 rounded-md hover:bg-[#21262d]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          {/* Gateway Endpoint */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Gateway URL
            </label>
            <div className="relative">
              <Globe className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                placeholder="http://127.0.0.1:31415/v1"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Standard local FreeLLMAPI gateway runs on port 31415.
            </p>
          </div>

          {/* Unified API Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                FreeLLMAPI Unified Key
              </label>
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-[10px] text-blue-400 hover:underline"
              >
                {showKey ? 'Hide' : 'Reveal'}
              </button>
            </div>
            <div className="relative">
              <Key className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Leave blank for auto-detected local key"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>
            <div className="flex items-center space-x-1.5 mt-1.5 text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 p-2 rounded">
              <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                Jarvis auto-detects your FreeLLMAPI desktop key from local database if left blank.
              </span>
            </div>
          </div>

          {/* Workspace Path Preview */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Active Workspace
            </label>
            <div className="flex items-center space-x-2 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-slate-300 font-mono text-[11px]">
              <Folder className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="truncate">{settings.workspacePaths[0] || 'Default'}</span>
            </div>
          </div>

          {/* Mascot Companion Preferences */}
          <div className="pt-2 border-t border-[#30363d] space-y-2">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              3D Mascot Desktop Companion
            </label>
            <div className="space-y-1.5">
              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mascotEnabled}
                  onChange={(e) => setMascotEnabled(e.target.checked)}
                  className="rounded bg-[#0d1117] border-[#30363d] text-blue-600 focus:ring-0"
                />
                <span>Enable Floating 3D Owl Desktop Companion</span>
              </label>
              <label className="flex items-center space-x-2 text-slate-400 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={reduceMotion}
                  onChange={(e) => setReduceMotion(e.target.checked)}
                  className="rounded bg-[#0d1117] border-[#30363d] text-blue-600 focus:ring-0"
                />
                <span>Reduce Motion (Minimal low-frequency animation)</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#30363d]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-[#30363d] bg-[#21262d] text-slate-300 hover:bg-[#30363d] transition text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center space-x-1.5 transition text-xs shadow-md"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
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
