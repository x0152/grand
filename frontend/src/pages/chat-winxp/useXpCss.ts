import { useEffect } from 'react'

const CDN = 'https://unpkg.com/xp.css@0.2.6/dist/XP.css'
const ATTR = 'data-mantis-xp-css'

/**
 * Injects the official XP.css stylesheet (botoxparty/XP.css v0.2.6) into the
 * document head while the experiment is mounted, and yanks it back out on
 * unmount. The link uses a marker attribute so React Strict Mode double mounts
 * don't end up loading it twice.
 *
 * The whole experimental UI lives behind a toggle, so leaking XP.css into the
 * regular interface is a real concern — a stray `button {…}` rule from the
 * stylesheet would repaint half the app. Scoping by lifecycle is the simplest
 * way to keep the blast radius contained.
 */
export function useXpCss(active: boolean) {
  useEffect(() => {
    if (!active) return
    let link = document.querySelector<HTMLLinkElement>(`link[${ATTR}]`)
    if (!link) {
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = CDN
      link.setAttribute(ATTR, '1')
      document.head.appendChild(link)
    }
    return () => {
      const el = document.querySelector(`link[${ATTR}]`)
      if (el) el.remove()
    }
  }, [active])
}
