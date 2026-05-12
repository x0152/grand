import { Fragment, useId, useMemo, useState } from 'react'
import type { ProviderModel } from '@/types'
import type { ModelRow } from '../../wizard/types'
import { XpButton } from './shared'

interface Props {
  rows: ModelRow[]
  onChange: (rows: ModelRow[]) => void
  available: ProviderModel[] | null
  loadingModels: boolean
}

type Role = ModelRow['role']

interface ListItem {
  id: string
  custom: boolean
}

const ROLES: Array<{ value: Role; label: string }> = [
  { value: 'chat', label: 'main' },
  { value: 'summary', label: 'summary' },
  { value: 'vision', label: 'vision' },
]

export function ModelEditor({ rows, onChange, available, loadingModels }: Props) {
  const [draft, setDraft] = useState('')
  const reactId = useId()

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
    <div className="xp-wizard-models">
      {items.length === 0 && loadingModels && (
        <p className="xp-wizard-help xp-wizard-help-block">Loading models from your server…</p>
      )}

      {items.length === 0 && !loadingModels && (
        <p className="xp-wizard-help xp-wizard-help-block">
          No models loaded yet. Fill in URL/API key above or add a model manually below.
        </p>
      )}

      {items.length > 0 && (
        <div className="xp-wizard-model-list">
          {items.map((item, idx) => {
            const row = findRow(item.id)
            const selected = !!row
            const inputId = `${reactId}-model-${idx}`
            return (
              <div key={item.id} className="xp-wizard-model-list-item">
                <div className="xp-wizard-model-check field-row">
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelect(item.id)}
                  />
                  <label htmlFor={inputId} className="xp-wizard-model-check-label">
                    <span className="xp-wizard-model-name">{item.id}</span>
                    {item.custom && <span className="xp-wizard-model-badge">custom</span>}
                  </label>
                </div>

                {selected && (
                  <div className="xp-wizard-model-roles">
                    {ROLES.map(role => {
                      const active = row?.role === role.value
                      const rid = `${inputId}-role-${role.value}`
                      return (
                        <Fragment key={role.value}>
                          <input
                            id={rid}
                            type="radio"
                            name={`${inputId}-role`}
                            checked={active}
                            onChange={() => setRowRole(item.id, role.value)}
                          />
                          <label
                            htmlFor={rid}
                            onClick={e => {
                              if (active) {
                                e.preventDefault()
                                setRowRole(item.id, '')
                              }
                            }}
                          >
                            {role.label}
                          </label>
                        </Fragment>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="xp-wizard-model-add">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addCustom()
            }
          }}
          placeholder="Add a model the server did not list…"
          className="xp-wizard-input xp-wizard-input-mono"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <XpButton onClick={addCustom} disabled={!draft.trim()}>
          Add model
        </XpButton>
      </div>

      <p className="xp-wizard-help xp-wizard-help-block">
        Select models by checkbox. Choose one <em>main</em> model (required). Optional:{' '}
        <em>summary</em> for chat titles and <em>vision</em> for image input.
      </p>
    </div>
  )
}
