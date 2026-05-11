import { useState } from 'react'
import { Loader2, Mail } from '@/lib/icons'
import { api } from '@/api'
import type { EmailVerifyResult } from '@/types'
import { AppleAction } from '../components/apple/AppleAction'
import { AppleField } from '../components/apple/AppleField'
import { AppleListGroup } from '../components/apple/AppleListGroup'
import { AppleNote } from '../components/apple/AppleNote'
import { AppleSection } from '../components/apple/AppleSection'
import { EmailProviderInstructions } from '../components/EmailProviderInstructions'
import { EmailProviderPicker } from '../components/EmailProviderPicker'
import { EmailServerFields } from '../components/EmailServerFields'
import { EmailTestResult } from '../components/EmailTestResult'
import { SkipToggle } from '../components/SkipToggle'
import { StepHero } from '../components/StepHero'
import { findEmailPreset, type EmailProviderId, type EmailProviderPreset } from '../data/emailPresets'

interface EmailStepProps {
  address: string
  smtpHost: string
  smtpPort: string
  smtpUsername: string
  smtpPassword: string
  smtpPasswordKnown: boolean
  imapHost: string
  imapPort: string
  imapUsername: string
  imapPassword: string
  imapPasswordKnown: boolean
  skip: boolean
  onChangeAddress: (v: string) => void
  onChangeSmtpHost: (v: string) => void
  onChangeSmtpPort: (v: string) => void
  onChangeSmtpUsername: (v: string) => void
  onChangeSmtpPassword: (v: string) => void
  onChangeImapHost: (v: string) => void
  onChangeImapPort: (v: string) => void
  onChangeImapUsername: (v: string) => void
  onChangeImapPassword: (v: string) => void
  onChangeSkip: (v: boolean) => void
}

export function EmailStep(props: EmailStepProps) {
  const {
    address,
    smtpHost,
    smtpPort,
    smtpUsername,
    smtpPassword,
    smtpPasswordKnown,
    imapHost,
    imapPort,
    imapUsername,
    imapPassword,
    imapPasswordKnown,
    skip,
    onChangeAddress,
    onChangeSmtpHost,
    onChangeSmtpPort,
    onChangeSmtpUsername,
    onChangeSmtpPassword,
    onChangeImapHost,
    onChangeImapPort,
    onChangeImapUsername,
    onChangeImapPassword,
    onChangeSkip,
  } = props

  const [selectedProvider, setSelectedProvider] = useState<EmailProviderId | null>(null)
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState('')
  const [result, setResult] = useState<EmailVerifyResult | null>(null)
  const preset = findEmailPreset(selectedProvider)
  const disabled = skip

  const canTest =
    !skip &&
    !!address.trim() &&
    ((!!smtpHost.trim() && (smtpPasswordKnown || !!smtpPassword.trim())) ||
      (!!imapHost.trim() && (imapPasswordKnown || !!imapPassword.trim())))

  const onPickPreset = (id: EmailProviderId | null) => {
    setSelectedProvider(id)
    if (!id) return
    const found = findEmailPreset(id)
    if (found) applyPreset(found)
  }

  const applyPreset = (p: EmailProviderPreset) => {
    onChangeSmtpHost(p.smtpHost)
    onChangeSmtpPort(p.smtpPort)
    onChangeImapHost(p.imapHost)
    onChangeImapPort(p.imapPort)
    if (address.trim()) {
      if (!smtpUsername.trim()) onChangeSmtpUsername(address.trim())
      if (!imapUsername.trim()) onChangeImapUsername(address.trim())
    }
  }

  const onTest = async () => {
    setTesting(true)
    setTestError('')
    setResult(null)
    try {
      const res = await api.config.verifyEmail({
        address: address.trim(),
        smtpHost: smtpHost.trim(),
        smtpPort: smtpPort.trim(),
        smtpUsername: smtpUsername.trim(),
        smtpPassword: smtpPassword.trim(),
        imapHost: imapHost.trim(),
        imapPort: imapPort.trim(),
        imapUsername: imapUsername.trim(),
        imapPassword: imapPassword.trim(),
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
    <div className="space-y-10">
      <StepHero
        stepId="email"
        align="left"
        hero={
          <div className="size-[68px] rounded-[20px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Mail size={32} weight="duotone" />
          </div>
        }
      />

      <AppleSection
        title="Pick your provider"
        trailing={
          selectedProvider && (
            <button
              type="button"
              onClick={() => setSelectedProvider(null)}
              className="text-[12.5px] text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Reset
            </button>
          )
        }
      >
        <EmailProviderPicker
          selected={selectedProvider}
          onSelect={onPickPreset}
          disabled={disabled}
        />
      </AppleSection>

      {preset && <EmailProviderInstructions preset={preset} />}

      <AppleSection title="Email address">
        <AppleListGroup>
          <AppleField
            label="Address"
            type="email"
            value={address}
            onChange={e => onChangeAddress(e.target.value)}
            placeholder="you@example.com"
            disabled={disabled}
            autoComplete="off"
          />
        </AppleListGroup>
      </AppleSection>

      <EmailServerFields
        title="SMTP — outgoing"
        hint="Used to send replies on your behalf."
        host={smtpHost}
        port={smtpPort}
        username={smtpUsername}
        password={smtpPassword}
        passwordKnown={smtpPasswordKnown}
        hostPlaceholder="smtp.gmail.com"
        portPlaceholder="465"
        usernamePlaceholder={address || 'you@example.com'}
        disabled={disabled}
        onChangeHost={onChangeSmtpHost}
        onChangePort={onChangeSmtpPort}
        onChangeUsername={onChangeSmtpUsername}
        onChangePassword={onChangeSmtpPassword}
      />

      <EmailServerFields
        title="IMAP — incoming"
        hint="Used to read your mailbox."
        host={imapHost}
        port={imapPort}
        username={imapUsername}
        password={imapPassword}
        passwordKnown={imapPasswordKnown}
        hostPlaceholder="imap.gmail.com"
        portPlaceholder="993"
        usernamePlaceholder={address || 'you@example.com'}
        disabled={disabled}
        onChangeHost={onChangeImapHost}
        onChangePort={onChangeImapPort}
        onChangeUsername={onChangeImapUsername}
        onChangePassword={onChangeImapPassword}
      />

      <div className="space-y-3">
        <AppleAction
          variant="secondary"
          fullWidth
          onClick={() => void onTest()}
          disabled={!canTest || testing}
          leading={testing ? <Loader2 size={15} className="animate-spin" /> : undefined}
        >
          {testing ? 'Testing connection…' : 'Test connection'}
        </AppleAction>
        <p className="text-center text-[12.5px] text-[var(--grand-muted-2)]">
          Sends a login probe to SMTP and IMAP — no mail is sent.
        </p>
      </div>

      {testError && <AppleNote tone="danger">{testError}</AppleNote>}

      {result && <EmailTestResult result={result} />}

      <SkipToggle
        checked={skip}
        onChange={onChangeSkip}
        label="I don’t want to connect a mailbox"
        helper="Web chat is enough for now. You can add email later in Setup."
      />
    </div>
  )
}
