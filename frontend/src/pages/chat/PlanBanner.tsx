import { GitBranch } from '@/lib/icons'
import { navigate } from '../../router'

export function PlanBanner({ planId }: { planId?: string }) {
  return (
    <div className="px-6 py-3 bg-[var(--grand-surface-2)] shrink-0">
      <div className="flex items-center gap-2.5 text-[12.5px] tracking-tight text-[var(--grand-fg-2)]">
        <GitBranch size={14} className="text-amber-400" />
        <span>Plan execution chat · read-only</span>
        {planId && (
          <button
            onClick={() => navigate({ page: 'plans', planId })}
            className="ml-auto text-emerald-400 hover:text-emerald-300 hover:underline"
          >
            open plan →
          </button>
        )}
      </div>
    </div>
  )
}
