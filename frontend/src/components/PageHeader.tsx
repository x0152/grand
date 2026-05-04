import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  kicker?: string
  action?: ReactNode
}

export function PageHeader({ title, kicker, action }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between mb-7">
      <div className="flex flex-col gap-2">
        {kicker && (
          <span className="kicker">
            <span>{kicker}</span>
          </span>
        )}
        <h2 className="text-[22px] font-semibold tracking-tight text-[var(--grand-fg)]">{title}</h2>
      </div>
      {action}
    </div>
  )
}
