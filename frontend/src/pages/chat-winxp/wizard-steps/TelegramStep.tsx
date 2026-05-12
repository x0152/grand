import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api'
import type { TelegramWizardBot, TelegramWizardUser } from '@/types'
import { XpButton, XpCheckRow, XpField, XpSection, XpStatusLine } from './shared'
import type { WizardController } from './useWizardController'

interface Props {
  ctrl: WizardController
}

export function TelegramStep({ ctrl }: Props) {
  if (!ctrl.state) return null
  const { tgToken, tgLinkedUser, tgSkip } = ctrl.state

  const [bot, setBot] = useState<TelegramWizardBot | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [statusError, setStatusError] = useState('')
  const [waiting, setWaiting] = useState(false)
  const initialTokenRef = useRef(tgToken)
  // After a Re-link, the backend still remembers the previous user
  // and `status` returns them on the very next poll — which would
  // immediately re-link, hiding the new code. Track the id we just
  // unlinked from and ignore it until a DIFFERENT account sends the
  // code from Telegram. Cleared on token change / explicit reset.
  const [ignoredUserId, setIgnoredUserId] = useState<number | null>(null)
  // Latest `ctrl` snapshot. We read from this inside long-lived
  // effects (initial verify + status poller) so that a fresh
  // controller object on every render does NOT cancel and restart
  // the polling — which used to clear/recreate `bot` and visibly
  // wipe the BotCodeBlock with the connect code.
  const ctrlRef = useRef(ctrl)
  ctrlRef.current = ctrl

  const reset = useCallback(() => {
    setBot(null)
    setVerifyError('')
    setStatusError('')
    setWaiting(false)
    setIgnoredUserId(null)
    ctrlRef.current.update('tgLinkedUser', null)
  }, [])

  const relink = useCallback(() => {
    setIgnoredUserId(tgLinkedUser?.id ?? null)
    ctrlRef.current.update('tgLinkedUser', null)
  }, [tgLinkedUser])

  const verify = useCallback(
    async (value: string): Promise<TelegramWizardBot | null> => {
      const trimmed = value.trim()
      if (!trimmed) {
        reset()
        return null
      }
      setVerifying(true)
      setVerifyError('')
      setStatusError('')
      try {
        const result = await api.telegram.verify(trimmed)
        setBot(result)
        return result
      } catch (e) {
        setBot(null)
        setVerifyError(e instanceof Error ? e.message : 'Could not reach Telegram')
        return null
      } finally {
        setVerifying(false)
      }
    },
    [reset],
  )

  // Run the initial verify ONCE per mount. Without the ref guard the
  // effect would re-fire whenever `verify` changes (which it does on
  // any ctrl object change — see ctrlRef above), triggering an extra
  // round-trip to Telegram every couple of seconds.
  const initialVerifyRanRef = useRef(false)
  useEffect(() => {
    if (initialVerifyRanRef.current) return
    initialVerifyRanRef.current = true
    if (initialTokenRef.current.trim()) void verify(initialTokenRef.current)
  }, [verify])

  useEffect(() => {
    if (tgSkip || !bot || !tgToken.trim() || tgLinkedUser) {
      setWaiting(false)
      setStatusError('')
      return
    }
    setWaiting(true)
    let cancelled = false
    const tick = async () => {
      try {
        const res = await api.telegram.status(tgToken.trim())
        if (cancelled) return
        setStatusError('')
        if (res.user) {
          // After a Re-link the backend still echoes the previous
          // user — ignore that id until a different account sends
          // the code, otherwise the BotCodeBlock would flash and
          // immediately collapse back to LinkedBlock.
          if (ignoredUserId != null && res.user.id === ignoredUserId) return
          setIgnoredUserId(null)
          ctrlRef.current.update('tgLinkedUser', res.user)
          setWaiting(false)
        }
      } catch (e) {
        if (cancelled) return
        setStatusError(e instanceof Error ? e.message : 'Could not check Telegram status')
      }
    }
    void tick()
    const id = setInterval(tick, 2500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [tgSkip, bot, tgToken, tgLinkedUser, ignoredUserId])

  const canVerify = !!tgToken.trim() && !verifying && !tgSkip

  return (
    <div className="xp-wizard-step">
      <p className="xp-wizard-prose">
        Paste your bot token from{' '}
        <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
          @BotFather
        </a>
        , then send the code from your Telegram — we'll link the account automatically.
      </p>

      <XpSection title="Bot token">
        <XpField
          label="Token"
          value={tgToken}
          onChange={v => {
            ctrl.update('tgToken', v)
            reset()
          }}
          placeholder="123456:ABC-DEF..."
          monospace
          disabled={tgSkip}
          hint={
            <>
              Get one from{' '}
              <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
                @BotFather
              </a>
              : open the chat, send <code>/newbot</code>, follow the steps.
            </>
          }
        />
        <div className="xp-wizard-actions-inline">
          <XpButton onClick={() => void verify(tgToken)} disabled={!canVerify}>
            {verifying ? 'Checking…' : bot ? 'Re-check' : 'Verify'}
          </XpButton>
        </div>
      </XpSection>

      {verifyError && !tgSkip && (
        <XpStatusLine tone="error">Couldn't reach the bot: {verifyError}</XpStatusLine>
      )}

      {bot && !tgLinkedUser && !tgSkip && (
        <BotCodeBlock bot={bot} waiting={waiting} />
      )}

      {statusError && bot && !tgLinkedUser && !tgSkip && (
        <XpStatusLine tone="error">{statusError}</XpStatusLine>
      )}

      {bot && tgLinkedUser && !tgSkip && (
        <LinkedBlock
          linkedUser={tgLinkedUser}
          onRelink={relink}
        />
      )}

      <XpCheckRow
        checked={tgSkip}
        onChange={() => ctrl.update('tgSkip', !tgSkip)}
        label="I don't want to connect Telegram (skip this step)"
      />
    </div>
  )
}

function BotCodeBlock({ bot, waiting }: { bot: TelegramWizardBot; waiting: boolean }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bot.code)
    } catch {}
  }
  return (
    <XpSection title={`Connected to @${bot.username || bot.name}`}>
      <p className="xp-wizard-help xp-wizard-help-block">Send this code to the bot:</p>
      <div className="xp-wizard-code">
        <code>{bot.code}</code>
      </div>
      <div className="xp-wizard-actions-inline">
        {bot.deepLink && (
          <XpButton primary onClick={() => window.open(bot.deepLink, '_blank', 'noreferrer')}>
            Open bot in Telegram
          </XpButton>
        )}
        <XpButton onClick={() => void copy()}>Copy code</XpButton>
      </div>
      <XpStatusLine tone={waiting ? 'info' : 'warn'}>
        {waiting ? 'Waiting for the code from your Telegram…' : 'Verify the bot to start listening.'}
      </XpStatusLine>
    </XpSection>
  )
}

function LinkedBlock({
  linkedUser,
  onRelink,
}: {
  linkedUser: TelegramWizardUser
  onRelink: () => void
}) {
  const friendly = linkedUser.name?.trim() || linkedUser.username?.trim() || ''
  return (
    <XpSection title={friendly ? `Linked as ${friendly}` : 'Linked to your Telegram'}>
      <p className="xp-wizard-help xp-wizard-help-block">
        {linkedUser.username && <>@{linkedUser.username} · </>}id {linkedUser.id}
      </p>
      <div className="xp-wizard-actions-inline">
        <XpButton onClick={onRelink}>Re-link</XpButton>
      </div>
    </XpSection>
  )
}
