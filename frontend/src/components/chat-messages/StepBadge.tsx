import { AlertCircle, CheckCircle2, Loader2, Square, Wrench } from '@/lib/icons'
import { navigate } from '../../router'
import type { Step } from '../../types'
import { STEP_ICONS, planIdFromStepArgs, stepArgsSummary } from './stepHelpers'
import { useTicker } from './useTicker'
import { fmtElapsed } from './utils'

export function StepBadge({ step, onClick }: { step: Step; onClick: () => void }) {
  const Icon = STEP_ICONS[step.icon] ?? Wrench
  const isRunning = step.status === 'running'
  const isError = step.status === 'error'
  const isCancelled = step.status === 'cancelled'
  const argSummary = stepArgsSummary(step)

  useTicker(isRunning)
  const startMs = step.startedAt ? new Date(step.startedAt).getTime() : 0
  const endMs = step.finishedAt ? new Date(step.finishedAt).getTime() : Date.now()
  const elapsed = startMs > 0 ? endMs - startMs : 0
  const showElapsed = elapsed >= 300 || isRunning

  const planId = !isRunning ? planIdFromStepArgs(step) : undefined
  const handleClick = () => {
    if (planId) navigate({ page: 'plans', planId })
    onClick()
  }

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-start gap-2 px-2.5 py-1.5 rounded-md border font-mono text-[12px] tracking-tight cursor-pointer transition-colors max-w-full text-left step-enter ${
        isRunning
          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-400/40 step-running'
          : isError
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/40'
            : isCancelled
              ? 'bg-[var(--grand-bg)] text-[var(--grand-muted-2)] border-[var(--grand-border)] line-through decoration-[var(--grand-muted-2)]'
              : 'bg-[var(--grand-bg)] text-[var(--grand-fg)] border-[var(--grand-border)] hover:border-emerald-400/60 hover:text-emerald-400'
      }`}
    >
      {isRunning ? (
        <Loader2 size={13} className="animate-spin shrink-0 mt-0.5" />
      ) : isError ? (
        <AlertCircle size={13} className="shrink-0 mt-0.5" />
      ) : isCancelled ? (
        <Square size={12} className="fill-current opacity-70 shrink-0 mt-0.5" />
      ) : (
        <Icon size={13} className="shrink-0 mt-0.5" />
      )}
      <span className="break-words whitespace-normal leading-snug min-w-0 flex-1">
        {step.label}
        {argSummary && <span className="ml-1.5 opacity-60">{argSummary}</span>}
      </span>
      {showElapsed && (
        <span className="opacity-70 tabular-nums shrink-0 mt-0.5">{fmtElapsed(elapsed)}</span>
      )}
      {!isRunning && !isError && !isCancelled && <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />}
    </button>
  )
}
