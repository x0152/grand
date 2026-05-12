import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api'
import type { ChatSession } from '../../types'
import { useIconPositions, type IconPosition } from './useIconPositions'
import { WinXpHourglass } from './WinXpHourglass'

type IconKind =
  | 'newchat'
  | 'folder'
  | 'computer'
  | 'bin'
  | 'exit'
  | 'notepad'
  | 'chat'
  | 'vibecoding'
  | 'messenger'
  | 'outlook'
  | 'addressbook'
  | 'paint'
  | 'minesweeper'
  | 'solitaire'
  | 'wizard'

interface DesktopIcon {
  id: string
  kind: IconKind
  label: string
  /** Action on double-click — undefined means inert */
  onOpen?: () => void
  /** When true the icon shows the chat-icon glyph and label */
  isSession?: boolean
  /** When true, paints the XP "busy" spinner badge in the lower-right
   *  corner of the icon glyph (used for chat sessions that are currently
   *  streaming a response). */
  busy?: boolean
}

interface Props {
  sessions: ChatSession[]
  onOpenSession: (session: ChatSession) => void
  onNewChat: () => void
  onOpenNotepad: () => void
  onOpenGonkaTxt: () => void
  onOpenWizard: () => void
  onExit: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onResetIcons: () => void
  /**
   * Called when the user drops a session icon onto the Recycle Bin.
   * The session id is the chat session UUID. The parent typically asks
   * for confirmation, then calls `useChatSessions().deleteSession`.
   */
  onRequestDeleteSession?: (sessionId: string, label: string) => void
  resetSignal: number
  /**
   * When `true`, hide *every* desktop icon — including the wizard
   * shortcut itself. Used while the Accessibility Wizard window is
   * showing so the wallpaper is fully clear of clutter, the same way
   * the real first-run OOBE blanks the desktop while its setup
   * wizard is in front.
   */
  hideAllIcons?: boolean
}

const BIN_ID = '__bin'

/**
 * The desktop. Owns:
 *   - persisted icon positions (via `useIconPositions`)
 *   - the marquee selection rectangle (visual-only, like real XP when you
 *     click-drag on empty desktop)
 *   - drag-to-move for individual icons
 *
 * Right-click handling is bubbled up to `WinXpExperiment` because the menu
 * itself lives outside this component (so it can sit above other windows).
 */
export function WinXpDesktop({
  sessions,
  onOpenSession,
  onNewChat,
  onOpenNotepad,
  onOpenGonkaTxt,
  onOpenWizard,
  onExit,
  onContextMenu,
  onResetIcons,
  onRequestDeleteSession,
  resetSignal,
  hideAllIcons = false,
}: Props) {
  const icons: DesktopIcon[] = useMemo(() => {
    // While the wizard is open the desktop is wiped — no shortcuts,
    // no recycle bin, not even the wizard's own icon. The wizard
    // window is the only chrome on screen.
    if (hideAllIcons) return []

    // GRAND Setup Wizard shortcut — appears whenever the wizard is
    // closed so the user can re-launch it from the desktop.
    const wizardIcon: DesktopIcon = {
      id: '__wizard',
      kind: 'wizard',
      label: 'GRAND Setup Wizard',
      onOpen: onOpenWizard,
    }

    const fixed: DesktopIcon[] = [
      // "New chat" uses the New-Folder-with-sparkle glyph — pairs
      // perfectly with the chat session glyph (an open folder with a
      // page) so the relationship reads instantly: "make a new one of
      // these". A second one-click launcher lives in Quick Launch.
      { id: '__new', kind: 'newchat', label: 'New chat', onOpen: onNewChat },
      // Vibe Coding uses the File-and-Settings-Transfer-Wizard glyph
      // (two monitors, green arrow) — fits the "switch to the new
      // experience" framing perfectly.
      { id: '__exit', kind: 'vibecoding', label: 'Vibe Coding (2026)', onOpen: onExit },
      // "New Text Document.txt" — the exact default filename Windows
      // XP English assigns when you right-click the desktop and pick
      // "New ▸ Text Document". Uses the .txt file glyph (small Notepad
      // pad icon), distinct from the Notepad app glyph in the title bar.
      { id: '__notepad', kind: 'notepad', label: 'New Text Document.txt', onOpen: onOpenNotepad },
      { id: '__gonka_txt', kind: 'notepad', label: 'gonka.txt', onOpen: onOpenGonkaTxt },
      wizardIcon,
      { id: BIN_ID, kind: 'bin', label: 'Recycle Bin' },
    ]
    // Each session shows up as the classic "open folder with a single
    // page sticking out" glyph — the same one Outlook Express used for
    // saved-message folders. Reads instantly as "a chat / conversation
    // file" without being mistaken for an MSN buddy list.
    const sessionIcons: DesktopIcon[] = sessions.map(s => ({
      id: s.id,
      kind: 'chat',
      label: s.title?.trim() || 'Untitled chat',
      onOpen: () => onOpenSession(s),
      isSession: true,
      busy: !!s.active,
    }))
    return [...fixed, ...sessionIcons]
  }, [
    sessions,
    onOpenSession,
    onNewChat,
    onOpenNotepad,
    onOpenGonkaTxt,
    onOpenWizard,
    onExit,
    hideAllIcons,
  ])

  const allIds = useMemo(() => icons.map(i => i.id), [icons])
  const { positions, setIconPosition, resetPositions } = useIconPositions(allIds)

  // Reset icons when the parent bumps `resetSignal`.
  const lastResetRef = useRef(resetSignal)
  useEffect(() => {
    if (resetSignal !== lastResetRef.current) {
      lastResetRef.current = resetSignal
      resetPositions()
      onResetIcons()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  // Live drag state — `binHover` paints the bin in its "full" glyph and
  // selected look while a session icon is held over it.
  const [binHover, setBinHover] = useState(false)
  const binCellRef = useRef<HTMLDivElement>(null)

  const isPointerOverBin = useCallback((clientX: number, clientY: number) => {
    const el = binCellRef.current
    if (!el) return false
    const r = el.getBoundingClientRect()
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    setSelectedId(null)
    const rect = e.currentTarget.getBoundingClientRect()
    setMarquee({
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!marquee) return
    const rect = e.currentTarget.getBoundingClientRect()
    setMarquee({
      ...marquee,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (marquee) setMarquee(null)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }

  return (
    <div
      className="xp-desktop"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={onContextMenu}
    >
      {icons.map(ico => {
        const pos = positions[ico.id] ?? { left: 16, top: 16 }
        const isBin = ico.id === BIN_ID
        return (
          <DesktopIconCell
            key={ico.id}
            icon={ico}
            position={pos}
            selected={selectedId === ico.id || (isBin && binHover)}
            // Bin glyph swaps to its "full" bitmap whenever a session
            // icon is being held over it — same Easter-egg the real
            // Explorer ships.
            kindOverride={isBin && binHover ? 'bin-full' : undefined}
            cellRef={isBin ? binCellRef : undefined}
            busy={ico.busy}
            onSelect={() => setSelectedId(ico.id)}
            onMove={p => setIconPosition(ico.id, p)}
            // Drag wiring — only session icons can be dropped onto the
            // bin. We keep this opt-in so accidentally dragging the
            // recycle bin onto itself is a no-op, and also so static
            // icons (Vibe Coding, Notepad, New chat) can't be deleted.
            isSession={!!ico.isSession}
            onDragMove={
              ico.isSession
                ? (x, y) => setBinHover(isPointerOverBin(x, y))
                : undefined
            }
            onDragEnd={
              ico.isSession
                ? (x, y) => {
                    const overBin = isPointerOverBin(x, y)
                    setBinHover(false)
                    if (overBin && onRequestDeleteSession) {
                      onRequestDeleteSession(ico.id, ico.label)
                      // Snap icon back to its original slot — the parent
                      // will remove it from `sessions` once delete confirms.
                      return 'snap-back'
                    }
                    return 'commit'
                  }
                : undefined
            }
          />
        )
      })}

      {marquee && <MarqueeBox marquee={marquee} />}
    </div>
  )
}

interface MarqueeShape {
  startX: number
  startY: number
  x: number
  y: number
}
type Marquee = MarqueeShape

function MarqueeBox({ marquee }: { marquee: MarqueeShape }) {
  const left = Math.min(marquee.startX, marquee.x)
  const top = Math.min(marquee.startY, marquee.y)
  const width = Math.abs(marquee.x - marquee.startX)
  const height = Math.abs(marquee.y - marquee.startY)
  return <div className="xp-marquee" style={{ left, top, width, height }} />
}

function DesktopIconCell({
  icon,
  position,
  selected,
  kindOverride,
  cellRef,
  isSession,
  busy,
  onSelect,
  onMove,
  onDragMove,
  onDragEnd,
}: {
  icon: DesktopIcon
  position: IconPosition
  selected: boolean
  /** Optional override for the glyph (e.g. swap recycle bin to "full"). */
  kindOverride?: string
  /** Ref onto the icon's outer cell so the desktop can hit-test against
   *  it during a drag (used for the drag-to-bin drop target). */
  cellRef?: React.RefObject<HTMLDivElement | null>
  isSession?: boolean
  /** Paint the XP "busy" spinner over the icon glyph. */
  busy?: boolean
  onSelect: () => void
  /** Commit a new committed position. Only fires on pointer-up — the
   *  XP shell never moves the real icon while you drag, only on drop. */
  onMove: (next: IconPosition) => void
  /** Fires every move while the user is dragging this icon — desktop
   *  uses this to update its "is hovering bin" highlight. */
  onDragMove?: (clientX: number, clientY: number) => void
  /** Fires once on pointer-up for a drag. Returning `'snap-back'`
   *  cancels the position commit (used after the bin consumed it). */
  onDragEnd?: (clientX: number, clientY: number) => 'snap-back' | 'commit' | void
}) {
  const dragRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null)
  // Live cursor offset while dragging — drives the translucent "ghost"
  // overlay. The committed icon stays put at `position` until we drop.
  const [ghost, setGhost] = useState<{ dx: number; dy: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    // 4px slop before we treat the gesture as a drag — otherwise a
    // single-pixel jitter on click would spawn a ghost flash.
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return
    d.moved = true
    setGhost({ dx, dy })
    if (isSession) onDragMove?.(e.clientX, e.clientY)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
    setGhost(null)
    if (!d || !d.moved) return
    // Only sessions are valid drag-to-bin sources, so we only consult
    // onDragEnd (and risk a snap-back) for them.
    const dropResult = isSession ? onDragEnd?.(e.clientX, e.clientY) : undefined
    if (dropResult === 'snap-back') return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    onMove({ left: position.left + dx, top: position.top + dy })
  }

  const glyphKind = kindOverride ?? icon.kind

  return (
    <>
      <div
        ref={cellRef}
        className={`xp-icon ${selected ? 'selected' : ''} ${isSession ? 'draggable' : ''}`}
        style={{ left: position.left, top: position.top }}
        title={icon.label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={e => {
          e.stopPropagation()
          icon.onOpen?.()
        }}
      >
        <div className="xp-icon-glyph-wrap">
          <div className="xp-icon-glyph" data-kind={glyphKind} aria-hidden />
          {busy && (
            <span className="xp-icon-busy" aria-label="Generating" title="Generating">
              <WinXpHourglass size={14} title="Generating" />
            </span>
          )}
        </div>
        <div className="xp-icon-label">{icon.label}</div>
      </div>
      {ghost && (
        // XP-faithful drag preview: translucent copy of the icon glued
        // to the cursor while the original stays in place. `pointer-
        // events: none` so it never steals events from the captured
        // pointer or the bin's hit-test below.
        <div
          className="xp-icon xp-icon-ghost"
          style={{ left: position.left + ghost.dx, top: position.top + ghost.dy }}
          aria-hidden
        >
          <div className="xp-icon-glyph-wrap">
            <div className="xp-icon-glyph" data-kind={glyphKind} aria-hidden />
            {busy && (
              <span className="xp-icon-busy" aria-hidden>
                <WinXpHourglass size={14} title="" />
              </span>
            )}
          </div>
          <div className="xp-icon-label">{icon.label}</div>
        </div>
      )}
    </>
  )
}

export function useChatSessions(active: boolean): {
  sessions: ChatSession[]
  refresh: () => Promise<void>
  newChat: () => Promise<ChatSession | null>
  deleteSession: (id: string) => Promise<boolean>
} {
  const [sessions, setSessions] = useState<ChatSession[]>([])

  const refresh = async () => {
    try {
      const list = await api.chat.listSessions({ limit: 100, offset: 0 })
      setSessions(list.filter(s => s.source !== 'plan'))
    } catch {}
  }

  useEffect(() => {
    if (!active) return
    void refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [active])

  async function newChat() {
    try {
      const s = await api.chat.createSession()
      await refresh()
      return s
    } catch {
      return null
    }
  }

  async function deleteSession(id: string): Promise<boolean> {
    // Optimistically drop from local state so the icon vanishes from the
    // desktop while the network call is in flight — the bin animation
    // would otherwise look stuck. We re-fetch on completion to reconcile.
    setSessions(prev => prev.filter(s => s.id !== id))
    try {
      await api.chat.deleteSession(id)
      await refresh()
      return true
    } catch {
      // Roll back by refetching whatever the server thinks the truth is.
      await refresh()
      return false
    }
  }

  return { sessions, refresh, newChat, deleteSession }
}
