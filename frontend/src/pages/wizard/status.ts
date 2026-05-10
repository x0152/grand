import type { GlobalConfig } from '@/types'
import type { StepStatus, StepId } from './types'

export interface WizardStatus {
  steps: StepStatus[]
  done: boolean
  firstMissing: StepId | null
}

export function deriveStatus(config: GlobalConfig | null): WizardStatus {
  if (!config) {
    return { steps: [], done: false, firstMissing: null }
  }
  const provider = config.provider.value
  const steps: StepStatus[] = []
  // Setup is considered complete only after the provider choice is saved in DB.
  // Env/default values are treated as prefill and still require finishing wizard.
  const providerDone = config.provider.source === 'db'
  steps.push({ id: 'provider', done: providerDone, source: config.provider.source, optional: false })

  if (provider === 'openai') {
    const baseDone = config.openai.baseUrl.source !== 'unset'
    const keyDone = config.openai.apiKey.set
    const hasChat = config.models.some(m => m.role === 'chat' && m.name.trim() !== '')
    steps.push({
      id: 'openai',
      done: baseDone && keyDone && hasChat,
      source: pickSource([config.openai.baseUrl.source, config.openai.apiKey.source]),
      optional: false,
    })
  } else if (provider === 'gonka') {
    const nodeDone = config.gonka.nodeUrl.source !== 'unset'
    const keyDone = config.gonka.privateKey.set
    const hasChat = config.models.some(m => m.role === 'chat' && m.name.trim() !== '')
    steps.push({
      id: 'wallet-choice',
      done: nodeDone && keyDone,
      source: pickSource([config.gonka.nodeUrl.source, config.gonka.privateKey.source]),
      optional: false,
    })
    steps.push({
      id: 'gonka-models',
      done: hasChat,
      source: hasChat ? 'db' : 'unset',
      optional: false,
    })
  }

  const tgDone = config.telegram.token.set
  steps.push({
    id: 'telegram',
    done: tgDone,
    source: config.telegram.source,
    optional: true,
  })

  const emailDone = config.email.smtpPassword.set || config.email.imapPassword.set
  steps.push({
    id: 'email',
    done: emailDone,
    source: config.email.source,
    optional: true,
  })

  const requiredDone = steps.every(s => s.optional || s.done)
  const firstMissing = steps.find(s => !s.optional && !s.done)?.id ?? null
  return { steps, done: requiredDone, firstMissing }
}

function pickSource(sources: GlobalConfig['provider']['source'][]): GlobalConfig['provider']['source'] {
  if (sources.some(s => s === 'db')) return 'db'
  if (sources.some(s => s === 'env')) return 'env'
  if (sources.some(s => s === 'default')) return 'default'
  return 'unset'
}
