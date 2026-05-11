import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, Eye, QrCode, ShieldAlert } from '@/lib/icons'
import { AddressDisplay } from '../components/AddressDisplay'
import { AppleAction } from '../components/apple/AppleAction'
import { AppleNote } from '../components/apple/AppleNote'
import { AppleSection } from '../components/apple/AppleSection'
import { QRDisplay } from '../components/QRDisplay'
import { StepHero } from '../components/StepHero'

interface WalletRevealStepProps {
  address: string
  words: string[]
  acknowledged: boolean
  onAcknowledge: (v: boolean) => void
}

export function WalletRevealStep({ address, words, acknowledged, onAcknowledge }: WalletRevealStepProps) {
  const [revealed, setRevealed] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const phrase = words.join(' ')

  const copyPhrase = async () => {
    if (!phrase) return
    try {
      await navigator.clipboard.writeText(phrase)
      toast.success('Recovery phrase copied to clipboard')
    } catch {
      toast.error('Copy failed — please write the phrase down manually')
    }
  }

  return (
    <div className="space-y-10">
      <StepHero stepId="wallet-reveal" align="left" />

      <AppleNote tone="danger" title="Save these words now" icon={ShieldAlert}>
        Anyone with these words can take your money. Write them on paper or save them in a
        password manager — we won’t show them again.
      </AppleNote>

      <AddressDisplay label="Your wallet address" address={address} />

      <AppleSection
        title={`Your ${words.length} secret words`}
        trailing={
          <div className="flex items-center gap-2">
            <SmallChip
              onClick={() => setRevealed(v => !v)}
              icon={<Eye size={12} weight="bold" />}
              label={revealed ? 'Hide' : 'Show'}
            />
            <SmallChip
              onClick={copyPhrase}
              icon={<Copy size={12} weight="bold" />}
              label="Copy"
            />
          </div>
        }
      >
        <div
          className={`rounded-2xl bg-[var(--grand-surface)] ring-1 ring-[var(--grand-border-2)] p-4 grid grid-cols-3 gap-2 ${
            revealed ? '' : 'select-none'
          }`}
        >
          {words.map((word, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-xl bg-[var(--grand-bg)] px-3 py-2.5"
            >
              <span className="font-mono text-[11px] tabular-nums text-[var(--grand-muted-2)] w-6 shrink-0">
                {i + 1}.
              </span>
              <span
                className={`font-mono text-[14px] tracking-tight ${
                  revealed
                    ? 'text-[var(--grand-fg)]'
                    : 'tracking-widest text-[var(--grand-muted-2)] blur-[5px]'
                }`}
              >
                {revealed ? word : '••••••'}
              </span>
            </div>
          ))}
        </div>
      </AppleSection>

      <div className="rounded-2xl bg-[var(--grand-surface)] ring-1 ring-[var(--grand-border-2)] p-5 space-y-3">
        <button
          type="button"
          onClick={() => setShowQR(v => !v)}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="flex items-center gap-2.5 text-[14px] text-[var(--grand-fg-2)]">
            <QrCode size={16} /> Import into a mobile wallet
          </span>
          <span className="text-[13px] text-emerald-600 dark:text-emerald-400 font-medium">
            {showQR ? 'Hide QR' : 'Show QR'}
          </span>
        </button>
        {showQR && (
          <QRDisplay
            value={phrase}
            tone="amber"
            caption="Open Cosmostation, Leap, or Trust Wallet → Add wallet → Scan QR. Keplr Mobile needs the phrase typed manually."
          />
        )}
      </div>

      <AcknowledgeRow
        acknowledged={acknowledged}
        onAcknowledge={onAcknowledge}
        wordCount={words.length}
      />
    </div>
  )
}

function SmallChip({
  onClick,
  icon,
  label,
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <AppleAction
      variant="secondary"
      onClick={onClick}
      className="h-9 px-3.5 rounded-full text-[13px]"
      leading={icon}
    >
      {label}
    </AppleAction>
  )
}

function AcknowledgeRow({
  acknowledged,
  onAcknowledge,
  wordCount,
}: {
  acknowledged: boolean
  onAcknowledge: (v: boolean) => void
  wordCount: number
}) {
  return (
    <button
      type="button"
      onClick={() => onAcknowledge(!acknowledged)}
      className={`w-full flex items-center gap-4 rounded-2xl ring-1 px-5 py-4 text-left transition-all ${
        acknowledged
          ? 'ring-2 ring-emerald-500 bg-emerald-500/[0.05]'
          : 'ring-[var(--grand-border)] bg-[var(--grand-surface)] hover:ring-[var(--grand-border-2)]'
      }`}
    >
      <span
        className={`size-7 shrink-0 rounded-md ring-2 inline-flex items-center justify-center transition-colors ${
          acknowledged
            ? 'bg-emerald-500 ring-emerald-500 text-white'
            : 'ring-[var(--grand-border)]'
        }`}
      >
        {acknowledged && (
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
            <path
              d="M3 8.2 6.5 11.5 13 5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="text-[14.5px] leading-snug text-[var(--grand-fg-2)]">
        I saved my {wordCount} words. I get that I can’t see them again.
      </span>
    </button>
  )
}
