import type { LucideIcon } from "@/lib/icons"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="text-center py-20">
      <Icon size={48} className="mx-auto text-[var(--grand-muted-2)] mb-4" strokeWidth={1.5} />
      <p className="text-[var(--grand-fg-2)] text-[15px] font-medium">{title}</p>
      {description && (
        <p className="text-[13px] text-[var(--grand-muted)] mt-1.5 max-w-sm mx-auto">{description}</p>
      )}
    </div>
  )
}
