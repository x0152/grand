import { XpButton, XpField, XpRadioRow, XpSection, XpStatusLine, XpTextarea } from './shared'
import type { WizardController } from './useWizardController'
import { isValidMnemonic, isValidPrivateKey } from '../../wizard/utils'

interface Props {
  ctrl: WizardController
}

export function WalletImportStep({ ctrl }: Props) {
  if (!ctrl.state) return null
  const s = ctrl.state
  const wordCount = s.gonkaMnemonicInput.trim()
    ? s.gonkaMnemonicInput.trim().split(/\s+/).length
    : 0
  const mnemonicValid = isValidMnemonic(s.gonkaMnemonicInput)
  const privateKeyValid = isValidPrivateKey(s.gonkaPrivateKey)
  const canSubmit =
    !!s.gonkaNodeUrl.trim() && (s.walletImportMode === 'mnemonic' ? mnemonicValid : privateKeyValid)

  return (
    <div className="xp-wizard-step">
      <p className="xp-wizard-prose">
        Paste the recovery phrase from Keplr, Cosmostation or Leap, or use a private key as a
        fallback.
      </p>

      <XpSection title="Import method">
        <XpRadioRow
          name="wallet-import-mode"
          checked={s.walletImportMode === 'mnemonic'}
          onChange={() => ctrl.onWalletImportModeSelect('mnemonic')}
          label={<><strong>Recovery phrase</strong> — 12 or 24 words (recommended)</>}
        />
        <XpRadioRow
          name="wallet-import-mode"
          checked={s.walletImportMode === 'private-key'}
          onChange={() => ctrl.onWalletImportModeSelect('private-key')}
          label={<><strong>Private key</strong> — advanced fallback</>}
        />
      </XpSection>

      {s.walletImportMode === 'mnemonic' ? (
        <XpTextarea
          label="Recovery phrase"
          value={s.gonkaMnemonicInput}
          onChange={v => ctrl.update('gonkaMnemonicInput', v)}
          placeholder="word1 word2 word3 word4 …"
          rows={3}
          hint={
            wordCount === 0
              ? 'Separate words with spaces. Lowercase only.'
              : mnemonicValid
                ? `${wordCount} words — looks good`
                : `${wordCount} word${wordCount === 1 ? '' : 's'} — need 12, 15, 18, 21 or 24`
          }
        />
      ) : (
        <>
          <XpStatusLine tone="warn">
            A recovery phrase is safer. Use the private key only if your wallet shows nothing else.
          </XpStatusLine>
          <XpField
            label="Private key (64 hex chars, with or without 0x)"
            type="password"
            value={s.gonkaPrivateKey}
            onChange={v => ctrl.update('gonkaPrivateKey', v)}
            placeholder="0x..."
            monospace
          />
        </>
      )}

      <XpField
        label="Gonka node URL"
        value={s.gonkaNodeUrl}
        onChange={v => ctrl.update('gonkaNodeUrl', v)}
        placeholder="https://node4.gonka.ai"
        monospace
      />

      <div className="xp-wizard-actions-inline">
        <XpButton
          primary
          onClick={() => void ctrl.onUseExisting()}
          disabled={!canSubmit || ctrl.submitting}
        >
          {ctrl.submitting ? 'Connecting wallet…' : 'Use this wallet'}
        </XpButton>
      </div>
    </div>
  )
}
