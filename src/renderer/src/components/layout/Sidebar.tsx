import React, { useMemo, useState } from 'react'
import { FolderOpen, MessageSquare, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react'
import type { Conversation } from '../../../../shared/types'
import { basename, formatDayGroup, formatTime } from '../../lib/format'
import { cn } from '../../lib/cn'
import { Button } from '../ui'

interface SidebarProps {
  open: boolean
  conversations: Conversation[]
  activeConvId: string
  workspacePath: string
  onNewChat: () => void
  onSelectConversation: (conversation: Conversation) => void
  onDeleteConversation: (event: React.MouseEvent, id: string) => void
  onSelectWorkspace: () => void
}

const GROUPS = ['Today', 'Yesterday', 'Earlier'] as const

export function Sidebar({
  open,
  conversations,
  activeConvId,
  workspacePath,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onSelectWorkspace
}: SidebarProps): React.JSX.Element {
  const [query, setQuery] = useState('')

  const grouped = useMemo(() => {
    const filtered = conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(query.trim().toLowerCase())
    )
    return GROUPS.map((label) => ({
      label,
      items: filtered
        .filter((conversation) => formatDayGroup(conversation.updatedAt || conversation.createdAt) === label)
        .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    })).filter((group) => group.items.length > 0)
  }, [conversations, query])

  return (
    <aside
      aria-label="Conversations"
      className={cn(
        'relative z-20 shrink-0 overflow-hidden border-jarvis-border bg-jarvis-surface transition-[width] duration-200 ease-out',
        open ? 'w-[276px] border-r' : 'w-0 border-r-0'
      )}
    >
      <div className="flex h-full w-[276px] flex-col">
        <div className="space-y-2.5 px-3 pb-3 pt-4">
          <Button variant="primary" size="md" onClick={onNewChat} className="w-full justify-between pl-3.5">
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New conversation
            </span>
            <span className="rounded border border-jarvis-accentContrast/20 bg-jarvis-accentContrast/10 px-1.5 py-0.5 font-mono text-[9px] text-jarvis-accentContrast/70">
              new
            </span>
          </Button>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-jarvis-muted" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              className="h-8 w-full rounded-md border border-jarvis-border bg-jarvis-base pl-8 pr-3 text-[11.5px] text-jarvis-ivory placeholder:text-jarvis-muted/75 transition focus:border-jarvis-accent focus:bg-jarvis-surface focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-3 pb-1.5">
          <span className="text-3xs font-semibold uppercase tracking-[0.16em] text-jarvis-muted">
            Conversations
          </span>
          <span className="font-mono text-3xs text-jarvis-muted">{conversations.length}</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          {grouped.length === 0 ? (
            <div className="px-2 py-10 text-center">
              <MessageSquare className="mx-auto mb-2 h-5 w-5 text-jarvis-borderStrong" />
              <p className="text-[11.5px] text-jarvis-muted">
                {query ? 'No conversations match that search.' : 'No conversations yet.'}
              </p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.label} className="mb-3">
                <div className="sticky top-0 z-10 bg-jarvis-surface px-2 py-1.5 text-3xs font-semibold uppercase tracking-[0.16em] text-jarvis-muted/85">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((conversation) => {
                    const active = conversation.id === activeConvId
                    const noteCount = conversation.messages?.length || 0
                    return (
                      <div key={conversation.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => onSelectConversation(conversation)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'w-full rounded-md border-l-2 py-2 pl-2.5 pr-9 text-left transition-colors',
                            active
                              ? 'border-jarvis-accent bg-jarvis-accentSoft text-jarvis-ivory'
                              : 'border-transparent text-jarvis-sage hover:bg-jarvis-hover hover:text-jarvis-ivory'
                          )}
                        >
                          <span className="block truncate text-[12.5px] font-medium leading-snug">
                            {conversation.title || 'Conversation'}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-3xs text-jarvis-muted">
                            <span>{formatTime(conversation.updatedAt || conversation.createdAt)}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {noteCount} {noteCount === 1 ? 'note' : 'notes'}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => onDeleteConversation(event, conversation.id)}
                          aria-label={`Delete ${conversation.title || 'conversation'}`}
                          title="Delete conversation"
                          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-jarvis-muted opacity-0 transition hover:bg-jarvis-dangerSoft hover:text-jarvis-danger focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </nav>

        <div className="space-y-2 border-t border-jarvis-border p-3">
          <button
            type="button"
            onClick={onSelectWorkspace}
            title={workspacePath}
            className="group flex w-full items-center gap-2.5 rounded-md border border-jarvis-border bg-jarvis-base px-2.5 py-2 text-left transition hover:border-jarvis-borderStrong hover:bg-jarvis-elevated"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-jarvis-elevated text-jarvis-accent">
              <FolderOpen className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-3xs font-semibold uppercase tracking-[0.14em] text-jarvis-muted">
                Workspace
              </span>
              <span className="mt-0.5 block truncate font-mono text-[10.5px] text-jarvis-sage group-hover:text-jarvis-ivory">
                {basename(workspacePath)}
              </span>
            </span>
          </button>

          <div className="flex items-start gap-2 rounded-md border border-jarvis-accent/15 bg-jarvis-accentSoft/55 px-2.5 py-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-jarvis-accent" />
            <div>
              <p className="text-[10.5px] font-semibold leading-tight text-jarvis-accent">Local & gated</p>
              <p className="mt-0.5 text-[10px] leading-snug text-jarvis-sage/85">
                SQLite history. Every machine-changing action asks first.
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
