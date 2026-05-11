import { CheckCircle2 } from '@/lib/icons'
import type { State, StepId } from '../types'
import { MIN_BALANCE_GNK } from '../seeds'
import { PinnedAction } from './PinnedAction'

interface NavBarProps {
  stepId: StepId
  canBack: boolean
  onBack: () => void
  onNext: () => void
  onComplete: () => void
  submitting: boolean
  state: State
}

const STEPS_WITH_INLINE_ACTION: StepId[] = [
  'wallet-create',
  'wallet-import',
]

export function NavBar({ stepId, canBack, onBack, onNext, onComplete, submitting, state }: NavBarProps) {
  const inlineAction = STEPS_WITH_INLINE_ACTION.includes(stepId)

  if (inlineAction) {
    if (!canBack) return null
    return <PinnedAction showBack onBack={onBack} />
  }

  if (stepId === 'finish') {
    return (
      <PinnedAction
        showBack={canBack}
        onBack={onBack}
        primary={{
          label: (
            <>
              <CheckCircle2 size={16} weight="fill" /> Open GRAND
            </>
          ),
          onClick: onComplete,
          busy: submitting,
        }}
      />
    )
  }

  const nextDisabled = isNextDisabled(stepId, state)
  return (
    <PinnedAction
      showBack={canBack}
      onBack={onBack}
      primary={{ label: 'Continue', onClick: onNext, disabled: nextDisabled }}
    />
  )
}

function isNextDisabled(stepId: StepId, state: State): boolean {
  switch (stepId) {
    case 'provider':
      return !state.provider
    case 'openai': {
      const hasChat = state.modelRows.some(r => r.role === 'chat' && r.name.trim())
      return !state.openaiBaseUrl.trim() || !hasChat
    }
    case 'wallet-choice':
      return !state.walletMode
    case 'wallet-create':
    case 'wallet-import':
      return true
    case 'wallet-reveal':
      return !state.mnemonicAcknowledged
    case 'wallet-balance':
      return !state.bypassBalance && !hasEnoughBalance(state)
    case 'gonka-models': {
      const hasChat = state.modelRows.some(r => r.role === 'chat' && r.name.trim())
      return !hasChat
    }
    case 'telegram': {
      if (state.tgSkip || state.tgLinkedUser) return false
      if (state.tgTokenKnown) return false
      return true
    }
    case 'email': {
      if (state.emailSkip) return false
      const hasAddress = !!state.emailAddress.trim()
      const hasSmtp = !!state.emailSmtpHost.trim() && (state.emailSmtpPasswordKnown || !!state.emailSmtpPassword.trim())
      const hasImap = !!state.emailImapHost.trim() && (state.emailImapPasswordKnown || !!state.emailImapPassword.trim())
      return !(hasAddress && (hasSmtp || hasImap))
    }
    case 'finish':
      return false
  }
}

function hasEnoughBalance(state: State): boolean {
  return !!state.gonkaBalance && state.gonkaBalance.gnk >= MIN_BALANCE_GNK
}
