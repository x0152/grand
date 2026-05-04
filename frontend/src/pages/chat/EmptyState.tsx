import { SUGGESTIONS, type SuggestionKind } from './suggestions'
import { type IconComponent } from '@/lib/icons'

interface EmptyStateProps {
  disabled?: boolean
  onInsert: (prompt: string) => void
  onSend: (prompt: string) => void
}

export function EmptyState({ disabled, onInsert, onSend }: EmptyStateProps) {
  if (disabled) {
    return (
      <div className="flex items-center justify-center h-full text-[14px] text-[var(--grand-muted)]">
        Plan execution chat (read-only)
      </div>
    )
  }
  return (
    <div className="flex flex-col h-full w-full px-2 py-10">
      <div className="mb-5">
        <h3 className="text-[18px] font-semibold tracking-tight text-[var(--grand-fg)]">What should we try?</h3>
        <p className="text-[13px] text-[var(--grand-muted)] mt-1.5">
          A few ideas tailored to this setup · click to insert · double-click to send
        </p>
      </div>
      <div className="grid w-full grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
        {SUGGESTIONS.map(s => (
          <SuggestionCard
            key={s.id}
            icon={s.icon}
            title={s.title}
            gets={s.gets}
            kind={s.kind}
            prompt={s.prompt}
            disabled={disabled}
            onInsert={() => onInsert(s.prompt)}
            onSend={() => onSend(s.prompt)}
          />
        ))}
      </div>
    </div>
  )
}

interface SuggestionCardProps {
  icon: IconComponent
  title: string
  gets: string
  kind: SuggestionKind
  prompt: string
  disabled?: boolean
  onInsert: () => void
  onSend: () => void
}

// Tone per kind. Artifact outcomes (image/table/chart/gif/answer) get the
// accent tint so the eye reads "you'll get a thing" instantly. Automation
// outcomes (action) stay neutral — they set something up rather than returning
// a single artifact.
const KIND_CLASS: Record<SuggestionKind, string> = {
  answer: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  image: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  table: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  chart: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  gif: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  action: 'text-[var(--grand-fg-2)] border-[var(--grand-border-strong)] bg-[var(--grand-surface-2)]',
}

function SuggestionCard({ icon: Icon, title, gets, kind, prompt, disabled, onInsert, onSend }: SuggestionCardProps) {
  return (
    <button
      type="button"
      onClick={onInsert}
      onDoubleClick={onSend}
      disabled={disabled}
      title={`${prompt}\n\nClick to insert · double-click to send`}
      className="group flex h-full min-h-0 w-full min-w-0 text-left rounded-lg
                 border border-[var(--grand-border)]
                 bg-[var(--grand-surface)]
                 hover:border-emerald-400/60
                 hover:bg-[var(--grand-surface-2)]
                 text-[var(--grand-fg-2)]
                 hover:text-[var(--grand-fg)]
                 transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none"
    >
      <div className="flex min-h-0 w-full min-w-0 items-stretch gap-3.5 px-4 py-4">
        <div className="shrink-0 self-start pt-0.5 text-[var(--grand-muted)] group-hover:text-emerald-400 transition-colors">
          <Icon size={20} strokeWidth={1.5} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="text-[15px] font-medium text-[var(--grand-fg)] leading-snug">{title}</div>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11.5px]
                          leading-none ${KIND_CLASS[kind]}`}
            >
              <span className="opacity-60">→</span>
              {gets}
            </span>
          </div>
          <div className="mt-2 flex-1 text-[12.5px] leading-snug text-[var(--grand-muted)] line-clamp-2 group-hover:line-clamp-[8]">
            {prompt}
          </div>
        </div>
      </div>
    </button>
  )
}
