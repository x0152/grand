import { useState, useEffect, useCallback } from 'react'
import { Plus, GitBranch, Pencil, Trash2, Play, Pause } from '@/lib/icons'
import { toast } from 'sonner'
import { api } from '../api'
import type { Plan } from '../types'
import PlanEditor from '../components/plans/PlanEditor'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmDelete } from '@/components/ConfirmDelete'
import { navigate } from '../router'

const emptyPlan: Plan = {
  id: '',
  name: '',
  description: '',
  schedule: '',
  enabled: false,
  parameters: {},
  graph: { nodes: [], edges: [] },
}

export default function PlansPage({ deepPlanId }: { deepPlanId?: string }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [activePlan, setActivePlan] = useState<Plan | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      setLoading(true)
      const list = await api.plans.list()
      setPlans(list)
      return list
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!deepPlanId || loading) return
    const found = plans.find(p => p.id === deepPlanId)
    if (found) setActivePlan(found)
  }, [deepPlanId, loading, plans])

  const toggleEnabled = async (plan: Plan, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await api.plans.update(plan.id, {
        name: plan.name,
        description: plan.description,
        schedule: plan.schedule,
        enabled: !plan.enabled,
        parameters: plan.parameters ?? {},
        graph: plan.graph,
      })
      toast.success(plan.enabled ? 'Plan disabled' : 'Plan enabled')
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Toggle failed')
    }
  }

  const remove = async (id: string) => {
    try {
      await api.plans.delete(id)
      toast.success('Plan deleted')
      setDeleteTarget(null)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (activePlan) {
    return (
      <PlanEditor
        plan={activePlan}
        onBack={() => {
          setActivePlan(null)
          if (deepPlanId) navigate({ page: 'plans' })
          load()
        }}
        onSaved={load}
      />
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--grand-fg)]">Plans</h1>
          <p className="text-[13.5px] text-[var(--grand-muted)] mt-1.5">Agentic workflows with actions and decisions</p>
        </div>
        <Button onClick={() => setActivePlan(emptyPlan)}>
          <Plus size={15} /> New plan
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--grand-muted)] text-[14px]">Loading…</div>
      ) : plans.length === 0 ? (
        <EmptyState icon={GitBranch} title="No plans yet" description="Create your first agentic workflow" />
      ) : (
        <div className="space-y-2">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`bg-[var(--grand-surface)] rounded-lg px-5 py-4 cursor-pointer hover:bg-[var(--grand-surface-2)] transition-colors ${!plan.enabled ? 'opacity-60' : ''}`}
              onClick={() => setActivePlan(plan)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <GitBranch size={18} className="text-emerald-400 shrink-0" />
                  <span className="font-medium text-[var(--grand-fg)] text-[14.5px]">{plan.name}</span>
                  {plan.schedule && <Badge variant="outline" className="font-mono">{plan.schedule}</Badge>}
                  <Badge variant={plan.enabled ? 'success' : 'muted'}>
                    {plan.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                  <Badge variant="secondary">
                    {plan.graph.nodes.length} nodes
                  </Badge>
                </div>
                <div className="flex gap-0.5 ml-3" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={e => toggleEnabled(plan, e)}>
                    {plan.enabled ? <Pause size={16} /> : <Play size={16} />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setActivePlan(plan)}>
                    <Pencil size={16} />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => setDeleteTarget(plan.id)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              {plan.description && (
                <p className="text-[13px] text-[var(--grand-muted)] mt-2 ml-7">{plan.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDelete
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title="Delete plan?"
        description="This will permanently remove the plan and its graph."
      />
    </div>
  )
}
