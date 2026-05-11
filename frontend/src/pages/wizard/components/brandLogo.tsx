import type { CSSProperties } from 'react'

export interface BrandLogoSpec {
  slug: string | null
  color: string
  monogram?: string
}

interface BrandLogoProps {
  spec: BrandLogoSpec
  size?: number
  rounded?: number
  style?: CSSProperties
}

export function BrandLogo({ spec, size = 40, rounded = 12, style }: BrandLogoProps) {
  const tile: CSSProperties = {
    width: size,
    height: size,
    borderRadius: rounded,
    backgroundColor: `#${spec.color}1A`,
    ...style,
  }
  return (
    <div
      className="flex items-center justify-center shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/10"
      style={tile}
    >
      {spec.slug ? (
        <img
          src={`https://cdn.simpleicons.org/${spec.slug}/${spec.color}`}
          alt=""
          style={{ width: size * 0.55, height: size * 0.55 }}
          onError={e => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : (
        <span
          style={{
            color: `#${spec.color}`,
            fontSize: size * 0.32,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          {spec.monogram ?? '·'}
        </span>
      )}
    </div>
  )
}
