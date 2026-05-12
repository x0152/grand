import { useEffect, useRef } from 'react'
import type { StepId } from '../wizard/types'
import { openExternal } from '../wizard/utils'
import { useDraggable, type Position } from './useDraggable'
import type { Size } from './useResizable'
import { useWizardController } from './wizard-steps/useWizardController'
import { STEP_REGISTRY } from './wizard-steps'
import { WizardFooter } from './wizard-steps/WizardFooter'

const GONKA_LINK_STEPS: ReadonlySet<StepId> = new Set<StepId>([
  'provider',
  'wallet-choice',
  'wallet-create',
  'wallet-import',
  'wallet-reveal',
  'wallet-balance',
  'gonka-models',
])

interface Props {
  position: Position
  size: Size
  zIndex: number
  active: boolean
  onActivate: () => void
  onMove: (next: Position) => void
  onClose: () => void
  onDone?: () => void
}

export function WinXpWizard({
  position,
  size,
  zIndex,
  active,
  onActivate,
  onMove,
  onClose,
  onDone,
}: Props) {
  const dragHandle = useDraggable(position, onMove, onActivate)
  const nextRef = useRef<HTMLButtonElement>(null)
  const finishRef = useRef<HTMLButtonElement>(null)

  const ctrl = useWizardController({ onDone: onDone ?? onClose })

  useEffect(() => {
    if (ctrl.isLast) finishRef.current?.focus()
    else nextRef.current?.focus()
  }, [ctrl.stepId, ctrl.isLast])

  const stepDef = STEP_REGISTRY[ctrl.stepId]
  const StepComponent = stepDef.Component
  const showNext = !stepDef.hideNext
  const showGonkaLink = GONKA_LINK_STEPS.has(ctrl.stepId)

  return (
    <div
      className="xp-window-wrap xp-wizard-wrap"
      style={{
        left: position.left,
        top: position.top,
        width: size.width,
        height: size.height,
        zIndex,
      }}
      onMouseDown={onActivate}
    >
      <div className="window xp-wizard">
        <div className={`title-bar ${active ? '' : 'inactive'}`} {...dragHandle}>
          <div className="title-bar-text">GRAND Setup Wizard</div>
          <div className="title-bar-controls">
            <button aria-label="Close" onClick={onClose} />
          </div>
        </div>
        <div className="window-body xp-wizard-body">
          <div className="xp-wizard-sidebar" role="presentation">
            {showGonkaLink && (
              <a
                className="xp-wizard-sidebar-link"
                href="https://gonka.ai"
                target="_blank"
                rel="noopener noreferrer"
                title="Learn about the Gonka decentralized inference network"
                onMouseDown={e => e.stopPropagation()}
                onClick={openExternal('https://gonka.ai')}
              >
                <span className="xp-wizard-sidebar-link-eyebrow">Need a primer?</span>
                <span className="xp-wizard-sidebar-link-title">What is Gonka?</span>
                <span className="xp-wizard-sidebar-link-host">gonka.ai &rsaquo;</span>
              </a>
            )}
          </div>
          <div className="xp-wizard-content">
            {stepDef.heading && (
              <h2 className="xp-wizard-step-heading">{stepDef.heading}</h2>
            )}
            {ctrl.state ? (
              <StepComponent ctrl={ctrl} />
            ) : (
              <p className="xp-wizard-prose">Loading setup…</p>
            )}
            {ctrl.error && <div className="xp-wizard-error">{ctrl.error}</div>}
          </div>
        </div>
        <WizardFooter
          isFirst={ctrl.isFirst}
          isLast={ctrl.isLast}
          canBack={ctrl.canBack}
          canNext={ctrl.canNext}
          submitting={ctrl.submitting}
          showNext={showNext}
          onBack={ctrl.goBack}
          onNext={ctrl.goNext}
          onComplete={ctrl.onComplete}
          onCancel={onClose}
          nextRef={nextRef}
          finishRef={finishRef}
        />
      </div>
    </div>
  )
}
