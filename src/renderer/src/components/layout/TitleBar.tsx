import React from 'react'
import {
  Eye,
  EyeOff,
  KeyRound,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Sun
} from 'lucide-react'
import { JarvisMark } from '../brand/JarvisMark'
import { Badge } from '../ui/Badge'
import { IconButton } from '../ui/Button'
import { Tooltip } from '../ui/Tooltip'

interface TitleBarProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  conversationTitle: string
  isDark: boolean
  onToggleTheme: () => void
  mascotEnabled: boolean
  onToggleMascot: () => void
  onOpenHub: () => void
  onOpenSettings: () => void
}

export function TitleBar({
  sidebarOpen,
  onToggleSidebar,
  conversationTitle,
  isDark,
  onToggleTheme,
  mascotEnabled,
  onToggleMascot,
  onOpenHub,
  onOpenSettings
}: TitleBarProps): React.JSX.Element {
  const isWindows = navigator.userAgent.includes('Windows')

  return (
    <header
      className="drag-region relative z-30 flex h-11 shrink-0 items-center gap-2 border-b border-jarvis-border bg-jarvis-surface pl-2"
      style={{ paddingRight: isWindows ? 148 : 12 }}
    >
      <Tooltip label={sidebarOpen ? 'Collapse conversations' : 'Open conversations'}>
        <IconButton
          label={sidebarOpen ? 'Collapse conversations' : 'Open conversations'}
          size="sm"
          onClick={onToggleSidebar}
          className="no-drag"
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </IconButton>
      </Tooltip>

      <div className="ml-0.5 flex min-w-0 items-center gap-2.5">
        <JarvisMark className="h-[22px] w-[22px] text-jarvis-accent" />
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-display text-[17px] font-semibold leading-none tracking-[-0.02em] text-jarvis-ivory">
            Jarvis
          </span>
          <span className="hidden text-3xs font-semibold uppercase tracking-[0.18em] text-jarvis-muted lg:inline">
            Personal observatory
          </span>
        </div>
      </div>

      <div className="mx-3 hidden h-4 w-px bg-jarvis-border md:block" />

      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <span className="max-w-[260px] truncate text-[11.5px] text-jarvis-sage">{conversationTitle}</span>
        <Badge variant="accent" dot className="shrink-0">
          Local
        </Badge>
      </div>

      <div className="no-drag ml-auto flex items-center gap-0.5">
        <Tooltip label="Free model providers">
          <IconButton label="Free model providers" size="sm" onClick={onOpenHub}>
            <KeyRound className="h-3.5 w-3.5" />
          </IconButton>
        </Tooltip>

        <Tooltip label={mascotEnabled ? 'Hide floating companion' : 'Show floating companion'}>
          <IconButton
            label={mascotEnabled ? 'Hide floating companion' : 'Show floating companion'}
            size="sm"
            onClick={onToggleMascot}
            active={mascotEnabled}
          >
            {mascotEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </IconButton>
        </Tooltip>

        <Tooltip label={isDark ? 'Switch to light appearance' : 'Switch to dark appearance'}>
          <IconButton
            label={isDark ? 'Switch to light appearance' : 'Switch to dark appearance'}
            size="sm"
            onClick={onToggleTheme}
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </IconButton>
        </Tooltip>

        <Tooltip label="Gateway & settings">
          <IconButton label="Gateway & settings" size="sm" onClick={onOpenSettings}>
            <Settings2 className="h-3.5 w-3.5" />
          </IconButton>
        </Tooltip>
      </div>
    </header>
  )
}
