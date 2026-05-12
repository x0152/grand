import type { ReactNode } from 'react'
import { ArrowLeft } from '@/lib/icons'
import { AppleAction } from './apple/AppleAction'

interface PinnedActionProps {
  primary?: {
    label: ReactNode
    onClick: () => void
    disabled?: boolean
    busy?: boolean
  }
  secondary?: {
    label: ReactNode
    onClick: () => void
    disabled?: boolean
  }
  hint?: ReactNode
  showBack: boolean
  onBack: () => void
}

export function PinnedAction({ primary, secondary, hint, showBack, onBack }: PinnedActionProps) {
  if (!primary && !secondary && !showBack) return null
  return (
    <div className="shrink-0 border-t border-[var(--grand-border-2)] bg-[var(--grand-bg)]/95 backdrop-blur">
      <div className="max-w-lg mx-auto px-6 pt-5 pb-6 space-y-3">
        {primary && (
          <AppleAction
            variant="primary"
            fullWidth
            disabled={primary.disabled || primary.busy}
            onClick={primary.onClick}
          >
            {primary.busy ? 'Initializing…' : primary.label}
          </AppleAction>
        )}
        {secondary && (
          <AppleAction
            variant="secondary"
            fullWidth
            disabled={secondary.disabled}
            onClick={secondary.onClick}
          >
            {secondary.label}
          </AppleAction>
        )}
        <div className="flex items-center justify-between gap-3 min-h-[20px]">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-[13.5px] text-[var(--grand-muted)] hover:text-[var(--grand-fg)] transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>
          ) : (
            <span />
          )}
          {hint && (
            <span className="text-[12.5px] text-[var(--grand-muted-2)] text-right">{hint}</span>
          )}
        </div>
      </div>
    </div>
  )
}
