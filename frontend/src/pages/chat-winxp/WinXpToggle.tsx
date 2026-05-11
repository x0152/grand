import { useEffect, useState } from 'react'
import './winxp.css'

const STORAGE_KEY = 'mantis.winxp.enabled'

/**
 * Persistent boolean stored in localStorage so refreshes don't kick the user
 * back out of the experimental UI. The empty-string check is for SSR/Node
 * dev environments where `localStorage` isn't available.
 */
export function useWinXpEnabled(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
    } catch {}
  }, [enabled])

  return [enabled, setEnabled]
}

interface Props {
  enabled: boolean
  onToggle: (next: boolean) => void
}

export function WinXpToggle({ enabled, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      title={enabled ? 'Exit experimental Windows XP theme' : 'Try the experimental Windows XP theme'}
      className={`group w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-[var(--grand-border)] bg-[var(--grand-surface)] text-[12px] transition-colors ${
        enabled
          ? 'border-emerald-400/60 bg-emerald-500/5 text-[var(--grand-fg)]'
          : 'text-[var(--grand-muted)] hover:border-emerald-400/60 hover:bg-emerald-500/5 hover:text-[var(--grand-fg)]'
      }`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <div
          className={`shrink-0 w-[14px] h-[14px] bg-[url('/winxp/winflag.png')] bg-center bg-contain bg-no-repeat transition-opacity ${
            enabled ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
          }`}
          style={{ imageRendering: '-webkit-optimize-contrast' }}
        />
        <span className="font-mono uppercase tracking-[0.14em] text-[10.5px] truncate text-left">
          Windows XP
        </span>
      </span>
      <div className={`w-2 h-2 shrink-0 rounded-full transition-colors ${enabled ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'border border-[var(--grand-border)] bg-transparent'}`} />
    </button>
  )
}
