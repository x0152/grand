interface Props {
  state?: 'idle' | 'thinking'
  size?: number
  className?: string
  title?: string
}

/**
 * Real Clippy assets ripped from the clippyjs sprite map at
 * https://github.com/clippyjs/clippy.js/tree/master/agents/Clippy and stored
 * locally in `public/winxp/`. We render either:
 *  - the static "RestPose" frame (top-left of the sprite map), or
 *  - an animated GIF stitched from the 8 frames of the original "Thinking"
 *    animation (frame coordinates straight out of `agent.js`).
 */
export function WinXpClippy({ state = 'idle', size = 56, className = '', title = 'Clippy' }: Props) {
  const src = state === 'thinking' ? '/winxp/clippy-thinking.gif' : '/winxp/clippy-idle.png'
  const cls = `xp-clippy ${state === 'thinking' ? 'thinking' : ''} ${className}`.trim()
  // Original frame size is 124×93 — we keep aspect via `height: auto` so
  // callers only have to pick a width.
  return (
    <img
      className={cls}
      src={src}
      alt={title}
      title={title}
      width={size}
      style={{ height: 'auto', imageRendering: 'pixelated' }}
      draggable={false}
    />
  )
}
