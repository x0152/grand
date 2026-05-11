import { CheckCircle2, XCircle } from '@/lib/icons'
import type { EmailProbe, EmailVerifyResult } from '@/types'

interface EmailTestResultProps {
  result: EmailVerifyResult
}

export function EmailTestResult({ result }: EmailTestResultProps) {
  return (
    <div className="rounded-2xl bg-[var(--grand-surface)] ring-1 ring-[var(--grand-border-2)] overflow-hidden divide-y divide-[var(--grand-border-2)]">
      <ProbeRow label="SMTP — outgoing" probe={result.smtp} />
      <ProbeRow label="IMAP — incoming" probe={result.imap} />
    </div>
  )
}

function ProbeRow({ label, probe }: { label: string; probe: EmailProbe }) {
  const tone = probe.skipped ? 'skipped' : probe.ok ? 'ok' : 'fail'
  const palette = {
    skipped: { bg: 'bg-[var(--grand-surface-2)]', text: 'text-[var(--grand-muted)]' },
    ok: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400' },
    fail: { bg: 'bg-rose-500/10', text: 'text-rose-700 dark:text-rose-400' },
  }[tone]
  const message = probe.skipped
    ? 'skipped — fill in to test'
    : probe.detail || (probe.ok ? 'login succeeded' : 'failed')

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className={`size-9 shrink-0 rounded-full flex items-center justify-center ${palette.bg} ${palette.text}`}>
        {tone === 'ok' && <CheckCircle2 size={18} weight="fill" />}
        {tone === 'fail' && <XCircle size={18} weight="fill" />}
        {tone === 'skipped' && <span className="size-2 rounded-full bg-current opacity-60" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-medium tracking-tight text-[var(--grand-fg)]">
          {label}
        </div>
        <div className={`text-[13px] mt-0.5 ${palette.text}`}>{message}</div>
      </div>
    </div>
  )
}
