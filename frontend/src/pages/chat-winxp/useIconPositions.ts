import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'mantis.winxp.iconPositions'

export interface IconPosition {
  left: number
  top: number
}

export type IconPositions = Record<string, IconPosition>

/**
 * Persists user-arranged desktop icon positions across reloads.
 *
 * After dragging, icons land on whatever pixel the user releases on —
 * the only invariant we enforce is that no two icons overlap. If the
 * drop point would intersect another icon's box we spiral outward
 * looking for the closest free pixel and place it there. This matches
 * Windows XP's "free placement" mode, where right-click → Arrange Icons
 * → "Auto Arrange" is *off* (the default the user asked for).
 *
 * The initial / auto-arrange grid is still 96 × 96 cells with a 16px
 * outer margin — same as the CSS — so freshly seeded icons line up
 * neatly until the user starts moving them around.
 */
const CELL_W = 96
const CELL_H = 96
// Free-placement margin: icons can sit almost flush against the
// viewport edges, matching real XP "Auto Arrange OFF" behaviour. Used
// only as a soft clamp so they don't fall completely off-screen.
const MARGIN = 2
// Auto-arrange margin: bigger so the seeded grid breathes from the
// edges. Only the *initial* layout uses this — once the user drags
// an icon manually, the soft MARGIN above takes over.
const GRID_MARGIN = 16
// Visible icon cell width/height — used for collision tests in the
// initial auto-arrange grid (not after a manual drag).
const ICON_BOX = 80
const TASKBAR_H = 30

export function useIconPositions(allIds: string[]): {
  positions: IconPositions
  setIconPosition: (id: string, pos: IconPosition) => void
  resetPositions: () => void
} {
  const [positions, setPositions] = useState<IconPositions>(() => loadFromStorage())

  // Whenever a brand-new id appears, lay it down on the first free slot
  // so the desktop never shows up empty when you connect new sessions.
  // Existing icons keep whatever (potentially non-grid) position they
  // already had — only the *new* ids snap to the grid.
  useEffect(() => {
    setPositions(prev => {
      const known = new Set(Object.keys(prev))
      const taken = Object.values(prev)
      let added = false
      const next = { ...prev }
      for (const id of allIds) {
        if (known.has(id)) continue
        const slot = nextFreeGridSlot(taken)
        next[id] = slot
        taken.push(slot)
        added = true
      }
      if (!added) return prev
      saveToStorage(next)
      return next
    })
  }, [allIds.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  const setIconPosition = useCallback((id: string, pos: IconPosition) => {
    setPositions(prev => {
      // Free-placement: drop the icon exactly where the user pointed,
      // only clamping to the viewport so it stays reachable. Real XP
      // with Auto-Arrange OFF lets icons overlap, sit edge-to-edge,
      // or hug the desktop borders — so we don't run any spiral
      // collision avoidance here. The earlier impl would teleport an
      // icon away from the cursor any time the drop overlapped the
      // 80-px bounding box of a neighbour, which the user perceived
      // as the desktop "catching" intersections too aggressively.
      const resolved = clampToViewport(pos)
      const cur = prev[id]
      if (cur && cur.left === resolved.left && cur.top === resolved.top) return prev
      const next = { ...prev, [id]: resolved }
      saveToStorage(next)
      return next
    })
  }, [])

  // Auto-arrange immediately re-flows every known id into a fresh column-
  // major grid, so the user gets the result they expect on click. The
  // earlier impl set state to {} and relied on the new-id effect, but the
  // effect's dep `allIds.join('|')` doesn't change after a reset, so the
  // re-layout never fired and icons stacked at (16,16).
  const resetPositions = useCallback(() => {
    const taken: IconPosition[] = []
    const next: IconPositions = {}
    for (const id of allIds) {
      const slot = nextFreeGridSlot(taken)
      next[id] = slot
      taken.push(slot)
    }
    setPositions(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }, [allIds.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  return { positions, setIconPosition, resetPositions }
}

function loadFromStorage(): IconPositions {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as IconPositions
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed
  } catch {
    return {}
  }
}

function saveToStorage(p: IconPositions): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {}
}

function clampToViewport(pos: IconPosition): IconPosition {
  if (typeof window === 'undefined') return pos
  const maxLeft = Math.max(MARGIN, window.innerWidth - ICON_BOX - MARGIN)
  const maxTop = Math.max(MARGIN, window.innerHeight - TASKBAR_H - ICON_BOX - MARGIN)
  return {
    left: Math.min(Math.max(MARGIN, Math.round(pos.left)), maxLeft),
    top: Math.min(Math.max(MARGIN, Math.round(pos.top)), maxTop),
  }
}

function rectsOverlap(a: IconPosition, b: IconPosition): boolean {
  return (
    a.left < b.left + ICON_BOX &&
    a.left + ICON_BOX > b.left &&
    a.top < b.top + ICON_BOX &&
    a.top + ICON_BOX > b.top
  )
}

function hasOverlap(pos: IconPosition, others: IconPosition[]): boolean {
  for (const o of others) {
    if (rectsOverlap(pos, o)) return true
  }
  return false
}

function nextFreeGridSlot(taken: IconPosition[]): IconPosition {
  // column-major sweep — start at top-left and walk down, then right
  if (typeof window === 'undefined') return { left: GRID_MARGIN, top: GRID_MARGIN }
  const maxRows = Math.max(2, Math.floor((window.innerHeight - TASKBAR_H - GRID_MARGIN) / CELL_H))
  for (let col = 0; col < 64; col++) {
    for (let row = 0; row < maxRows; row++) {
      const candidate = {
        left: GRID_MARGIN + col * CELL_W,
        top: GRID_MARGIN + row * CELL_H,
      }
      if (!hasOverlap(candidate, taken)) return candidate
    }
  }
  return { left: GRID_MARGIN, top: GRID_MARGIN }
}
