import type { StepId } from '../types'

interface StepperProps {
  path: StepId[]
  stepId: StepId
}

export function Stepper({ path, stepId }: StepperProps) {
  const idx = Math.max(0, path.indexOf(stepId))
  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-valuenow={idx + 1}
      aria-valuemin={1}
      aria-valuemax={path.length}
    >
      {path.map((id, i) => {
        const state =
          i === idx ? 'active' : i < idx ? 'done' : 'todo'
        return (
          <span
            key={id}
            className={`h-1.5 rounded-full transition-all ${
              state === 'active'
                ? 'w-7 bg-emerald-500'
                : state === 'done'
                  ? 'w-2 bg-emerald-500/55'
                  : 'w-2 bg-[var(--grand-line)]'
            }`}
          />
        )
      })}
    </div>
  )
}
