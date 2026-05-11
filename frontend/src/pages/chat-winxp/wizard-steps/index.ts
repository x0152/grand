import type { ComponentType } from 'react'
import type { StepId } from '../../wizard/types'
import type { WizardController } from './useWizardController'

import { ProviderStep } from './ProviderStep'
import { OpenAIStep } from './OpenAIStep'
import { WalletChoiceStep } from './WalletChoiceStep'
import { WalletImportStep } from './WalletImportStep'
import { WalletCreateStep } from './WalletCreateStep'
import { WalletRevealStep } from './WalletRevealStep'
import { WalletBalanceStep } from './WalletBalanceStep'
import { GonkaModelsStep } from './GonkaModelsStep'
import { TelegramStep } from './TelegramStep'
import { EmailStep } from './EmailStep'
import { FinishStep } from './FinishStep'

export interface StepDef {
  heading: string | null
  Component: ComponentType<{ ctrl: WizardController }>
  ownsLayout?: boolean
  hideNext?: boolean
}

export const STEP_REGISTRY: Record<StepId, StepDef> = {
  provider: { heading: 'Where should your AI live?', Component: ProviderStep },
  openai: { heading: 'Connect your AI', Component: OpenAIStep },
  'wallet-choice': { heading: 'Get a Gonka wallet', Component: WalletChoiceStep },
  'wallet-import': { heading: 'Plug in your wallet', Component: WalletImportStep, hideNext: true },
  'wallet-create': { heading: 'Create a new wallet', Component: WalletCreateStep, hideNext: true },
  'wallet-reveal': { heading: 'Your secret words', Component: WalletRevealStep },
  'wallet-balance': { heading: 'Add some GNK', Component: WalletBalanceStep },
  'gonka-models': { heading: 'Pick your models', Component: GonkaModelsStep },
  telegram: { heading: 'Add Telegram', Component: TelegramStep },
  email: { heading: 'Connect your mailbox', Component: EmailStep },
  finish: { heading: null, Component: FinishStep, ownsLayout: true },
}
