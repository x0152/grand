import { Bell, Check, Loader2, Mail, Plug, Sparkles, Wallet, type IconComponent } from '@/lib/icons'
import { AppleHero } from '../components/apple/AppleHero'
import { AppleListGroup } from '../components/apple/AppleListGroup'
import { StepHero } from '../components/StepHero'
import type { Provider } from '../types'

interface FinishStepProps {
  provider: Provider
  chatModel?: string
  endpoint: string
  telegramLabel: string
  emailLabel: string
  submitting?: boolean
}

export function FinishStep({ provider, chatModel, endpoint, telegramLabel, emailLabel, submitting }: FinishStepProps) {
  const rows: Array<{ icon: IconComponent; label: string; value: string }> = [
    {
      icon: provider === 'openai' ? Plug : Wallet,
      label: 'Powered by',
      value: provider === 'openai' ? 'OpenAI-compatible API' : 'Gonka wallet',
    },
    { icon: Plug, label: 'Server', value: endpoint || '—' },
    { icon: Sparkles, label: 'Chat model', value: chatModel || '—' },
    { icon: Bell, label: 'Telegram', value: telegramLabel },
    { icon: Mail, label: 'Email', value: emailLabel },
  ]

  return (
    <div className="space-y-10">
      <StepHero
        stepId="finish"
        hero={<AppleHero iconNode={<Check size={48} weight="bold" className="text-white" />} tone="emerald" />}
      />

      <AppleListGroup>
        {rows.map((row, i) => {
          const Icon = row.icon
          return (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="size-10 rounded-xl bg-[var(--grand-surface-2)] text-[var(--grand-fg-2)] flex items-center justify-center shrink-0">
                <Icon size={18} weight="duotone" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-mono uppercase tracking-[0.16em] text-[var(--grand-muted-2)]">
                  {row.label}
                </div>
                <div className="text-[15px] font-medium text-[var(--grand-fg)] mt-0.5 truncate">
                  {row.value}
                </div>
              </div>
            </div>
          )
        })}
      </AppleListGroup>

      {submitting && (
        <div className="flex items-start gap-3 rounded-2xl ring-1 ring-blue-500/30 bg-blue-500/[0.06] px-5 py-4 text-[13.5px] text-blue-700 dark:text-blue-400">
          <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />
          <span>
            Initializing GRAND — provisioning sandboxes and applying your configuration. This can
            take up to a minute on the first run, please don't close this window.
          </span>
        </div>
      )}
    </div>
  )
}
