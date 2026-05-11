import { XpButton, XpField, XpStatusLine } from './shared'
import type { WizardController } from './useWizardController'

interface Props {
  ctrl: WizardController
}

export function WalletCreateStep({ ctrl }: Props) {
  if (!ctrl.state) return null
  const inferencedReady = ctrl.gonkaConfig?.inferencedAvailable ?? false
  const disabled = !inferencedReady || !ctrl.state.gonkaNodeUrl.trim() || ctrl.submitting

  return (
    <div className="xp-wizard-step">
      <p className="xp-wizard-prose">
        One tap and you're done. We'll show the 24 secret words right after — write them down
        somewhere safe.
      </p>

      <ol className="xp-wizard-numbered">
        <li><span className="xp-wizard-numbered-bullet">1</span> We generate a fresh wallet on your server.</li>
        <li><span className="xp-wizard-numbered-bullet">2</span> You see your 24 secret words — save them somewhere safe.</li>
        <li><span className="xp-wizard-numbered-bullet">3</span> You top up the wallet with a small amount of GNK.</li>
      </ol>

      <XpField
        label="Gonka node URL"
        value={ctrl.state.gonkaNodeUrl}
        onChange={v => ctrl.update('gonkaNodeUrl', v)}
        placeholder="https://node4.gonka.ai"
        monospace
      />

      <div className="xp-wizard-actions-inline">
        <XpButton primary onClick={() => void ctrl.onCreateWallet()} disabled={disabled}>
          {ctrl.submitting ? 'Creating your wallet…' : 'Create my wallet'}
        </XpButton>
      </div>

      {!inferencedReady && (
        <XpStatusLine tone="warn">
          Wallet creation isn't available on this server. Use “I already have a wallet” on the
          previous screen.
        </XpStatusLine>
      )}
    </div>
  )
}
