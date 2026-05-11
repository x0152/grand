import { Sparkles, Wallet } from '@/lib/icons'
import type { GonkaConfig } from '@/types'
import { AppleForkCard } from '../components/apple/AppleForkCard'
import { StepHero } from '../components/StepHero'
import type { WalletMode } from '../types'

interface WalletChoiceStepProps {
  walletMode: WalletMode | null
  gonkaConfig: GonkaConfig | null
  onSelect: (mode: WalletMode) => void
}

export function WalletChoiceStep({ walletMode, gonkaConfig, onSelect }: WalletChoiceStepProps) {
  const inferencedReady = gonkaConfig?.inferencedAvailable ?? false
  return (
    <div className="space-y-10">
      <StepHero stepId="wallet-choice" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <AppleForkCard
          icon={Sparkles}
          title="Create a fresh wallet"
          tagline="One click · 24 secret words"
          description="We generate a brand-new Gonka wallet for you. You write down 24 recovery words once and you are done."
          bullets={[
            'No crypto experience needed',
            'You stay in full control of the keys',
            'Works with Keplr, Cosmostation, Leap on mobile too',
          ]}
          selected={walletMode === 'create'}
          disabled={!inferencedReady}
          badge={!inferencedReady ? { label: 'unavailable here', tone: 'amber' } : undefined}
          onClick={() => onSelect('create')}
        />

        <AppleForkCard
          icon={Wallet}
          title="Use a wallet I already have"
          tagline="Recovery phrase · Private key"
          description="Plug in the same wallet you use in Keplr, Cosmostation, or Leap — bring its 12 / 24 word recovery phrase."
          bullets={[
            '12 or 24 words from your wallet app',
            'Private key import is available as a fallback',
            'You can switch wallets any time in settings',
          ]}
          selected={walletMode === 'import'}
          onClick={() => onSelect('import')}
        />
      </div>
    </div>
  )
}
