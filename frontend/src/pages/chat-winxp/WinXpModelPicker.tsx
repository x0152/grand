import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import type { Model, Preset, Settings } from '../../types'

const NONE = '__none__'

/**
 * XP-style model picker rendered with a plain `<select>` so xp.css can paint
 * the iconic Luna dropdown chrome out of the box (the embedded SVG arrow,
 * blue highlight, etc.). Mirrors the chat-side logic from `PresetBar`:
 *   - load settings/presets/models on mount
 *   - find the active chat preset and its current chat model
 *   - on change, write the new chatModelId back to that preset
 *
 * It's intentionally chat-only (no `serverPreset` slot, no profile editor)
 * — the experimental shell is meant to feel light, and the heavy editor
 * lives in the regular UI for users who want it.
 */
export function WinXpModelPicker() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [presets, setPresets] = useState<Preset[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [s, pr, md] = await Promise.all([
        api.settings.get(),
        api.presets.list(),
        api.models.list(),
      ])
      setSettings(s)
      setPresets(pr)
      setModels(md)
    } catch {}
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const chatPreset = useMemo(
    () => presets.find(p => p.id === settings?.chatPresetId) ?? null,
    [presets, settings],
  )

  const value = chatPreset?.chatModelId || NONE

  function showFlash(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(prev => (prev === msg ? null : prev)), 2200)
  }

  async function applyModel(next: string) {
    if (!chatPreset) return
    const modelId = next === NONE ? '' : next
    if (modelId === chatPreset.chatModelId) return
    setBusy(true)
    try {
      const updated = await api.presets.update(chatPreset.id, {
        name: chatPreset.name,
        chatModelId: modelId,
        summaryModelId: chatPreset.summaryModelId,
        imageModelId: chatPreset.imageModelId,
        fallbackModelId: chatPreset.fallbackModelId,
        temperature: chatPreset.temperature,
        systemPrompt: chatPreset.systemPrompt,
      })
      setPresets(prev => prev.map(p => (p.id === updated.id ? updated : p)))
      const label = modelId
        ? models.find(m => m.id === modelId)?.name ?? modelId
        : 'none'
      showFlash(`model · ${label}`)
    } catch {
      showFlash('failed to update')
    } finally {
      setBusy(false)
    }
  }

  if (!settings || !chatPreset || models.length === 0) return null

  return (
    <div className="xp-model-picker" title="Chat model — applies to this and future chats">
      <span className="xp-model-label">Model:</span>
      <select
        className="xp-model-select"
        value={value}
        onChange={e => void applyModel(e.target.value)}
        disabled={busy}
      >
        <option value={NONE}>— none —</option>
        {models.map(m => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {flash && <span className="xp-model-flash">{flash}</span>}
    </div>
  )
}
