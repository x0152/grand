import type { ReactNode } from 'react'
import type { IconComponent } from '@/lib/icons'

interface AppleHeroProps {
  icon?: IconComponent
  iconNode?: ReactNode
  tone?: 'emerald' | 'rose' | 'amber' | 'sky'
}

const toneBg: Record<NonNullable<AppleHeroProps['tone']>, string> = {
  emerald:
    'bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-700 shadow-[0_24px_60px_-20px_rgba(16,185,129,0.55)]',
  rose:
    'bg-gradient-to-br from-rose-300 via-rose-500 to-rose-700 shadow-[0_24px_60px_-20px_rgba(244,63,94,0.55)]',
  amber:
    'bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-[0_24px_60px_-20px_rgba(245,158,11,0.55)]',
  sky:
    'bg-gradient-to-br from-sky-300 via-sky-500 to-sky-700 shadow-[0_24px_60px_-20px_rgba(14,165,233,0.55)]',
}

export function AppleHero({ icon: Icon, iconNode, tone = 'emerald' }: AppleHeroProps) {
  return (
    <div className="flex justify-center">
      <div
        className={`size-20 rounded-3xl flex items-center justify-center text-white ${toneBg[tone]}`}
      >
        {iconNode ?? (Icon ? <Icon size={42} weight="duotone" /> : null)}
      </div>
    </div>
  )
}
