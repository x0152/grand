import type { ReactNode } from 'react'
import { Check, type IconComponent } from '@/lib/icons'

interface AppleForkCardProps {
  icon: IconComponent
  title: ReactNode
  tagline: ReactNode
  description: ReactNode
  bullets?: ReactNode[]
  badge?: { label: string; tone?: 'emerald' | 'amber' }
  selected?: boolean
  disabled?: boolean
  hint?: ReactNode
  onClick: () => void
}

const toneStyles: Record<NonNullable<NonNullable<AppleForkCardProps['badge']>['tone']>, string> = {
  emerald:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
}

export function AppleForkCard({
  icon: Icon,
  title,
  tagline,
  description,
  bullets,
  badge,
  selected,
  disabled,
  hint,
  onClick,
}: AppleForkCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative h-full w-full text-left rounded-3xl ring-1 transition-all duration-150 ${
        disabled
          ? 'ring-[var(--grand-border-2)] opacity-50 cursor-not-allowed bg-[var(--grand-surface)]'
          : selected
            ? 'ring-2 ring-emerald-500 bg-emerald-500/[0.04] shadow-[0_8px_32px_-16px_rgba(16,185,129,0.4)]'
            : 'ring-[var(--grand-border-2)] bg-[var(--grand-surface)] hover:ring-[var(--grand-border)] hover:shadow-[0_12px_32px_-20px_rgba(15,23,42,0.25)] hover:-translate-y-0.5'
      } px-6 py-6 sm:px-7 sm:py-7`}
    >
      {selected && (
        <span className="absolute right-5 top-5 inline-flex size-7 rounded-full bg-emerald-500 text-white items-center justify-center">
          <Check size={16} weight="bold" />
        </span>
      )}
      <div className="flex items-start gap-4">
        <div
          className={`size-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
            selected
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-[var(--grand-surface-2)] text-[var(--grand-fg-2)]'
          }`}
        >
          <Icon size={28} weight="duotone" />
        </div>
        <div className="flex-1 min-w-0 pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[20px] font-semibold tracking-tight text-[var(--grand-fg)] leading-tight">
              {title}
            </h3>
            {badge && (
              <span
                className={`text-[10.5px] uppercase tracking-wide rounded-full border px-2 py-0.5 ${
                  toneStyles[badge.tone ?? 'emerald']
                }`}
              >
                {badge.label}
              </span>
            )}
          </div>
          <p className="text-[12.5px] font-mono uppercase tracking-[0.12em] text-[var(--grand-muted-2)] mt-1">
            {tagline}
          </p>
          <p className="text-[14.5px] text-[var(--grand-muted)] mt-3 leading-relaxed">
            {description}
          </p>
          {bullets && bullets.length > 0 && (
            <ul className="mt-4 space-y-2">
              {bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-[13.5px] text-[var(--grand-fg-2)] leading-relaxed"
                >
                  <span className="mt-0.5 inline-flex size-5 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 items-center justify-center">
                    <Check size={12} weight="bold" />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          {hint && (
            <p className="mt-4 text-[12.5px] text-[var(--grand-muted-2)] italic leading-snug">
              {hint}
            </p>
          )}
          {!disabled && (
            <div
              className={`mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium tracking-tight transition-colors ${
                selected
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-[var(--grand-muted-2)] group-hover:text-[var(--grand-fg-2)]'
              }`}
            >
              {selected ? (
                <>
                  <Check size={13} weight="bold" /> Selected
                </>
              ) : (
                'Tap to choose'
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
