const KEY = 'mantis_plan_editor_return_chat'

/** Call before navigating to /plans/:id so PlanEditor “back” can restore the chat session. */
export function stashPlanEditorReturnChat(sessionId: string) {
  if (!sessionId) return
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ sessionId }))
  } catch {
    /* ignore quota */
  }
}

/** Consumes and returns session id if user opened the editor from chat; otherwise null. */
export function takePlanEditorReturnChat(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    const o = JSON.parse(raw) as { sessionId?: string }
    return typeof o.sessionId === 'string' && o.sessionId.length > 0 ? o.sessionId : null
  } catch {
    return null
  }
}
