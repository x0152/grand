import { useId } from 'react'

export const BRAND_NAME = 'GRAND'
export const BRAND_TAGLINE = 'v0 · runtime'

export type BrandLogoState = 'idle' | 'thinking' | 'typing' | 'working'

interface Props {
  size?: number
  className?: string
  title?: string
  state?: BrandLogoState
  animated?: boolean
}

/**
 * GRAND mark · connected paths.
 *
 * One source at the top routes data through one of three connected channels.
 * Reads as an inverted trident:
 *
 *      ●          orchestrator (origin of data flow)
 *      │          stem
 *   ┌──┴──┐
 *   │  │  │       three downstream channels (left / center / right)
 *   ▼  ▼  ▼       arrow tips at the bottom = where the data lands (agents)
 *
 * Whole figure renders in `var(--grand-accent)` so it reads as one live
 * circuit — not decoration. The two idle channels are dimmed; the active
 * one is lit. The "active" assignment cycles between the three channels
 * over time so the logo *visibly* routes data while the system runs.
 *
 * Stays legible at 16×16 because every mark is one thick stroke with
 * round caps and round joins — no thin lines or fine detail.
 */
export function BrandLogo({
  size = 24,
  className,
  title = BRAND_NAME,
  state = 'idle',
  animated = true,
}: Props) {
  const rawId = useId()
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '')
  const glowId = `brand-glow-${uid}`

  const rootClass = ['brand-logo', className].filter(Boolean).join(' ')

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={title}
      className={rootClass}
      data-state={animated ? state : undefined}
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      <title>{title}</title>

      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.45" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/*  ambient halo behind the orchestrator — barely visible, gives life  */}
      <circle cx="32" cy="8" r="14" fill={`url(#${glowId})`} className="brand-halo" />

      <g
        stroke="currentColor"
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/*  stem · the source descending from the orchestrator into the junction  */}
        <path className="brand-stem" d="M32 10 V26" />

        {/*  3 downstream channels, all sharing the same junction at (32, 26)  */}
        <path className="brand-channel brand-channel-left"   d="M32 26 H14 V54" />
        <path className="brand-channel brand-channel-center" d="M32 26 V54" />
        <path className="brand-channel brand-channel-right"  d="M32 26 H50 V54" />
      </g>

      {/*  arrow tips at the bottom — destinations of the routed data  */}
      <g fill="currentColor" className="brand-arrows">
        <path className="brand-arrow brand-arrow-left"   d="M14 60 L10 53 L18 53 Z" />
        <path className="brand-arrow brand-arrow-center" d="M32 60 L28 53 L36 53 Z" />
        <path className="brand-arrow brand-arrow-right"  d="M50 60 L46 53 L54 53 Z" />
      </g>

      {/*  junction node — small dot where the three paths meet  */}
      <circle cx="32" cy="26" r="2.4" fill="currentColor" className="brand-junction" />

      {/*  orchestrator dot — origin of the data flow  */}
      <circle cx="32" cy="8" r="3.8" fill="currentColor" className="brand-orchestrator" />
    </svg>
  )
}
