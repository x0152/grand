import type { GonkaConfig } from '@/types'
import type { StepId, State, WizardMode } from './types'
import type { WizardStatus } from './status'

export interface BuildPathOptions {
  state: State
  gonkaConfig: GonkaConfig | null
  mode: WizardMode
  status?: WizardStatus
}

export function buildPath({ state, gonkaConfig, mode, status }: BuildPathOptions): StepId[] {
  const full = buildFullPath(state, gonkaConfig)
  if (mode === 'full' || !status || status.steps.length === 0) {
    return full
  }
  const doneByStep = new Map<StepId, boolean>(status.steps.map(s => [s.id, s.done]))
  const filtered = full.filter(id => {
    if (id === 'finish') return true
    const done = doneByStep.get(id)
    if (done === undefined) return true
    return !done
  })
  return filtered.length > 1 ? filtered : full
}

function buildFullPath(state: State, gonkaConfig: GonkaConfig | null): StepId[] {
  if (state.provider === 'openai') {
    return ['provider', 'openai', 'telegram', 'finish']
  }
  const path: StepId[] = ['provider', 'wallet-choice']
  if (state.walletMode === 'create') {
    path.push('wallet-create')
    if (gonkaConfig?.inferencedAvailable) {
      path.push('wallet-reveal')
    }
  } else {
    path.push('wallet-import')
  }
  path.push('wallet-balance', 'gonka-models', 'telegram', 'finish')
  return path
}
