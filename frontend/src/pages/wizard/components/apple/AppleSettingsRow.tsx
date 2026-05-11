import type { ReactNode } from 'react'
import { Check, ChevronRight } from '@/lib/icons'

export type RowMode = 'navigate' | 'select-single' | 'select-multi' | 'static'

interface AppleSettingsRowProps {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  badge?: ReactNode
  trailing?: ReactNode
  mode?: RowMode
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
}

export function AppleSettingsRow({
  leading,
  title,
  subtitle,
  badge,
  trailing,
  mode = 'navigate',
  selected,
  disabled,
  onClick,
}: AppleSettingsRowProps) {
  const interactive = mode !== 'static' && !disabled

  const body = (
    <div className="w-full flex items-center gap-4 px-5 py-4 text-left">
      {leading && (
        <div className="shrink-0 flex items-center justify-center">{leading}</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[16px] font-medium tracking-tight text-[var(--grand-fg)]">
            {title}
          </span>
          {badge}
        </div>
        {subtitle && (
          <p className="text-[13.5px] text-[var(--grand-muted)] mt-0.5 leading-snug">
            {subtitle}
          </p>
        )}
      </div>
      <RowTrailing mode={mode} selected={selected} trailing={trailing} />
    </div>
  )

  if (!interactive) {
    return <div className="w-full">{body}</div>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full hover:bg-[var(--grand-surface-2)]/60 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
    >
      {body}
    </button>
  )
}

function RowTrailing({
  mode,
  selected,
  trailing,
}: {
  mode: RowMode
  selected?: boolean
  trailing?: ReactNode
}) {
  if (trailing) return <div className="shrink-0">{trailing}</div>
  if (mode === 'select-single') {
    return (
      <div className="shrink-0">
        {selected ? (
          <Check size={22} weight="bold" className="text-emerald-500" />
        ) : (
          <span className="inline-block size-[22px]" aria-hidden />
        )}
      </div>
    )
  }
  if (mode === 'select-multi') {
    return (
      <div className="shrink-0">
        {selected ? (
          <span className="inline-flex size-7 rounded-full bg-emerald-500 items-center justify-center text-white">
            <Check size={16} weight="bold" />
          </span>
        ) : (
          <span className="inline-block size-7 rounded-full ring-2 ring-[var(--grand-border)]" />
        )}
      </div>
    )
  }
  if (mode === 'navigate') {
    return (
      <div className="shrink-0 text-[var(--grand-muted-2)]">
        <ChevronRight size={20} />
      </div>
    )
  }
  return null
}
