import type { StepId, StepMeta } from './types'
import { MIN_BALANCE_GNK } from './seeds'

export function stepMeta(stepId: StepId): StepMeta {
  switch (stepId) {
    case 'provider':
      return {
        title: 'Where should your AI live?',
        subtitle: 'Two ways to power GRAND. Pick the one that fits — you can switch any time.',
      }
    case 'openai':
      return {
        title: 'Connect your AI',
        subtitle: 'Tell GRAND where to send your messages and which models to use.',
      }
    case 'wallet-choice':
      return {
        title: 'Get a Gonka wallet',
        subtitle: 'Pay-per-call needs a wallet. Brand new? We’ll create one. Have one? Plug it in.',
      }
    case 'wallet-import':
      return {
        title: 'Plug in your wallet',
        subtitle: 'Paste the recovery phrase from Keplr, Cosmostation or Leap.',
      }
    case 'wallet-create':
      return {
        title: 'Create a new wallet',
        subtitle: 'One tap and you’re done. We’ll show the secret words right after.',
      }
    case 'wallet-reveal':
      return {
        title: 'Your secret words',
        subtitle: 'Write them down somewhere safe. They’re the only way to recover this wallet.',
      }
    case 'wallet-balance':
      return {
        title: 'Add some GNK',
        subtitle: `Scan the QR or copy the address below. Send at least ${MIN_BALANCE_GNK} GNK — we’ll auto-detect it.`,
      }
    case 'gonka-models':
      return {
        title: 'Pick your models',
        subtitle: 'One chat model is required. Summary and vision are nice-to-haves.',
      }
    case 'telegram':
      return {
        title: 'Add Telegram',
        subtitle: 'Paste your bot token, send a code from your Telegram — we’ll link the account.',
      }
    case 'email':
      return {
        title: 'Connect your mailbox',
        subtitle: 'Pick your email provider — we’ll guide you through generating an app password.',
      }
    case 'finish':
      return {
        title: 'You’re all set',
        subtitle: 'Here’s what we’ll save. Tap Open GRAND to start your first chat.',
      }
  }
}
