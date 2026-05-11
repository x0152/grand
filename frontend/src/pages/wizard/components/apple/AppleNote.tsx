import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, ShieldAlert, Sparkles, type IconComponent } from '@/lib/icons'

export type NoteTone = 'info' | 'success' | 'warning' | 'danger'

interface AppleNoteProps {
  tone?: NoteTone
  title?: ReactNode
  children: ReactNode
  icon?: IconComponent
}

const palette: Record<NoteTone, { ring: string; bg: string; iconCls: string; titleCls: string }> = {
  info: {
    ring: 'ring-emerald-500/25',
    bg: 'bg-emerald-500/[0.04]',
    iconCls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    titleCls: 'text-emerald-700 dark:text-emerald-400',
  },
  success: {
    ring: 'ring-emerald-500/30',
    bg: 'bg-emerald-500/[0.06]',
    iconCls: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    titleCls: 'text-emerald-700 dark:text-emerald-400',
  },
  warning: {
    ring: 'ring-amber-500/30',
    bg: 'bg-amber-500/[0.06]',
    iconCls: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    titleCls: 'text-amber-700 dark:text-amber-400',
  },
  danger: {
    ring: 'ring-rose-500/30',
    bg: 'bg-rose-500/[0.06]',
    iconCls: 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
    titleCls: 'text-rose-700 dark:text-rose-400',
  },
}

const defaultIcons: Record<NoteTone, IconComponent> = {
  info: Sparkles,
  success: CheckCircle2,
  warning: ShieldAlert,
  danger: AlertCircle,
}

export function AppleNote({ tone = 'info', title, children, icon }: AppleNoteProps) {
  const p = palette[tone]
  const Icon = icon ?? defaultIcons[tone]
  return (
    <div className={`rounded-2xl ring-1 px-5 py-4 flex items-start gap-3.5 ${p.ring} ${p.bg}`}>
      <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${p.iconCls}`}>
        <Icon size={18} weight="fill" />
      </div>
      <div className="min-w-0 flex-1">
        {title && (
          <div className={`text-[14.5px] font-semibold tracking-tight ${p.titleCls}`}>{title}</div>
        )}
        <div
          className={`text-[13.5px] leading-relaxed text-[var(--grand-fg-2)] ${title ? 'mt-1' : ''}`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
