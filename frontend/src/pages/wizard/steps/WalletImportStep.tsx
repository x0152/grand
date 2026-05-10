import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/FormField'
import { Loader2, ShieldAlert, TextAa, Key, type IconComponent } from '@/lib/icons'
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
  const [showServer, setShowServer] = useState(false)
  const wordCount = mnemonic.trim() ? mnemonic.trim().split(/\s+/).length : 0
  const canSubmit =
    !!nodeUrl.trim() &&
    (importMode === 'mnemonic' ? isValidMnemonic(mnemonic) : isValidPrivateKey(privateKey))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <ModeButton
          icon={TextAa}
          title="Recovery phrase"
          subtitle="12 or 24 words"
          selected={importMode === 'mnemonic'}
          onClick={() => onChangeImportMode('mnemonic')}
        />
        <ModeButton
          icon={Key}
          title="Private key"
          subtitle="advanced"
          selected={importMode === 'private-key'}
          onClick={() => onChangeImportMode('private-key')}
        />
      </div>

      {importMode === 'mnemonic' ? (
        <div className="space-y-2">
          <FormField
            label="Recovery phrase"
            hint={
              wordCount === 0
                ? 'The 12 or 24 words from your wallet app, separated by spaces. Lowercase only.'
                : isValidMnemonic(mnemonic)
                  ? `${wordCount} words · looks good`
                  : `${wordCount} word${wordCount === 1 ? '' : 's'} · need 12, 15, 18, 21, or 24`
            }
          >
            <textarea
              value={mnemonic}
              onChange={e => onChangeMnemonic(e.target.value)}
              placeholder="word1 word2 word3 …"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              rows={3}
              className="flex w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 font-mono text-[12.5px] text-zinc-900 dark:text-zinc-50 outline-none placeholder:text-zinc-400 focus-visible:border-teal-500/60 focus-visible:ring-2 focus-visible:ring-teal-500/20 resize-none"
            />
          </FormField>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-[12px] text-amber-700 dark:text-amber-400 leading-relaxed flex items-start gap-2">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <div>
              Not recommended. A recovery phrase is safer and works with Keplr, Cosmostation, and
              Leap. Use the private key only if your wallet shows nothing else.
            </div>
          </div>
          <FormField
            label="Private key"
            hint="64 hexadecimal characters from your wallet app. With or without “0x”."
          >
            <Input
              type="password"
              value={privateKey}
              onChange={e => onChangePrivateKey(e.target.value)}
              placeholder="0x..."
              className="font-mono"
            />
          </FormField>
        </div>
      )}

      <Button onClick={onConfirm} disabled={!canSubmit || submitting} className="w-full h-10">
        {submitting ? (
          <>
            <Loader2 size={14} className="animate-spin" /> checking…
          </>
        ) : (
          'Use this wallet'
        )}
      </Button>

      <div className="pt-1">
        {!showServer ? (
          <button
            type="button"
            onClick={() => setShowServer(true)}
            className="text-[11.5px] text-zinc-500 dark:text-zinc-500 hover:text-teal-600 dark:hover:text-teal-400"
          >
            Server: <span className="font-mono">{nodeUrl || 'default'}</span> · change
          </button>
        ) : (
          <FormField label="Gonka server" hint="Where GRAND sends your AI requests. The default works.">
            <Input
              value={nodeUrl}
              onChange={e => onChangeNodeUrl(e.target.value)}
              placeholder="https://node4.gonka.ai"
            />
          </FormField>
        )}
      </div>
    </div>
  )
}

interface ModeButtonProps {
  icon: IconComponent
  title: string
  subtitle: string
  selected: boolean
  onClick: () => void
}

function ModeButton({ icon: Icon, title, subtitle, selected, onClick }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        selected
          ? 'border-teal-500/70 bg-teal-500/5'
          : 'border-zinc-200 dark:border-zinc-800 bg-transparent hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
    >
      <div
        className={`size-8 rounded-md flex items-center justify-center shrink-0 ${
          selected
            ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
            : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400'
        }`}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium text-zinc-900 dark:text-zinc-50 truncate">
          {title}
        </div>
        <div className="text-[10.5px] uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
          {subtitle}
        </div>
      </div>
    </button>
  )
}
