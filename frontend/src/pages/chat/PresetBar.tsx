import { useCallback, useEffect, useMemo, useState } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Brain, Check, ChevronDown, Layers } from '@/lib/icons'
import { api } from '../../api'
import type { LlmConnection, Model, Preset, Settings } from '../../types'

// PresetBar — compact, always-visible row above the composer. Lets the user
// swap the active chat preset, or swap the chat model inside the active
// preset, without leaving the conversation. All changes persist immediately
// (Settings / Preset.chatModelId) so the next message uses the new routing.

export function PresetBar() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [presets, setPresets] = useState<Preset[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [connections, setConnections] = useState<LlmConnection[]>([])
  const [busy, setBusy] = useState<'preset' | 'model' | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [s, pr, md, cn] = await Promise.all([
        api.settings.get(),
        api.presets.list(),
        api.models.list(),
        api.llmConnections.list().catch(() => [] as LlmConnection[]),
      ])
      setSettings(s)
      setPresets(pr)
      setModels(md)
      setConnections(cn)
    } catch {}
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const activePreset = useMemo(
    () => presets.find(p => p.id === settings?.chatPresetId) ?? null,
    [presets, settings],
  )
  const activeChatModel = useMemo(
    () => models.find(m => m.id === activePreset?.chatModelId) ?? null,
    [models, activePreset],
  )
  const connById = useMemo(() => {
    const m = new Map<string, LlmConnection>()
    for (const c of connections) m.set(c.id, c)
    return m
  }, [connections])

  const triggerFlash = useCallback((msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(prev => (prev === msg ? null : prev)), 2200)
  }, [])

  async function onPresetChange(next: string) {
    if (!settings || next === settings.chatPresetId) return
    setBusy('preset')
    const prev = settings
    try {
      const updated = await api.settings.update({
        chatPresetId: next,
        serverPresetId: prev.serverPresetId,
        memoryEnabled: prev.memoryEnabled,
        userMemories: prev.userMemories ?? [],
      })
      setSettings(updated)
      const name = presets.find(p => p.id === next)?.name ?? 'preset'
      triggerFlash(`next message uses preset “${name}”`)
    } catch {
      triggerFlash('failed to update preset')
    } finally {
      setBusy(null)
    }
  }

  async function onModelChange(next: string) {
    if (!activePreset || next === activePreset.chatModelId) return
    setBusy('model')
    try {
      const updated = await api.presets.update(activePreset.id, {
        name: activePreset.name,
        chatModelId: next,
        summaryModelId: activePreset.summaryModelId,
        imageModelId: activePreset.imageModelId,
        fallbackModelId: activePreset.fallbackModelId,
        temperature: activePreset.temperature,
        systemPrompt: activePreset.systemPrompt,
      })
      setPresets(prev => prev.map(p => (p.id === updated.id ? updated : p)))
      const name = models.find(m => m.id === next)?.name ?? 'model'
      triggerFlash(`next message uses “${name}”`)
    } catch {
      triggerFlash('failed to update model')
    } finally {
      setBusy(null)
    }
  }

  if (!settings || presets.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-[var(--grand-muted)] min-w-0">
      <SlotSelect
        icon={<Layers size={13} strokeWidth={1.6} className="text-[var(--grand-muted)]" />}
        label="preset"
        value={activePreset?.id ?? ''}
        displayValue={activePreset?.name ?? '—'}
        onChange={onPresetChange}
        disabled={busy === 'preset'}
        items={presets.map(p => ({
          value: p.id,
          label: p.name,
          sub: modelNameFor(p.chatModelId, models),
        }))}
        emptyLabel="no presets"
      />

      <span className="text-[var(--grand-muted-2)]/60 select-none">·</span>

      <SlotSelect
        icon={<Brain size={13} strokeWidth={1.6} className="text-[var(--grand-muted)]" />}
        label="chat model"
        value={activeChatModel?.id ?? ''}
        displayValue={activeChatModel?.name ?? '—'}
        onChange={onModelChange}
        disabled={!activePreset || busy === 'model'}
        items={models.map(m => {
          const conn = connById.get(m.connectionId)
          return {
            value: m.id,
            label: m.name,
            sub: conn ? `${conn.provider}` : undefined,
          }
        })}
        emptyLabel="no models"
      />

      {flash && (
        <span className="ml-auto text-[11.5px] text-emerald-400 truncate max-w-[50%]">
          {flash}
        </span>
      )}
    </div>
  )
}

function modelNameFor(modelId: string | undefined, models: Model[]): string | undefined {
  if (!modelId) return undefined
  return models.find(m => m.id === modelId)?.name
}

interface SlotSelectProps {
  icon: React.ReactNode
  label: string
  value: string
  displayValue: string
  onChange: (next: string) => void
  disabled?: boolean
  items: { value: string; label: string; sub?: string }[]
  emptyLabel: string
}

function SlotSelect({ icon, label, value, displayValue, onChange, disabled, items, emptyLabel }: SlotSelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className="group flex items-center gap-1.5 min-w-0 h-7 rounded-md px-2
                   text-[var(--grand-fg-2)] hover:text-[var(--grand-fg)]
                   hover:bg-[var(--grand-surface-2)]
                   data-[state=open]:bg-[var(--grand-surface-2)]
                   data-[state=open]:text-[var(--grand-fg)]
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/60"
      >
        {icon}
        <span className="text-[11.5px] text-[var(--grand-muted)] tracking-tight">{label}</span>
        <span className="text-[13px] font-medium text-[var(--grand-fg)] truncate max-w-[180px]">
          {displayValue}
        </span>
        <ChevronDown
          size={12}
          strokeWidth={1.8}
          className="text-[var(--grand-muted-2)] transition-transform group-data-[state=open]:rotate-180"
        />
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          align="start"
          className="z-50 min-w-[220px] max-h-80 overflow-hidden rounded-lg
                     border border-[var(--grand-border)] bg-[var(--grand-surface)]
                     shadow-2xl p-1.5
                     data-[state=open]:animate-in data-[state=closed]:animate-out
                     data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
                     data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <SelectPrimitive.Viewport>
            {items.length === 0 && (
              <div className="px-2.5 py-2 text-[12px] text-[var(--grand-muted)]">{emptyLabel}</div>
            )}
            {items.map(it => (
              <SelectPrimitive.Item
                key={it.value}
                value={it.value}
                className="relative flex w-full cursor-default select-none items-start gap-2
                           rounded-md py-1.5 pl-8 pr-2.5 text-[13px] text-[var(--grand-fg-2)]
                           outline-none focus:bg-[var(--grand-surface-2)] focus:text-[var(--grand-fg)]
                           data-[state=checked]:text-[var(--grand-fg)] data-disabled:pointer-events-none data-disabled:opacity-50"
              >
                <span className="absolute left-2 top-1.5 flex size-4 items-center justify-center text-emerald-400">
                  <SelectPrimitive.ItemIndicator>
                    <Check size={13} strokeWidth={2} />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <div className="min-w-0 flex-1">
                  <SelectPrimitive.ItemText asChild>
                    <div className="truncate">{it.label}</div>
                  </SelectPrimitive.ItemText>
                  {it.sub && (
                    <div className="text-[11px] text-[var(--grand-muted)] truncate">{it.sub}</div>
                  )}
                </div>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
