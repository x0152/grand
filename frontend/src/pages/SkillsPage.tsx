import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, Wrench } from '@/lib/icons'
import { toast } from 'sonner'
import { api } from '../api'
import type { Connection, Skill } from '../types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CodeEditor } from '@/components/CodeEditor'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/EmptyState'
import { FormField } from '@/components/FormField'
import { ConfirmDelete } from '@/components/ConfirmDelete'
import { ParameterEditor } from '@/components/ParameterEditor'
import { ParamButtons, insertAtCursor } from '@/components/ParamButtons'

type SkillForm = {
  connectionId: string
  name: string
  description: string
  parameters: Record<string, unknown>
  script: string
}

const emptyForm: SkillForm = {
  connectionId: '',
  name: '',
  description: '',
  parameters: { type: 'object', properties: {} },
  script: '',
}

function scriptHint(params: Record<string, unknown>): string {
  const props = params?.properties as Record<string, unknown> | undefined
  if (!props || Object.keys(props).length === 0) {
    return 'Bash script executed on the server via SSH'
  }
  return 'Use Go template syntax to inject parameters'
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Skill | null>(null)
  const [form, setForm] = useState<SkillForm>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const scriptRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [allSkills, allConnections] = await Promise.all([api.skills.list(), api.connections.list()])
      setSkills(allSkills)
      setConnections(allConnections)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    if (connections.length === 0) {
      toast.error('Create a server first')
      return
    }
    setEditing(null)
    setForm({ ...emptyForm, connectionId: connections[0]?.id ?? '' })
    setModalOpen(true)
  }

  const openEdit = (skill: Skill) => {
    setEditing(skill)
    setForm({
      connectionId: skill.connectionId,
      name: skill.name,
      description: skill.description,
      parameters: skill.parameters ?? { type: 'object', properties: {} },
      script: skill.script,
    })
    setModalOpen(true)
  }

  const submit = async () => {
    try {
      const payload = {
        connectionId: form.connectionId,
        name: form.name.trim(),
        description: form.description.trim(),
        parameters: form.parameters,
        script: form.script,
      }
      if (editing) {
        await api.skills.update(editing.id, payload)
        toast.success('Skill updated')
      } else {
        await api.skills.create(payload)
        toast.success('Skill created')
      }
      setModalOpen(false)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Operation failed')
    }
  }

  const remove = async (id: string) => {
    try {
      await api.skills.delete(id)
      toast.success('Skill deleted')
      setDeleteTarget(null)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const connectionName = (id: string) => connections.find(c => c.id === id)?.name || id

  const paramsCount = (skill: Skill) => {
    const properties = skill.parameters?.properties
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return 0
    return Object.keys(properties as Record<string, unknown>).length
  }

  return (
    <div className="p-8">
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--grand-fg)]">Skills</h1>
          <p className="text-[13.5px] text-[var(--grand-muted)] mt-1.5">Reusable SSH scripts exposed as tools for the agent</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={15} /> Add skill
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--grand-muted)] text-[14px]">Loading…</div>
      ) : skills.length === 0 ? (
        <EmptyState icon={Wrench} title="No skills yet" description="Create a skill and the agent will be able to call it as a tool" />
      ) : (
        <div className="bg-[var(--grand-surface)] rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Server</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Params</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {skills.map(skill => (
                <TableRow key={skill.id}>
                  <TableCell className="font-medium text-[var(--grand-fg)]">
                    {skill.name}
                  </TableCell>
                  <TableCell>{connectionName(skill.connectionId)}</TableCell>
                  <TableCell className="text-[var(--grand-muted)] max-w-[380px] truncate">
                    {skill.description || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{paramsCount(skill)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(skill)}>
                        <Pencil size={16} />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => setDeleteTarget(skill.id)}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Skill' : 'New Skill'}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Server">
              <select
                value={form.connectionId}
                onChange={e => setForm(f => ({ ...f, connectionId: e.target.value }))}
                className="flex w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-teal-500/50"
              >
                <option value="">Select server...</option>
                {connections.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.id}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Name">
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Restart nginx"
              />
            </FormField>

            <FormField label="Description">
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Gracefully restart nginx and verify service state"
              />
            </FormField>

            <FormField label="Parameters" hint="Arguments the agent will fill when calling this skill">
              <ParameterEditor
                value={form.parameters}
                onChange={parameters => setForm(f => ({ ...f, parameters }))}
              />
            </FormField>

            <FormField label="Script" hint={scriptHint(form.parameters)}>
              <CodeEditor
                ref={scriptRef}
                value={form.script}
                onChange={script => setForm(f => ({ ...f, script }))}
                placeholder={'sudo systemctl restart {{.service_name}}\nsudo systemctl status {{.service_name}} --no-pager'}
              />
              <ParamButtons
                parameters={form.parameters}
                onInsert={snippet => insertAtCursor(scriptRef.current, snippet, form.script, v => setForm(f => ({ ...f, script: v })))}
              />
            </FormField>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={!form.connectionId || !form.name.trim() || !form.script.trim()}>
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
        title="Delete skill?"
        description="This will permanently remove the skill from tool list."
      />
    </div>
  )
}
