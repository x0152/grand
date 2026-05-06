import { useEffect, useMemo, useState } from 'react'
import { Cloud, Container, Loader2 } from '@/lib/icons'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { api } from '@/api'
import type { Connection } from '@/types'

interface Props {
  profileId: string | null
}

export function AttachmentsPanel({ profileId }: Props) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const reload = async () => {
    if (!profileId) return
    try {
      setLoading(true)
      const list = await api.connections.list()
      setConnections(list)
      setSelected(new Set(list.filter(c => c.profileIds?.includes(profileId)).map(c => c.id)))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load hosts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [profileId])

  const grouped = useMemo(() => {
    const ssh: Connection[] = []
    const sandbox: Connection[] = []
    for (const c of connections) {
      if (c.dockerfile) sandbox.push(c)
      else ssh.push(c)
    }
    ssh.sort((a, b) => a.name.localeCompare(b.name))
    sandbox.sort((a, b) => a.name.localeCompare(b.name))
    return { ssh, sandbox }
  }, [connections])

  const initial = useMemo(() => {
    if (!profileId) return new Set<string>()
    return new Set(connections.filter(c => c.profileIds?.includes(profileId)).map(c => c.id))
  }, [connections, profileId])

  const dirty = useMemo(() => {
    if (selected.size !== initial.size) return true
    for (const id of selected) if (!initial.has(id)) return true
    return false
  }, [selected, initial])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const setAll = (ids: string[], on: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      ids.forEach(id => (on ? next.add(id) : next.delete(id)))
      return next
    })
  }

  const save = async () => {
    if (!profileId) return
    try {
      setSaving(true)
      await api.guardProfiles.syncAttachments(profileId, [...selected])
      toast.success('Hosts updated')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to attach')
    } finally {
      setSaving(false)
    }
  }

  if (!profileId) {
    return (
      <div className="rounded-md bg-[var(--grand-surface-2)] px-3 py-3 text-[12px] text-[var(--grand-muted)]">
        Save the profile first, then attach it to your hosts.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-[var(--grand-muted)] py-3 justify-center">
        <Loader2 size={12} className="animate-spin" /> Loading hosts…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Group
        title="Remote SSH"
        icon={<Cloud size={12} className="text-[var(--grand-muted)]" />}
        items={grouped.ssh}
        selected={selected}
        onToggle={toggle}
        onSetAll={on => setAll(grouped.ssh.map(c => c.id), on)}
      />
      <Group
        title="Sandboxes"
        icon={<Container size={12} className="text-[var(--grand-muted)]" />}
        items={grouped.sandbox}
        selected={selected}
        onToggle={toggle}
        onSetAll={on => setAll(grouped.sandbox.map(c => c.id), on)}
      />

      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-[var(--grand-muted)]">
          {selected.size} of {connections.length} attached
        </span>
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : null}
          Save attachments
        </Button>
      </div>
    </div>
  )
}

interface GroupProps {
  title: string
  icon: React.ReactNode
  items: Connection[]
  selected: Set<string>
  onToggle: (id: string) => void
  onSetAll: (on: boolean) => void
}

function Group({ title, icon, items, selected, onToggle, onSetAll }: GroupProps) {
  if (items.length === 0) return null
  const allOn = items.every(c => selected.has(c.id))
  const someOn = items.some(c => selected.has(c.id))
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-[11px] font-semibold text-[var(--grand-muted)] uppercase tracking-wider">
            {title} ({items.length})
          </span>
        </div>
        <button
          onClick={() => onSetAll(!allOn)}
          className="text-[11px] text-emerald-400 hover:text-emerald-300"
        >
          {allOn ? 'Clear all' : someOn ? 'Add rest' : 'Add all'}
        </button>
      </div>
      <div className="rounded-md border border-[var(--grand-border)] divide-y divide-[var(--grand-line)] overflow-hidden">
        {items.map(c => (
          <label
            key={c.id}
            className="px-3 py-2 flex items-center gap-2.5 bg-[var(--grand-surface-2)] hover:bg-[var(--grand-surface)] cursor-pointer"
          >
            <Checkbox checked={selected.has(c.id)} onCheckedChange={() => onToggle(c.id)} />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] text-[var(--grand-fg)] truncate">{c.name}</div>
              {c.description && (
                <div className="text-[11px] text-[var(--grand-muted)] truncate">{c.description}</div>
              )}
            </div>
            {c.profileIds?.length ? (
              <span className="text-[10.5px] text-[var(--grand-muted-2)] font-mono">
                {c.profileIds.length} profile{c.profileIds.length === 1 ? '' : 's'}
              </span>
            ) : null}
          </label>
        ))}
      </div>
    </div>
  )
}
