import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api'
import type { GonkaBalance } from '@/types'
import { XpButton, XpCheckRow, XpSection, XpStatusLine } from './shared'
import { formatGnk } from '../../wizard/utils'
import type { WizardController } from './useWizardController'

interface Props {
  ctrl: WizardController
}

export function WalletBalanceStep({ ctrl }: Props) {
  const [loading, setLoading] = useState(false)
  const [refreshError, setRefreshError] = useState('')

  if (!ctrl.state) return null

  const { gonkaAddress, gonkaNodeUrl, gonkaBalance, bypassBalance } = ctrl.state
  const minBalance = ctrl.minBalance
  const sufficient = !!gonkaBalance && gonkaBalance.gnk >= minBalance

  const onBalanceChangeRef = useRef<(b: GonkaBalance | null) => void>(b =>
    ctrl.update('gonkaBalance', b),
  )
  useEffect(() => {
    onBalanceChangeRef.current = b => ctrl.update('gonkaBalance', b)
  })

  const refresh = useCallback(async () => {
    if (!gonkaAddress || !gonkaNodeUrl) return
    setLoading(true)
    setRefreshError('')
    try {
      const b = await api.gonka.balance(gonkaAddress, gonkaNodeUrl)
      onBalanceChangeRef.current(b)
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : 'Balance check failed')
    } finally {
      setLoading(false)
    }
  }, [gonkaAddress, gonkaNodeUrl])

  useEffect(() => {
    if (sufficient) return
    void refresh()
    const id = window.setInterval(refresh, 15_000)
    return () => window.clearInterval(id)
  }, [refresh, sufficient])

  return (
    <div className="xp-wizard-step">
      <p className="xp-wizard-prose">
        Send at least {minBalance} GNK to the address below — we'll auto-detect it.
      </p>

      <XpSection title="Send GNK to this address">
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

      <div className={`xp-wizard-balance ${sufficient ? 'is-funded' : ''}`}>
        <div className="xp-wizard-balance-head">
          <span className="xp-wizard-balance-label">Wallet balance</span>
          <XpButton onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Checking…' : 'Refresh'}
          </XpButton>
        </div>
        <div className="xp-wizard-balance-amount">
          <span>{gonkaBalance ? formatGnk(gonkaBalance.gnk) : '—'}</span>
          <em>GNK</em>
        </div>
        {refreshError && <XpStatusLine tone="error">{refreshError}</XpStatusLine>}
        {sufficient ? (
          <XpStatusLine tone="ok">Funded — you're ready to chat. Click Next.</XpStatusLine>
        ) : (
          <p className="xp-wizard-help xp-wizard-help-block">
            We re-check every few seconds. You need at least <strong>{minBalance} GNK</strong>.
          </p>
        )}
      </div>

      <XpCheckRow
        checked={bypassBalance}
        onChange={() => ctrl.update('bypassBalance', !bypassBalance)}
        label="I'll add money later — skip the funding check for now"
      />
    </div>
  )
}
