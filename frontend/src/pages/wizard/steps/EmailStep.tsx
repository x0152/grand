import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/FormField'
import { CheckCircle2, ExternalLink, Loader2, XCircle } from '@/lib/icons'
import { api } from '@/api'
import type { EmailProbe, EmailVerifyResult } from '@/types'

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

const GOOGLE_HELP_URL = 'https://support.google.com/mail/answer/7126229'

export function EmailStep({
  address,
  smtpHost, smtpPort, smtpUsername, smtpPassword, smtpPasswordKnown,
  imapHost, imapPort, imapUsername, imapPassword, imapPasswordKnown,
  skip,
  onChangeAddress,
  onChangeSmtpHost, onChangeSmtpPort, onChangeSmtpUsername, onChangeSmtpPassword,
  onChangeImapHost, onChangeImapPort, onChangeImapUsername, onChangeImapPassword,
  onChangeSkip,
}: EmailStepProps) {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<EmailVerifyResult | null>(null)
  const [testError, setTestError] = useState('')

  const disabled = skip
  const canTest =
    !skip &&
    !!address.trim() &&
    ((!!smtpHost.trim() && (smtpPasswordKnown || !!smtpPassword.trim())) ||
      (!!imapHost.trim() && (imapPasswordKnown || !!imapPassword.trim())))

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
    <div className="space-y-3.5">
      <FormField
        label="Email address"
        hint={
          <>
            For Gmail use an{' '}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
              className="text-teal-600 dark:text-teal-400 hover:underline"
            >
              app password
            </a>
            . SMTP/IMAP host, port and SSL settings live in{' '}
            <a
              href={GOOGLE_HELP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-teal-600 dark:text-teal-400 hover:underline"
            >
              Google’s guide <ExternalLink size={11} />
            </a>
            .
          </>
        }
      >
        <Input
          type="email"
          value={address}
          onChange={e => onChangeAddress(e.target.value)}
          placeholder="you@example.com"
          disabled={disabled}
        />
      </FormField>

      <div className="space-y-3 rounded-md border border-zinc-200/70 dark:border-zinc-800/60 px-3 py-3">
        <div className="kicker"><span>SMTP · outgoing</span></div>
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <FormField label="Host">
            <Input value={smtpHost} onChange={e => onChangeSmtpHost(e.target.value)} placeholder="smtp.gmail.com" disabled={disabled} />
          </FormField>
          <FormField label="Port">
            <Input value={smtpPort} onChange={e => onChangeSmtpPort(e.target.value)} placeholder="465" disabled={disabled} />
          </FormField>
        </div>
        <FormField label="Username">
          <Input value={smtpUsername} onChange={e => onChangeSmtpUsername(e.target.value)} placeholder={address || 'you@example.com'} disabled={disabled} />
        </FormField>
        <FormField label="Password">
          <Input
            type="password"
            value={smtpPassword}
            onChange={e => onChangeSmtpPassword(e.target.value)}
            placeholder={smtpPasswordKnown ? '*' : 'app password'}
            disabled={disabled}
          />
        </FormField>
      </div>

      <div className="space-y-3 rounded-md border border-zinc-200/70 dark:border-zinc-800/60 px-3 py-3">
        <div className="kicker"><span>IMAP · incoming</span></div>
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <FormField label="Host">
            <Input value={imapHost} onChange={e => onChangeImapHost(e.target.value)} placeholder="imap.gmail.com" disabled={disabled} />
          </FormField>
          <FormField label="Port">
            <Input value={imapPort} onChange={e => onChangeImapPort(e.target.value)} placeholder="993" disabled={disabled} />
          </FormField>
        </div>
        <FormField label="Username">
          <Input value={imapUsername} onChange={e => onChangeImapUsername(e.target.value)} placeholder={address || 'you@example.com'} disabled={disabled} />
        </FormField>
        <FormField label="Password">
          <Input
            type="password"
            value={imapPassword}
            onChange={e => onChangeImapPassword(e.target.value)}
            placeholder={imapPasswordKnown ? '*' : 'app password'}
            disabled={disabled}
          />
        </FormField>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onTest()}
          disabled={!canTest || testing}
          className="h-8 text-[12px]"
        >
          {testing ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Testing…
            </>
          ) : (
            'Test connection'
          )}
        </Button>
        <span className="text-[11px] text-zinc-500">
          Sends a login probe to SMTP and IMAP — no mail is sent.
        </span>
      </div>

      {testError && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">
          {testError}
        </div>
      )}

      {result && (
        <div className="space-y-1.5">
          <ProbeRow label="SMTP outgoing" probe={result.smtp} />
          <ProbeRow label="IMAP incoming" probe={result.imap} />
        </div>
      )}

      <label
        className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[12px] cursor-pointer transition-colors ${
          skip
            ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-100/60 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
            : 'border-zinc-200/70 dark:border-zinc-800/60 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
        }`}
      >
        <input
          type="checkbox"
          checked={skip}
          onChange={e => onChangeSkip(e.target.checked)}
          className="mt-0.5 size-4 accent-teal-600"
        />
        <span>I don’t want to connect a mailbox — chat is enough.</span>
      </label>
    </div>
  )
}

function ProbeRow({ label, probe }: { label: string; probe: EmailProbe }) {
  if (probe.skipped) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-zinc-200/70 dark:border-zinc-800/60 px-3 py-2 text-[12px] text-zinc-500 dark:text-zinc-400">
        <span className="size-3 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" aria-hidden />
        <span className="font-medium">{label}</span>
        <span>· skipped — fill in to test</span>
      </div>
    )
  }
  if (probe.ok) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 size={13} />
        <span className="font-medium">{label}</span>
        <span>· {probe.detail || 'login succeeded'}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">
      <XCircle size={13} />
      <span className="font-medium">{label}</span>
      <span>· {probe.detail || 'failed'}</span>
    </div>
  )
}
