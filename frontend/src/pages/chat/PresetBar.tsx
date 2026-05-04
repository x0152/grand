import { useCallback, useEffect, useMemo, useState } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Brain, Check, ChevronDown, Cloud, Pencil } from '@/lib/icons'
import { toast } from 'sonner'
import { api } from '../../api'
import type { LlmConnection, Model, Preset, Settings } from '../../types'
import { ProfileDialog } from '../llm/ProfileDialog'
import { EMPTY_PROFILE_FORM, type ProfileForm } from '../llm/types'

// Bar shows the active chat model and server-side model (each stored on the
// routed preset’s chatModelId). Pencil opens full profile edit on AI Engine.

const NONE = '__none__'

export function PresetBar() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [presets, setPresets] = useState<Preset[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [connections, setConnections] = useState<LlmConnection[]>([])
  const [busy, setBusy] = useState<'chat' | 'server' | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const [profileOpen, setProfileOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Preset | null>(null)
  const [profileForm, setProfileForm] = useState<ProfileForm>(EMPTY_PROFILE_FORM)

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

  const endpointById = useMemo(() => new Map(connections.map(c => [c.id, c])), [connections])

  const chatPreset = useMemo(
    () => presets.find(p => p.id === settings?.chatPresetId) ?? null,
    [presets, settings],
  )
  const serverPreset = useMemo(
    () => presets.find(p => p.id === settings?.serverPresetId) ?? null,
    [presets, settings],
  )

  const chatModel = useMemo(
    () => (chatPreset?.chatModelId ? models.find(m => m.id === chatPreset.chatModelId) ?? null : null),
    [chatPreset, models],
  )
  const serverModel = useMemo(
    () => (serverPreset?.chatModelId ? models.find(m => m.id === serverPreset.chatModelId) ?? null : null),
    [serverPreset, models],
  )

  const triggerFlash = useCallback((msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(prev => (prev === msg ? null : prev)), 2200)
  }, [])

  function openEditPreset(p: Preset | null, label: string) {
    if (!p) {
      toast.info(`Set a ${label} preset in AI Engine first, or pick routing there`)
      return
    }
    setEditingProfile(p)
    setProfileForm({
      name: p.name,
      chatModelId: p.chatModelId,
      summaryModelId: p.summaryModelId,
      imageModelId: p.imageModelId,
      fallbackModelId: p.fallbackModelId,
      temperature: p.temperature != null ? String(p.temperature) : '',
      systemPrompt: p.systemPrompt,
    })
    setProfileOpen(true)
  }

  const submitProfile = useCallback(async () => {
    if (!editingProfile) return
    try {
      const payload = {
        name: profileForm.name,
        chatModelId: profileForm.chatModelId,
        summaryModelId: profileForm.summaryModelId,
        imageModelId: profileForm.imageModelId,
        fallbackModelId: profileForm.fallbackModelId,
        temperature: profileForm.temperature ? parseFloat(profileForm.temperature) : null,
        systemPrompt: profileForm.systemPrompt,
      }
      const updated = await api.presets.update(editingProfile.id, payload)
      setPresets(prev => prev.map(p => (p.id === updated.id ? updated : p)))
      toast.success('Profile updated')
      setProfileOpen(false)
      setEditingProfile(null)
      await refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }, [editingProfile, profileForm, refresh])

  async function applyChatModel(next: string) {
    const modelId = next === NONE ? '' : next
    if (!chatPreset || modelId === chatPreset.chatModelId) return
    setBusy('chat')
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
      const label = modelId ? models.find(m => m.id === modelId)?.name ?? modelId : 'none'
      triggerFlash(`chat model · ${label}`)
    } catch {
      triggerFlash('failed to update chat model')
    } finally {
      setBusy(null)
    }
  }

  async function applyServerModel(next: string) {
    const modelId = next === NONE ? '' : next
    if (!serverPreset || modelId === serverPreset.chatModelId) return
    setBusy('server')
    try {
      const updated = await api.presets.update(serverPreset.id, {
        name: serverPreset.name,
        chatModelId: modelId,
        summaryModelId: serverPreset.summaryModelId,
        imageModelId: serverPreset.imageModelId,
        fallbackModelId: serverPreset.fallbackModelId,
        temperature: serverPreset.temperature,
        systemPrompt: serverPreset.systemPrompt,
      })
      setPresets(prev => prev.map(p => (p.id === updated.id ? updated : p)))
      const label = modelId ? models.find(m => m.id === modelId)?.name ?? modelId : 'none'
      triggerFlash(`servers / SSH model · ${label}`)
    } catch {
      triggerFlash('failed to update server model')
    } finally {
      setBusy(null)
    }
  }

  const modelItems = models.map(m => {
    const conn = endpointById.get(m.connectionId)
    return {
      value: m.id,
      label: m.name,
      sub: conn ? `${conn.provider} · ${conn.id}` : undefined,
    }
  })

  const chatModelValue = chatPreset?.chatModelId || NONE
  const serverModelValue = serverPreset?.chatModelId || NONE

  const editBtnClass =
    'shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md ' +
    'text-[var(--grand-muted)] hover:text-emerald-400 hover:bg-[var(--grand-surface-2)] ' +
    'transition-colors disabled:pointer-events-none disabled:opacity-35 outline-none ' +
    'focus-visible:ring-1 focus-visible:ring-emerald-400/60'

  if (!settings || presets.length === 0) {
    return null
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-[var(--grand-muted)] min-w-0">
        <div className="flex min-w-0 items-center gap-0.5">
          <SlotSelect
            icon={<Brain size={13} strokeWidth={1.6} className="text-[var(--grand-muted)]" />}
            label="chat"
            value={chatModelValue}
            displayValue={chatModel?.name ?? 'None'}
            onChange={applyChatModel}
            disabled={!chatPreset || busy === 'chat' || models.length === 0}
            items={[
              { value: NONE, label: 'None', sub: undefined },
              ...modelItems,
            ]}
            emptyLabel="no models defined — AI Engine"
          />
          <button
            type="button"
            className={editBtnClass}
            title="Full preset: roles, temperature, system prompt"
            disabled={!chatPreset || busy === 'chat'}
            onClick={() => openEditPreset(chatPreset, 'chat')}
          >
            <Pencil size={13} strokeWidth={1.6} />
          </button>
        </div>

        <span className="text-[var(--grand-muted-2)]/60 select-none">·</span>

        <div className="flex min-w-0 items-center gap-0.5">
          <SlotSelect
            icon={<Cloud size={13} strokeWidth={1.6} className="text-[var(--grand-muted)]" />}
            label="servers"
            value={serverModelValue}
            displayValue={serverModel?.name ?? 'None'}
            onChange={applyServerModel}
            disabled={!serverPreset || busy === 'server' || models.length === 0}
            items={[
              { value: NONE, label: 'None', sub: undefined },
              ...modelItems,
            ]}
            emptyLabel="no models defined — AI Engine"
          />
          <button
            type="button"
            className={editBtnClass}
            title="Full preset: roles, temperature, system prompt"
            disabled={!serverPreset || busy === 'server'}
            onClick={() => openEditPreset(serverPreset, 'server')}
          >
            <Pencil size={13} strokeWidth={1.6} />
          </button>
        </div>

        {flash && (
          <span className="ml-auto text-[11.5px] text-emerald-400 truncate max-w-[50%]">
            {flash}
          </span>
        )}
      </div>

      <ProfileDialog
        open={profileOpen}
        onOpenChange={open => {
          setProfileOpen(open)
          if (!open) setEditingProfile(null)
        }}
        editing={editingProfile}
        form={profileForm}
        setForm={setProfileForm}
        onSubmit={() => { void submitProfile() }}
        models={models}
        endpointById={endpointById}
      />
    </>
  )
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
