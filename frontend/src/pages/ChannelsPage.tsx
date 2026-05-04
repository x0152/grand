import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Radio } from '@/lib/icons'
import { toast } from 'sonner'
import { api } from '../api'
import type { Channel, Preset } from '../types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/EmptyState'
import { FormField } from '@/components/FormField'
import { ConfirmDelete } from '@/components/ConfirmDelete'

function parseAllowedUserIds(s: string): number[] {
  return s
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => Number.parseInt(x, 10))
    .filter(n => Number.isFinite(n))
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Channel | null>(null)
  const [form, setForm] = useState({ name: '', token: '', presetId: '', allowedUserIds: '' })
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [chs, p] = await Promise.all([api.channels.list(), api.presets.list()])
      setChannels(chs)
      setPresets(p)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = (c: Channel) => {
    setEditing(c)
    setForm({
      name: c.name,
      token: c.token,
      presetId: c.presetId ?? '',
      allowedUserIds: (c.allowedUserIds ?? []).join(','),
    })
    setModalOpen(true)
  }

  const presetName = (id: string) => {
    const p = presets.find(x => x.id === id)
    if (p) return p.name
    return id ? (id.slice(0, 8) + '...') : '—'
  }

  const submit = async () => {
    try {
      const allowed = parseAllowedUserIds(form.allowedUserIds)
      if (editing) {
        const token = editing.type === 'chat' ? '' : form.token
        const allowedUserIds = editing.type === 'chat' ? [] : allowed
        await api.channels.update(editing.id, { name: form.name, token, presetId: form.presetId, allowedUserIds })
        toast.success('Channel updated')
      } else {
        await api.channels.create({ type: 'telegram', name: form.name, token: form.token, modelId: '', presetId: form.presetId, allowedUserIds: allowed })
        toast.success('Channel created')
      }
      setModalOpen(false)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Operation failed')
    }
  }

  const remove = async (id: string) => {
    try {
      await api.channels.delete(id)
      toast.success('Channel deleted')
      setDeleteTarget(null)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--grand-fg)]">Channels</h1>
          <p className="text-[13.5px] text-[var(--grand-muted)] mt-1.5">Chat channel is default; Telegram channels can be added</p>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled className="opacity-50 cursor-not-allowed">
            <Plus size={15} /> Add channel
          </Button>
          <span className="text-[12px] text-[var(--grand-muted-2)]">Coming soon</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--grand-muted)] text-[14px]">Loading…</div>
      ) : channels.length === 0 ? (
        <EmptyState icon={Radio} title="No channels yet" />
      ) : (
        <div className="bg-[var(--grand-surface)] rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Preset</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Allowed</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.slice().sort((a, b) => {
                if (a.type !== b.type) return a.type === 'chat' ? -1 : 1
                return (a.name || a.id).localeCompare(b.name || b.id)
              }).map(ch => (
                <TableRow key={ch.id}>
                  <TableCell className="font-medium text-zinc-800 dark:text-zinc-200 text-sm">{ch.name || (ch.type === 'chat' ? 'Chat' : 'Telegram')}</TableCell>
                  <TableCell>
                    <Badge className="uppercase">{ch.type}</Badge>
                  </TableCell>
                  <TableCell className="text-zinc-600 dark:text-zinc-400 text-sm">{ch.presetId ? presetName(ch.presetId) : <span className="text-zinc-400 italic">Inherit</span>}</TableCell>
                  <TableCell className="text-zinc-500">{ch.token ? 'set' : '—'}</TableCell>
                  <TableCell className="text-zinc-500">{(ch.allowedUserIds ?? []).length || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ch)}>
                        <Pencil size={14} />
                      </Button>
                      {ch.id !== 'chat' && (
                        <Button variant="destructive" size="icon" onClick={() => setDeleteTarget(ch.id)}>
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Channel' : 'New Telegram Channel'}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Name">
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={editing?.type === 'chat' ? 'Chat' : 'Telegram'}
              />
            </FormField>

            {editing?.type !== 'chat' && (
              <FormField label="Token">
                <Input
                  value={form.token}
                  onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
                  placeholder="123:ABC..."
                />
              </FormField>
            )}

            <FormField label="Preset">
              <select
                value={form.presetId}
                onChange={e => setForm(f => ({ ...f, presetId: e.target.value }))}
                className="flex w-full h-10 rounded-md bg-[var(--grand-surface-2)] px-3.5 py-2 text-[14px] text-[var(--grand-fg)] outline-none focus:bg-[var(--grand-surface)] focus:ring-2 focus:ring-emerald-400/40"
              >
                <option value="">Inherit (use global default)</option>
                {presets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </FormField>

            {editing?.type !== 'chat' && (
              <FormField label="Allowed user IDs">
                <Input
                  value={form.allowedUserIds}
                  onChange={e => setForm(f => ({ ...f, allowedUserIds: e.target.value }))}
                  className="font-mono"
                  placeholder="12345,67890"
                />
              </FormField>
            )}

            <DialogFooter>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={!editing && !form.token}>
                {editing ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title="Delete channel?"
        description="This will permanently remove the channel."
      />
    </div>
  )
}

