import type { ReactNode } from 'react'

interface SkipToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  helper?: ReactNode
}

export function SkipToggle({ checked, onChange, label, helper }: SkipToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-4 rounded-2xl ring-1 px-5 py-4 text-left transition-all ${
        checked
          ? 'ring-[var(--grand-fg-2)] bg-[var(--grand-surface-2)]'
          : 'ring-[var(--grand-border-2)] bg-[var(--grand-surface)] hover:ring-[var(--grand-border)]'
      }`}
    >
      <span
        className={`size-7 shrink-0 rounded-md ring-2 inline-flex items-center justify-center transition-colors ${
          checked
            ? 'bg-[var(--grand-fg)] ring-[var(--grand-fg)] text-[var(--grand-bg)]'
            : 'ring-[var(--grand-border)]'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
            <path
              d="M3 8.2 6.5 11.5 13 5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-medium text-[var(--grand-fg)]">{label}</span>
        {helper && (
          <span className="block text-[12.5px] text-[var(--grand-muted)] mt-0.5 leading-snug">
            {helper}
          </span>
        )}
      </span>
    </button>
  )
}
