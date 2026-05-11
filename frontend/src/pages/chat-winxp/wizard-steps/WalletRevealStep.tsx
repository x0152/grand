import { useState } from 'react'
import { XpButton, XpCheckRow, XpSection, XpStatusLine } from './shared'
import type { WizardController } from './useWizardController'

interface Props {
  ctrl: WizardController
}

export function WalletRevealStep({ ctrl }: Props) {
  const [revealed, setRevealed] = useState(false)
  if (!ctrl.state) return null
  const { gonkaAddress, gonkaMnemonicWords, mnemonicAcknowledged } = ctrl.state
  const phrase = gonkaMnemonicWords.join(' ')

  const copy = async () => {
    if (!phrase) return
    try {
      await navigator.clipboard.writeText(phrase)
    } catch {}
  }

  return (
    <div className="xp-wizard-step">
      <XpStatusLine tone="error">
        <strong>Save these words now.</strong> Anyone with them can take your money — we won't
        show them again.
      </XpStatusLine>

      <XpSection title="Wallet address">
        <div className="xp-wizard-address">
          <code>{gonkaAddress || '—'}</code>
          <XpButton
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(gonkaAddress)
              } catch {}
            }}
          >
            Copy
          </XpButton>
        </div>
      </XpSection>

      <XpSection
        title={`${gonkaMnemonicWords.length} secret words`}
        actions={
          <span className="xp-wizard-actions-inline">
            <XpButton onClick={() => setRevealed(v => !v)}>
              {revealed ? 'Hide' : 'Show'}
            </XpButton>
            <XpButton onClick={() => void copy()}>Copy</XpButton>
          </span>
        }
      >
        <div className={`xp-wizard-words ${revealed ? '' : 'xp-wizard-words-hidden'}`}>
          {gonkaMnemonicWords.map((w, i) => (
            <div key={i} className="xp-wizard-word">
              <span className="xp-wizard-word-idx">{i + 1}.</span>
              <span className="xp-wizard-word-text">{revealed ? w : '••••••'}</span>
            </div>
          ))}
        </div>
      </XpSection>

      <XpCheckRow
        checked={mnemonicAcknowledged}
        onChange={() => ctrl.update('mnemonicAcknowledged', !mnemonicAcknowledged)}
        label={`I saved my ${gonkaMnemonicWords.length} words. I get that I can't see them again.`}
      />
    </div>
  )
}
