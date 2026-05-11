import { useCallback, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'

export interface Size {
  width: number
  height: number
}

interface ResizeHandleProps {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void
  style: CSSProperties
}

interface Options {
  edge: 'right' | 'bottom' | 'corner'
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
}

/**
 * Pointer-events resize helper. Symmetric to `useDraggable` — the host owns
 * size state, this just wires the handle. Three edges supported:
 *  - `right` resizes width only (cursor: ew-resize)
 *  - `bottom` resizes height only (cursor: ns-resize)
 *  - `corner` resizes both (cursor: nwse-resize)
 */
export function useResizable(
  size: Size,
  onChange: (next: Size) => void,
  opts: Options,
  onActivate?: () => void,
): ResizeHandleProps {
  const startRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return
      onActivate?.()
      e.preventDefault()
      e.stopPropagation()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {}
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height,
      }
    },
    [size.width, size.height, onActivate],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const start = startRef.current
      if (!start) return
      const minW = opts.minWidth ?? 320
      const minH = opts.minHeight ?? 200
      const maxW = opts.maxWidth ?? Infinity
      const maxH = opts.maxHeight ?? Infinity
      let w = start.width
      let h = start.height
      if (opts.edge === 'right' || opts.edge === 'corner') {
        w = clamp(start.width + (e.clientX - start.x), minW, maxW)
      }
      if (opts.edge === 'bottom' || opts.edge === 'corner') {
        h = clamp(start.height + (e.clientY - start.y), minH, maxH)
      }
      onChange({ width: w, height: h })
    },
    [onChange, opts.edge, opts.minWidth, opts.minHeight, opts.maxWidth, opts.maxHeight],
  )

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    startRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }, [])

  const cursor =
    opts.edge === 'right' ? 'ew-resize' : opts.edge === 'bottom' ? 'ns-resize' : 'nwse-resize'

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    style: { cursor, touchAction: 'none' },
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
