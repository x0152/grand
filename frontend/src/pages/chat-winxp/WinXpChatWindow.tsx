import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api'
import type { Attachment, ChatMessage, ChatSession, Step } from '../../types'
import { stepArgsSummary } from '../../components/chat-messages/stepHelpers'
import { buildInterleavedParts } from '../../components/chat-messages/parts'
import { WinXpClippy } from './WinXpClippy'
import { WinXpHourglass } from './WinXpHourglass'
import { WinXpMarkdown } from './WinXpMarkdown'
import { WinXpModelPicker } from './WinXpModelPicker'
import { WinXpSuggestions } from './WinXpSuggestions'
import { useDraggable, type Position } from './useDraggable'
import { useResizable, type Size } from './useResizable'

interface Props {
  session: ChatSession
  position: Position
  size: Size
  zIndex: number
  active: boolean
  minimized: boolean
  maximized: boolean
  onActivate: () => void
  onClose: () => void
  onMinimize: () => void
  onMaximizeToggle: () => void
  onOpenStep: (step: Step) => void
  onMove: (next: Position) => void
  onResize: (next: Size) => void
  onNewChat: () => void
}

const PAGE_SIZE = 10
const ACTIVE_POLL_MS = 400
const IDLE_POLL_MS = 8000

export function WinXpChatWindow({
  session,
  position,
  size,
  zIndex,
  active,
  minimized,
  maximized,
  onActivate,
  onClose,
  onMinimize,
  onMaximizeToggle,
  onOpenStep,
  onMove,
  onResize,
  onNewChat,
}: Props) {
  const dragHandle = useDraggable(position, onMove, onActivate)
  const resizeRight = useResizable(size, onResize, { edge: 'right' }, onActivate)
  const resizeBottom = useResizable(size, onResize, { edge: 'bottom' }, onActivate)
  const resizeCorner = useResizable(size, onResize, { edge: 'corner' }, onActivate)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)
  const prependingRef = useRef(false)

  const hasPending = useMemo(
    () => messages.some(m => m.status === 'pending'),
    [messages],
  )

  const lastAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i]
    }
    return null
  }, [messages])

  const loadFull = useCallback(async () => {
    try {
      const list = await api.chat.listMessages({ sessionId: session.id, limit: PAGE_SIZE, offset: 0 })
      setMessages(list)
      setHasMore(list.length === PAGE_SIZE)
    } catch {}
  }, [session.id])

  useEffect(() => {
    setMessages([])
    setHasMore(false)
    void loadFull()
  }, [loadFull])

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      if (cancelled) return
      try {
        const latest = await api.chat.listMessages({ sessionId: session.id, limit: 4, offset: 0 })
        if (cancelled) return
        if (latest.length === 0) return
        setMessages(prev => {
          const byId = new Map<string, ChatMessage>()
          for (const m of prev) byId.set(m.id, m)
          for (const m of latest) byId.set(m.id, m)
          const next = Array.from(byId.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          )
          if (
            prev.length === next.length &&
            prev.every((m, i) => JSON.stringify(m) === JSON.stringify(next[i]))
          ) {
            return prev
          }
          return next
        })
      } catch {}
    }
    const interval = hasPending ? ACTIVE_POLL_MS : IDLE_POLL_MS
    const id = setInterval(tick, interval)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [session.id, hasPending])

  useEffect(() => {
    if (prependingRef.current) {
      prependingRef.current = false
      return
    }
    const el = scrollRef.current
    if (!el) return
    if (!userScrolledUp.current) el.scrollTop = el.scrollHeight
  }, [messages])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    userScrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 80
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const offset = messages.length
      const older = await api.chat.listMessages({ sessionId: session.id, limit: PAGE_SIZE, offset })
      if (older.length < PAGE_SIZE) setHasMore(false)
      if (older.length > 0) {
        prependingRef.current = true
        setMessages(prev => {
          const byId = new Map<string, ChatMessage>()
          for (const m of older) byId.set(m.id, m)
          for (const m of prev) byId.set(m.id, m)
          return Array.from(byId.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          )
        })
      }
    } catch {
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim()
    if (!text || sending) return
    if (!textOverride) setInput('')
    setSending(true)
    userScrolledUp.current = false
    try {
      const res = await api.chat.sendMessage(session.id, text)
      setMessages(prev => [...prev, res.userMessage, res.assistantMessage])
    } catch (e) {
      console.error('xp send failed', e)
    } finally {
      setSending(false)
    }
  }

  async function stop() {
    if (stopping) return
    setStopping(true)
    try {
      await api.chat.stopSession(session.id)
    } catch (e) {
      console.error('xp stop failed', e)
    } finally {
      setStopping(false)
    }
  }

  async function regenerate() {
    if (regenerating || hasPending) return
    setRegenerating(true)
    try {
      const res = await api.chat.regenerate(session.id)
      setMessages(prev => {
        // Drop the last assistant message (the one being regenerated) and
        // append the freshly-created pending one returned from the server.
        const lastAssistantId = lastAssistantMessage?.id
        const next = prev.filter(m => !(m.role === 'assistant' && m.id === lastAssistantId))
        return [...next, res.assistantMessage]
      })
      userScrolledUp.current = false
    } catch (e) {
      console.error('xp regenerate failed', e)
    } finally {
      setRegenerating(false)
    }
  }

  const lastAssistantId = lastAssistantMessage?.id
  const canRegenerate = !!lastAssistantId && !hasPending

  return (
    <div
      className={`xp-window-wrap ${minimized ? 'minimized' : ''} ${maximized ? 'maximized' : ''}`}
      style={{
        left: position.left,
        top: position.top,
        width: size.width,
        height: size.height,
        zIndex,
      }}
      onMouseDown={onActivate}
    >
      <div className="window">
        <div
          className={`title-bar ${active ? '' : 'inactive'}`}
          {...(maximized ? {} : dragHandle)}
          onDoubleClick={onMaximizeToggle}
        >
          <div className="title-bar-text">
            <img
              className="xp-title-icon"
              src="/winxp/outlook.png"
              alt=""
              draggable={false}
            />
            Clippy — {session.title || 'Untitled chat'}
          </div>
          <div className="title-bar-controls">
            <button aria-label="Minimize" onClick={onMinimize} />
            <button
              aria-label={maximized ? 'Restore' : 'Maximize'}
              onClick={onMaximizeToggle}
            />
            <button aria-label="Close" onClick={onClose} />
          </div>
        </div>
        <div className="window-body">
          <div className="xp-chat-toolbar">
            <button
              type="button"
              className="xp-chat-toolbar-btn"
              onClick={onNewChat}
              title="Open a new chat in its own window"
            >
              <img
                src="/winxp/new-chat.png"
                alt=""
                width={14}
                height={14}
                draggable={false}
              />
              New Chat
            </button>
            <span className="sep" />
            <span className="pill">
              Session: <b>{session.id.slice(0, 8)}</b>
            </span>
            <span className="pill ok">● online</span>
            <span className="sep" />
            <span className="pill">{messages.length} msgs</span>
            {hasPending && (
              <>
                <span className="sep" />
                <span className="pill" title="Streaming">
                  <WinXpHourglass size={12} title="Streaming" />
                  streaming…
                </span>
              </>
            )}
            <WinXpModelPicker />
          </div>

          <div ref={scrollRef} onScroll={handleScroll} className="xp-chat-stream">
            {hasMore && messages.length > 0 && (
              <div style={{ textAlign: 'center', margin: '4px 0 10px' }}>
                <button onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load older messages'}
                </button>
              </div>
            )}

            {messages.length === 0 && !hasPending && (
              <WinXpSuggestions
                disabled={sending}
                onInsert={prompt => setInput(prompt)}
                onSend={prompt => void send(prompt)}
              />
            )}

            {messages.map(msg => (
              <MessageRow
                key={msg.id}
                msg={msg}
                onOpenStep={onOpenStep}
                showActions={
                  msg.role === 'assistant' &&
                  msg.id === lastAssistantId &&
                  msg.status !== 'pending'
                }
                canRegenerate={canRegenerate}
                regenerating={regenerating}
                onRegenerate={() => void regenerate()}
              />
            ))}
          </div>

          <div className="xp-composer">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder="Type a message — Enter to send, Shift+Enter for newline"
            />
            {hasPending ? (
              <button onClick={() => void stop()} disabled={stopping}>
                {stopping ? 'Stopping…' : 'Stop'}
              </button>
            ) : (
              <button className="default" onClick={() => void send()} disabled={sending || !input.trim()}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            )}
          </div>
        </div>
        <div className="status-bar">
          <p className="status-bar-field">
            {hasPending ? 'Streaming response…' : 'Idle'}
          </p>
          <p className="status-bar-field">
            {messages.reduce((acc, m) => acc + (m.steps?.length ?? 0), 0)} tool calls
          </p>
          <p className="status-bar-field">
            Tokens: {lastAssistantMessage?.tokens ?? 0}
          </p>
        </div>
      </div>

      {!maximized && (
        <>
          <div className="xp-resize xp-resize-r" {...resizeRight} />
          <div className="xp-resize xp-resize-b" {...resizeBottom} />
          <div className="xp-resize xp-resize-br" {...resizeCorner} />
        </>
      )}
    </div>
  )
}

function MessageRow({
  msg,
  onOpenStep,
  showActions,
  canRegenerate,
  regenerating,
  onRegenerate,
}: {
  msg: ChatMessage
  onOpenStep: (s: Step) => void
  showActions?: boolean
  canRegenerate?: boolean
  regenerating?: boolean
  onRegenerate?: () => void
}) {
  const isUser = msg.role === 'user'
  const isPending = msg.status === 'pending'
  const parts = useMemo(
    () => buildInterleavedParts(msg.content ?? '', msg.steps ?? []),
    [msg.content, msg.steps],
  )
  const hasAnyContent = parts.length > 0
  const lastTextIdx = lastIndex(parts, p => p.type === 'text')
  const showThinkingPlaceholder = !isUser && isPending && !hasAnyContent

  // Aggregate plain text from all interleaved text parts for clipboard.
  const copyText = useMemo(
    () => parts.filter(p => p.type === 'text').map(p => p.text).join('\n\n').trim(),
    [parts],
  )

  // Image attachments (mime type or extension) — same heuristic the
  // regular AssistantBubble uses, so the XP shell shows the same set.
  const images = useMemo(
    () =>
      (msg.attachments ?? []).filter(
        a =>
          a.mimeType.startsWith('image/') ||
          /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(a.fileName),
      ),
    [msg.attachments],
  )
  const otherFiles = useMemo(
    () =>
      (msg.attachments ?? []).filter(
        a =>
          !a.mimeType.startsWith('image/') &&
          !/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(a.fileName),
      ),
    [msg.attachments],
  )

  const showHeader = !!(msg.presetName || msg.modelName || msg.modelRole === 'fallback')

  return (
    <div className={`xp-msg ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && <WinXpClippy state={isPending ? 'thinking' : 'idle'} size={56} />}

      <div className="body">
        <div className="who">{isUser ? 'You' : 'Clippy'}</div>

        {showHeader && (
          <div className="xp-msg-header">
            {msg.presetName && (
              <span className="xp-msg-header-preset" title="Preset">
                {msg.presetName}
              </span>
            )}
            {msg.presetName && msg.modelName && (
              <span className="xp-msg-header-sep">·</span>
            )}
            {msg.modelName && (
              <span className="xp-msg-header-model" title="Model">
                {msg.modelName}
              </span>
            )}
            {msg.modelRole === 'fallback' && (
              <span className="xp-msg-header-fallback" title="Fallback model">
                fallback
              </span>
            )}
          </div>
        )}

        {parts.map((part, i) => {
          if (part.type === 'step') {
            return (
              <ToolCard key={part.step!.id} step={part.step!} onOpen={() => onOpenStep(part.step!)} />
            )
          }
          const isLastText = i === lastTextIdx
          const showCursor = isPending && !isUser && isLastText
          return (
            <div
              key={`text-${i}`}
              className={`bubble ${showCursor ? 'xp-typing-cursor' : ''}`}
            >
              {/* User messages stay literal — XP-style markdown lives in
                  Clippy's bubbles where the model actually emits markdown. */}
              {isUser ? part.text : <WinXpMarkdown content={part.text} />}
            </div>
          )
        })}

        {images.length > 0 && (
          <div className={`xp-msg-images count-${Math.min(images.length, 4)}`}>
            {images.map(att => (
              <XpImageAttachment
                key={att.id}
                attachment={att}
                sessionId={msg.sessionId}
              />
            ))}
          </div>
        )}

        {otherFiles.length > 0 && (
          <div className="xp-msg-files">
            {otherFiles.map(att => (
              <a
                key={att.id}
                className="xp-msg-file"
                href={`/api/artifacts/${msg.sessionId}/${att.id}`}
                download={att.fileName}
                title={att.fileName}
              >
                <img src="/winxp/document.png" alt="" width={16} height={16} />
                <span className="xp-msg-file-name">{att.fileName}</span>
                <span className="xp-msg-file-size">{formatBytes(att.size)}</span>
              </a>
            ))}
          </div>
        )}

        {showThinkingPlaceholder && (
          <div className="bubble xp-thinking-bubble">
            <WinXpHourglass size={14} title="Thinking" />
            <span>thinking…</span>
          </div>
        )}

        {showActions && copyText && (
          <MessageActions
            text={copyText}
            canRegenerate={canRegenerate}
            regenerating={regenerating}
            onRegenerate={onRegenerate}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Image attachment with a Picture-Viewer-style modal. The thumbnail picks
 * up the same `xp-md-img` framing as inline markdown images so the look
 * is consistent across both code paths.
 */
function XpImageAttachment({
  attachment,
  sessionId,
}: {
  attachment: Attachment
  sessionId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const src = `/api/artifacts/${sessionId}/${attachment.id}`

  // Close lightbox on Escape.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  return (
    <>
      <button
        type="button"
        className="xp-msg-image"
        onClick={() => setExpanded(true)}
        title={attachment.fileName}
      >
        <img src={src} alt={attachment.fileName} loading="lazy" />
        <span className="xp-msg-image-cap">{attachment.fileName}</span>
      </button>

      {expanded && (
        <div
          className="xp-img-lightbox"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-label={attachment.fileName}
        >
          <div className="xp-img-lightbox-inner" onClick={e => e.stopPropagation()}>
            <div className="title-bar">
              <div className="title-bar-text">
                <img className="xp-title-icon" src="/winxp/document.png" alt="" />
                {attachment.fileName} — Windows Picture and Fax Viewer
              </div>
              <div className="title-bar-controls">
                <button aria-label="Close" onClick={() => setExpanded(false)} />
              </div>
            </div>
            <div className="xp-img-lightbox-canvas">
              <img src={src} alt={attachment.fileName} />
            </div>
            <div className="xp-img-lightbox-actions">
              <a href={src} download={attachment.fileName}>
                Save As…
              </a>
              <button onClick={() => setExpanded(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function formatBytes(b: number): string {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function MessageActions({
  text,
  canRegenerate,
  regenerating,
  onRegenerate,
}: {
  text: string
  canRegenerate?: boolean
  regenerating?: boolean
  onRegenerate?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for environments without clipboard API (eg. older HTTP)
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;left:-9999px'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } finally {
        document.body.removeChild(ta)
      }
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="xp-msg-actions">
      <button onClick={copy} title="Copy message">
        <span aria-hidden className="xp-action-icon xp-action-copy" />
        {copied ? 'Copied' : 'Copy'}
      </button>
      {canRegenerate && (
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          title="Regenerate response"
        >
          {regenerating ? (
            <WinXpHourglass size={11} title="Regenerating" />
          ) : (
            <span aria-hidden className="xp-action-icon xp-action-regen" />
          )}
          {regenerating ? 'Regenerating…' : 'Regenerate'}
        </button>
      )}
    </div>
  )
}

function lastIndex<T>(arr: T[], pred: (x: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i
  return -1
}

function ToolCard({ step, onOpen }: { step: Step; onOpen: () => void }) {
  const isRunning = step.status === 'running'
  const isError = step.status === 'error'
  const argsSummary = stepArgsSummary(step) || step.args.slice(0, 60)
  // Intentionally no result preview here — the chat reads as a one-line
  // tool-call list (XP cmd.exe style); the full output lives in the popup
  // window the user opens by clicking the row.
  return (
    <div className="xp-tool">
      <button
        type="button"
        className="xp-tool-head"
        onClick={onOpen}
        title="Open in cmd.exe"
      >
        <span className="xp-tool-title">
          <span className="xp-tool-prompt">C:\&gt;</span>
          <b>{step.label || step.tool}</b>
          {argsSummary && <span className="xp-tool-args">({argsSummary})</span>}
        </span>
        <span
          className={`xp-tool-status ${
            isRunning ? 'run' : isError ? 'err' : 'done'
          }`}
        >
          {isRunning && <WinXpHourglass size={11} title="Running" />}
          {isError && (
            <img
              src="/winxp/critical.png"
              alt=""
              width={11}
              height={11}
              className="xp-tool-status-icon"
              draggable={false}
            />
          )}
          {isRunning ? 'running' : isError ? 'error' : '✓ done'}
        </span>
      </button>
    </div>
  )
}
