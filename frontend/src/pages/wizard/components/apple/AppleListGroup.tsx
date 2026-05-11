import type { ReactNode } from 'react'

interface AppleListGroupProps {
  children: ReactNode
  caption?: ReactNode
  className?: string
}

export function AppleListGroup({ children, caption, className }: AppleListGroupProps) {
  return (
    <div className={className}>
      <div className="rounded-2xl bg-[var(--grand-surface)] ring-1 ring-[var(--grand-border-2)] overflow-hidden divide-y divide-[var(--grand-border-2)]">
        {children}
      </div>
      {caption && (
        <p className="mt-3 px-2 text-[13px] text-[var(--grand-muted)] leading-relaxed">
          {caption}
        </p>
      )}
    </div>
  )
}
