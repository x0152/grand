import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Wand2, RotateCcw, CheckCircle2, AlertCircle, Loader2 } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { api } from '@/api'
import type { GlobalConfig, ConfigSource } from '@/types'
import SetupWizard from './wizard/SetupWizard'
import type { WizardMode, StepId } from './wizard/types'
import { stepMeta } from './wizard/stepMeta'
import { deriveStatus } from './wizard/status'

type StatusItem = {
  id: StepId
  label: string
  done: boolean
  source: ConfigSource
  optional: boolean
}

export default function SetupPage() {
  const [config, setConfig] = useState<GlobalConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [wizardMode, setWizardMode] = useState<WizardMode | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const cfg = await api.config.get()
      setConfig(cfg)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const onReset = useCallback(async () => {
    setResetting(true)
    try {
      await api.config.reset()
      await reload()
      toast.success('Configuration reset')
      setConfirmReset(false)
      setWizardMode('full')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }, [reload])

  if (wizardMode) {
    return (
      <SetupWizard
        mode={wizardMode}
        onDone={() => {
          setWizardMode(null)
          void reload()
          toast.success('Setup applied')
        }}
      />
    )
  }

  const status = deriveStatus(config)
  const items: StatusItem[] = status.steps.map(step => ({
    id: step.id,
    label: stepMeta(step.id).title,
    done: step.done,
    source: step.source,
    optional: step.optional,
  }))

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="kicker"><span>setup</span></div>
          <h1 className="text-[26px] font-semibold tracking-tight text-[var(--grand-fg)]">
            Configuration
          </h1>
          <p className="text-[14px] text-[var(--grand-muted)] leading-relaxed max-w-xl">
            Provider, models, and channels managed by the wizard. Environment variables prefill empty fields; saved values take over once you finish a step.
          </p>
        </div>
        {status.done && !loading && (
          <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1.5 text-[12px] text-emerald-500">
            <CheckCircle2 size={14} /> ready
          </div>
        )}
      </div>

      <div className="rounded-lg bg-[var(--grand-surface)] divide-y divide-[var(--grand-line)]">
        {loading && (
          <div className="px-5 py-10 flex items-center justify-center text-[13px] text-[var(--grand-muted)]">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading configuration…
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="px-5 py-6 text-[14px] text-[var(--grand-muted)]">
            No configuration steps available.
          </div>
        )}
        {!loading && items.map(item => <StatusRow key={item.id} item={item} />)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ActionCard
          icon={Wand2}
          title={status.done ? 'Re-run wizard' : 'Continue setup'}
          description={
            status.done
              ? 'Walk through every step again to update settings — keeps the current values as defaults.'
              : 'Resume from the first unfinished step. Already configured steps are skipped.'
          }
          actionLabel={status.done ? 'Re-run' : 'Continue'}
          onAction={() => setWizardMode(status.done ? 'full' : 'resume')}
          tone="primary"
          disabled={loading}
        />
        <ActionCard
          icon={RotateCcw}
          title="Start over"
          description="Clear saved configuration. Existing connections, models, and channels remain — only the wizard state is wiped, then refilled from environment variables."
          actionLabel="Reset"
          onAction={() => setConfirmReset(true)}
          tone="danger"
          disabled={loading}
        />
      </div>

      <Dialog open={confirmReset} onOpenChange={open => { if (!resetting) setConfirmReset(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset configuration?</DialogTitle>
            <DialogDescription>
              The wizard state will be cleared. Existing AI engine, hosts, and channel records keep working — you can edit them on their pages. After reset the wizard reopens with environment variables prefilled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReset(false)} disabled={resetting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void onReset()} disabled={resetting}>
              {resetting ? (<><Loader2 size={14} className="animate-spin" /> Resetting…</>) : 'Reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusRow({ item }: { item: StatusItem }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-3">
      <div className="min-w-0 flex items-start gap-3">
        <StatusBadge done={item.done} optional={item.optional} />
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-[var(--grand-fg)] truncate">{item.label}</div>
          <div className="text-[12px] text-[var(--grand-muted)] mt-1">
            {item.optional ? 'optional · ' : ''}
            <SourceLabel source={item.source} />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ done, optional }: { done: boolean; optional: boolean }) {
  if (done) {
    return <CheckCircle2 size={18} className="text-emerald-400 mt-0.5 shrink-0" />
  }
  if (optional) {
    return <span className="size-4 mt-0.5 shrink-0 rounded-full bg-[var(--grand-line)]" />
  }
  return <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
}

function SourceLabel({ source }: { source: ConfigSource }) {
  switch (source) {
    case 'db': return <span>saved value</span>
    case 'env': return <span>from environment</span>
    case 'default': return <span>default</span>
    case 'unset': return <span>not configured</span>
  }
}

interface ActionCardProps {
  icon: typeof Wand2
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  tone: 'primary' | 'danger'
  disabled?: boolean
}

function ActionCard({ icon: Icon, title, description, actionLabel, onAction, tone, disabled }: ActionCardProps) {
  return (
    <div className="rounded-lg bg-[var(--grand-surface)] p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div
          className={`size-10 rounded-lg flex items-center justify-center ${
            tone === 'danger'
              ? 'bg-rose-500/10 text-rose-500'
              : 'bg-emerald-500/10 text-emerald-400'
          }`}
        >
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-tight text-[var(--grand-fg)]">{title}</div>
        </div>
      </div>
      <p className="text-[13px] text-[var(--grand-muted)] leading-relaxed">{description}</p>
      <div className="mt-auto pt-1">
        <Button
          onClick={onAction}
          disabled={disabled}
          variant={tone === 'danger' ? 'outline' : 'default'}
          size="sm"
          className={tone === 'danger' ? 'border-rose-500/40 text-rose-500 hover:bg-rose-500/10' : ''}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  )
}
