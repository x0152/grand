import {
  SUGGESTIONS,
  SUGGESTION_GROUP_ORDER,
  SUGGESTION_GROUP_META,
  type SuggestionKind,
} from './suggestions'
import { MessageSquare, type IconComponent } from '@/lib/icons'

interface EmptyStateProps {
  disabled?: boolean
  onInsert: (prompt: string) => void
  onSend: (prompt: string) => void
}

const sectionPanel = 'w-full'

const suggestionTile =
  'grand-suggest-tile group flex h-full min-h-0 w-full min-w-0 rounded-xl text-left select-none ' +
  'text-[var(--grand-fg-2)] disabled:cursor-not-allowed disabled:opacity-50'

const titleOnPlate =
  'text-[15px] font-medium leading-snug text-[var(--grand-fg)] ' +
  '[text-shadow:0_1px_0_rgba(255,255,255,0.92),0_2px_6px_rgba(15,23,42,0.06)] ' +
  'dark:[text-shadow:0_2px_14px_rgba(0,0,0,0.65),0_1px_0_rgba(255,255,255,0.06)]'

const promptOnPlate =
  'mt-2 flex-1 text-[12.5px] leading-snug text-[var(--grand-muted)] line-clamp-2 ' +
  '[text-shadow:0_1px_2px_rgba(15,23,42,0.05)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.75)]'

const heroTitleShadow =
  'mt-5 text-[22px] font-semibold tracking-tight text-[var(--grand-fg)] sm:text-2xl ' +
  '[text-shadow:0_1px_0_rgba(255,255,255,0.95),0_3px_10px_rgba(15,23,42,0.07)] ' +
  'dark:[text-shadow:0_2px_16px_rgba(0,0,0,0.8),0_1px_0_rgba(255,255,255,0.07)]'

const badgeSoft =
  'inline-flex items-center gap-2 rounded-full border border-dashed border-zinc-500/55 bg-transparent px-3 py-1.5 font-mono ' +
  'text-[10px] uppercase tracking-[0.12em] text-[var(--grand-muted)] dark:border-zinc-400/40 ' +
  '[text-shadow:0_1px_1px_rgba(255,255,255,0.85)] dark:[text-shadow:0_1px_2px_rgba(0,0,0,0.75)]'

export function EmptyState({ disabled, onInsert, onSend }: EmptyStateProps) {
  if (disabled) {
    return (
      <div className="flex items-center justify-center h-full text-[14px] text-[var(--grand-muted)]">
        Plan execution chat (read-only)
      </div>
    )
  }
  return (
    <div className="flex w-full min-h-[56vh] flex-col items-center justify-center py-6 sm:min-h-[52vh] sm:py-10">
      <div className="flex w-full max-w-5xl flex-col items-center px-3 sm:px-4">
        <header className="flex max-w-xl flex-col items-center text-center">
          <span className={badgeSoft}>
            <MessageSquare size={14} strokeWidth={1.6} className="text-emerald-400 drop-shadow-sm" aria-hidden />
            New chat
          </span>
          <h2 className={heroTitleShadow}>What should we try?</h2>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[var(--grand-muted)] [text-shadow:0_1px_2px_rgba(255,255,255,0.9)] dark:[text-shadow:0_1px_4px_rgba(0,0,0,0.65)]">
            Starter prompts for this workspace — grouped below. Click a tile to load it into the box, or type your own
            under this panel.
          </p>
          <p className="mt-3 text-[12.5px] text-[var(--grand-muted-2)] [text-shadow:0_1px_1px_rgba(255,255,255,0.7)] dark:[text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
            Click to insert · double-click to send
          </p>
        </header>

        <div className="mt-10 flex w-full flex-col gap-8 pb-4 sm:mt-12 sm:gap-10">
          {SUGGESTION_GROUP_ORDER.map(groupId => {
            const tiles = SUGGESTIONS.filter(s => s.group === groupId)
            if (tiles.length === 0) return null
            const meta = SUGGESTION_GROUP_META[groupId]
            return (
              <section key={groupId} className={sectionPanel}>
                <header className="mb-4 text-center sm:mb-5 sm:text-left">
                  <p
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--grand-muted)]
                               [text-shadow:0_1px_1px_rgba(255,255,255,0.85)] dark:[text-shadow:0_1px_2px_rgba(0,0,0,0.65)]"
                  >
                    {meta.title}
                  </p>
                  <p
                    className="mt-1 text-[13px] leading-snug text-[var(--grand-fg-2)]
                               [text-shadow:0_1px_2px_rgba(15,23,42,0.05)] dark:[text-shadow:0_2px_10px_rgba(0,0,0,0.65)]"
                  >
                    {meta.subtitle}
                  </p>
                </header>
                <div className="grid w-full grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-3.5 xl:grid-cols-3">
                  {tiles.map(s => (
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
              </section>
            )
          })}
        </div>
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

const KIND_CLASS: Record<SuggestionKind, string> = {
  answer: 'text-emerald-600 dark:text-emerald-400',
  image:  'text-emerald-600 dark:text-emerald-400',
  table:  'text-emerald-600 dark:text-emerald-400',
  chart:  'text-emerald-600 dark:text-emerald-400',
  gif:    'text-emerald-600 dark:text-emerald-400',
  action: 'text-[var(--grand-muted)]',
}

function SuggestionCard({ icon: Icon, title, gets, kind, prompt, disabled, onInsert, onSend }: SuggestionCardProps) {
  return (
    <button
      type="button"
      onClick={onInsert}
      onDoubleClick={onSend}
      disabled={disabled}
      title={`${prompt}\n\nClick to insert · double-click to send`}
      className={suggestionTile}
    >
      <div className="flex min-h-0 w-full min-w-0 items-stretch gap-3 px-3.5 py-3.5 sm:px-4 sm:py-4">
        <div
          className="shrink-0 self-start pt-0.5 text-[var(--grand-muted)] transition-colors group-hover:text-emerald-400
                     [filter:drop-shadow(0_1px_1px_rgba(255,255,255,0.85))] dark:[filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.75))]"
        >
          <Icon size={20} strokeWidth={1.5} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <span
            className={`block max-w-full break-words font-mono text-[10px] uppercase tracking-[0.10em] leading-snug [text-shadow:0_1px_1px_rgba(255,255,255,0.75)] dark:[text-shadow:0_1px_2px_rgba(0,0,0,0.65)] ${KIND_CLASS[kind]}`}
          >
            <span className="opacity-60">→</span> {gets}
          </span>
          <div className={`mt-1.5 ${titleOnPlate}`}>{title}</div>
          <div className={promptOnPlate}>{prompt}</div>
        </div>
      </div>
    </button>
  )
}
