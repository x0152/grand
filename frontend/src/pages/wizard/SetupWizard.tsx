import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Toaster } from '@/components/ui/sonner'
import { BrandLogo, BRAND_NAME } from '@/components/Brand'
import { ModeToggle } from '@/components/mode-toggle'
import { AlertCircle } from '@/lib/icons'
import { api } from '@/api'
import type { GlobalConfig, GlobalConfigDraft, GonkaConfig, ProviderModel } from '@/types'
import type { ModelRow, Provider, State, StepId, WalletMode, WizardMode } from './types'
import { DEFAULT_GONKA_NODE, MIN_BALANCE_GNK } from './seeds'
import { buildPath } from './path'
import { deriveStatus } from './status'
import { telegramSummary } from './utils'
import { StepHeader } from './components/StepHeader'
import { NavBar } from './components/NavBar'
import { ProviderStep } from './steps/ProviderStep'
import { OpenAIStep } from './steps/OpenAIStep'
import { WalletChoiceStep } from './steps/WalletChoiceStep'
import { WalletImportStep } from './steps/WalletImportStep'
import { WalletCreateStep } from './steps/WalletCreateStep'
import { WalletRevealStep } from './steps/WalletRevealStep'
import { WalletBalanceStep } from './steps/WalletBalanceStep'
import { GonkaModelsStep } from './steps/GonkaModelsStep'
import { TelegramStep } from './steps/TelegramStep'
import { FinishStep } from './steps/FinishStep'

interface SetupWizardProps {
  mode?: WizardMode
  onDone: () => void
}

export default function SetupWizard({ mode = 'full', onDone }: SetupWizardProps) {
  const [state, setState] = useState<State | null>(null)
  const [stepId, setStepId] = useState<StepId>('provider')
  const [gonkaConfig, setGonkaConfig] = useState<GonkaConfig | null>(null)
  const [resolved, setResolved] = useState<GlobalConfig | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [availableModels, setAvailableModels] = useState<ProviderModel[] | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([api.config.get(), api.gonka.config().catch(() => null)]).then(([cfg, gonka]) => {
      if (cancelled) return
      setResolved(cfg)
      const fallback = gonka?.defaultNodeUrl || DEFAULT_GONKA_NODE
      setGonkaConfig(gonka ?? { defaultNodeUrl: fallback, inferencedAvailable: false, minBalanceGnk: String(MIN_BALANCE_GNK) })
      setState(initialState(cfg, fallback))
      const status = deriveStatus(cfg)
      if (mode === 'resume' && status.firstMissing) {
        setStepId(status.firstMissing)
      }
    })
    return () => { cancelled = true }
  }, [mode])

  const loadModels = useCallback(
    async (provider: Provider, baseUrl: string, apiKey: string): Promise<ProviderModel[]> => {
      if (!baseUrl.trim()) {
        setModelsError('Fill in the server URL first.')
        return []
      }
      setLoadingModels(true)
      setModelsError('')
      const tempId = `wizard-${provider}-${Date.now()}`
      try {
        await api.llmConnections.create({ id: tempId, provider, baseUrl: baseUrl.trim(), apiKey: apiKey.trim() })
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
      setState(prev => prev ? autoFillFirstModel(prev, list) : prev)
    })()
  }, [state, stepId, availableModels, loadingModels, loadModels])

  useEffect(() => {
    gonkaAutoLoadedRef.current = false
  }, [state?.provider, state?.gonkaNodeUrl, state?.gonkaPrivateKey])

  const path = useMemo(() => {
    if (!state) return [] as StepId[]
    return buildPath({
      state,
      gonkaConfig,
      mode,
      status: deriveStatus(resolved),
    })
  }, [state, gonkaConfig, resolved, mode])

  const currentIdx = state ? Math.max(0, path.indexOf(stepId)) : 0

  if (!state) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6 text-sm text-zinc-500">
        Loading setup…
      </div>
    )
  }

  const update = <K extends keyof State>(key: K, value: State[K]) =>
    setState(prev => (prev ? { ...prev, [key]: value } : prev))

  const goNext = () => {
    setError('')
    const next = path[currentIdx + 1]
    if (next) setStepId(next)
  }
  const goBack = () => {
    setError('')
    const prev = path[currentIdx - 1]
    if (prev) setStepId(prev)
  }

  const onCompleteClick = async () => {
    if (!state) return
    setSubmitting(true)
    setError('')
    try {
      const draft = buildDraft(state)
      await api.config.update(draft)
      await api.config.apply()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed')
    } finally {
      setSubmitting(false)
    }
  }

  const onProviderSelect = (p: Provider) => {
    setState(prev => {
      if (!prev) return prev
      if (prev.provider === p) return prev
      return { ...prev, provider: p, modelRows: [{ name: '', role: 'chat' }] }
    })
    if (p === 'openai') setStepId('openai')
    else setStepId('wallet-choice')
  }

  const onWalletModeSelect = (walletMode: WalletMode) => {
    update('walletMode', walletMode)
    setStepId(walletMode === 'create' ? 'wallet-create' : 'wallet-import')
  }

  const onCreateWallet = async () => {
    setSubmitting(true)
    setError('')
    try {
      const wallet = await api.gonka.createWallet()
      setState(prev => prev ? {
        ...prev,
        gonkaPrivateKey: wallet.privateKeyHex,
        gonkaPrivateKeyKnown: true,
        gonkaAddress: wallet.address,
        gonkaMnemonicWords: wallet.words,
        mnemonicAcknowledged: false,
      } : prev)
      setStepId('wallet-reveal')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet creation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const onUseExisting = async () => {
    setSubmitting(true)
    setError('')
    try {
      const { address } = await api.gonka.deriveAddress(state.gonkaPrivateKey.trim())
      setState(prev => prev ? { ...prev, gonkaAddress: address, gonkaPrivateKeyKnown: true } : prev)
      setStepId('wallet-balance')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid private key')
    } finally {
      setSubmitting(false)
    }
  }

  const onLoadOpenAIModels = async () => {
    const list = await loadModels('openai', state.openaiBaseUrl, state.openaiApiKey)
    setState(prev => prev ? autoFillFirstModel(prev, list) : prev)
  }

  const onReloadGonkaModels = async () => {
    const list = await loadModels('gonka', state.gonkaNodeUrl, state.gonkaPrivateKey)
    setState(prev => prev ? autoFillFirstModel(prev, list) : prev)
  }

  return (
    <div className="min-h-screen bg-[var(--grand-bg)] flex items-center justify-center p-6">
      <Toaster />
      <div className="w-full max-w-xl">
        <div className="relative mb-8 flex items-center justify-center gap-3">
          <BrandLogo size={44} />
          <div className="leading-tight">
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--grand-fg)]">
              {BRAND_NAME}
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--grand-muted)] mt-1">
              {mode === 'resume' ? 'finishing setup' : 'first run'}
            </p>
          </div>
          <div className="absolute right-0 top-0">
            <ModeToggle />
          </div>
        </div>

        <Card className="bg-[var(--grand-surface)] p-7 space-y-6 border-0 shadow-none">
          <StepHeader path={path} stepId={stepId} />

          {stepId === 'provider' && (
            <ProviderStep provider={state.provider} gonkaConfig={gonkaConfig} onSelect={onProviderSelect} />
          )}

          {stepId === 'openai' && (
            <OpenAIStep
              baseUrl={state.openaiBaseUrl}
              apiKey={state.openaiApiKey}
              modelRows={state.modelRows}
              available={availableModels}
              loadingModels={loadingModels}
              modelsError={modelsError}
              onChangeBaseUrl={v => update('openaiBaseUrl', v)}
              onChangeApiKey={v => update('openaiApiKey', v)}
              onChangeModelRows={rows => update('modelRows', rows)}
              onLoadModels={onLoadOpenAIModels}
            />
          )}

          {stepId === 'wallet-choice' && (
            <WalletChoiceStep
              walletMode={state.walletMode}
              gonkaConfig={gonkaConfig}
              onSelect={onWalletModeSelect}
            />
          )}

          {stepId === 'wallet-import' && (
            <WalletImportStep
              privateKey={state.gonkaPrivateKey}
              nodeUrl={state.gonkaNodeUrl}
              submitting={submitting}
              onChangePrivateKey={v => update('gonkaPrivateKey', v)}
              onChangeNodeUrl={v => update('gonkaNodeUrl', v)}
              onConfirm={onUseExisting}
            />
          )}

          {stepId === 'wallet-create' && (
            <WalletCreateStep
              gonkaConfig={gonkaConfig}
              nodeUrl={state.gonkaNodeUrl}
              submitting={submitting}
              onChangeNodeUrl={v => update('gonkaNodeUrl', v)}
              onCreate={onCreateWallet}
            />
          )}

          {stepId === 'wallet-reveal' && (
            <WalletRevealStep
              address={state.gonkaAddress}
              words={state.gonkaMnemonicWords}
              acknowledged={state.mnemonicAcknowledged}
              onAcknowledge={v => update('mnemonicAcknowledged', v)}
            />
          )}

          {stepId === 'wallet-balance' && (
            <WalletBalanceStep
              address={state.gonkaAddress}
              nodeUrl={state.gonkaNodeUrl}
              minBalance={MIN_BALANCE_GNK}
              balance={state.gonkaBalance}
              onBalanceChange={b => update('gonkaBalance', b)}
              bypass={state.bypassBalance}
              onBypassChange={v => update('bypassBalance', v)}
            />
          )}

          {stepId === 'gonka-models' && (
            <GonkaModelsStep
              modelRows={state.modelRows}
              available={availableModels}
              loadingModels={loadingModels}
              modelsError={modelsError}
              onChange={rows => update('modelRows', rows)}
              onReload={onReloadGonkaModels}
            />
          )}

          {stepId === 'telegram' && (
            <TelegramStep
              token={state.tgToken}
              linkedUser={state.tgLinkedUser}
              skip={state.tgSkip}
              onChangeToken={v => update('tgToken', v)}
              onChangeLinkedUser={v => update('tgLinkedUser', v)}
              onChangeSkip={v => update('tgSkip', v)}
            />
          )}

          {stepId === 'finish' && (
            <FinishStep
              provider={state.provider}
              chatModel={state.modelRows.find(r => r.role === 'chat')?.name}
              endpoint={state.provider === 'openai' ? state.openaiBaseUrl : state.gonkaNodeUrl}
              telegramLabel={telegramSummary(state)}
            />
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <NavBar
            stepId={stepId}
            canBack={currentIdx > 0 && stepId !== 'wallet-reveal'}
            onBack={goBack}
            onNext={goNext}
            onComplete={onCompleteClick}
            submitting={submitting}
            state={state}
          />
        </Card>
      </div>
    </div>
  )
}

function initialState(cfg: GlobalConfig, defaultGonkaNode: string): State {
  const provider = (cfg.provider.value || 'openai') as Provider
  return {
    provider,
    openaiBaseUrl: cfg.openai.baseUrl.value,
    openaiApiKey: cfg.openai.apiKey.value || '',
    openaiApiKeyKnown: cfg.openai.apiKey.set,
    modelRows: cfg.models.length ? cfg.models.map(m => ({ name: m.name, role: m.role })) : [{ name: '', role: 'chat' }],
    walletMode: 'create',
    gonkaNodeUrl: cfg.gonka.nodeUrl.value || defaultGonkaNode,
    gonkaPrivateKey: '',
    gonkaPrivateKeyKnown: cfg.gonka.privateKey.set,
    gonkaAddress: '',
    gonkaMnemonicWords: [],
    mnemonicAcknowledged: false,
    bypassBalance: false,
    gonkaBalance: null,
    tgToken: cfg.telegram.token.value || '',
    tgTokenKnown: cfg.telegram.token.set,
    tgLinkedUser: null,
    tgAllowedUserIds: cfg.telegram.allowedUserIds ?? [],
    tgSkip: cfg.telegram.skipped,
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
  const validRows: ModelRow[] = state.modelRows.filter(r => r.name.trim()).map(r => ({ name: r.name.trim(), role: r.role }))
  const allowedFromState = state.tgAllowedUserIds ?? []
  const linkedId = state.tgLinkedUser?.id
  const merged = linkedId ? Array.from(new Set<number>([linkedId, ...allowedFromState])) : allowedFromState
  return {
    provider: state.provider,
    openai: {
      baseUrl: state.openaiBaseUrl.trim(),
      apiKey: state.openaiApiKey.trim(),
    },
    gonka: {
      nodeUrl: state.gonkaNodeUrl.trim(),
      privateKey: state.gonkaPrivateKey.trim(),
    },
    models: validRows,
    telegram: {
      token: state.tgToken.trim(),
      allowedUserIds: state.tgSkip ? [] : merged,
      skipped: state.tgSkip,
    },
  }
}
