import type { ReactNode } from 'react'

interface AppleHeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  align?: 'center' | 'left'
}

export function AppleHeader({ eyebrow, title, subtitle, align = 'center' }: AppleHeaderProps) {
  const wrap = align === 'center' ? 'text-center mx-auto' : 'text-left'
  const subWrap = align === 'center' ? 'mx-auto max-w-md' : ''
  return (
    <div className={wrap}>
      {eyebrow && (
        <div className="text-[12px] font-mono font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
          {eyebrow}
        </div>
      )}
      <h1 className="mt-2 text-[32px] sm:text-[36px] font-semibold tracking-[-0.025em] leading-[1.1] text-[var(--grand-fg)]">
        {title}
      </h1>
      {subtitle && (
        <p className={`mt-3 text-[16px] text-[var(--grand-muted)] leading-relaxed ${subWrap}`}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
