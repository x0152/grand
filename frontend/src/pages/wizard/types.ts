import type { ConfigSource, GonkaBalance, TelegramWizardUser } from '@/types'

export type Provider = 'openai' | 'gonka'
export type WalletMode = 'create' | 'import'
export type ModelRow = { name: string; role: 'chat' | 'summary' | 'vision' | '' }
export type WizardMode = 'full' | 'resume'

export type StepId =
  | 'provider'
  | 'openai'
  | 'wallet-choice'
  | 'wallet-import'
  | 'wallet-create'
  | 'wallet-reveal'
  | 'wallet-balance'
  | 'gonka-models'
  | 'telegram'
  | 'finish'

export interface State {
  provider: Provider
  openaiBaseUrl: string
  openaiApiKey: string
  openaiApiKeyKnown: boolean
  modelRows: ModelRow[]
  walletMode: WalletMode
  gonkaNodeUrl: string
  gonkaPrivateKey: string
  gonkaPrivateKeyKnown: boolean
  gonkaAddress: string
  gonkaMnemonicWords: string[]
  mnemonicAcknowledged: boolean
  bypassBalance: boolean
  gonkaBalance: GonkaBalance | null
  tgToken: string
  tgTokenKnown: boolean
  tgLinkedUser: TelegramWizardUser | null
  tgAllowedUserIds: number[]
  tgSkip: boolean
}

export interface StepMeta {
  title: string
  subtitle: string
}

export interface StepStatus {
  id: StepId
  done: boolean
  source: ConfigSource
  optional: boolean
}
