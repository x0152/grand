import type { StepId } from '../types'
import { stepMeta } from '../stepMeta'

export function ProgressBar({ path, stepId }: { path: StepId[]; stepId: StepId }) {
  const idx = Math.max(0, path.indexOf(stepId))
  const total = Math.max(path.length, 1)
  const progress = ((idx + 1) / total) * 100
  return (
    <div
      className="relative h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      role="progressbar"
      aria-valuenow={idx + 1}
      aria-valuemin={1}
      aria-valuemax={total}
    >
      <div
        className="h-full rounded-full bg-teal-500/80 transition-[width] duration-500 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export function StepIntro({ path, stepId }: { path: StepId[]; stepId: StepId }) {
  const meta = stepMeta(stepId)
  const idx = Math.max(0, path.indexOf(stepId))
  const total = Math.max(path.length, 1)
  return (
    <div className="space-y-2">
      <div className="kicker">
        <span>step {idx + 1} of {total}</span>
      </div>
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{meta.title}</h2>
        <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{meta.subtitle}</p>
      </div>
    </div>
  )
}

export function StepHeader({ path, stepId }: { path: StepId[]; stepId: StepId }) {
  return (
    <div className="space-y-2">
      <ProgressBar path={path} stepId={stepId} />
      <StepIntro path={path} stepId={stepId} />
    </div>
  )
}
