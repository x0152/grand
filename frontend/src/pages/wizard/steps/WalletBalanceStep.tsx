import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, RotateCw } from '@/lib/icons'
import { api } from '@/api'
import type { GonkaBalance } from '@/types'
import { AddressDisplay } from '../components/AddressDisplay'
import { AppleAction } from '../components/apple/AppleAction'
import { QRDisplay } from '../components/QRDisplay'
import { StepHero } from '../components/StepHero'
import { formatGnk } from '../utils'

interface WalletBalanceStepProps {
  address: string
  nodeUrl: string
  minBalance: number
  balance: GonkaBalance | null
  onBalanceChange: (b: GonkaBalance | null) => void
  bypass: boolean
  onBypassChange: (v: boolean) => void
}

export function WalletBalanceStep({
  address,
  nodeUrl,
  minBalance,
  balance,
  onBalanceChange,
  bypass,
  onBypassChange,
}: WalletBalanceStepProps) {
  const [loading, setLoading] = useState(false)
  const [refreshError, setRefreshError] = useState('')

  const onBalanceChangeRef = useRef(onBalanceChange)
  useEffect(() => {
    onBalanceChangeRef.current = onBalanceChange
  })

  const refresh = useCallback(async () => {
    if (!address || !nodeUrl) return
    setLoading(true)
    setRefreshError('')
    try {
      const b = await api.gonka.balance(address, nodeUrl)
      onBalanceChangeRef.current(b)
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : 'Balance check failed')
    } finally {
      setLoading(false)
    }
  }, [address, nodeUrl])

  const sufficient = !!balance && balance.gnk >= minBalance

  useEffect(() => {
    if (sufficient) return
    void refresh()
    const id = window.setInterval(refresh, 15_000)
    return () => window.clearInterval(id)
  }, [refresh, sufficient])

  return (
    <div className="space-y-10">
      <StepHero stepId="wallet-balance" align="left" />

      {address && (
        <div className="flex justify-center">
          <QRDisplay
            value={address}
            caption="Open Keplr / Cosmostation / Leap on your phone → Send → Scan this QR."
          />
        </div>
      )}

      <AddressDisplay label="Send GNK to this address" address={address} copyMessage="Address copied" />

      <BalanceCard
        balance={balance}
        sufficient={sufficient}
        loading={loading}
        refreshError={refreshError}
        minBalance={minBalance}
        onRefresh={refresh}
      />

      <BypassToggle bypass={bypass} onChange={onBypassChange} />
    </div>
  )
}

function BalanceCard({
  balance,
  sufficient,
  loading,
  refreshError,
  minBalance,
  onRefresh,
}: {
  balance: GonkaBalance | null
  sufficient: boolean
  loading: boolean
  refreshError: string
  minBalance: number
  onRefresh: () => void
}) {
  return (
    <div
      className={`rounded-3xl ring-1 px-6 py-5 transition-all ${
        sufficient
          ? 'ring-emerald-500/40 bg-emerald-500/[0.06]'
          : 'ring-[var(--grand-border-2)] bg-[var(--grand-surface)]'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[12px] font-mono uppercase tracking-[0.16em] text-[var(--grand-muted-2)]">
            Wallet balance
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[34px] font-semibold tabular-nums tracking-tight text-[var(--grand-fg)]">
              {balance ? formatGnk(balance.gnk) : '—'}
            </span>
            <span className="text-[14px] font-medium uppercase tracking-wide text-[var(--grand-muted)]">
              GNK
            </span>
          </div>
        </div>
        <AppleAction
          variant="secondary"
          onClick={onRefresh}
          disabled={loading}
          className="h-10 px-4 rounded-full text-[13px]"
          leading={loading ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}
        >
          Refresh
        </AppleAction>
      </div>

      {refreshError && (
        <p className="mt-3 text-[13px] text-rose-600 dark:text-rose-400">{refreshError}</p>
      )}

      {sufficient ? (
        <div className="mt-3 flex items-center gap-2 text-[13.5px] text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 size={16} weight="fill" />
          <span>Funded — you’re ready to chat. Tap Continue.</span>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-[var(--grand-muted)]">
          We re-check every few seconds. You need at least{' '}
          <span className="font-medium text-[var(--grand-fg-2)]">{minBalance} GNK</span>.
        </p>
      )}
    </div>
  )
}

function BypassToggle({
  bypass,
  onChange,
}: {
  bypass: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!bypass)}
      className={`w-full flex items-center gap-4 rounded-2xl ring-1 px-5 py-4 text-left transition-all ${
        bypass
          ? 'ring-amber-500/50 bg-amber-500/[0.06]'
          : 'ring-[var(--grand-border-2)] bg-[var(--grand-surface)] hover:ring-[var(--grand-border)]'
      }`}
    >
      <span
        className={`size-7 shrink-0 rounded-md ring-2 inline-flex items-center justify-center transition-colors ${
          bypass
            ? 'bg-amber-500 ring-amber-500 text-white'
            : 'ring-[var(--grand-border)]'
        }`}
      >
        {bypass && (
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
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-medium text-[var(--grand-fg)]">
          I’ll add money later
        </span>
        <span className="block text-[12.5px] text-[var(--grand-muted)] mt-0.5">
          Skip the funding check for now. You can top up any time from Setup.
        </span>
      </span>
    </button>
  )
}
