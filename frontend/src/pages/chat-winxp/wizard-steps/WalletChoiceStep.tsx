import { XpTile } from './shared'
import type { WizardController } from './useWizardController'

interface Props {
  ctrl: WizardController
}

export function WalletChoiceStep({ ctrl }: Props) {
  if (!ctrl.state) return null
  const inferencedReady = ctrl.gonkaConfig?.inferencedAvailable ?? false
  const walletMode = ctrl.state.walletMode

  return (
    <div className="xp-wizard-step">
      <p className="xp-wizard-prose">
        Pay-per-call needs a wallet. Brand new? We'll create one. Have one? Plug it in.
      </p>
      <div className="xp-wizard-grid-2">
        <XpTile
          name="wallet-mode"
          selected={walletMode === 'create'}
          onSelect={() => ctrl.onWalletModeSelect('create')}
          title="Create a fresh wallet"
          tagline="One click · 24 secret words"
          description="We generate a brand-new Gonka wallet for you. Write down 24 recovery words once and you're done."
          bullets={[
            'No crypto experience needed',
            'You stay in full control of the keys',
            'Works with Keplr, Cosmostation, Leap on mobile too',
          ]}
          disabled={!inferencedReady}
          badge={!inferencedReady ? 'unavailable' : undefined}
        />
        <XpTile
          name="wallet-mode"
          selected={walletMode === 'import'}
          onSelect={() => ctrl.onWalletModeSelect('import')}
          title="Use a wallet I already have"
          tagline="Recovery phrase · Private key"
          description="Plug in the same wallet you use in Keplr, Cosmostation, or Leap — bring its 12 / 24 word recovery phrase."
          bullets={[
            '12 or 24 words from your wallet app',
            'Private key import is available as a fallback',
            'You can switch wallets any time in settings',
          ]}
        />
      </div>
    </div>
  )
}
