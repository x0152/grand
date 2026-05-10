import type { ConfigSource, GonkaBalance, TelegramWizardUser } from '@/types'

export type Provider = 'openai' | 'gonka'
export type WalletMode = 'create' | 'import'
export type WalletImportMode = 'mnemonic' | 'private-key'
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
  | 'email'
  | 'finish'

export interface State {
  provider: Provider
  openaiBaseUrl: string
  openaiApiKey: string
  openaiApiKeyKnown: boolean
  modelRows: ModelRow[]
  walletMode: WalletMode
  walletImportMode: WalletImportMode
  gonkaNodeUrl: string
  gonkaPrivateKey: string
  gonkaPrivateKeyKnown: boolean
  gonkaMnemonicInput: string
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
  emailAddress: string
  emailSmtpHost: string
  emailSmtpPort: string
  emailSmtpUsername: string
  emailSmtpPassword: string
  emailSmtpPasswordKnown: boolean
  emailImapHost: string
  emailImapPort: string
  emailImapUsername: string
  emailImapPassword: string
  emailImapPasswordKnown: boolean
  emailSkip: boolean
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
