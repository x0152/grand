import type { Ref } from 'react'

interface Props {
  isFirst: boolean
  isLast: boolean
  canBack: boolean
  canNext: boolean
  submitting: boolean
  showNext: boolean
  onBack: () => void
  onNext: () => void
  onComplete: () => void
  onCancel: () => void
  nextRef?: Ref<HTMLButtonElement>
  finishRef?: Ref<HTMLButtonElement>
}

export function WizardFooter({
  isLast,
  canBack,
  canNext,
  submitting,
  showNext,
  onBack,
  onNext,
  onComplete,
  onCancel,
  nextRef,
  finishRef,
}: Props) {
  return (
    <div className="xp-wizard-footer">
      <div className="xp-wizard-footer-rule" aria-hidden />
      <div className="xp-wizard-actions">
        <button className="xp-wizard-btn" disabled={!canBack} onClick={onBack}>
          <span className="xp-wizard-btn-arrow">&lt;</span> Back
        </button>
        {showNext && !isLast && (
          <button
            ref={nextRef}
            className="xp-wizard-btn xp-wizard-btn-default"
            onClick={onNext}
            disabled={!canNext}
          >
            Next <span className="xp-wizard-btn-arrow">&gt;</span>
          </button>
        )}
        {isLast && (
          <button
            ref={finishRef}
            className="xp-wizard-btn xp-wizard-btn-default"
            onClick={onComplete}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Finish'}
          </button>
        )}
        <button className="xp-wizard-btn xp-wizard-btn-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
