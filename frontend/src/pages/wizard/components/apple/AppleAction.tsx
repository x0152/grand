import type { ButtonHTMLAttributes, ReactNode } from 'react'

type AppleActionVariant = 'primary' | 'secondary' | 'ghost'

interface AppleActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppleActionVariant
  fullWidth?: boolean
  leading?: ReactNode
  children: ReactNode
}

const variantStyles: Record<AppleActionVariant, string> = {
  primary:
    'bg-[var(--grand-fg)] text-[var(--grand-bg)] hover:bg-[var(--grand-fg-2)] active:translate-y-[0.5px] disabled:bg-[var(--grand-surface-2)] disabled:text-[var(--grand-muted-2)]',
  secondary:
    'bg-[var(--grand-surface)] text-[var(--grand-fg)] ring-1 ring-[var(--grand-border-2)] hover:ring-[var(--grand-border)] disabled:opacity-50',
  ghost:
    'bg-transparent text-[var(--grand-fg-2)] hover:bg-[var(--grand-surface-2)] disabled:opacity-50',
}

export function AppleAction({
  variant = 'primary',
  fullWidth,
  leading,
  children,
  className,
  ...props
}: AppleActionProps) {
  return (
    <button
      type="button"
      {...props}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-2xl h-14 px-7 text-[15.5px] font-medium tracking-tight transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40',
        'disabled:cursor-not-allowed',
        fullWidth ? 'w-full' : '',
        variantStyles[variant],
        className ?? '',
      ].join(' ')}
    >
      {leading}
      {children}
    </button>
  )
}
