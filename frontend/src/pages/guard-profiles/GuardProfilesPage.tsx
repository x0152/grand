import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from '@/lib/icons'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDelete } from '@/components/ConfirmDelete'
import { api } from '@/api'
import { navigate } from '@/router'
import type { GuardProfile } from '@/types'
import { ProfileList } from './ProfileList'
import { Studio } from './Studio'
import { fromProfile, EMPTY_FORM, type StudioForm } from './types'

interface Props {
  profileId?: string
}

const CLONE_KEY = 'guard-clone-source'

export default function GuardProfilesPage({ profileId }: Props) {
  const [profiles, setProfiles] = useState<GuardProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setProfiles(await api.guardProfiles.list())
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const openCreate = () => navigate({ page: 'guard-profiles', profileId: 'new' })
  const openEdit = (p: GuardProfile) => navigate({ page: 'guard-profiles', profileId: p.id })
  const openClone = (p: GuardProfile) => {
    sessionStorage.setItem(CLONE_KEY, JSON.stringify(p))
    navigate({ page: 'guard-profiles', profileId: 'new' })
  }

  const onCancel = () => navigate({ page: 'guard-profiles' })

  const onSaved = (saved: GuardProfile) => {
    setProfiles(prev => {
      const idx = prev.findIndex(p => p.id === saved.id)
      if (idx === -1) return [...prev, saved]
      const next = [...prev]
      next[idx] = saved
      return next
    })
    if (profileId === 'new') {
      navigate({ page: 'guard-profiles', profileId: saved.id })
    }
  }

  const remove = async (id: string) => {
    try {
      await api.guardProfiles.delete(id)
      toast.success('Profile deleted')
      setDeleteTarget(null)
      void load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const studioState = useStudioState(profileId, profiles, loading)

  if (studioState.kind === 'studio') {
    return (
      <Studio
        key={studioState.sessionKey}
        initial={studioState.initial}
        editing={studioState.editing}
        onCancel={onCancel}
        onSaved={onSaved}
      />
    )
  }

  if (studioState.kind === 'not-found') {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-[14px] text-[var(--grand-muted)]">Guard profile not found.</p>
        <Button variant="secondary" className="mt-3" onClick={onCancel}>Back to list</Button>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-7 gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--grand-fg)]">Guard profiles</h1>
          <p className="text-[13.5px] text-[var(--grand-muted)] mt-1.5 leading-relaxed max-w-2xl">
            A guard profile is a simple set of rules that decides which commands the agent can run
            and where it can reach on the network. Build one here, then attach it to as many
            sandboxes or SSH hosts as you like.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={15} /> New profile
        </Button>
      </div>

      <ProfileList
        profiles={profiles}
        expanded={expanded}
        onToggle={toggle}
        onCreate={openCreate}
        onEdit={openEdit}
        onClone={openClone}
        onDelete={setDeleteTarget}
        loading={loading}
      />

      <ConfirmDelete
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title="Delete profile?"
        description="This will permanently remove the guard profile."
      />
    </div>
  )
}

type StudioState =
  | { kind: 'list' }
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'studio'; sessionKey: string; editing: GuardProfile | null; initial: StudioForm }

function useStudioState(profileId: string | undefined, profiles: GuardProfile[], loading: boolean): StudioState {
  return useMemo<StudioState>(() => {
    if (!profileId) return { kind: 'list' }
    if (profileId === 'new') {
      const raw = sessionStorage.getItem(CLONE_KEY)
      if (raw) {
        sessionStorage.removeItem(CLONE_KEY)
        try {
          const source = JSON.parse(raw) as GuardProfile
          return {
            kind: 'studio',
            sessionKey: `clone-${source.id}-${Date.now()}`,
            editing: null,
            initial: { ...fromProfile(source), name: source.name + ' (copy)' },
          }
        } catch {
          // fall through to empty form
        }
      }
      return { kind: 'studio', sessionKey: 'new', editing: null, initial: EMPTY_FORM }
    }
    if (loading) return { kind: 'loading' }
    const p = profiles.find(p => p.id === profileId)
    if (!p) return { kind: 'not-found' }
    return { kind: 'studio', sessionKey: `edit-${p.id}`, editing: p, initial: fromProfile(p) }
  }, [profileId, profiles, loading])
}
