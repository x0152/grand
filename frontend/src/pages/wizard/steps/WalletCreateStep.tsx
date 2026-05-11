import { Loader2, Sparkles } from '@/lib/icons'
import type { GonkaConfig } from '@/types'
import { AppleAction } from '../components/apple/AppleAction'
import { AppleHero } from '../components/apple/AppleHero'
import { AppleNote } from '../components/apple/AppleNote'
import { GonkaServerSetting } from '../components/GonkaServerSetting'
import { StepHero } from '../components/StepHero'

interface WalletCreateStepProps {
  gonkaConfig: GonkaConfig | null
  nodeUrl: string
  submitting: boolean
  onChangeNodeUrl: (v: string) => void
  onCreate: () => Promise<void>
}

export function WalletCreateStep({
  gonkaConfig,
  nodeUrl,
  submitting,
  onChangeNodeUrl,
  onCreate,
}: WalletCreateStepProps) {
  const inferencedReady = gonkaConfig?.inferencedAvailable ?? false
  const disabled = !inferencedReady || !nodeUrl.trim() || submitting
  return (
    <div className="space-y-10">
      <StepHero stepId="wallet-create" hero={<AppleHero icon={Sparkles} tone="emerald" />} />

      <ol className="space-y-4">
        {[
          'We generate a fresh wallet on your server.',
          'You see your 24 secret words — save them somewhere safe.',
          'You top up the wallet with a small amount of GNK.',
        ].map((step, i) => (
          <li
            key={i}
            className="flex items-start gap-4 rounded-2xl bg-[var(--grand-surface)] ring-1 ring-[var(--grand-border-2)] px-5 py-4"
          >
            <span className="size-8 shrink-0 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-mono text-[14px] font-semibold">
              {i + 1}
            </span>
            <span className="text-[15px] leading-relaxed text-[var(--grand-fg-2)] pt-1">{step}</span>
          </li>
        ))}
      </ol>

      <AppleAction
        fullWidth
        onClick={() => void onCreate()}
        disabled={disabled}
        leading={submitting ? <Loader2 size={16} className="animate-spin" /> : undefined}
      >
        {submitting ? 'Creating your wallet…' : 'Create my wallet'}
      </AppleAction>

      {!inferencedReady && (
        <AppleNote tone="warning">
          Wallet creation isn’t available on this server. Use the “I already have a wallet” option
          on the previous screen instead.
        </AppleNote>
      )}

      <GonkaServerSetting nodeUrl={nodeUrl} onChange={onChangeNodeUrl} />
    </div>
  )
}
