import { useEffect, useRef } from 'react'

export interface MenuItem {
  label?: string
  onClick?: () => void
  disabled?: boolean
  divider?: boolean
  shortcut?: string
}

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

/**
 * Tiny XP-style popup menu used both for the desktop right-click menu and
 * (with different items) for the Start menu submenus. Closes on:
 *   - any click outside
 *   - any click that fires onClick
 *   - Escape
 *   - a window scroll/resize
 *
 * Position is anchored at the cursor with a tiny clamp so it doesn't run
 * past the screen edge.
 */
export function WinXpContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onClose)
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('mousedown', onDoc, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  // Keep the menu inside the viewport.
  const left = clamp(x, 0, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 220)
  const top = clamp(y, 0, (typeof window !== 'undefined' ? window.innerHeight : 800) - items.length * 22 - 8)

  return (
    <ul
      ref={ref}
      className="xp-ctx-menu"
      role="menu"
      style={{ left, top }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* The XP gutter rail — a vertical inset stripe on the left where
          icons would sit. We render it with an absolutely-positioned
          element so menu items can extend a hover bar across the full
          width including the gutter, just like real XP. */}
      <li className="xp-ctx-gutter" aria-hidden />
      {items.map((item, i) =>
        item.divider ? (
          <li key={`d${i}`} className="xp-ctx-divider" role="separator" />
        ) : (
          <li
            key={item.label || i}
            role="menuitem"
            aria-disabled={item.disabled || undefined}
            className={`xp-ctx-item ${item.disabled ? 'disabled' : ''}`}
            onClick={() => {
              if (item.disabled) return
              item.onClick?.()
              onClose()
            }}
          >
            <span className="xp-ctx-label">{item.label}</span>
            {item.shortcut && <span className="xp-ctx-shortcut">{item.shortcut}</span>}
          </li>
        ),
      )}
    </ul>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
