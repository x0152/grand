import { SUGGESTIONS } from './suggestions'

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
    <div className="flex flex-col items-center justify-center h-full px-4 py-10 max-w-2xl mx-auto w-full">
      <div className="self-stretch mb-5">
        <h3 className="text-[18px] font-semibold tracking-tight text-[var(--grand-fg)]">What should we try?</h3>
        <p className="text-[13px] text-[var(--grand-muted)] mt-1.5">
          A few ideas tailored to this setup · click to insert · double-click to send
        </p>
      </div>
      <div className="self-stretch grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SUGGESTIONS.map(s => (
          <SuggestionCard
            key={s.title}
            icon={s.icon}
            title={s.title}
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
  icon: import('@/lib/icons').IconComponent
  title: string
  prompt: string
  disabled?: boolean
  onInsert: () => void
  onSend: () => void
}

function SuggestionCard({ icon: Icon, title, prompt, disabled, onInsert, onSend }: SuggestionCardProps) {
  return (
    <button
      type="button"
      onClick={onInsert}
      onDoubleClick={onSend}
      disabled={disabled}
      title="Click to insert into the prompt, double-click to send"
      className="group flex items-start gap-3 text-left px-4 py-3.5 min-w-0 rounded-lg
                 border border-[var(--grand-border)]
                 bg-[var(--grand-surface)]
                 hover:border-emerald-400/60
                 hover:bg-[var(--grand-surface-2)]
                 text-[var(--grand-fg-2)]
                 hover:text-[var(--grand-fg)]
                 transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none"
    >
      <div className="shrink-0 mt-0.5 text-[var(--grand-muted)] group-hover:text-emerald-400">
        <Icon size={16} strokeWidth={1.5} />
      </div>
      <div className="min-w-0">
        <div className="text-[14px] font-medium truncate">{title}</div>
        <div className="text-[12.5px] text-[var(--grand-muted)] mt-1 line-clamp-2 leading-snug">
          {prompt}
        </div>
      </div>
    </button>
  )
}
