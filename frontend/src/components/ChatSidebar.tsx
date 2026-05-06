import { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, MessageSquare, GitBranch, Pencil, Trash2, Check, X, ChevronDown, ChevronRight, Loader2, Link2 } from '@/lib/icons'
import { api } from '../api'
import { navigate } from '../router'
import { stashPlanEditorReturnChat } from '../lib/planEditorReturn'
import type { ChatSession } from '../types'
import { ConfirmDelete } from '@/components/ConfirmDelete'

interface Props {
  activeSessionId: string | null
  onSelect: (session: ChatSession) => void
  onNew: () => void
  refreshKey: number
  scrollChatsListTopKey?: number
}

export default function ChatSidebar({
  activeSessionId,
  onSelect,
  onNew,
  refreshKey,
  scrollChatsListTopKey = 0,
}: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const editRef = useRef<HTMLInputElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const [planCollapsed, setPlanCollapsed] = useState(false)
  const regularChatsListRef = useRef<HTMLDivElement>(null)
  const lastHandledScrollKey = useRef(0)

  const regularSessions = useMemo(() => sessions.filter(s => s.source !== 'plan'), [sessions])
  const planSessions = useMemo(() => sessions.filter(s => s.source === 'plan'), [sessions])

  useEffect(() => { loadSessions() }, [refreshKey])

  useEffect(() => {
    if (!scrollChatsListTopKey || scrollChatsListTopKey <= lastHandledScrollKey.current) return
    if (activeSessionId && !regularSessions.some(s => s.id === activeSessionId)) return
    lastHandledScrollKey.current = scrollChatsListTopKey
    setChatCollapsed(false)
    const t = window.setTimeout(() => {
      regularChatsListRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }, 90)
    return () => clearTimeout(t)
  }, [scrollChatsListTopKey, regularSessions, activeSessionId])

  useEffect(() => {
    const iv = setInterval(loadSessions, 5000)
    return () => clearInterval(iv)
  }, [])

  async function loadSessions() {
    try {
      const list = await api.chat.listSessions({ limit: 100 })
      setSessions(list)
    } catch {}
  }

  async function handleDelete(id: string) {
    try {
      await api.chat.deleteSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      setDeleteTarget(null)
      if (activeSessionId === id) {
        const remaining = sessions.filter(s => s.id !== id && s.source !== 'plan')
        if (remaining.length > 0) {
          onSelect(remaining[0])
        } else {
          onNew()
        }
      }
    } catch {}
  }

  function startRename(e: React.MouseEvent, session: ChatSession) {
    e.stopPropagation()
    setEditingId(session.id)
    setEditTitle(session.title || '')
    setTimeout(() => editRef.current?.focus(), 0)
  }

  async function confirmRename(id: string) {
    try {
      const updated = await api.chat.updateSession(id, editTitle.trim())
      setSessions(prev => prev.map(s => s.id === id ? updated : s))
    } catch {}
    setEditingId(null)
  }

  function cancelRename() {
    setEditingId(null)
  }

  function displayTitle(s: ChatSession) {
    return s.title || 'New Chat'
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString()
  }

  function planIdFromSession(s: ChatSession): string | undefined {
    const m = s.id.match(/^plan:([^:]+):/)
    return m?.[1]
  }

  function renderSession(session: ChatSession, isPlan = false) {
    const Icon = isPlan ? GitBranch : MessageSquare
    const active = activeSessionId === session.id
    return (
      <div
        key={session.id}
        onClick={() => { if (editingId !== session.id) onSelect(session) }}
        data-active={active}
        className={`chat-row group flex items-center gap-2.5 px-4 py-2 cursor-pointer text-[14px] min-w-0 transition-colors ${
          active
            ? 'bg-[var(--grand-surface-2)] text-[var(--grand-fg)]'
            : 'text-[var(--grand-muted)] hover:text-[var(--grand-fg)] hover:bg-[var(--grand-surface-2)]/50'
        }`}
      >
        {session.active
          ? <Loader2 size={14} className="shrink-0 text-emerald-400 animate-spin" />
          : <Icon size={14} className={`shrink-0 ${isPlan ? 'text-amber-500/70' : 'opacity-70'}`} strokeWidth={1.5} />
        }

        {editingId === session.id ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
            <input
              ref={editRef}
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmRename(session.id)
                if (e.key === 'Escape') cancelRename()
              }}
              className="flex-1 min-w-0 bg-[var(--grand-surface)] rounded px-2 py-1 text-[13px] text-[var(--grand-fg)] outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
            <button onClick={() => confirmRename(session.id)} className="text-emerald-400 hover:text-emerald-300"><Check size={14} /></button>
            <button onClick={cancelRename} className="text-[var(--grand-muted)] hover:text-[var(--grand-fg)]"><X size={14} /></button>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <div className={`truncate ${active ? 'font-medium' : ''}`}>{displayTitle(session)}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-[10.5px] tabular-nums text-[var(--grand-muted-2)]">{formatDate(session.createdAt).toLowerCase()}</span>
                {isPlan && planIdFromSession(session) && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      stashPlanEditorReturnChat(session.id)
                      navigate({ page: 'plans', planId: planIdFromSession(session)! })
                    }}
                    title="Open plan"
                    className="inline-flex items-center gap-1 font-mono text-[10.5px] text-amber-500/70 hover:text-amber-400"
                  >
                    <Link2 size={11} strokeWidth={1.5} />
                    open plan
                  </button>
                )}
              </div>
            </div>
            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
              {!isPlan && (
                <button
                  onClick={e => startRename(e, session)}
                  className="p-1.5 text-[var(--grand-muted)] hover:text-[var(--grand-fg)] rounded"
                >
                  <Pencil size={13} />
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); setDeleteTarget(session.id) }}
                className="p-1.5 text-[var(--grand-muted)] hover:text-rose-500 rounded"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <button
        onClick={onNew}
        className="mx-3 mt-2 mb-2 flex shrink-0 items-center justify-center gap-2 px-3 py-2.5 rounded-md border border-[var(--grand-border)] bg-[var(--grand-surface)] text-[13px] font-medium text-[var(--grand-fg)] hover:border-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
      >
        <Plus size={14} strokeWidth={2} />
        New chat
      </button>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={`flex min-h-0 flex-1 flex-col pb-1 ${
            planSessions.length > 0 ? 'border-b border-[var(--grand-line-2)]' : ''
          }`}
        >
          <button
            type="button"
            onClick={() => setChatCollapsed(v => !v)}
            className="kicker shrink-0 px-4 pb-1.5 pt-1 w-full text-left hover:text-[var(--grand-fg-2)] transition-colors"
          >
            {chatCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
            <span>chats · {regularSessions.length}</span>
          </button>
          {!chatCollapsed && (
            <div ref={regularChatsListRef} className="min-h-0 flex-1 overflow-y-auto pb-2">
              {regularSessions.map(s => renderSession(s))}

              {regularSessions.length === 0 && planSessions.length === 0 && (
                <div className="text-center text-[13px] text-[var(--grand-muted-2)] py-8">
                  No chats yet
                </div>
              )}

              {regularSessions.length === 0 && planSessions.length > 0 && (
                <div className="text-center text-[13px] text-[var(--grand-muted-2)] px-3 py-6">
                  No direct chats yet
                </div>
              )}
            </div>
          )}
        </div>

        {planSessions.length > 0 && (
          <div className="shrink-0 pt-1">
            <button
              type="button"
              onClick={() => setPlanCollapsed(v => !v)}
              className="kicker px-4 pb-1.5 pt-2 w-full text-left hover:text-[var(--grand-fg-2)] transition-colors"
            >
              {planCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
              <span>plan chats · {planSessions.length}</span>
            </button>
            {!planCollapsed && (
              <div className="max-h-[min(38vh,280px)] overflow-y-auto pb-2">
                {planSessions.map(s => renderSession(s, true))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDelete
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="Delete chat?"
        description="This will delete the chat and all its messages."
      />
    </div>
  )
}
