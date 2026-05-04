import { type ReactNode } from 'react'
import type { LucideIcon } from '@/lib/icons'

export type StepItem = {
  n: number
  label: string
  icon: LucideIcon
  count: number
  total?: number
  done: boolean
}

export function scrollToSection(n: number) {
  document.getElementById(`section-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function Stepper({ steps }: { steps: StepItem[] }) {
  return (
    <nav className="rounded-lg bg-[var(--grand-surface)] px-2 py-2 flex items-center gap-1">
      {steps.map((s, i) => {
        const Icon = s.icon
        return (
          <div key={s.n} className="flex items-center gap-1 flex-1 min-w-0">
            <button
              onClick={() => scrollToSection(s.n)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-[var(--grand-surface-2)] flex-1 min-w-0 text-left transition-colors"
            >
              <span
                className={`size-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  s.done
                    ? 'bg-emerald-400 text-zinc-950'
                    : 'bg-[var(--grand-surface-2)] text-[var(--grand-muted)]'
                }`}
              >
                {s.n}
              </span>
              <Icon size={15} className={s.done ? 'text-emerald-400' : 'text-[var(--grand-muted)]'} />
              <span className={`text-[13.5px] font-medium truncate ${s.done ? 'text-[var(--grand-fg)]' : 'text-[var(--grand-muted)]'}`}>
                {s.label}
              </span>
              <span className="text-[11.5px] text-[var(--grand-muted-2)] ml-auto shrink-0 tabular-nums">
                {s.total != null ? `${s.count}/${s.total}` : s.count}
              </span>
            </button>
            {i < steps.length - 1 && <div className="w-3 h-px bg-[var(--grand-line)] shrink-0" />}
          </div>
        )
      })}
    </nav>
  )
}

export type SectionProps = {
  n: number
  icon: LucideIcon
  title: string
  subtitle: string
  action?: ReactNode
  disabled?: boolean
  disabledHint?: string
  children: ReactNode
}

export function Section({ n, icon: Icon, title, subtitle, action, disabled, disabledHint, children }: SectionProps) {
  return (
    <section
      id={`section-${n}`}
      className={`rounded-xl bg-[var(--grand-surface)] p-5 scroll-mt-4 transition-opacity ${disabled ? 'opacity-60' : ''}`}
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-7 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[12px] font-bold shrink-0 mt-0.5">
            {n}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon size={16} className="text-emerald-400" />
              <h2 className="text-[15px] font-semibold tracking-tight text-[var(--grand-fg)]">{title}</h2>
            </div>
            <p className="text-[12.5px] text-[var(--grand-muted)] mt-1 leading-relaxed">
              {disabled && disabledHint ? disabledHint : subtitle}
            </p>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {!disabled && children}
    </section>
  )
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md bg-[var(--grand-surface-2)] px-4 py-7 text-center text-[13px] text-[var(--grand-muted)]">
      {children}
    </div>
  )
}
