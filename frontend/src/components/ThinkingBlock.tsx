import { useState } from 'react'
import { ChevronRight } from '@/lib/icons'
import { BrainThinking } from './BrainThinking'

export function ThinkingBlock({ content, streaming }: { content: string; streaming: boolean }) {
  const [open, setOpen] = useState(false)
  const trimmed = content.trim()
  const chars = trimmed.length

  return (
    <div
      className={`not-prose my-2 last:mb-0 rounded-md border border-emerald-400/30 bg-emerald-500/5 overflow-hidden ${
        open ? 'w-full' : 'w-fit max-w-full'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left font-mono text-[12px] tracking-tight text-emerald-400 hover:bg-emerald-500/10 transition-colors"
      >
        <BrainThinking
          size={22}
          active={streaming}
          className="shrink-0"
        />
        <span>{streaming ? 'Thinking' : 'Thoughts'}</span>
        <span className="text-[11px] tabular-nums text-emerald-400/60">
          {chars}
        </span>
        <ChevronRight
          size={12}
          strokeWidth={1.6}
          className={`ml-1 shrink-0 text-emerald-400/60 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && trimmed && (
        <div className="px-3 py-2.5 border-t border-emerald-400/20 text-[13px] leading-relaxed whitespace-pre-wrap break-words text-[var(--grand-fg-2)] max-h-64 overflow-auto bg-[var(--grand-bg)]">
          {trimmed}
        </div>
      )}
    </div>
  )
}
