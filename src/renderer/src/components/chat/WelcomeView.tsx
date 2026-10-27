import React from 'react'
import { ArrowUpRight, BookOpen, GitBranch, Globe2, Play, ShieldCheck } from 'lucide-react'
import { JarvisMark } from '../brand/JarvisMark'

interface WelcomeViewProps {
  onSuggestion: (prompt: string) => void
  workspaceName: string
}

const SUGGESTIONS = [
  {
    index: '01',
    title: 'Capabilities & local storage',
    description: 'See what Jarvis can do and where your history lives.',
    prompt: 'What can you actually do and where is chat history saved?',
    icon: BookOpen
  },
  {
    index: '02',
    title: 'Open Gmail in Chrome',
    description: 'Exercise the browser-launch approval path.',
    prompt: 'open my gmail from chrome',
    icon: Globe2
  },
  {
    index: '03',
    title: 'Git status & recent commits',
    description: 'Read the branch, staged changes, and latest log.',
    prompt: 'Check git status and recent commits',
    icon: GitBranch
  },
  {
    index: '04',
    title: 'Start the dev server',
    description: 'Exercise the gated process approval path.',
    prompt: 'Start the development server with npm run dev',
    icon: Play
  }
]

export function WelcomeView({ onSuggestion, workspaceName }: WelcomeViewProps): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="animate-slide-up">
        <div className="flex items-center gap-3">
          <JarvisMark className="h-11 w-11 text-jarvis-accent" />
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-jarvis-muted">
              Assistive autonomy · Local-first
            </p>
            <p className="mt-1 font-mono text-[10.5px] text-jarvis-muted/85">{workspaceName}</p>
          </div>
        </div>

        <h1 className="mt-7 max-w-xl font-display text-[clamp(2.1rem,4vw,3.15rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-jarvis-ivory text-balance">
          What should we <em className="font-display italic text-jarvis-accent">make</em> of today?
        </h1>
        <p className="mt-3.5 max-w-lg text-[13.5px] leading-relaxed text-jarvis-sage">
          Inspect the codebase, shape a plan, or run a careful errand. Jarvis reads freely, asks before
          changing anything, and keeps the evidence on this machine.
        </p>
      </div>

      <div className="mt-8">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="text-3xs font-semibold uppercase tracking-[0.18em] text-jarvis-muted">
            Begin with a field note
          </span>
          <span className="h-px flex-1 bg-jarvis-border" />
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {SUGGESTIONS.map((suggestion, index) => {
            const Icon = suggestion.icon
            return (
              <button
                key={suggestion.index}
                type="button"
                onClick={() => onSuggestion(suggestion.prompt)}
                className="group animate-slide-up rounded-lg border border-jarvis-border bg-jarvis-surface p-3.5 text-left shadow-hairline transition duration-200 hover:-translate-y-0.5 hover:border-jarvis-accent/45 hover:bg-jarvis-elevated hover:shadow-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jarvis-accent"
                style={{ animationDelay: `${80 + index * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md border border-jarvis-border bg-jarvis-base text-jarvis-accent transition group-hover:border-jarvis-accent/30 group-hover:bg-jarvis-accentSoft">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-mono text-3xs text-jarvis-muted/70">{suggestion.index}</span>
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[12.5px] font-semibold leading-snug text-jarvis-ivory">
                      {suggestion.title}
                    </h2>
                    <p className="mt-1 text-[11px] leading-snug text-jarvis-muted">
                      {suggestion.description}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-jarvis-muted/50 transition group-hover:text-jarvis-accent" />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 flex items-start gap-2.5 rounded-md border border-jarvis-border/80 bg-jarvis-elevated/55 px-3 py-2.5">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-jarvis-accent" />
        <p className="text-[11px] leading-relaxed text-jarvis-muted">
          <span className="font-medium text-jarvis-sage">The safety contract:</span> low-risk reading runs
          quietly. File writes, external launches, and commands pause for an explicit approval bound to the
          exact action.
        </p>
      </div>
    </div>
  )
}
