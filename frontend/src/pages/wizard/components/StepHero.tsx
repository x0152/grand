import type { ReactNode } from 'react'
import { stepMeta } from '../stepMeta'
import type { StepId } from '../types'
import { AppleHeader } from './apple/AppleHeader'

interface StepHeroProps {
  stepId: StepId
  align?: 'center' | 'left'
  title?: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  hero?: ReactNode
}

export function StepHero({ stepId, align = 'center', title, subtitle, eyebrow, hero }: StepHeroProps) {
  const meta = stepMeta(stepId)
  return (
    <div className="space-y-6">
      {hero && <div className="flex justify-center">{hero}</div>}
      <AppleHeader
        eyebrow={eyebrow}
        title={title ?? meta.title}
        subtitle={subtitle ?? meta.subtitle}
        align={align}
      />
    </div>
  )
}
