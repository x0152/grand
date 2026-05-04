import { BrainThinking } from '../BrainThinking'
import { TypingLines } from '../TypingLines'

export function PendingIndicator({ mode = 'thinking' }: { mode?: 'thinking' | 'typing' }) {
  return (
    <div className="flex items-center gap-2.5 py-1 text-[13px] text-[var(--grand-muted)]">
      {mode === 'thinking' ? (
        <BrainThinking size={28} active className="shrink-0 text-emerald-400" />
      ) : (
        <TypingLines size={28} active className="shrink-0 text-emerald-400" />
      )}
      {mode === 'typing' ? (
        <>
          <span>Typing</span>
          <span className="typing-caret text-emerald-400" aria-hidden />
        </>
      ) : (
        <span>Thinking</span>
      )}
    </div>
  )
}
