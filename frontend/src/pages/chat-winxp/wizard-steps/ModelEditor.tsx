import type { ProviderModel } from '@/types'
import type { ModelRow } from '../../wizard/types'
import { XpButton } from './shared'

interface Props {
  rows: ModelRow[]
  onChange: (rows: ModelRow[]) => void
  available: ProviderModel[] | null
  loadingModels: boolean
}

const ROLES: Array<{ value: ModelRow['role']; label: string }> = [
  { value: 'chat', label: 'chat' },
  { value: 'summary', label: 'summary' },
  { value: 'vision', label: 'vision' },
  { value: '', label: '— other —' },
]

export function ModelEditor({ rows, onChange, available, loadingModels }: Props) {
  const usedRoles = new Set(rows.map(r => r.role).filter(Boolean))

  const setRow = (i: number, next: Partial<ModelRow>) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...next } : r)))
  }

  const removeRow = (i: number) => {
    onChange(rows.filter((_, idx) => idx !== i))
  }

  const addRow = () => {
    const nextRole: ModelRow['role'] = !usedRoles.has('chat')
      ? 'chat'
      : !usedRoles.has('summary')
        ? 'summary'
        : !usedRoles.has('vision')
          ? 'vision'
          : ''
    onChange([...rows, { name: '', role: nextRole }])
  }

  return (
    <div className="xp-wizard-models">
      <div className="xp-wizard-models-head">
        <span>Model</span>
        <span>Role</span>
        <span />
      </div>
      {rows.length === 0 && (
        <p className="xp-wizard-help xp-wizard-help-block">
          No models yet. Click <em>Add</em> to wire one up.
        </p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="xp-wizard-model-row">
          <input
            type="text"
            list={available ? `xp-models-${i}` : undefined}
            value={row.name}
            onChange={e => setRow(i, { name: e.target.value })}
            placeholder={loadingModels ? 'loading…' : 'gpt-4o, llama3.1:8b, …'}
            className="xp-wizard-input xp-wizard-input-mono"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          {available && (
            <datalist id={`xp-models-${i}`}>
              {available.map(m => (
                <option key={m.id} value={m.id} />
              ))}
            </datalist>
          )}
          <select
            value={row.role}
            onChange={e => setRow(i, { role: e.target.value as ModelRow['role'] })}
            className="xp-wizard-input xp-wizard-select"
          >
            {ROLES.map(r => (
              <option key={r.value || 'none'} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <XpButton onClick={() => removeRow(i)} disabled={rows.length <= 1}>
            Remove
          </XpButton>
        </div>
      ))}
      <div className="xp-wizard-models-actions">
        <XpButton onClick={addRow}>Add model</XpButton>
        {available && (
          <span className="xp-wizard-help">{available.length} available on this server</span>
        )}
      </div>
    </div>
  )
}
