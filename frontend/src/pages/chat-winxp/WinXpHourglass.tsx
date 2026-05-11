interface Props {
  size?: number
  className?: string
  title?: string
}

const DOT_COUNT = 8

/**
 * Windows-XP-style "busy" indicator. The literal hourglass we shipped
 * first read like a clock face at small sizes, and the SVG version that
 * replaced it sometimes failed to animate inside flex parents. We're
 * now down to plain `<span>`s positioned around a circle with CSS only —
 * which means every dot reliably participates in the keyframe animation
 * regardless of the surrounding layout. Style lives in `winxp.css` under
 * the `.xp-spin` block.
 */
export function WinXpHourglass({ size = 16, className = '', title = 'Busy' }: Props) {
  const cls = `xp-spin ${className}`.trim()
  return (
    <span
      className={cls}
      style={{ width: size, height: size }}
      role="img"
      aria-label={title}
      title={title}
    >
      {Array.from({ length: DOT_COUNT }, (_, i) => (
        <span key={i} className={`xp-spin-dot xp-spin-dot-${i}`} />
      ))}
    </span>
  )
}
