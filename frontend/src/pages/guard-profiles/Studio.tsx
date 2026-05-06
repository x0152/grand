import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Check, ChevronDown, ChevronRight, Clock, Container,
  Plus, Save, Shield, Sparkles, Terminal, Wand2, X, Zap,
  type LucideIcon,
} from '@/lib/icons'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/api'
import type { CommandRule, CommandsMode, EgressMode, GuardEvent, GuardProfile } from '@/types'
import { AttachmentsPanel } from './AttachmentsPanel'
import {
  CAP_HINTS,
  CAP_LABELS,
  CAP_ORDER,
  COMMANDS_MODES,
  EGRESS_MODES,
  formatCommandRule,
  mergeCommandRule,
  fromProfile,
  parseCommandRule,
  presets,
  suggestAllowCommand,
  suggestAllowHost,
  suggestBlockCommand,
  suggestBlockHost,
  toPayload,
  type ModeOption,
  type StudioForm,
  type SuggestedFix,
} from './types'

interface Props {
  initial: StudioForm
  editing: GuardProfile | null
  onCancel: () => void
  onSaved: (profile: GuardProfile) => void
}

export function Studio({ initial, editing, onCancel, onSaved }: Props) {
  const [form, setForm] = useState<StudioForm>(initial)
  const [baseline, setBaseline] = useState<StudioForm>(initial)
  const [savedId, setSavedId] = useState<string | null>(editing?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [showPresets, setShowPresets] = useState(!savedId && initial.commands.length === 0)
  const [attachOpen, setAttachOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline])
  const builtin = !!editing?.builtin
  const canSave = !!form.name.trim() && (!savedId || dirty)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !attachOpen) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, attachOpen])

  const onSave = async () => {
    if (!form.name.trim()) {
      toast.error('Please give the profile a name first')
      return
    }
    try {
      setSaving(true)
      const data = toPayload(form)
      const saved = savedId
        ? await api.guardProfiles.update(savedId, data)
        : await api.guardProfiles.create(data)
      setSavedId(saved.id)
      setBaseline(fromProfile(saved))
      onSaved(saved)
      toast.success(savedId ? 'Profile saved' : 'Profile created')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const applyPreset = (build: () => StudioForm) => {
    setForm(prev => {
      const built = build()
      return { ...built, name: prev.name || built.description }
    })
    setShowPresets(false)
  }

  const onApply = (fix: SuggestedFix) => {
    setForm(prev => fix.apply(prev))
    toast.success(fix.label)
  }

  const enabledCaps = CAP_ORDER.filter(k => form.capabilities[k]).length
  const headerTitle = savedId ? (form.name.trim() || 'Untitled profile') : 'New guard profile'

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 border-b border-[var(--grand-border)] bg-[var(--grand-surface)] flex items-center gap-3 px-6 py-3">
        <Button variant="ghost" size="icon" onClick={onCancel} title="Back to profiles">
          <ArrowLeft size={16} />
        </Button>
        <Shield size={18} className="text-emerald-400 shrink-0" />
        <h1 className="text-[14.5px] font-semibold text-[var(--grand-fg)] truncate flex-1 min-w-0">
          {headerTitle}
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          {builtin && <Badge variant="secondary">Built-in</Badge>}
          {!savedId && <Badge variant="outline">Draft</Badge>}
          {savedId && !dirty && <Badge variant="success">Saved</Badge>}
          {savedId && dirty && <Badge variant="warning">Unsaved changes</Badge>}
          {form.capabilities.unrestricted && <Badge variant="warning">Unrestricted</Badge>}
          {savedId && (
            <Button variant="secondary" size="sm" onClick={() => setAttachOpen(true)}>
              <Container size={13} /> Where it&rsquo;s used
            </Button>
          )}
          <Button onClick={onSave} disabled={saving || !canSave}>
            <Save size={13} /> {savedId ? 'Save changes' : 'Create profile'}
          </Button>
        </div>
      </header>

      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          <BasicsSection form={form} onChange={setForm} disabled={false} />

          {showPresets && (
            <PresetsSection onPick={applyPreset} onSkip={() => setShowPresets(false)} />
          )}

          <CommandsSection form={form} onChange={setForm} onApply={onApply} disabled={false} />
          <NetworkSection form={form} onChange={setForm} onApply={onApply} disabled={false} />

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-2 px-5 py-3 rounded-lg bg-[var(--grand-surface)] hover:bg-[var(--grand-surface-2)] text-left transition">
                {advancedOpen ? <ChevronDown size={14} className="text-[var(--grand-muted)]" /> : <ChevronRight size={14} className="text-[var(--grand-muted)]" />}
                <span className="text-[13.5px] font-semibold text-[var(--grand-fg)]">4. Advanced shell features</span>
                <span className="text-[12px] text-[var(--grand-muted)]">
                  — extra abilities like sudo, downloads, scheduling
                </span>
                <span className="ml-auto text-[11.5px] text-[var(--grand-muted)]">
                  {enabledCaps} of {CAP_ORDER.length} on
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CapabilitiesPanel form={form} onChange={setForm} disabled={false} />
            </CollapsibleContent>
          </Collapsible>

          <RecentActivity profileId={savedId} onApply={onApply} />
        </div>
      </div>

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Where this profile is used</DialogTitle>
            <DialogDescription>
              Pick the SSH connections and sandboxes that should follow{' '}
              <span className="font-medium text-[var(--grand-fg)]">{form.name || 'this profile'}</span>.
            </DialogDescription>
          </DialogHeader>
          <AttachmentsPanel profileId={savedId} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Section({
  index,
  icon: Icon,
  title,
  hint,
  children,
}: {
  index?: string
  icon: LucideIcon
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-[var(--grand-surface)] rounded-lg overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-[var(--grand-line-2)] flex items-start gap-2.5">
        <Icon size={16} className="text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h2 className="text-[13.5px] font-semibold text-[var(--grand-fg)]">
            {index && <span className="text-[var(--grand-muted)] mr-1.5">{index}.</span>}
            {title}
          </h2>
          <p className="text-[12px] text-[var(--grand-muted)] mt-0.5 leading-relaxed">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function FieldLabel({ children, hint, required }: { children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div className="mb-1.5">
      <label className="text-[12px] font-medium text-[var(--grand-fg)]">
        {children}
        {required && <span className="text-rose-400 ml-1">*</span>}
      </label>
      {hint && <span className="text-[11.5px] text-[var(--grand-muted)] ml-2">{hint}</span>}
    </div>
  )
}

function BasicsSection({
  form,
  onChange,
  disabled,
}: {
  form: StudioForm
  onChange: (next: StudioForm) => void
  disabled: boolean
}) {
  return (
    <Section
      index="1"
      icon={Shield}
      title="Basics"
      hint="Give the profile a clear name so you can recognise it later."
    >
      <div className="px-5 py-4 space-y-4">
        <div>
          <FieldLabel required>Profile name</FieldLabel>
          <Input
            value={form.name}
            onChange={e => onChange({ ...form, name: e.target.value })}
            placeholder="e.g. Read-only inspector"
            disabled={disabled}
            autoFocus={!form.name}
          />
        </div>
        <div>
          <FieldLabel hint="Optional — a short reminder for you and your team.">
            What is this profile for?
          </FieldLabel>
          <Input
            value={form.description}
            onChange={e => onChange({ ...form, description: e.target.value })}
            placeholder="What should the agent be allowed to do?"
            disabled={disabled}
          />
        </div>
      </div>
    </Section>
  )
}

function PresetsSection({
  onPick,
  onSkip,
}: {
  onPick: (build: () => StudioForm) => void
  onSkip: () => void
}) {
  return (
    <Section
      icon={Wand2}
      title="Quick start"
      hint="Pick a ready-made template. You can change anything afterwards."
    >
      <div className="px-5 pt-4 pb-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {presets().map(p => (
          <button
            key={p.id}
            onClick={() => onPick(p.build)}
            className="group flex flex-col items-start gap-1.5 p-3 rounded-md border border-[var(--grand-border-2)] bg-[var(--grand-surface-2)] hover:bg-[var(--grand-bg)] hover:border-emerald-400/50 text-left transition"
          >
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Sparkles size={13} />
              <span className="text-[12.5px] font-semibold text-[var(--grand-fg)] group-hover:text-emerald-300 transition-colors">
                {p.label}
              </span>
            </div>
            <span className="text-[11.5px] text-[var(--grand-muted)] leading-snug">{p.hint}</span>
          </button>
        ))}
      </div>
      <div className="px-5 pb-4">
        <button
          onClick={onSkip}
          className="text-[11.5px] text-[var(--grand-muted)] hover:text-[var(--grand-fg)] transition-colors"
        >
          Skip and start with an empty profile
        </button>
      </div>
    </Section>
  )
}

function ModeCards<M extends string>({
  modes,
  value,
  onChange,
  disabled,
}: {
  modes: ModeOption<M>[]
  value: M
  onChange: (m: M) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
      {modes.map(m => {
        const Icon = m.icon
        const active = m.id === value
        return (
          <button
            key={m.id}
            disabled={disabled}
            onClick={() => onChange(m.id)}
            className={`flex flex-col items-start gap-1.5 p-3 rounded-md border text-left transition ${
              active
                ? 'bg-emerald-500/10 border-emerald-400/60 ring-1 ring-emerald-400/30'
                : 'bg-[var(--grand-surface-2)] border-[var(--grand-border-2)] hover:bg-[var(--grand-bg)] hover:border-[var(--grand-border)]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-center gap-1.5">
              <Icon
                size={14}
                className={active ? 'text-emerald-400' : 'text-[var(--grand-muted)]'}
              />
              <span
                className={`text-[12.5px] font-semibold ${
                  active ? 'text-[var(--grand-fg)]' : 'text-[var(--grand-fg-2)]'
                }`}
              >
                {m.label}
              </span>
            </div>
            <span className="text-[11.5px] text-[var(--grand-muted)] leading-snug">
              {m.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}

interface TesterResult {
  allowed: boolean
  rule?: string
  message?: string
  reason?: string
  target: string
}

function TesterPanel({
  title,
  hint,
  placeholder,
  testing,
  result,
  fix,
  block,
  onApply,
  onTest,
  value,
  onValueChange,
  disabled,
}: {
  title: string
  hint: string
  placeholder: string
  testing: boolean
  result: TesterResult | null
  fix: SuggestedFix | null
  block: SuggestedFix | null
  onApply: (fix: SuggestedFix) => void
  onTest: () => void
  value: string
  onValueChange: (v: string) => void
  disabled: boolean
}) {
  return (
    <div className="bg-[var(--grand-surface-2)] rounded-md border border-[var(--grand-border-2)] p-3.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Wand2 size={13} className="text-emerald-400" />
        <span className="text-[12.5px] font-semibold text-[var(--grand-fg)]">{title}</span>
      </div>
      <p className="text-[11.5px] text-[var(--grand-muted)] mb-2.5">{hint}</p>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={e => onValueChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onTest() }}
          placeholder={placeholder}
          className="flex-1 h-9 rounded-md border border-[var(--grand-border)] bg-[var(--grand-surface)] px-3 text-[13px] font-mono text-[var(--grand-fg)] placeholder:text-[var(--grand-muted-2)] outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 transition-colors"
        />
        <Button size="sm" onClick={onTest} disabled={!value.trim() || testing}>
          {testing ? '…' : 'Check'}
        </Button>
      </div>
      {result && (
        <Verdict
          result={result}
          fix={fix}
          block={block}
          onApply={onApply}
          disabled={disabled}
        />
      )}
    </div>
  )
}

function Verdict({
  result,
  fix,
  block,
  onApply,
  disabled,
}: {
  result: TesterResult
  fix: SuggestedFix | null
  block: SuggestedFix | null
  onApply: (fix: SuggestedFix) => void
  disabled: boolean
}) {
  const allowed = result.allowed
  const action = fix || block
  return (
    <div
      className={`mt-3 rounded-md border p-3 flex items-start gap-3 ${
        allowed
          ? 'bg-emerald-500/8 border-emerald-400/30'
          : 'bg-rose-500/8 border-rose-400/30'
      }`}
    >
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          allowed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
        }`}
      >
        {allowed ? <Check size={14} /> : <X size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-[12.5px] font-semibold ${
            allowed ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {allowed ? 'Would be allowed' : 'Would be blocked'}
        </div>
        <div className="font-mono text-[12px] text-[var(--grand-fg-2)] mt-0.5 truncate">
          {result.target}
        </div>
        {(result.message || result.reason) && (
          <div className="text-[11.5px] text-[var(--grand-muted)] mt-1 leading-snug">
            {result.message || result.reason}
          </div>
        )}
      </div>
      {!disabled && action && (
        <Button size="sm" variant="secondary" onClick={() => onApply(action)} className="shrink-0">
          {action.label}
        </Button>
      )}
    </div>
  )
}

function CommandsSection({
  form,
  onChange,
  onApply,
  disabled,
}: {
  form: StudioForm
  onChange: (next: StudioForm) => void
  onApply: (fix: SuggestedFix) => void
  disabled: boolean
}) {
  const [tester, setTester] = useState('')
  const [result, setResult] = useState<TesterResult | null>(null)
  const [testing, setTesting] = useState(false)

  const runTest = async () => {
    const target = tester.trim()
    if (!target) return
    try {
      setTesting(true)
      const r = await api.guardProfiles.test(toPayload(form), 'command', target)
      setResult({ allowed: r.allowed, rule: r.rule, message: r.message, target })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not test')
    } finally {
      setTesting(false)
    }
  }

  const fix = result && !result.allowed
    ? suggestAllowCommand(result.target, result.rule ?? '', result.message ?? '')
    : null
  const block = result && result.allowed
    ? suggestBlockCommand(result.target)
    : null

  const showCommandList = form.commandsMode === 'whitelist' || form.commandsMode === 'blacklist'

  return (
    <Section
      index="2"
      icon={Terminal}
      title="What can the agent run?"
      hint="Decide which shell commands the agent is allowed to execute."
    >
      <div className="px-5 py-4 space-y-4">
        <div>
          <FieldLabel>Choose how strict you want to be</FieldLabel>
          <ModeCards
            modes={COMMANDS_MODES}
            value={form.commandsMode}
            onChange={(commandsMode: CommandsMode) => onChange({ ...form, commandsMode })}
            disabled={disabled}
          />
        </div>

        {showCommandList && (
          <CommandList
            mode={form.commandsMode}
            commands={form.commands}
            onChange={(commands) => onChange({ ...form, commands })}
            disabled={disabled}
          />
        )}

        <TesterPanel
          title="Try it out"
          hint="Type a command and we'll show whether it would be allowed by these rules."
          placeholder="e.g. ls -la /tmp"
          testing={testing}
          result={result}
          fix={fix}
          block={block}
          onApply={onApply}
          onTest={() => void runTest()}
          value={tester}
          onValueChange={setTester}
          disabled={disabled}
        />
      </div>
    </Section>
  )
}

function NetworkSection({
  form,
  onChange,
  onApply,
  disabled,
}: {
  form: StudioForm
  onChange: (next: StudioForm) => void
  onApply: (fix: SuggestedFix) => void
  disabled: boolean
}) {
  const [tester, setTester] = useState('')
  const [result, setResult] = useState<TesterResult | null>(null)
  const [testing, setTesting] = useState(false)

  const runTest = async () => {
    const target = tester.trim()
    if (!target) return
    try {
      setTesting(true)
      const r = await api.guardProfiles.test(toPayload(form), 'host', target)
      setResult({ allowed: r.allowed, reason: r.reason, target })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not test')
    } finally {
      setTesting(false)
    }
  }

  const fix = result && !result.allowed
    ? suggestAllowHost(result.target, result.reason ?? '')
    : null
  const block = result && result.allowed
    ? suggestBlockHost(result.target)
    : null

  const showLists = form.egress.mode === 'whitelist' || form.egress.mode === 'blacklist'
  const emptyWhitelist =
    form.egress.mode === 'whitelist' &&
    form.egress.hosts.length === 0 &&
    form.egress.cidrs.length === 0

  return (
    <Section
      index="3"
      icon={Zap}
      title="Where can the agent connect?"
      hint="Decide which hosts and IP ranges the agent may reach over the network."
    >
      <div className="px-5 py-4 space-y-4">
        <div>
          <FieldLabel>Choose how strict you want to be</FieldLabel>
          <ModeCards
            modes={EGRESS_MODES}
            value={form.egress.mode}
            onChange={(mode: EgressMode) => onChange({ ...form, egress: { ...form.egress, mode } })}
            disabled={disabled}
          />
        </div>

        {emptyWhitelist && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
            <strong>Empty whitelist blocks everything.</strong> DNS lookups for any host will fail
            (<code className="font-mono">Could not resolve host</code>) until you add at least one entry below —
            or switch to <em>Reach anywhere</em>.
          </div>
        )}

        {showLists && (
          <NetworkLists form={form} onChange={onChange} disabled={disabled} />
        )}

        <TesterPanel
          title="Try a destination"
          hint="Type a hostname or IP and we'll show whether the agent could reach it."
          placeholder="e.g. api.openai.com or 10.0.0.1"
          testing={testing}
          result={result}
          fix={fix}
          block={block}
          onApply={onApply}
          onTest={() => void runTest()}
          value={tester}
          onValueChange={setTester}
          disabled={disabled}
        />
      </div>
    </Section>
  )
}

function CommandList({
  mode,
  commands,
  onChange,
  disabled,
}: {
  mode: CommandsMode
  commands: CommandRule[]
  onChange: (next: CommandRule[]) => void
  disabled: boolean
}) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [editVal, setEditVal] = useState('')

  const add = () => {
    const rule = parseCommandRule(draft)
    if (!rule) return
    const existingIdx = commands.findIndex(c => c.command === rule.command)
    if (existingIdx >= 0) {
      const next = [...commands]
      next[existingIdx] = mergeCommandRule(commands[existingIdx], rule)
      onChange(next)
      toast.success(`Updated "${rule.command}"`)
    } else {
      onChange([...commands, rule])
    }
    setDraft('')
  }

  const remove = (i: number) => onChange(commands.filter((_, j) => j !== i))

  const startEdit = (i: number) => {
    setEditing(i)
    setEditVal(formatCommandRule(commands[i]))
  }

  const commitEdit = () => {
    if (editing === null) return
    const rule = parseCommandRule(editVal)
    if (!rule) {
      setEditing(null)
      return
    }
    const next = [...commands]
    next[editing] = rule
    onChange(next)
    setEditing(null)
  }

  const heading = mode === 'whitelist' ? 'Allowed commands' : 'Blocked commands'
  const placeholder = mode === 'whitelist' ? 'e.g. ls' : 'e.g. rm'
  const empty = mode === 'whitelist'
    ? 'Nothing on the list — the agent cannot run any command yet.'
    : 'Nothing on the list — the agent can still run anything.'

  return (
    <div>
      <FieldLabel>
        {heading} <span className="text-[var(--grand-muted)] font-normal">({commands.length})</span>
      </FieldLabel>

      {!disabled && (
        <div className="flex items-center gap-2 mb-2">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }}
            placeholder={placeholder}
            className="flex-1 h-9 rounded-md border border-[var(--grand-border)] bg-[var(--grand-surface-2)] px-3 text-[13px] font-mono text-[var(--grand-fg)] placeholder:text-[var(--grand-muted-2)] outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 transition-colors"
          />
          <Button size="sm" variant="secondary" onClick={add} disabled={!draft.trim()}>
            <Plus size={12} /> Add
          </Button>
        </div>
      )}
      {mode === 'whitelist' ? (
        <p className="text-[11.5px] text-[var(--grand-muted)] mb-2.5">
          Plain <code className="font-mono text-[var(--grand-fg-2)]">cmd</code> = command is fully allowed.
          To narrow it: <code className="font-mono text-[var(--grand-fg-2)]">curl[-X,GET]</code> only those args,{' '}
          <code className="font-mono text-[var(--grand-fg-2)]">psql(SELECT,INSERT)</code> only those SQL keywords.
          Red chips like <code className="font-mono text-rose-300">psql !DROP TABLE</code> are blocks set in migrations.
        </p>
      ) : (
        <p className="text-[11.5px] text-[var(--grand-muted)] mb-2.5">
          Just the command name — arguments are ignored when blocking.
        </p>
      )}

      {commands.length === 0 ? (
        <p className="text-[12px] text-[var(--grand-muted)] italic">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {commands.map((c, i) => {
            const hasBlocks = (c.blockedArgs?.length ?? 0) + (c.blockedSql?.length ?? 0) > 0
            return editing === i ? (
              <input
                key={i}
                autoFocus
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setEditing(null)
                }}
                onBlur={commitEdit}
                className="px-2.5 py-1 rounded-md bg-[var(--grand-surface-2)] border border-emerald-400/50 text-[12.5px] font-mono outline-none min-w-[200px]"
              />
            ) : (
              <span
                key={i}
                className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12.5px] font-mono transition-colors ${
                  hasBlocks
                    ? 'bg-rose-500/10 text-rose-200 border border-rose-500/30 hover:bg-rose-500/15'
                    : 'bg-[var(--grand-surface-2)] text-[var(--grand-fg-2)] hover:text-[var(--grand-fg)] hover:bg-[var(--grand-bg)]'
                }`}
              >
                <button
                  onClick={() => !disabled && startEdit(i)}
                  className="text-left disabled:cursor-not-allowed"
                  disabled={disabled}
                  title={disabled ? undefined : 'Click to edit'}
                >
                  {formatCommandRule(c)}
                </button>
                {!disabled && (
                  <button
                    onClick={() => remove(i)}
                    className="opacity-50 hover:opacity-100 hover:text-rose-400 transition-opacity"
                    title="Remove"
                  >
                    <X size={11} />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NetworkLists({
  form,
  onChange,
  disabled,
}: {
  form: StudioForm
  onChange: (next: StudioForm) => void
  disabled: boolean
}) {
  const [hostDraft, setHostDraft] = useState('')
  const [cidrDraft, setCidrDraft] = useState('')

  const addHost = () => {
    const v = hostDraft.trim()
    if (!v) return
    if (form.egress.hosts.includes(v)) return
    onChange({ ...form, egress: { ...form.egress, hosts: [...form.egress.hosts, v] } })
    setHostDraft('')
  }

  const addCidr = () => {
    const v = cidrDraft.trim()
    if (!v) return
    if (form.egress.cidrs.includes(v)) return
    onChange({ ...form, egress: { ...form.egress, cidrs: [...form.egress.cidrs, v] } })
    setCidrDraft('')
  }

  const removeHost = (i: number) => onChange({ ...form, egress: { ...form.egress, hosts: form.egress.hosts.filter((_, j) => j !== i) } })
  const removeCidr = (i: number) => onChange({ ...form, egress: { ...form.egress, cidrs: form.egress.cidrs.filter((_, j) => j !== i) } })

  const verb = form.egress.mode === 'whitelist' ? 'Allowed' : 'Blocked'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ListColumn
        title={`${verb} hosts`}
        count={form.egress.hosts.length}
        items={form.egress.hosts}
        draft={hostDraft}
        onDraftChange={setHostDraft}
        onAdd={addHost}
        onRemove={removeHost}
        placeholder="e.g. api.openai.com"
        hint="Use *.example.com to match any subdomain."
        disabled={disabled}
      />
      <ListColumn
        title={`${verb} IP ranges`}
        count={form.egress.cidrs.length}
        items={form.egress.cidrs}
        draft={cidrDraft}
        onDraftChange={setCidrDraft}
        onAdd={addCidr}
        onRemove={removeCidr}
        placeholder="e.g. 10.0.0.0/8"
        hint="Single IP (1.2.3.4) or CIDR range (10.0.0.0/8)."
        disabled={disabled}
      />
    </div>
  )
}

function ListColumn({
  title,
  count,
  items,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
  placeholder,
  hint,
  disabled,
}: {
  title: string
  count: number
  items: string[]
  draft: string
  onDraftChange: (v: string) => void
  onAdd: () => void
  onRemove: (i: number) => void
  placeholder: string
  hint: string
  disabled: boolean
}) {
  return (
    <div>
      <FieldLabel>
        {title} <span className="text-[var(--grand-muted)] font-normal">({count})</span>
      </FieldLabel>
      {!disabled && (
        <div className="flex items-center gap-2 mb-2">
          <input
            value={draft}
            onChange={e => onDraftChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onAdd() }}
            placeholder={placeholder}
            className="flex-1 h-9 rounded-md border border-[var(--grand-border)] bg-[var(--grand-surface-2)] px-3 text-[13px] font-mono text-[var(--grand-fg)] placeholder:text-[var(--grand-muted-2)] outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 transition-colors"
          />
          <Button size="sm" variant="secondary" onClick={onAdd} disabled={!draft.trim()}>
            <Plus size={12} /> Add
          </Button>
        </div>
      )}
      <p className="text-[11.5px] text-[var(--grand-muted)] mb-2.5">{hint}</p>
      {items.length === 0 ? (
        <p className="text-[12px] text-[var(--grand-muted)] italic">Nothing on this list yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((h, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--grand-surface-2)] text-[12.5px] font-mono text-[var(--grand-fg-2)]"
            >
              {h}
              {!disabled && (
                <button
                  onClick={() => onRemove(i)}
                  className="opacity-50 hover:opacity-100 hover:text-rose-400 transition-opacity"
                  title="Remove"
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function CapabilitiesPanel({
  form,
  onChange,
  disabled,
}: {
  form: StudioForm
  onChange: (next: StudioForm) => void
  disabled: boolean
}) {
  return (
    <div className="bg-[var(--grand-surface)] rounded-lg p-4 mt-1.5">
      <p className="text-[12px] text-[var(--grand-muted)] mb-3 leading-relaxed">
        These extras are checked first. If something here is off, the agent can&rsquo;t use it
        even when its command is on your allow-list above.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {CAP_ORDER.map(k => {
          const on = !!form.capabilities[k]
          const danger = k === 'unrestricted'
          return (
            <label
              key={k}
              className={`flex items-start gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition ${
                on
                  ? danger
                    ? 'bg-amber-500/8 border-amber-400/40'
                    : 'bg-emerald-500/8 border-emerald-400/40'
                  : 'bg-[var(--grand-surface-2)] border-[var(--grand-border-2)] hover:border-[var(--grand-border)]'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <Checkbox
                checked={on}
                onCheckedChange={(v) => onChange({ ...form, capabilities: { ...form.capabilities, [k]: !!v } })}
                disabled={disabled}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-[var(--grand-fg)]">{CAP_LABELS[k]}</div>
                <div className="text-[11.5px] text-[var(--grand-muted)] mt-0.5 leading-snug">
                  {CAP_HINTS[k]}
                </div>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function RecentActivity({
  profileId,
  onApply,
}: {
  profileId: string | null
  onApply: (fix: SuggestedFix) => void
}) {
  const [events, setEvents] = useState<GuardEvent[]>([])
  const [loading, setLoading] = useState(false)
  const reqIdRef = useRef(0)

  const load = useCallback(async () => {
    const id = ++reqIdRef.current
    try {
      setLoading(true)
      const items = await api.guardEvents.list({
        profileId: profileId ?? undefined,
        limit: 20,
      })
      if (id === reqIdRef.current) setEvents(items)
    } catch {
      void 0
    } finally {
      if (id === reqIdRef.current) setLoading(false)
    }
  }, [profileId])

  useEffect(() => {
    void load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  const cmds = events.filter(e => e.kind === 'command').slice(0, 10)
  const hosts = events.filter(e => e.kind === 'host').slice(0, 10)

  return (
    <Section
      icon={Clock}
      title="Recent activity"
      hint="Last allowed and blocked traffic across hosts using this profile."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-5 py-4">
        <ActivityList title="Commands" icon={Terminal} events={cmds} kind="command" onApply={onApply} loading={loading} />
        <ActivityList title="Network" icon={Zap} events={hosts} kind="host" onApply={onApply} loading={loading} />
      </div>
    </Section>
  )
}

function ActivityList({
  title,
  icon: Icon,
  events,
  kind,
  onApply,
  loading,
}: {
  title: string
  icon: LucideIcon
  events: GuardEvent[]
  kind: 'command' | 'host'
  onApply: (fix: SuggestedFix) => void
  loading: boolean
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 text-[11.5px] font-semibold text-[var(--grand-muted)] uppercase tracking-wider">
        <Icon size={11} /> {title}
        {loading && events.length === 0 && <span className="ml-auto text-[10.5px] normal-case font-normal">…</span>}
      </div>
      {events.length === 0 ? (
        <p className="text-[12px] text-[var(--grand-muted)] italic px-1 py-2">No activity yet.</p>
      ) : (
        <div className="space-y-1">
          {events.map(ev => (
            <ActivityRow key={ev.id} event={ev} kind={kind} onApply={onApply} />
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityRow({
  event,
  kind,
  onApply,
}: {
  event: GuardEvent
  kind: 'command' | 'host'
  onApply: (fix: SuggestedFix) => void
}) {
  const [open, setOpen] = useState(false)
  const fix = event.allowed
    ? (kind === 'command' ? suggestBlockCommand(event.target) : suggestBlockHost(event.target))
    : (kind === 'command' ? suggestAllowCommand(event.target, event.rule, event.message) : suggestAllowHost(event.target, event.rule))

  const verdictLabel = event.allowed ? 'Allowed' : 'Blocked'
  const verdictClass = event.allowed
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  const actionLabel = event.allowed ? 'Block it' : 'Allow it'
  const actionTooltip = event.allowed
    ? `Add a rule that blocks "${event.target}"`
    : `Add a rule that allows "${event.target}"`

  return (
    <div
      className="px-2.5 py-1.5 rounded-md bg-[var(--grand-surface-2)] hover:bg-[var(--grand-bg)] flex items-center gap-2 cursor-pointer transition-colors flex-wrap"
      onClick={() => setOpen(o => !o)}
    >
      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${verdictClass}`}>
        {verdictLabel}
      </span>
      <span className="font-mono text-[12px] truncate flex-1 text-[var(--grand-fg-2)]">{event.target}</span>
      <span className="text-[10.5px] text-[var(--grand-muted)] shrink-0">{relTime(event.createdAt)}</span>
      {fix && (
        <button
          onClick={(e) => { e.stopPropagation(); onApply(fix) }}
          className="text-[10.5px] px-1.5 py-0.5 rounded bg-[var(--grand-surface)] hover:bg-[var(--grand-bg)] text-[var(--grand-muted)] hover:text-[var(--grand-fg)] shrink-0 inline-flex items-center gap-1 transition-colors"
          title={actionTooltip}
        >
          <Plus size={10} /> {actionLabel}
        </button>
      )}
      {open && (event.message || event.rule) && (
        <span className="basis-full text-[11px] text-[var(--grand-muted)] mt-1">
          {event.rule}{event.rule && event.message ? ' — ' : ''}{event.message}
        </span>
      )}
    </div>
  )
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return `${Math.floor(diff / 86_400_000)}d`
}
