import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Copy, Link2, Loader2, Send } from '@/lib/icons'
import { api } from '@/api'
import type { TelegramWizardBot, TelegramWizardUser } from '@/types'
import { AppleAction } from '../components/apple/AppleAction'
import { AppleField } from '../components/apple/AppleField'
import { AppleListGroup } from '../components/apple/AppleListGroup'
import { AppleNote } from '../components/apple/AppleNote'
import { AppleSection } from '../components/apple/AppleSection'
import { BrandLogo } from '../components/brandLogo'
import { TELEGRAM_BRAND } from '../components/brandSpecs'
import { StepHero } from '../components/StepHero'
import { SkipToggle } from '../components/SkipToggle'

interface TelegramStepProps {
  token: string
  linkedUser: TelegramWizardUser | null
  skip: boolean
  onChangeToken: (v: string) => void
  onChangeLinkedUser: (user: TelegramWizardUser | null) => void
  onChangeSkip: (v: boolean) => void
}

export function TelegramStep({
  token,
  linkedUser,
  skip,
  onChangeToken,
  onChangeLinkedUser,
  onChangeSkip,
}: TelegramStepProps) {
  const [bot, setBot] = useState<TelegramWizardBot | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [statusError, setStatusError] = useState('')
  const [waiting, setWaiting] = useState(false)
  const initialTokenRef = useRef(token)

  const reset = useCallback(() => {
    setBot(null)
    setVerifyError('')
    setStatusError('')
    setWaiting(false)
    onChangeLinkedUser(null)
  }, [onChangeLinkedUser])

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

  useEffect(() => {
    if (initialTokenRef.current.trim()) void verify(initialTokenRef.current)
  }, [verify])

  useEffect(() => {
    if (skip || !bot || !token.trim() || linkedUser) {
      setWaiting(false)
      setStatusError('')
      return
    }
    setWaiting(true)
    let cancelled = false
    const tick = async () => {
      try {
        const res = await api.telegram.status(token.trim())
        if (cancelled) return
        setStatusError('')
        if (res.user) {
          onChangeLinkedUser(res.user)
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
  }, [skip, bot, token, linkedUser, onChangeLinkedUser])

  const inputsDisabled = skip
  const canVerify = !!token.trim() && !verifying && !inputsDisabled

  return (
    <div className="space-y-10">
      <StepHero stepId="telegram" align="left" hero={<BrandLogo spec={TELEGRAM_BRAND} size={68} rounded={20} />} />

      <TokenSection
        token={token}
        bot={bot}
        verifying={verifying}
        canVerify={canVerify}
        disabled={inputsDisabled}
        onChange={value => {
          onChangeToken(value)
          reset()
        }}
        onVerify={() => void verify(token)}
        onBlurVerify={value => {
          if (value.trim() && !bot && !skip) void verify(value)
        }}
      />

      {verifyError && !skip && (
        <AppleNote tone="danger" title="Couldn’t reach the bot">
          {verifyError}
        </AppleNote>
      )}

      {statusError && bot && !linkedUser && !skip && (
        <AppleNote tone="danger" title="Couldn’t check Telegram status">
          {statusError}
        </AppleNote>
      )}

      {bot && !linkedUser && !skip && (
        <CodeBlock bot={bot} waiting={waiting} />
      )}

      {bot && linkedUser && !skip && (
        <LinkedCard linkedUser={linkedUser} onRelink={() => onChangeLinkedUser(null)} />
      )}

      <SkipToggle
        checked={skip}
        onChange={onChangeSkip}
        label="I don’t want to connect Telegram"
        helper="You can add it later in Setup or via the TG_BOT_TOKEN env variable."
      />
    </div>
  )
}

function TokenSection({
  token,
  bot,
  verifying,
  canVerify,
  disabled,
  onChange,
  onVerify,
  onBlurVerify,
}: {
  token: string
  bot: TelegramWizardBot | null
  verifying: boolean
  canVerify: boolean
  disabled: boolean
  onChange: (v: string) => void
  onVerify: () => void
  onBlurVerify: (value: string) => void
}) {
  return (
    <AppleSection title="Bot token">
      <AppleListGroup
        caption={
          <>
            Get one from{' '}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
            >
              @BotFather
            </a>
            : open the chat, send <code className="font-mono text-[12.5px]">/newbot</code>, follow the steps.
          </>
        }
      >
        <AppleField
          label="Token"
          value={token}
          onChange={e => onChange(e.target.value)}
          onBlur={e => onBlurVerify(e.target.value)}
          placeholder="123456:ABC-DEF..."
          monospace
          disabled={disabled}
          trailing={
            <AppleAction
              variant="secondary"
              className="h-9 px-3.5 rounded-full text-[13px]"
              onClick={onVerify}
              disabled={!canVerify}
              leading={verifying ? <Loader2 size={13} className="animate-spin" /> : undefined}
            >
              {verifying ? 'Checking' : bot ? 'Re-check' : 'Verify'}
            </AppleAction>
          }
        />
      </AppleListGroup>
    </AppleSection>
  )
}

function CodeBlock({ bot, waiting }: { bot: TelegramWizardBot; waiting: boolean }) {
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(bot.code)
      toast.success('Code copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-[var(--grand-surface)] ring-1 ring-emerald-500/30 p-6 space-y-5">
        <div className="flex items-center gap-2.5 text-[14px] text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 size={16} weight="fill" />
          <span>
            Connected to <span className="font-mono">{bot.name || bot.username}</span>
            {bot.username && (
              <>
                {' '}—{' '}
                <a
                  href={bot.link}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono hover:underline"
                >
                  @{bot.username}
                </a>
              </>
            )}
          </span>
        </div>

        <div>
          <div className="text-[12px] font-mono uppercase tracking-[0.16em] text-[var(--grand-muted-2)]">
            Send this code to the bot
          </div>
          <div className="mt-3 rounded-2xl bg-[var(--grand-bg)] ring-1 ring-[var(--grand-border-2)] py-6 px-5 text-center">
            <code className="font-mono text-[36px] sm:text-[42px] font-bold tracking-[0.18em] text-[var(--grand-fg)]">
              {bot.code}
            </code>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          {bot.deepLink && (
            <AppleAction
              variant="primary"
              fullWidth
              className="h-12 rounded-2xl text-[14.5px]"
              leading={<Link2 size={15} weight="bold" />}
              onClick={() => window.open(bot.deepLink, '_blank', 'noreferrer')}
            >
              Open bot in Telegram
            </AppleAction>
          )}
          <AppleAction
            variant="secondary"
            fullWidth
            className="h-12 rounded-2xl text-[14.5px]"
            leading={<Copy size={15} weight="bold" />}
            onClick={copyCode}
          >
            Copy code
          </AppleAction>
        </div>
      </div>

      <WaitingRow waiting={waiting} />
    </div>
  )
}

function WaitingRow({ waiting }: { waiting: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2.5 text-[13.5px] text-[var(--grand-muted)]">
      {waiting ? (
        <>
          <Loader2 size={15} className="animate-spin text-emerald-500" />
          <span>Waiting for the code from your Telegram…</span>
        </>
      ) : (
        <>
          <Send size={14} />
          <span>Verify the bot to start listening for the code.</span>
        </>
      )}
    </div>
  )
}

function LinkedCard({
  linkedUser,
  onRelink,
}: {
  linkedUser: TelegramWizardUser
  onRelink: () => void
}) {
  const friendly = linkedUser.name?.trim() || linkedUser.username?.trim() || ''
  const title: ReactNode = friendly ? `Linked as ${friendly}` : 'Linked to your Telegram'
  return (
    <div className="rounded-3xl bg-emerald-500/[0.07] ring-1 ring-emerald-500/35 p-6 space-y-3">
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <CheckCircle2 size={26} weight="fill" />
        </div>
        <div>
          <div className="text-[16px] font-semibold tracking-tight text-[var(--grand-fg)]">
            {title}
          </div>
          <div className="text-[12.5px] text-[var(--grand-muted)] font-mono mt-0.5">
            {linkedUser.username && <>@{linkedUser.username} · </>}id {linkedUser.id}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-[var(--grand-muted)] leading-snug">
          Only this account can talk to the bot. Add more later in Hosts → Channels.
        </span>
        <AppleAction
          variant="ghost"
          onClick={onRelink}
          className="h-9 px-3.5 rounded-full text-[12.5px] shrink-0"
        >
          Re-link
        </AppleAction>
      </div>
    </div>
  )
}
