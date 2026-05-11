import type { ReactNode } from 'react'

interface AppleSectionProps {
  title?: ReactNode
  trailing?: ReactNode
  children: ReactNode
}

export function AppleSection({ title, trailing, children }: AppleSectionProps) {
  return (
    <div>
      {(title || trailing) && (
        <div className="flex items-end justify-between gap-3 px-2 mb-2">
          {title && (
            <h3 className="text-[12.5px] font-mono uppercase tracking-[0.16em] text-[var(--grand-muted)]">
              {title}
            </h3>
          )}
          {trailing}
        </div>
      )}
      {children}
    </div>
  )
}
