import { useMemo, useState } from 'react'
import { Check, Loader2, Plus } from '@/lib/icons'
import type { ProviderModel } from '@/types'
import { AppleAction } from './apple/AppleAction'
import type { ModelRow } from '../types'

interface ModelEditorProps {
  rows: ModelRow[]
  onChange: (rows: ModelRow[]) => void
  available?: ProviderModel[] | null
  loadingModels?: boolean
}

interface ListItem {
  id: string
  custom: boolean
}

type Role = ModelRow['role']

export function ModelEditor({ rows, onChange, available, loadingModels }: ModelEditorProps) {
  const [draft, setDraft] = useState('')

  const items = useMemo<ListItem[]>(() => {
    const fromServer = (available ?? []).map(m => ({ id: m.id, custom: false }))
    const customRows = rows
      .filter(r => r.name.trim() && !fromServer.some(s => s.id === r.name))
      .map(r => ({ id: r.name, custom: true }))
    return [...customRows, ...fromServer]
  }, [available, rows])

  const cleanRows = (input: ModelRow[]) => input.filter(r => r.name.trim())
  const findRow = (name: string) => rows.find(r => r.name === name && r.name.trim())

  const toggleSelect = (name: string) => {
    if (findRow(name)) {
      onChange(cleanRows(rows).filter(r => r.name !== name))
      return
    }
    const next = cleanRows(rows)
    const hasChat = next.some(r => r.role === 'chat')
    onChange([...next, { name, role: hasChat ? '' : 'chat' }])
  }

  const setRowRole = (name: string, role: Role) => {
    const next: ModelRow[] = cleanRows(rows).map(r => {
      if (r.name === name) return { ...r, role }
      if (role && r.role === role) return { ...r, role: '' }
      return r
    })
    onChange(next)
  }

  const addCustom = () => {
    const name = draft.trim()
    if (!name) return
    setDraft('')
    if (findRow(name)) return
    const next = cleanRows(rows)
    const hasChat = next.some(r => r.role === 'chat')
    onChange([...next, { name, role: hasChat ? '' : 'chat' }])
  }

  return (
    <div className="space-y-4">
      {items.length === 0 && loadingModels && (
        <div className="rounded-2xl bg-[var(--grand-surface)] ring-1 ring-[var(--grand-border-2)] px-5 py-6 flex items-center gap-3 text-[14px] text-[var(--grand-muted)]">
          <Loader2 size={16} className="animate-spin" />
          Loading models from your server…
        </div>
      )}

      {items.length === 0 && !loadingModels && (
        <EmptyHint />
      )}

      {items.length > 0 && (
        <div className="rounded-2xl bg-[var(--grand-surface)] ring-1 ring-[var(--grand-border-2)] overflow-hidden divide-y divide-[var(--grand-border-2)] max-h-[420px] overflow-y-auto">
          {items.map(item => {
            const row = findRow(item.id)
            return (
              <ModelRowItem
                key={item.id}
                name={item.id}
                custom={item.custom}
                selected={!!row}
                role={row?.role ?? ''}
                onToggle={() => toggleSelect(item.id)}
                onRoleChange={r => setRowRole(item.id, r)}
              />
            )
          })}
        </div>
      )}

      <CustomAdder
        value={draft}
        onChange={setDraft}
        onSubmit={addCustom}
      />

      <p className="text-[12.5px] text-[var(--grand-muted-2)] px-2 leading-relaxed">
        Tap a model to use it. Pick one as <span className="font-medium text-[var(--grand-fg-2)]">chat</span> (required).
        Optional: <span className="font-medium text-[var(--grand-fg-2)]">summary</span> writes chat
        titles, <span className="font-medium text-[var(--grand-fg-2)]">vision</span> understands images.
      </p>
    </div>
  )
}

function EmptyHint() {
  return (
    <div className="rounded-2xl bg-[var(--grand-surface)] ring-1 ring-dashed ring-[var(--grand-border)] px-5 py-6 text-center text-[13.5px] text-[var(--grand-muted)] leading-relaxed">
      No models loaded yet. Fill in the URL and key above — we’ll fetch the list automatically.
      You can also type a model name below to add one manually.
    </div>
  )
}

function ModelRowItem({
  name,
  custom,
  selected,
  role,
  onToggle,
  onRoleChange,
}: {
  name: string
  custom: boolean
  selected: boolean
  role: Role
  onToggle: () => void
  onRoleChange: (role: Role) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <span
          className={`size-6 shrink-0 rounded-md ring-2 inline-flex items-center justify-center transition-colors ${
            selected
              ? 'bg-emerald-500 ring-emerald-500 text-white'
              : 'ring-[var(--grand-border)] bg-transparent'
          }`}
        >
          {selected && <Check size={14} weight="bold" />}
        </span>
        <span className="font-mono text-[14.5px] text-[var(--grand-fg)] truncate">{name}</span>
        {custom && (
          <span className="shrink-0 text-[10px] uppercase tracking-wide rounded-full bg-[var(--grand-surface-2)] text-[var(--grand-muted)] px-1.5 py-0.5">
            custom
          </span>
        )}
      </button>
      {selected && <RolePicker value={role} onChange={onRoleChange} />}
    </div>
  )
}

function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const ROLES: { value: Role; label: string }[] = [
    { value: 'chat', label: 'chat' },
    { value: 'summary', label: 'summary' },
    { value: 'vision', label: 'vision' },
  ]
  return (
    <div className="flex items-center gap-1 rounded-full bg-[var(--grand-surface-2)] ring-1 ring-[var(--grand-border-2)] p-0.5">
      {ROLES.map(r => {
        const active = value === r.value
        return (
          <button
            key={r.value}
            type="button"
            onClick={() => onChange(active ? '' : r.value)}
            className={`text-[11px] font-medium uppercase tracking-wide rounded-full px-2 py-1 transition-colors ${
              active
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-[var(--grand-muted)] hover:text-[var(--grand-fg)]'
            }`}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}

function CustomAdder({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
}) {
  return (
    <div className="rounded-2xl bg-[var(--grand-surface)] ring-1 ring-[var(--grand-border-2)] flex items-center gap-2 pl-4 pr-2 py-2 focus-within:ring-emerald-500/60 transition-all">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onSubmit()
          }
        }}
        placeholder="Add a model the server didn't list…"
        className="flex-1 min-w-0 bg-transparent outline-none text-[14.5px] font-mono text-[var(--grand-fg)] placeholder:text-[var(--grand-muted-2)] py-1.5"
      />
      <AppleAction
        variant="primary"
        className="h-9 px-3.5 rounded-xl text-[13px]"
        disabled={!value.trim()}
        onClick={onSubmit}
        leading={<Plus size={13} weight="bold" />}
      >
        Add
      </AppleAction>
    </div>
  )
}
