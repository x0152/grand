import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { ModeToggle } from '@/components/mode-toggle'
import { ArrowLeft, AlertCircle, X } from '@/lib/icons'
import { api } from '@/api'
import type { GlobalConfig, GlobalConfigDraft, GonkaConfig, ProviderModel } from '@/types'
import type { ModelRow, Provider, State, StepId, WalletImportMode, WalletMode, WizardMode } from './types'
import { DEFAULT_GONKA_NODE, MIN_BALANCE_GNK } from './seeds'
import { buildPath } from './path'
import { deriveStatus } from './status'
import { Stepper } from './components/Stepper'
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
import { EmailStep } from './steps/EmailStep'
import { FinishStep } from './steps/FinishStep'
import { telegramSummary, emailSummary } from './utils'

interface SetupWizardProps {
  mode?: WizardMode
  onDone: () => void
  onCancel?: () => void
  onSwitchToXp?: () => void
}

export default function SetupWizard({ mode = 'full', onDone, onCancel, onSwitchToXp }: SetupWizardProps) {
  const [state, setState] = useState<State | null>(null)
  const [stepId, setStepId] = useState<StepId>('provider')
  const [direction, setDirection] = useState<'next' | 'back'>('next')
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
      setGonkaConfig(
        gonka ?? {
          defaultNodeUrl: fallback,
          inferencedAvailable: false,
          minBalanceGnk: String(MIN_BALANCE_GNK),
        },
      )
      setState(initialState(cfg, fallback))
      const status = deriveStatus(cfg)
      if (mode === 'resume' && status.firstMissing) {
        setStepId(status.firstMissing)
      }
    })
    return () => {
      cancelled = true
    }
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
    return buildPath({ state, gonkaConfig, mode, status: deriveStatus(resolved) })
  }, [state, gonkaConfig, resolved, mode])

  const currentIdx = state ? Math.max(0, path.indexOf(stepId)) : 0

  if (!state) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--grand-bg)] flex items-center justify-center p-6 text-sm text-[var(--grand-muted)]">
        Loading setup…
      </div>
    )
  }

  const update = <K extends keyof State>(key: K, value: State[K]) =>
    setState(prev => (prev ? { ...prev, [key]: value } : prev))

  const goTo = (next: StepId, dir: 'next' | 'back' = 'next') => {
    setDirection(dir)
    setStepId(next)
  }

  const goNext = () => {
    setError('')
    const next = path[currentIdx + 1]
    if (next) goTo(next, 'next')
  }
  const goBack = () => {
    setError('')
    const prev = path[currentIdx - 1]
    if (prev) goTo(prev, 'back')
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
  }

  const onWalletModeSelect = (walletMode: WalletMode) => {
    update('walletMode', walletMode)
  }

  const onCreateWallet = async () => {
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
      goTo('wallet-reveal', 'next')
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
        setState(prev => (prev ? { ...prev, gonkaAddress: address, gonkaPrivateKeyKnown: true } : prev))
      }
      goTo('wallet-balance', 'next')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect that wallet')
    } finally {
      setSubmitting(false)
    }
  }

  const onReloadGonkaModels = async () => {
    const list = await loadModels('gonka', state.gonkaNodeUrl, state.gonkaPrivateKey)
    setState(prev => (prev ? autoFillFirstModel(prev, list) : prev))
  }

  const canBack = currentIdx > 0 && stepId !== 'wallet-reveal'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--grand-bg)] text-[var(--grand-fg)] overflow-hidden">
      <Toaster />

      <header className="shrink-0 backdrop-blur bg-[var(--grand-bg)]/85 border-b border-[var(--grand-border-2)]">
        <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={canBack ? goBack : undefined}
            disabled={!canBack}
            className="flex items-center gap-1 text-[14px] text-[var(--grand-muted)] hover:text-[var(--grand-fg)] disabled:opacity-30 disabled:hover:text-[var(--grand-muted)] transition-colors -ml-1"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <Stepper path={path} stepId={stepId} />
          <div className="flex items-center gap-1">
            <span className="text-[12px] font-mono uppercase tracking-[0.16em] text-[var(--grand-muted-2)] mr-2 hidden sm:inline">
              {mode === 'resume' ? 'finishing' : `step ${currentIdx + 1}/${path.length}`}
            </span>
            {onSwitchToXp && mode === 'full' && (
              <button
                type="button"
                onClick={onSwitchToXp}
                title="Open the same setup in a Windows XP–style wizard"
                className="hidden md:inline-flex items-center gap-1.5 mr-1 px-2 py-1 rounded-md text-[10.5px] font-mono uppercase tracking-[0.14em] text-[var(--grand-muted-2)] hover:text-[var(--grand-fg)] hover:bg-[var(--grand-surface-2)] transition-colors"
              >
                <span
                  className="w-[11px] h-[11px] bg-center bg-contain bg-no-repeat opacity-70"
                  style={{ backgroundImage: "url('/winxp/winflag.png')", imageRendering: '-webkit-optimize-contrast' }}
                  aria-hidden
                />
                Windows wizard?
              </button>
            )}
            <ModeToggle />
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                aria-label="Close setup"
                className="ml-1 size-9 rounded-lg inline-flex items-center justify-center text-[var(--grand-muted)] hover:text-[var(--grand-fg)] hover:bg-[var(--grand-surface-2)] transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className={`${contentMaxWidth(stepId)} mx-auto px-6 pt-12 sm:pt-16 pb-12`}>
          <div
            key={stepId}
            className={`wizard-step ${direction === 'back' ? 'wizard-step-back' : 'wizard-step-next'}`}
          >
            {stepId === 'provider' && (
              <ProviderStep
                provider={state.provider}
                gonkaConfig={gonkaConfig}
                onSelect={onProviderSelect}
              />
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
                importMode={state.walletImportMode}
                mnemonic={state.gonkaMnemonicInput}
                privateKey={state.gonkaPrivateKey}
                nodeUrl={state.gonkaNodeUrl}
                submitting={submitting}
                onChangeImportMode={(m: WalletImportMode) => update('walletImportMode', m)}
                onChangeMnemonic={v => update('gonkaMnemonicInput', v)}
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

            {stepId === 'email' && (
              <EmailStep
                address={state.emailAddress}
                smtpHost={state.emailSmtpHost}
                smtpPort={state.emailSmtpPort}
                smtpUsername={state.emailSmtpUsername}
                smtpPassword={state.emailSmtpPassword}
                smtpPasswordKnown={state.emailSmtpPasswordKnown}
                imapHost={state.emailImapHost}
                imapPort={state.emailImapPort}
                imapUsername={state.emailImapUsername}
                imapPassword={state.emailImapPassword}
                imapPasswordKnown={state.emailImapPasswordKnown}
                skip={state.emailSkip}
                onChangeAddress={v => update('emailAddress', v)}
                onChangeSmtpHost={v => update('emailSmtpHost', v)}
                onChangeSmtpPort={v => update('emailSmtpPort', v)}
                onChangeSmtpUsername={v => update('emailSmtpUsername', v)}
                onChangeSmtpPassword={v => update('emailSmtpPassword', v)}
                onChangeImapHost={v => update('emailImapHost', v)}
                onChangeImapPort={v => update('emailImapPort', v)}
                onChangeImapUsername={v => update('emailImapUsername', v)}
                onChangeImapPassword={v => update('emailImapPassword', v)}
                onChangeSkip={v => update('emailSkip', v)}
              />
            )}

            {stepId === 'finish' && (
              <FinishStep
                provider={state.provider}
                chatModel={state.modelRows.find(r => r.role === 'chat')?.name}
                endpoint={state.provider === 'openai' ? state.openaiBaseUrl : state.gonkaNodeUrl}
                telegramLabel={telegramSummary(state)}
                emailLabel={emailSummary(state)}
              />
            )}
          </div>

          {error && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl ring-1 ring-rose-500/30 bg-rose-500/[0.06] px-5 py-4 text-[13.5px] text-rose-600 dark:text-rose-400">
              <AlertCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </main>

      <NavBar
        stepId={stepId}
        canBack={canBack}
        onBack={goBack}
        onNext={goNext}
        onComplete={onCompleteClick}
        submitting={submitting}
        state={state}
      />
    </div>
  )
}

function initialState(cfg: GlobalConfig, defaultGonkaNode: string): State {
  const provider = (cfg.provider.value || 'openai') as Provider
  const linkedFromConfig = (cfg.telegram.allowedUserIds ?? [])[0]
  return {
    provider,
    openaiBaseUrl: cfg.openai.baseUrl.value,
    openaiApiKey: cfg.openai.apiKey.value || '',
    openaiApiKeyKnown: cfg.openai.apiKey.set,
    modelRows: cfg.models.length ? cfg.models.map(m => ({ name: m.name, role: m.role })) : [{ name: '', role: 'chat' }],
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

const WIDE_STEPS: ReadonlySet<StepId> = new Set<StepId>(['provider', 'wallet-choice'])

function contentMaxWidth(stepId: StepId): string {
  return WIDE_STEPS.has(stepId) ? 'max-w-5xl' : 'max-w-lg'
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
  const merged = linkedId ? Array.from(new Set<number>([linkedId, ...allowedFromState])) : allowedFromState
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
