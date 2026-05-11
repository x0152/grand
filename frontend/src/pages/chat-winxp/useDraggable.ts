import { useCallback, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'

export interface Position {
  left: number
  top: number
}

interface DragHandleProps {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void
  style: CSSProperties
}

/**
 * Tiny pointer-events drag helper for the XP windows. Spread the returned
 * props onto whichever element is the drag handle (typically the
 * `.title-bar`). Position state lives outside the hook so multiple windows
 * can be reordered/restored without local component state going stale.
 *
 * Skips drags that start inside `.title-bar-controls` (the minimize / close
 * buttons) so clicking those still registers as a regular click instead of
 * a 0-pixel drag.
 */
export function useDraggable(
  position: Position,
  onChange: (next: Position) => void,
  onActivate?: () => void,
) {
  const startRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      onActivate?.()
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest('.title-bar-controls')) return
      if (target.closest('button')) return
      e.preventDefault()
      const handle = e.currentTarget
      try {
        handle.setPointerCapture(e.pointerId)
      } catch {}
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        left: position.left,
        top: position.top,
      }
    },
    [position.left, position.top, onActivate],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const start = startRef.current
      if (!start) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      // Clamp so the title bar stays at least mostly on screen — XP itself
      // lets you drag a window mostly off-screen, but a tiny strip is enough
      // to keep things recoverable. Bottom margin leaves room for taskbar.
      const minLeft = -200
      const maxLeft = (typeof window !== 'undefined' ? window.innerWidth : 1200) - 80
      const minTop = 0
      const maxTop = (typeof window !== 'undefined' ? window.innerHeight : 800) - 60
      const next: Position = {
        left: clamp(start.left + dx, minLeft, maxLeft),
        top: clamp(start.top + dy, minTop, maxTop),
      }
      onChange(next)
    },
    [onChange],
  )

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    startRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }, [])

  const handleProps: DragHandleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    style: { cursor: 'move', touchAction: 'none' },
  }

  return handleProps
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
