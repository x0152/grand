import { Loader2, Key, TextAa, type IconComponent } from '@/lib/icons'
import { AppleAction } from '../components/apple/AppleAction'
import { AppleNote } from '../components/apple/AppleNote'
import { GonkaServerSetting } from '../components/GonkaServerSetting'
import { StepHero } from '../components/StepHero'
import type { WalletImportMode } from '../types'
import { isValidMnemonic, isValidPrivateKey } from '../utils'

interface WalletImportStepProps {
  importMode: WalletImportMode
  mnemonic: string
  privateKey: string
  nodeUrl: string
  submitting: boolean
  onChangeImportMode: (mode: WalletImportMode) => void
  onChangeMnemonic: (v: string) => void
  onChangePrivateKey: (v: string) => void
  onChangeNodeUrl: (v: string) => void
  onConfirm: () => Promise<void>
}

export function WalletImportStep({
  importMode,
  mnemonic,
  privateKey,
  nodeUrl,
  submitting,
  onChangeImportMode,
  onChangeMnemonic,
  onChangePrivateKey,
  onChangeNodeUrl,
  onConfirm,
}: WalletImportStepProps) {
  const wordCount = mnemonic.trim() ? mnemonic.trim().split(/\s+/).length : 0
  const mnemonicValid = isValidMnemonic(mnemonic)
  const privateKeyValid = isValidPrivateKey(privateKey)
  const canSubmit =
    !!nodeUrl.trim() && (importMode === 'mnemonic' ? mnemonicValid : privateKeyValid)

  return (
    <div className="space-y-10">
      <StepHero stepId="wallet-import" align="left" />

      <ImportModeToggle value={importMode} onChange={onChangeImportMode} />

      {importMode === 'mnemonic' ? (
        <MnemonicEntry
          value={mnemonic}
          onChange={onChangeMnemonic}
          wordCount={wordCount}
          valid={mnemonicValid}
        />
      ) : (
        <PrivateKeyEntry
          value={privateKey}
          onChange={onChangePrivateKey}
        />
      )}

      <AppleAction
        fullWidth
        onClick={() => void onConfirm()}
        disabled={!canSubmit || submitting}
        leading={submitting ? <Loader2 size={16} className="animate-spin" /> : undefined}
      >
        {submitting ? 'Connecting wallet…' : 'Use this wallet'}
      </AppleAction>

      <GonkaServerSetting nodeUrl={nodeUrl} onChange={onChangeNodeUrl} />
    </div>
  )
}

function ImportModeToggle({
  value,
  onChange,
}: {
  value: WalletImportMode
  onChange: (mode: WalletImportMode) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ModeTile
        icon={TextAa}
        title="Recovery phrase"
        subtitle="12 or 24 words · recommended"
        selected={value === 'mnemonic'}
        onClick={() => onChange('mnemonic')}
      />
      <ModeTile
        icon={Key}
        title="Private key"
        subtitle="Advanced fallback"
        selected={value === 'private-key'}
        onClick={() => onChange('private-key')}
      />
    </div>
  )
}

function ModeTile({
  icon: Icon,
  title,
  subtitle,
  selected,
  onClick,
}: {
  icon: IconComponent
  title: string
  subtitle: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-2xl px-4 py-4 text-left ring-1 transition-all ${
        selected
          ? 'ring-2 ring-emerald-500 bg-emerald-500/[0.05]'
          : 'ring-[var(--grand-border-2)] bg-[var(--grand-surface)] hover:ring-[var(--grand-border)]'
      }`}
    >
      <div
        className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
          selected
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            : 'bg-[var(--grand-surface-2)] text-[var(--grand-fg-2)]'
        }`}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="text-[14.5px] font-semibold tracking-tight text-[var(--grand-fg)]">{title}</div>
        <div className="text-[12px] text-[var(--grand-muted)] mt-0.5">{subtitle}</div>
      </div>
    </button>
  )
}

function MnemonicEntry({
  value,
  onChange,
  wordCount,
  valid,
}: {
  value: string
  onChange: (v: string) => void
  wordCount: number
  valid: boolean
}) {
  const hint =
    wordCount === 0
      ? 'The 12 or 24 words from your wallet app, separated by spaces. Lowercase only.'
      : valid
        ? `${wordCount} words · looks good`
        : `${wordCount} word${wordCount === 1 ? '' : 's'} · need 12, 15, 18, 21, or 24`

  const hintTone = wordCount > 0 ? (valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400') : 'text-[var(--grand-muted-2)]'

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[var(--grand-surface)] ring-1 ring-[var(--grand-border-2)] p-5 focus-within:ring-emerald-500/60 transition-all">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="word1 word2 word3 word4 …"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={4}
          className="w-full bg-transparent outline-none font-mono text-[15px] tracking-tight text-[var(--grand-fg)] placeholder:text-[var(--grand-muted-2)] resize-none leading-relaxed"
        />
      </div>
      <p className={`px-2 text-[13px] ${hintTone}`}>{hint}</p>
    </div>
  )
}

function PrivateKeyEntry({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-4">
      <AppleNote tone="warning" title="Not recommended">
        A recovery phrase is safer and works with Keplr, Cosmostation, and Leap. Use the private
        key only if your wallet shows nothing else.
      </AppleNote>

      <div className="rounded-2xl bg-[var(--grand-surface)] ring-1 ring-[var(--grand-border-2)] p-5 focus-within:ring-emerald-500/60 transition-all">
        <input
          type="password"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="0x... · 64 hexadecimal characters"
          autoComplete="new-password"
          autoCapitalize="off"
          autoCorrect="off"
          className="w-full bg-transparent outline-none font-mono text-[15px] tracking-tight text-[var(--grand-fg)] placeholder:text-[var(--grand-muted-2)]"
        />
      </div>
      <p className="px-2 text-[13px] text-[var(--grand-muted-2)]">
        64 hexadecimal characters from your wallet app. With or without “0x”.
      </p>
    </div>
  )
}
