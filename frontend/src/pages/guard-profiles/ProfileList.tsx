import { ChevronDown, ChevronRight, Copy, Pencil, Plus, Shield, Terminal, Trash2, Zap } from '@/lib/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import type { EgressPolicy, GuardProfile } from '@/types'
import { capList, findCommandsMode, findEgressMode, formatCommandRule } from './types'

interface Props {
  profiles: GuardProfile[]
  expanded: Set<string>
  onToggle: (id: string) => void
  onCreate: () => void
  onEdit: (p: GuardProfile) => void
  onClone: (p: GuardProfile) => void
  onDelete: (id: string) => void
  loading: boolean
}

export function ProfileList({ profiles, expanded, onToggle, onCreate, onEdit, onClone, onDelete, loading }: Props) {
  if (loading) {
    return <div className="text-center py-12 text-[14px] text-[var(--grand-muted)]">Loading…</div>
  }

  if (profiles.length === 0) {
    return (
      <EmptyState
        icon={Shield}
        title="No guard profiles yet"
        description="Create a profile to control which commands the agent runs and where it can connect."
      />
    )
  }

  return (
    <div className="space-y-2">
      {profiles.map(p => (
        <Row
          key={p.id}
          profile={p}
          expanded={expanded.has(p.id)}
          onToggle={() => onToggle(p.id)}
          onEdit={() => onEdit(p)}
          onClone={() => onClone(p)}
          onDelete={() => onDelete(p.id)}
        />
      ))}
      <button
        onClick={onCreate}
        className="w-full px-4 py-3 rounded-lg border border-dashed border-[var(--grand-border)] text-[13px] text-[var(--grand-muted)] hover:text-[var(--grand-fg)] hover:border-emerald-400/60 inline-flex items-center justify-center gap-2 transition"
      >
        <Plus size={13} /> New profile
      </button>
    </div>
  )
}

function Row({
  profile,
  expanded,
  onToggle,
  onEdit,
  onClone,
  onDelete,
}: {
  profile: GuardProfile
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onClone: () => void
  onDelete: () => void
}) {
  const cmdMode = findCommandsMode(profile.commandsMode)
  const egressMode = findEgressMode(profile.egress?.mode)

  return (
    <div className="bg-[var(--grand-surface)] rounded-lg overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <button onClick={onToggle} className="flex items-center gap-2.5 min-w-0 text-left flex-1">
            {expanded ? (
              <ChevronDown size={16} className="text-[var(--grand-muted)] shrink-0" />
            ) : (
              <ChevronRight size={16} className="text-[var(--grand-muted)] shrink-0" />
            )}
            <span className="font-medium text-[var(--grand-fg)] text-[14.5px] truncate">{profile.name}</span>
            {profile.builtin && <Badge variant="secondary">Built-in</Badge>}
            {profile.capabilities.unrestricted && <Badge variant="warning">Unrestricted</Badge>}
            <Badge variant={toneToBadge(cmdMode.tone)}>
              <Terminal size={10} /> Commands · {cmdMode.badge}
              {(cmdMode.id === 'whitelist' || cmdMode.id === 'blacklist') && (
                <span className="text-[var(--grand-muted)]"> ({profile.commands.length})</span>
              )}
            </Badge>
            <Badge variant={toneToBadge(egressMode.tone)}>
              <Zap size={10} /> Network · {egressMode.badge}
            </Badge>
          </button>
          <div className="flex gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" onClick={onClone} title="Duplicate this profile">
              <Copy size={14} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onEdit} title="Open the editor">
              <Pencil size={14} />
            </Button>
            {!profile.builtin && (
              <Button variant="destructive" size="icon" onClick={onDelete} title="Delete profile">
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        </div>
        {profile.description && (
          <p className="text-[12px] text-[var(--grand-muted)] mt-1 ml-6">{profile.description}</p>
        )}
      </div>

      {expanded && (
        <div className="px-5 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title="Extra abilities">
            <p className="text-[12px] text-[var(--grand-fg-2)] leading-relaxed">{capList(profile.capabilities)}</p>
          </Card>

          <Card title="Network">
            <div className="text-[12px] text-[var(--grand-fg-2)]">
              {egressMode.label} <span className="text-[var(--grand-muted)]">— {egressMode.description}</span>
            </div>
            <NetworkChips egress={profile.egress} />
          </Card>

          <Card
            title={`Commands · ${cmdMode.label} (${profile.commands.length})`}
            className="md:col-span-2"
          >
            {profile.commands.length === 0 ? (
              <p className="text-[12px] text-[var(--grand-muted)] italic">
                {profile.capabilities.unrestricted || profile.commandsMode === 'open'
                  ? 'All commands allowed.'
                  : profile.commandsMode === 'closed'
                  ? 'All commands blocked.'
                  : 'No commands configured yet.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {profile.commands.map((c, i) => {
                  const hasBlocks = (c.blockedArgs?.length ?? 0) + (c.blockedSql?.length ?? 0) > 0
                  return (
                    <span
                      key={i}
                      className={`px-1.5 py-0.5 text-[11px] font-mono rounded ${
                        hasBlocks
                          ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                          : 'bg-[var(--grand-surface)] text-[var(--grand-fg-2)]'
                      }`}
                      title={[
                        c.allowedArgs?.length ? `Allowed args: ${c.allowedArgs.join(', ')}` : '',
                        c.allowedSql?.length ? `Allowed SQL: ${c.allowedSql.join(', ')}` : '',
                        c.blockedArgs?.length ? `Blocked args: ${c.blockedArgs.join(', ')}` : '',
                        c.blockedSql?.length ? `Blocked SQL: ${c.blockedSql.join(', ')}` : '',
                      ].filter(Boolean).join('\n')}
                    >
                      {formatCommandRule(c)}
                    </span>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

function NetworkChips({ egress }: { egress: EgressPolicy | undefined }) {
  if (!egress) return null
  if (!egress.hosts?.length && !egress.cidrs?.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {egress.hosts.map((h, i) => (
        <span key={`h-${i}`} className="px-1.5 py-0.5 text-[11px] font-mono bg-[var(--grand-surface)] text-[var(--grand-fg-2)] rounded">{h}</span>
      ))}
      {egress.cidrs.map((c, i) => (
        <span key={`c-${i}`} className="px-1.5 py-0.5 text-[11px] font-mono bg-[var(--grand-surface)] text-[var(--grand-fg-2)] rounded">{c}</span>
      ))}
    </div>
  )
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[var(--grand-surface-2)] rounded-md p-3 ${className ?? ''}`}>
      <p className="text-[10.5px] font-semibold text-[var(--grand-muted)] uppercase tracking-wider mb-1.5">{title}</p>
      {children}
    </div>
  )
}

function toneToBadge(tone: 'open' | 'safe' | 'warn' | 'closed'): 'secondary' | 'success' | 'warning' | 'destructive' {
  switch (tone) {
    case 'safe':   return 'success'
    case 'warn':   return 'warning'
    case 'closed': return 'destructive'
    default:       return 'secondary'
  }
}
