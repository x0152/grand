import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatSession, Step } from '../../types'
import { useXpCss } from './useXpCss'
import { WinXpDesktop, useChatSessions } from './WinXpDesktop'
import { WinXpChatWindow } from './WinXpChatWindow'
import { WinXpCmdTerminal } from './WinXpCmdTerminal'
import { WinXpContextMenu, type MenuItem } from './WinXpContextMenu'
import { WinXpNotepad, UNTITLED1_INITIAL_TEXT } from './WinXpNotepad'
import { WinXpConfirmDialog } from './WinXpConfirmDialog'
import { WinXpWizard } from './WinXpWizard'
import './winxp.css'

interface Props {
  onExit: () => void
  initialSessionId?: string | null
  /** When set, the experiment is acting as the first-run setup. The
   *  wizard cannot be dismissed without finishing — closing it exits
   *  back to the modern wizard via `onExit`. Once the wizard finishes
   *  saving config, `onSetupDone` is invoked. */
  inSetupMode?: boolean
  onSetupDone?: () => void
}

interface Position { left: number; top: number }
interface Size { width: number; height: number }

interface OpenWindow {
  kind: 'chat'
  id: string
  session: ChatSession
  position: Position
  size: Size
  minimized: boolean
  maximized: boolean
  prev?: { position: Position; size: Size }
}

interface OpenCmd {
  kind: 'cmd'
  id: string
  step: Step
  position: Position
  size: Size
  maximized: boolean
  prev?: { position: Position; size: Size }
}

interface OpenNotepad {
  kind: 'notepad'
  id: string
  title: string
  content: string
  position: Position
  size: Size
  minimized: boolean
  maximized: boolean
  prev?: { position: Position; size: Size }
}

interface OpenWizard {
  kind: 'wizard'
  id: string
  position: Position
  size: Size
}

const CHAT_OFFSET_X = 48
const CHAT_OFFSET_Y = 36
const CMD_OFFSET_X = 30
const CMD_OFFSET_Y = 30
// Bumped from 660×500 — the empty-chat suggestion grid (3-4 sections of
// 6+ tiles each) needs ~860px width and ~640px height to feel breathable.
// Capped at 92% of viewport so smaller screens still see the wallpaper edge.
const DEFAULT_CHAT_SIZE: Size = { width: 860, height: 640 }
const DEFAULT_CMD_SIZE: Size = { width: 720, height: 460 }
const DEFAULT_NOTEPAD_SIZE: Size = { width: 560, height: 460 }
// Base wizard size is 800x600, the exact resolution of the canonical
// XP OOBE (Out-Of-Box Experience) wizard. We do not scale
// it up to preserve the pixel-perfect original proportions.
const WIZARD_BASE_SIZE: Size = { width: 800, height: 600 }
// XP's Luna taskbar is 30px tall; we still match that dimension so the
// chrome looks right against the wallpaper.
const TASKBAR_H = 30
const NOTEPAD_ID = '__notepad'
const WIZARD_ID = '__wizard'

/**
 * Self-contained Windows-XP-themed shell for the chat experience. Mounts
 * full-screen on top of the regular UI when toggled on, lifecycle-injects
 * XP.css to keep its `button {…}` rules out of the rest of the app, and
 * owns the window manager / start menu / context menu state.
 *
 * Everything in this folder (`pages/chat-winxp/`) is opt-in via the toggle
 * and can be deleted as a unit.
 */
export function WinXpExperiment({ onExit, initialSessionId, inSetupMode = false, onSetupDone }: Props) {
  useXpCss(true)
  const { sessions, newChat, deleteSession } = useChatSessions(true)

  const [windows, setWindows] = useState<OpenWindow[]>([])
  const [terminals, setTerminals] = useState<OpenCmd[]>([])
  const [notepad, setNotepad] = useState<OpenNotepad | null>(null)
  const [wizard, setWizard] = useState<OpenWizard | null>(null)
  const [zStack, setZStack] = useState<string[]>([])
  const [clock, setClock] = useState(() => new Date())
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const [iconResetSignal, setIconResetSignal] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)
  const [isFlenovMode, setIsFlenovMode] = useState(false)
  const [flenovPos, setFlenovPos] = useState<{ x: number; y: number } | null>(null)
  const handledInitialRef = useRef(false)
  // Auto-open the GRAND Setup Wizard once per XP-mode mount — the
  // first-launch experience the real OOBE box did. After the user
  // closes it, the desktop reveals every other icon.
  const wizardAutoLaunchedRef = useRef(false)

  useEffect(() => {
    if (!isFlenovMode) return
    // 5. Бесконечный цикл перемещения (как учил М. Фленов в "Программировании на C++ глазами хакера")
    // SetParent(hStartButton, NULL) -> Теперь родитель - весь экран
    const id = setInterval(() => {
      const maxX = window.innerWidth - 100 // 100 is approx Start button width
      const maxY = window.innerHeight - 30 // 30 is approx Start button height
      setFlenovPos({
        x: Math.max(0, Math.floor(Math.random() * maxX)),
        y: Math.max(0, Math.floor(Math.random() * maxY)),
      })
    }, 500)
    return () => clearInterval(id)
  }, [isFlenovMode])

  // Tray clock — refresh every 30s so it stays roughly current without
  // thrashing the render tree.
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Auto-resize maximized windows when the viewport changes.
  useEffect(() => {
    const onResize = () => {
      setWindows(prev =>
        prev.map(w =>
          w.maximized ? { ...w, size: maxSize(), position: { left: 0, top: 0 } } : w,
        ),
      )
      setTerminals(prev =>
        prev.map(t =>
          t.maximized ? { ...t, size: maxSize(), position: { left: 0, top: 0 } } : t,
        ),
      )
      setNotepad(prev =>
        prev && prev.maximized
          ? { ...prev, size: maxSize(), position: { left: 0, top: 0 } }
          : prev,
      )
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const focused = zStack.length ? zStack[zStack.length - 1] : null

  const bringToFront = useCallback((id: string) => {
    setZStack(prev => {
      const next = prev.filter(x => x !== id)
      next.push(id)
      return next
    })
  }, [])

  const openChat = useCallback(
    (session: ChatSession) => {
      setWindows(prev => {
        const existing = prev.find(w => w.id === session.id)
        if (existing) {
          return prev.map(w =>
            w.id === session.id ? { ...w, minimized: false } : w,
          )
        }
        const offset = prev.length
        return [
          ...prev,
          {
            kind: 'chat',
            id: session.id,
            session,
            position: {
              left: 80 + offset * CHAT_OFFSET_X,
              top: 60 + offset * CHAT_OFFSET_Y,
            },
            size: clampToViewport(DEFAULT_CHAT_SIZE),
            minimized: false,
            maximized: false,
          },
        ]
      })
      bringToFront(session.id)
    },
    [bringToFront],
  )

  const closeWindow = useCallback((id: string | null) => {
    if (!id) return
    setWindows(prev => prev.filter(w => w.id !== id))
    setZStack(prev => prev.filter(x => x !== id))
  }, [])

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => (w.id === id ? { ...w, minimized: true } : w)))
    setZStack(prev => prev.filter(x => x !== id))
  }, [])

  const toggleMaximize = useCallback((id: string) => {
    setWindows(prev =>
      prev.map(w => {
        if (w.id !== id) return w
        if (w.maximized && w.prev) {
          return { ...w, maximized: false, position: w.prev.position, size: w.prev.size, prev: undefined }
        }
        return {
          ...w,
          maximized: true,
          prev: { position: w.position, size: w.size },
          position: { left: 0, top: 0 },
          size: maxSize(),
        }
      }),
    )
  }, [])

  const moveWindow = useCallback((id: string, next: Position) => {
    setWindows(prev =>
      prev.map(w => (w.id === id && !w.maximized ? { ...w, position: next } : w)),
    )
  }, [])

  const sizeWindow = useCallback((id: string, next: Size) => {
    setWindows(prev =>
      prev.map(w => (w.id === id && !w.maximized ? { ...w, size: next } : w)),
    )
  }, [])

  const openTerminal = useCallback(
    (step: Step) => {
      const id = `cmd-${step.id}-${Date.now()}`
      setTerminals(prev => {
        const offset = prev.length
        return [
          ...prev,
          {
            kind: 'cmd',
            id,
            step,
            position: {
              left: 200 + offset * CMD_OFFSET_X,
              top: 120 + offset * CMD_OFFSET_Y,
            },
            size: clampToViewport(DEFAULT_CMD_SIZE),
            maximized: false,
          },
        ]
      })
      bringToFront(id)
    },
    [bringToFront],
  )

  const closeTerminal = useCallback((id: string) => {
    setTerminals(prev => prev.filter(t => t.id !== id))
    setZStack(prev => prev.filter(x => x !== id))
  }, [])

  const moveTerminal = useCallback((id: string, next: Position) => {
    setTerminals(prev =>
      prev.map(t => (t.id === id && !t.maximized ? { ...t, position: next } : t)),
    )
  }, [])

  const sizeTerminal = useCallback((id: string, next: Size) => {
    setTerminals(prev =>
      prev.map(t => (t.id === id && !t.maximized ? { ...t, size: next } : t)),
    )
  }, [])

  const toggleMaximizeTerminal = useCallback((id: string) => {
    setTerminals(prev =>
      prev.map(t => {
        if (t.id !== id) return t
        if (t.maximized && t.prev) {
          return { ...t, maximized: false, position: t.prev.position, size: t.prev.size, prev: undefined }
        }
        return {
          ...t,
          maximized: true,
          prev: { position: t.position, size: t.size },
          position: { left: 0, top: 0 },
          size: maxSize(),
        }
      }),
    )
  }, [])

  const openNotepad = useCallback(() => {
    setNotepad(prev => {
      if (prev) return { ...prev, minimized: false }
      return {
        kind: 'notepad',
        id: NOTEPAD_ID,
        title: 'New Text Document',
        content: UNTITLED1_INITIAL_TEXT,
        position: { left: 140, top: 90 },
        size: clampToViewport(DEFAULT_NOTEPAD_SIZE),
        minimized: false,
        maximized: false,
      }
    })
    bringToFront(NOTEPAD_ID)
  }, [bringToFront])

  const closeNotepad = useCallback(() => {
    setNotepad(null)
    setZStack(prev => prev.filter(x => x !== NOTEPAD_ID))
  }, [])

  const openWizard = useCallback(() => {
    setWizard(prev => {
      if (prev) return prev
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800
      const size = computeWizardSize(vw, vh)
      return {
        kind: 'wizard',
        id: WIZARD_ID,
        position: {
          left: Math.max(0, Math.round((vw - size.width) / 2)),
          top: Math.max(0, Math.round((vh - size.height) / 2)),
        },
        size,
      }
    })
    bringToFront(WIZARD_ID)
  }, [bringToFront])

  const closeWizard = useCallback(() => {
    setWizard(null)
    setZStack(prev => prev.filter(x => x !== WIZARD_ID))
  }, [])

  const moveWizard = useCallback((next: Position) => {
    setWizard(prev => (prev ? { ...prev, position: next } : prev))
  }, [])

  // Auto-open the wizard the very first time the XP shell mounts —
  // BUT only when we're actually in setup mode (mirrors how the modern
  // UI gates SetupWizard behind `needsSetup`). Otherwise the user has
  // already finished setup and re-opening the wizard on every XP mount
  // is just noise — the desktop should reveal directly. The user can
  // still launch it manually from the Setup icon / Start menu later.
  useEffect(() => {
    if (wizardAutoLaunchedRef.current) return
    wizardAutoLaunchedRef.current = true
    if (!inSetupMode) return
    openWizard()
  }, [openWizard, inSetupMode])

  const moveNotepad = useCallback((next: Position) => {
    setNotepad(prev => (prev && !prev.maximized ? { ...prev, position: next } : prev))
  }, [])

  const sizeNotepad = useCallback((next: Size) => {
    setNotepad(prev => (prev && !prev.maximized ? { ...prev, size: next } : prev))
  }, [])

  const toggleMaximizeNotepad = useCallback(() => {
    setNotepad(prev => {
      if (!prev) return prev
      if (prev.maximized && prev.prev) {
        return { ...prev, maximized: false, position: prev.prev.position, size: prev.prev.size, prev: undefined }
      }
      return {
        ...prev,
        maximized: true,
        prev: { position: prev.position, size: prev.size },
        position: { left: 0, top: 0 },
        size: maxSize(),
      }
    })
  }, [])

  // ESC closes whatever is currently focused (terminal, chat window, notepad,
  // wizard). Wizards live in the same stack — Cancel and ESC behave the
  // same way the real shell32 wizard does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (ctxMenu) return // ctx menu handles its own ESC
      const top = zStack[zStack.length - 1]
      if (!top) return
      if (top === WIZARD_ID && wizard) {
        if (inSetupMode) onExit()
        else closeWizard()
      }
      else if (top === NOTEPAD_ID && notepad) closeNotepad()
      else if (terminals.some(t => t.id === top)) closeTerminal(top)
      else if (windows.some(w => w.id === top)) closeWindow(top)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [windows, terminals, zStack, closeTerminal, closeWindow, closeNotepad, notepad, ctxMenu, wizard, closeWizard, inSetupMode, onExit])

  // Open the initial session on first mount when sessions are ready.
  useEffect(() => {
    if (handledInitialRef.current) return
    if (!initialSessionId) return
    const session = sessions.find(s => s.id === initialSessionId)
    if (!session) return
    handledInitialRef.current = true
    openChat(session)
  }, [initialSessionId, sessions, openChat])

  async function handleNewChat() {
    const created = await newChat()
    if (created) openChat(created)
  }

  function showDesktopMenu(e: React.MouseEvent) {
    e.preventDefault()
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'View', shortcut: '▸' },
        { label: 'Arrange Icons By', shortcut: '▸' },
        { label: 'Refresh', onClick: () => {} },
        { divider: true },
        {
          label: 'Paste',
          disabled: true,
        },
        { divider: true },
        {
          label: 'New chat',
          onClick: () => void handleNewChat(),
        },
        {
          label: 'Auto-arrange icons',
          onClick: () => setIconResetSignal(n => n + 1),
        },
        { divider: true },
        { label: 'Properties', disabled: true },
      ],
    })
  }

  return (
    <div className="xp-root">
      <WinXpDesktop
        sessions={sessions}
        onOpenSession={openChat}
        onNewChat={handleNewChat}
        onOpenNotepad={openNotepad}
        onOpenWizard={openWizard}
        onExit={onExit}
        onContextMenu={showDesktopMenu}
        onResetIcons={() => {}}
        onRequestDeleteSession={(id, label) => setDeleteTarget({ id, label })}
        resetSignal={iconResetSignal}
        // While the wizard is open the desktop is fully blanked —
        // including the wizard's own shortcut — so the wallpaper sits
        // empty behind the wizard chrome, matching the real first-run
        // OOBE behaviour. The shortcut returns the moment the wizard
        // closes so the user can re-launch it.
        hideAllIcons={!!wizard}
      />

      <div className="xp-windows">
        {!wizard && windows.map(w => {
          const z = zStack.indexOf(w.id)
          return (
            <WinXpChatWindow
              key={w.id}
              session={w.session}
              position={w.position}
              size={w.size}
              zIndex={10 + (z >= 0 ? z : 0)}
              active={focused === w.id}
              minimized={w.minimized}
              maximized={w.maximized}
              onActivate={() => bringToFront(w.id)}
              onClose={() => closeWindow(w.id)}
              onMinimize={() => minimizeWindow(w.id)}
              onMaximizeToggle={() => toggleMaximize(w.id)}
              onOpenStep={openTerminal}
              onMove={next => moveWindow(w.id, next)}
              onResize={next => sizeWindow(w.id, next)}
              onNewChat={() => void handleNewChat()}
            />
          )
        })}

        {!wizard && terminals.map(t => {
          const z = zStack.indexOf(t.id)
          return (
            <WinXpCmdTerminal
              key={t.id}
              step={t.step}
              position={t.position}
              size={t.size}
              zIndex={10 + (z >= 0 ? z : 0)}
              active={focused === t.id}
              maximized={t.maximized}
              onActivate={() => bringToFront(t.id)}
              onMove={next => moveTerminal(t.id, next)}
              onResize={next => sizeTerminal(t.id, next)}
              onMaximizeToggle={() => toggleMaximizeTerminal(t.id)}
              onClose={() => closeTerminal(t.id)}
            />
          )
        })}

        {!wizard && notepad && !notepad.minimized && (() => {
          const z = zStack.indexOf(notepad.id)
          return (
            <WinXpNotepad
              position={notepad.position}
              size={notepad.size}
              zIndex={10 + (z >= 0 ? z : 0)}
              active={focused === notepad.id}
              maximized={notepad.maximized}
              title={notepad.title}
              initialContent={notepad.content}
              onActivate={() => bringToFront(notepad.id)}
              onClose={closeNotepad}
              onMaximizeToggle={toggleMaximizeNotepad}
              onMove={moveNotepad}
              onResize={sizeNotepad}
            />
          )
        })()}

        {wizard && (() => {
          const z = zStack.indexOf(wizard.id)
          return (
            <WinXpWizard
              position={wizard.position}
              size={wizard.size}
              zIndex={10 + (z >= 0 ? z : 0)}
              active={focused === wizard.id}
              onActivate={() => bringToFront(wizard.id)}
              onMove={moveWizard}
              onClose={inSetupMode ? onExit : closeWizard}
              onDone={() => {
                closeWizard()
                onSetupDone?.()
              }}
            />
          )
        })()}
      </div>

      {!wizard && <div className="xp-taskbar">
        <button
          className="xp-start"
          onClick={onExit}
          onContextMenu={(e) => {
            e.preventDefault()
            setIsFlenovMode(true)
          }}
          title={isFlenovMode ? "HWND_DESKTOP // Flenov's Hacker Eyes" : "Switch to Vibe Coding (2026)"}
          aria-label="Switch to Vibe Coding"
          style={isFlenovMode && flenovPos ? {
            position: 'fixed',
            left: flenovPos.x,
            top: flenovPos.y,
            zIndex: 99999,
          } : undefined}
        >
          {/* Single click on Start exits the XP experiment back to the
              regular UI — there's no Start menu in this build. We keep
              the original PNG (multicoloured logo + italic "start"
              wordmark) so the chrome looks pixel-perfect.

              4. ГЛАВНЫЙ ТРЮК: Делаем кнопку дочерним окном рабочего стола
              HWND_DESKTOP (или NULL) означает, что родитель теперь - весь экран
              (Привет книге М. Фленова "Программирование на C++ глазами хакера")

              `tabindex={-1}` keeps the button from grabbing focus on
              keyboard nav, otherwise the browser draws a black focus
              ring on the green pill and the user reads it as a
              "white-ish artifact" against the gradient. */}
          <img src="/winxp/start-button.png" alt="" draggable={false} />
        </button>

        {/* Quick Launch — XP shipped this strip immediately to the right
            of Start with one-click shortcuts (IE, Show Desktop, Outlook
            Express). We use it for the most-frequent action in this
            experiment: spawn a new chat. The tray-style sunken bevel
            visually separates it from the running-tasks list. */}
        <div className="xp-quicklaunch" role="toolbar" aria-label="Quick Launch">
          <button
            type="button"
            className="xp-quick-btn"
            onClick={handleNewChat}
            title="New chat"
            aria-label="New chat"
          >
            <img src="/winxp/new-chat.png" alt="" draggable={false} />
          </button>
        </div>

        <div className="xp-tasks">
          {windows.map(w => (
            <button
              key={w.id}
              className={`xp-task ${focused === w.id && !w.minimized ? 'active' : ''}`}
              onClick={() => {
                if (w.minimized) {
                  setWindows(prev =>
                    prev.map(x => (x.id === w.id ? { ...x, minimized: false } : x)),
                  )
                  bringToFront(w.id)
                } else if (focused === w.id) {
                  minimizeWindow(w.id)
                } else {
                  bringToFront(w.id)
                }
              }}
            >
              <img className="xp-task-icon" src="/winxp/outlook.png" alt="" draggable={false} />
              <span className="xp-task-label">
                {w.session.title || 'Untitled chat'}
              </span>
            </button>
          ))}
          {notepad && (
            <button
              className={`xp-task ${focused === notepad.id && !notepad.minimized ? 'active' : ''}`}
              onClick={() => {
                if (notepad.minimized) {
                  setNotepad(prev => (prev ? { ...prev, minimized: false } : prev))
                  bringToFront(notepad.id)
                } else if (focused === notepad.id) {
                  setNotepad(prev => (prev ? { ...prev, minimized: true } : prev))
                  setZStack(prev => prev.filter(x => x !== notepad.id))
                } else {
                  bringToFront(notepad.id)
                }
              }}
            >
              <img className="xp-task-icon" src="/winxp/notepad-app.png" alt="" draggable={false} />
              <span className="xp-task-label">{notepad.title} - Notepad</span>
            </button>
          )}
        </div>

        <div className="xp-tray">
          {/* The real XP system tray uses pixel-perfect 16×16 PNGs — using
              the actual icons (instead of inline SVG approximations) avoids
              the "Win98 vector" look the user pointed out in the
              screenshot. */}
          <img className="xp-tray-icon" src="/winxp/tray-network.png" alt="Network" title="Network — connected" />
          <img className="xp-tray-icon" src="/winxp/tray-volume.png" alt="Volume" title="Volume" />
          <span className="xp-tray-clock">
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>}

      {ctxMenu && (
        <WinXpContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {deleteTarget && (
        <WinXpConfirmDialog
          title="Confirm File Delete"
          confirmLabel="Yes"
          cancelLabel="No"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            const id = deleteTarget.id
            setDeleteTarget(null)
            // Close the chat window so it doesn't keep polling a deleted
            // session. Open cmd terminals reference individual log steps
            // (not the session), so we leave them as static transcripts.
            closeWindow(id)
            await deleteSession(id)
          }}
        >
          Are you sure you want to send <b>{deleteTarget.label || 'Untitled chat'}</b>{' '}
          to the Recycle Bin?
        </WinXpConfirmDialog>
      )}
    </div>
  )
}

function maxSize(): Size {
  return {
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: (typeof window !== 'undefined' ? window.innerHeight : 800) - TASKBAR_H,
  }
}

/**
 * Cap a default size to ~92% of the available desktop. Keeps initial
 * window sizes generous on big screens but stops them overflowing on
 * 1280×800 laptops where 860×640 + a 60px header offset would clip.
 */
function clampToViewport(size: Size): Size {
  if (typeof window === 'undefined') return size
  const maxW = Math.floor(window.innerWidth * 0.92)
  const maxH = Math.floor((window.innerHeight - TASKBAR_H) * 0.92)
  return {
    width: Math.min(size.width, maxW),
    height: Math.min(size.height, maxH),
  }
}

/**
 * Pick a wizard size that feels right for the current viewport. We use the
 * exact base size of the original XP wizard and do not scale it up, to 
 * preserve the retro feel. The result is always clamped to 92% of the viewport.
 */
function computeWizardSize(vw: number, vh: number): Size {
  const w = Math.min(WIZARD_BASE_SIZE.width, Math.floor(vw * 0.92))
  const h = Math.min(WIZARD_BASE_SIZE.height, Math.floor(vh * 0.92))
  return { width: w, height: h }
}

