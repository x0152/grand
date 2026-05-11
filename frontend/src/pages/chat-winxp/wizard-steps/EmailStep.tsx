import { useState } from 'react'
import { api } from '@/api'
import type { EmailVerifyResult } from '@/types'
import { XpButton, XpCheckRow, XpField, XpSection, XpStatusLine } from './shared'
import type { WizardController } from './useWizardController'

interface Props {
  ctrl: WizardController
}

export function EmailStep({ ctrl }: Props) {
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState('')
  const [result, setResult] = useState<EmailVerifyResult | null>(null)

  if (!ctrl.state) return null
  const s = ctrl.state
  const disabled = s.emailSkip

  const hasAddress = !!s.emailAddress.trim()
  const hasSmtp =
    !!s.emailSmtpHost.trim() && (s.emailSmtpPasswordKnown || !!s.emailSmtpPassword.trim())
  const hasImap =
    !!s.emailImapHost.trim() && (s.emailImapPasswordKnown || !!s.emailImapPassword.trim())
  const canTest = !disabled && hasAddress && (hasSmtp || hasImap)

  const onTest = async () => {
    setTesting(true)
    setTestError('')
    setResult(null)
    try {
      const res = await api.config.verifyEmail({
        address: s.emailAddress.trim(),
        smtpHost: s.emailSmtpHost.trim(),
        smtpPort: s.emailSmtpPort.trim(),
        smtpUsername: s.emailSmtpUsername.trim(),
        smtpPassword: s.emailSmtpPassword.trim(),
        imapHost: s.emailImapHost.trim(),
        imapPort: s.emailImapPort.trim(),
        imapUsername: s.emailImapUsername.trim(),
        imapPassword: s.emailImapPassword.trim(),
        skipped: false,
      })
      setResult(res)
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="xp-wizard-step">
      <p className="xp-wizard-prose">
        Connect a mailbox so the assistant can read and reply on your behalf. Skip if you only want
        web chat.
      </p>

      <XpField
        label="Email address"
        type="email"
        value={s.emailAddress}
        onChange={v => ctrl.update('emailAddress', v)}
        placeholder="you@example.com"
        disabled={disabled}
      />

      <XpSection title="SMTP — outgoing" hint="Used to send replies on your behalf.">
        <div className="xp-wizard-grid-2 xp-wizard-grid-compact">
          <XpField
            label="Host"
            value={s.emailSmtpHost}
            onChange={v => ctrl.update('emailSmtpHost', v)}
            placeholder="smtp.gmail.com"
            monospace
            disabled={disabled}
          />
          <XpField
            label="Port"
            value={s.emailSmtpPort}
            onChange={v => ctrl.update('emailSmtpPort', v)}
            placeholder="465"
            monospace
            disabled={disabled}
          />
        </div>
        <XpField
          label="Username"
          value={s.emailSmtpUsername}
          onChange={v => ctrl.update('emailSmtpUsername', v)}
          placeholder={s.emailAddress || 'you@example.com'}
          monospace
          disabled={disabled}
        />
        <XpField
          label={s.emailSmtpPasswordKnown ? 'Password (saved — enter to replace)' : 'Password'}
          type="password"
          value={s.emailSmtpPassword}
          onChange={v => ctrl.update('emailSmtpPassword', v)}
          placeholder="••••••••"
          disabled={disabled}
        />
      </XpSection>

      <XpSection title="IMAP — incoming" hint="Used to read your mailbox.">
        <div className="xp-wizard-grid-2 xp-wizard-grid-compact">
          <XpField
            label="Host"
            value={s.emailImapHost}
            onChange={v => ctrl.update('emailImapHost', v)}
            placeholder="imap.gmail.com"
            monospace
            disabled={disabled}
          />
          <XpField
            label="Port"
            value={s.emailImapPort}
            onChange={v => ctrl.update('emailImapPort', v)}
            placeholder="993"
            monospace
            disabled={disabled}
          />
        </div>
        <XpField
          label="Username"
          value={s.emailImapUsername}
          onChange={v => ctrl.update('emailImapUsername', v)}
          placeholder={s.emailAddress || 'you@example.com'}
          monospace
          disabled={disabled}
        />
        <XpField
          label={s.emailImapPasswordKnown ? 'Password (saved — enter to replace)' : 'Password'}
          type="password"
          value={s.emailImapPassword}
          onChange={v => ctrl.update('emailImapPassword', v)}
          placeholder="••••••••"
          disabled={disabled}
        />
      </XpSection>

      <div className="xp-wizard-actions-inline">
        <XpButton onClick={() => void onTest()} disabled={!canTest || testing}>
          {testing ? 'Testing connection…' : 'Test connection'}
        </XpButton>
        <span className="xp-wizard-help">Sends a login probe — no mail is sent.</span>
      </div>

      {testError && <XpStatusLine tone="error">{testError}</XpStatusLine>}
      {result && (
        <>
          <XpStatusLine tone={result.smtp.ok ? 'ok' : result.smtp.skipped ? 'info' : 'error'}>
            SMTP: {result.smtp.ok ? 'OK' : result.smtp.skipped ? 'skipped' : 'failed'}
            {result.smtp.detail ? ` — ${result.smtp.detail}` : ''}
          </XpStatusLine>
          <XpStatusLine tone={result.imap.ok ? 'ok' : result.imap.skipped ? 'info' : 'error'}>
            IMAP: {result.imap.ok ? 'OK' : result.imap.skipped ? 'skipped' : 'failed'}
            {result.imap.detail ? ` — ${result.imap.detail}` : ''}
          </XpStatusLine>
        </>
      )}

      <XpCheckRow
        checked={s.emailSkip}
        onChange={() => ctrl.update('emailSkip', !s.emailSkip)}
        label="I don't want to connect a mailbox (skip this step)"
      />
    </div>
  )
}
