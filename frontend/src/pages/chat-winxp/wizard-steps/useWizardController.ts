import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api'
import type { GlobalConfig, GlobalConfigDraft, GonkaConfig, ProviderModel } from '@/types'
import type {
  ModelRow,
  Provider,
  State,
  StepId,
  WalletImportMode,
  WalletMode,
} from '../../wizard/types'
import { DEFAULT_GONKA_NODE, MIN_BALANCE_GNK } from '../../wizard/seeds'
import { buildPath } from '../../wizard/path'

export interface WizardController {
  state: State | null
  update: <K extends keyof State>(key: K, value: State[K]) => void
  stepId: StepId
  path: StepId[]
  currentIdx: number
  isFirst: boolean
  isLast: boolean
  canBack: boolean
  canNext: boolean
  submitting: boolean
  error: string
  gonkaConfig: GonkaConfig | null
  availableModels: ProviderModel[] | null
  loadingModels: boolean
  modelsError: string
  goNext: () => void
  goBack: () => void
  goTo: (next: StepId) => void
  onProviderSelect: (p: Provider) => void
  onWalletModeSelect: (m: WalletMode) => void
  onWalletImportModeSelect: (m: WalletImportMode) => void
  onCreateWallet: () => Promise<void>
  onUseExisting: () => Promise<void>
  loadModels: (provider: Provider, baseUrl: string, apiKey: string) => Promise<ProviderModel[]>
  onReloadGonkaModels: () => Promise<void>
  onComplete: () => Promise<void>
  minBalance: number
}

interface Options {
  onDone: () => void
}

export function useWizardController({ onDone }: Options): WizardController {
  const [state, setState] = useState<State | null>(null)
  const [stepId, setStepId] = useState<StepId>('provider')
  const [gonkaConfig, setGonkaConfig] = useState<GonkaConfig | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [availableModels, setAvailableModels] = useState<ProviderModel[] | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([api.config.get(), api.gonka.config().catch(() => null)]).then(([cfg, gonka]) => {
      if (cancelled) return
      const fallback = gonka?.defaultNodeUrl || DEFAULT_GONKA_NODE
      setGonkaConfig(
        gonka ?? {
          defaultNodeUrl: fallback,
          inferencedAvailable: false,
          minBalanceGnk: String(MIN_BALANCE_GNK),
        },
      )
      const initial = buildInitialState(cfg, fallback)
      setState(initial)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback(<K extends keyof State>(key: K, value: State[K]) => {
    setState(prev => (prev ? { ...prev, [key]: value } : prev))
  }, [])

  const loadModels = useCallback(
    async (provider: Provider, baseUrl: string, apiKey: string): Promise<ProviderModel[]> => {
      if (!baseUrl.trim()) {
        setModelsError('Fill in the server URL first.')
        return []
      }
      setLoadingModels(true)
      setModelsError('')
      const tempId = `xp-wizard-${provider}-${Date.now()}`
      try {
        await api.llmConnections.create({
          id: tempId,
          provider,
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
        })
        try {
          const list = await api.llmConnections.listAvailableModels(tempId)
          setAvailableModels(list)
          return list
        } finally {
          await api.llmConnections.delete(tempId).catch(() => {})
        }
      } catch (e) {
        setModelsError(e instanceof Error ? e.message : 'Could not load models')
        return []
      } finally {
        setLoadingModels(false)
      }
    },
    [],
  )

  useEffect(() => {
    setAvailableModels(null)
    setModelsError('')
  }, [state?.provider])

  const openaiBaseUrl = state?.openaiBaseUrl ?? ''
  const openaiApiKey = state?.openaiApiKey ?? ''
  useEffect(() => {
    if (stepId !== 'openai') return
    const url = openaiBaseUrl.trim()
    if (!url) return
    const handle = setTimeout(() => {
      void (async () => {
        const list = await loadModels('openai', url, openaiApiKey)
        setState(prev => (prev ? autoFillFirstModel(prev, list) : prev))
      })()
    }, 700)
    return () => clearTimeout(handle)
  }, [stepId, openaiBaseUrl, openaiApiKey, loadModels])

  const gonkaAutoLoadedRef = useRef(false)
  useEffect(() => {
    if (!state) return
    if (stepId !== 'gonka-models') return
    if (gonkaAutoLoadedRef.current) return
    if (availableModels !== null || loadingModels) return
    if (!state.gonkaNodeUrl.trim() || !state.gonkaPrivateKey.trim()) return
    gonkaAutoLoadedRef.current = true
    void (async () => {
      const list = await loadModels('gonka', state.gonkaNodeUrl, state.gonkaPrivateKey)
      setState(prev => (prev ? autoFillFirstModel(prev, list) : prev))
    })()
  }, [state, stepId, availableModels, loadingModels, loadModels])

  useEffect(() => {
    gonkaAutoLoadedRef.current = false
  }, [state?.provider, state?.gonkaNodeUrl, state?.gonkaPrivateKey])

  const path = useMemo(() => {
    if (!state) return [] as StepId[]
    return buildPath({ state, gonkaConfig, mode: 'full' })
  }, [state, gonkaConfig])

  const currentIdx = state ? Math.max(0, path.indexOf(stepId)) : 0
  const isFirst = currentIdx === 0
  const isLast = stepId === 'finish'
  const canBack = currentIdx > 0 && stepId !== 'wallet-reveal'
  const canNext = state ? !isNextDisabled(stepId, state) : false

  const goTo = useCallback((next: StepId) => {
    setError('')
    setStepId(next)
  }, [])

  const goNext = useCallback(() => {
    setError('')
    const next = path[currentIdx + 1]
    if (next) setStepId(next)
  }, [path, currentIdx])

  const goBack = useCallback(() => {
    setError('')
    const prev = path[currentIdx - 1]
    if (prev) setStepId(prev)
  }, [path, currentIdx])

  const onProviderSelect = useCallback((p: Provider) => {
    setState(prev => {
      if (!prev) return prev
      if (prev.provider === p) return prev
      return { ...prev, provider: p, modelRows: [{ name: '', role: 'chat' }] }
    })
  }, [])

  const onWalletModeSelect = useCallback((walletMode: WalletMode) => {
    update('walletMode', walletMode)
  }, [update])

  const onWalletImportModeSelect = useCallback((m: WalletImportMode) => {
    update('walletImportMode', m)
  }, [update])

  const onCreateWallet = useCallback(async () => {
    setSubmitting(true)
    setError('')
    try {
      const wallet = await api.gonka.createWallet()
      setState(prev =>
        prev
          ? {
              ...prev,
              gonkaPrivateKey: wallet.privateKeyHex,
              gonkaPrivateKeyKnown: true,
              gonkaAddress: wallet.address,
              gonkaMnemonicWords: wallet.words,
              mnemonicAcknowledged: false,
            }
          : prev,
      )
      setStepId('wallet-reveal')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet creation failed')
    } finally {
      setSubmitting(false)
    }
  }, [])

  const onUseExisting = useCallback(async () => {
    if (!state) return
    setSubmitting(true)
    setError('')
    try {
      if (state.walletImportMode === 'mnemonic') {
        const wallet = await api.gonka.importWallet(state.gonkaMnemonicInput)
        setState(prev =>
          prev
            ? {
                ...prev,
                gonkaPrivateKey: wallet.privateKeyHex,
                gonkaPrivateKeyKnown: true,
                gonkaAddress: wallet.address,
                gonkaMnemonicWords: wallet.words,
              }
            : prev,
        )
      } else {
        const { address } = await api.gonka.deriveAddress(state.gonkaPrivateKey.trim())
        setState(prev =>
          prev ? { ...prev, gonkaAddress: address, gonkaPrivateKeyKnown: true } : prev,
        )
      }
      setStepId('wallet-balance')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect that wallet')
    } finally {
      setSubmitting(false)
    }
  }, [state])

  const onReloadGonkaModels = useCallback(async () => {
    if (!state) return
    const list = await loadModels('gonka', state.gonkaNodeUrl, state.gonkaPrivateKey)
    setState(prev => (prev ? autoFillFirstModel(prev, list) : prev))
  }, [state, loadModels])

  const onComplete = useCallback(async () => {
    if (!state) return
    setSubmitting(true)
    setError('')
    try {
      await api.config.update(buildDraft(state))
      await api.config.apply()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed')
    } finally {
      setSubmitting(false)
    }
  }, [state, onDone])

  return {
    state,
    update,
    stepId,
    path,
    currentIdx,
    isFirst,
    isLast,
    canBack,
    canNext,
    submitting,
    error,
    gonkaConfig,
    availableModels,
    loadingModels,
    modelsError,
    goNext,
    goBack,
    goTo,
    onProviderSelect,
    onWalletModeSelect,
    onWalletImportModeSelect,
    onCreateWallet,
    onUseExisting,
    loadModels,
    onReloadGonkaModels,
    onComplete,
    minBalance: MIN_BALANCE_GNK,
  }
}

function buildInitialState(cfg: GlobalConfig, defaultGonkaNode: string): State {
  const provider = (cfg.provider.value || 'openai') as Provider
  const linkedFromConfig = (cfg.telegram.allowedUserIds ?? [])[0]
  return {
    provider,
    openaiBaseUrl: cfg.openai.baseUrl.value,
    openaiApiKey: cfg.openai.apiKey.value || '',
    openaiApiKeyKnown: cfg.openai.apiKey.set,
    modelRows: cfg.models.length
      ? cfg.models.map(m => ({ name: m.name, role: m.role }))
      : [{ name: '', role: 'chat' }],
    walletMode: 'create',
    walletImportMode: 'mnemonic',
    gonkaNodeUrl: cfg.gonka.nodeUrl.value || defaultGonkaNode,
    gonkaPrivateKey: '',
    gonkaPrivateKeyKnown: cfg.gonka.privateKey.set,
    gonkaMnemonicInput: '',
    gonkaAddress: '',
    gonkaMnemonicWords: [],
    mnemonicAcknowledged: false,
    bypassBalance: false,
    gonkaBalance: null,
    tgToken: cfg.telegram.token.value || '',
    tgTokenKnown: cfg.telegram.token.set,
    tgLinkedUser: linkedFromConfig ? { id: linkedFromConfig, name: '' } : null,
    tgAllowedUserIds: cfg.telegram.allowedUserIds ?? [],
    tgSkip: cfg.telegram.skipped,
    emailAddress: cfg.email.address.value || '',
    emailSmtpHost: cfg.email.smtpHost.value || '',
    emailSmtpPort: cfg.email.smtpPort.value || '',
    emailSmtpUsername: cfg.email.smtpUsername.value || '',
    emailSmtpPassword: cfg.email.smtpPassword.value || '',
    emailSmtpPasswordKnown: cfg.email.smtpPassword.set,
    emailImapHost: cfg.email.imapHost.value || '',
    emailImapPort: cfg.email.imapPort.value || '',
    emailImapUsername: cfg.email.imapUsername.value || '',
    emailImapPassword: cfg.email.imapPassword.value || '',
    emailImapPasswordKnown: cfg.email.imapPassword.set,
    emailSkip: cfg.email.skipped,
  }
}

function autoFillFirstModel(prev: State, list: ProviderModel[]): State {
  const rows = prev.modelRows
  const isEmpty = rows.length === 0 || (rows.length === 1 && !rows[0].name.trim())
  if (isEmpty && list.length > 0) {
    return { ...prev, modelRows: [{ name: list[0].id, role: 'chat' }] }
  }
  return prev
}

function buildDraft(state: State): GlobalConfigDraft {
  const validRows: ModelRow[] = state.modelRows
    .filter(r => r.name.trim())
    .map(r => ({ name: r.name.trim(), role: r.role }))
  const allowedFromState = state.tgAllowedUserIds ?? []
  const linkedId = state.tgLinkedUser?.id
  const merged = linkedId
    ? Array.from(new Set<number>([linkedId, ...allowedFromState]))
    : allowedFromState
  return {
    provider: state.provider,
    openai: { baseUrl: state.openaiBaseUrl.trim(), apiKey: state.openaiApiKey.trim() },
    gonka: { nodeUrl: state.gonkaNodeUrl.trim(), privateKey: state.gonkaPrivateKey.trim() },
    models: validRows,
    telegram: {
      token: state.tgToken.trim(),
      allowedUserIds: state.tgSkip ? [] : merged,
      skipped: state.tgSkip,
    },
    email: {
      address: state.emailAddress.trim(),
      smtpHost: state.emailSmtpHost.trim(),
      smtpPort: state.emailSmtpPort.trim(),
      smtpUsername: state.emailSmtpUsername.trim(),
      smtpPassword: state.emailSmtpPassword.trim(),
      imapHost: state.emailImapHost.trim(),
      imapPort: state.emailImapPort.trim(),
      imapUsername: state.emailImapUsername.trim(),
      imapPassword: state.emailImapPassword.trim(),
      skipped: state.emailSkip,
    },
  }
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
      const hasSmtp =
        !!state.emailSmtpHost.trim() &&
        (state.emailSmtpPasswordKnown || !!state.emailSmtpPassword.trim())
      const hasImap =
        !!state.emailImapHost.trim() &&
        (state.emailImapPasswordKnown || !!state.emailImapPassword.trim())
      return !(hasAddress && (hasSmtp || hasImap))
    }
    case 'finish':
      return false
  }
}

function hasEnoughBalance(state: State): boolean {
  return !!state.gonkaBalance && state.gonkaBalance.gnk >= MIN_BALANCE_GNK
}
