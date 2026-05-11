import { QRCodeSVG } from 'qrcode.react'

interface QRDisplayProps {
  value: string
  size?: number
  caption?: string
  tone?: 'neutral' | 'amber'
}

const toneStyles: Record<NonNullable<QRDisplayProps['tone']>, string> = {
  neutral: 'ring-[var(--grand-border-2)] bg-white',
  amber: 'ring-amber-500/40 bg-amber-50',
}

export function QRDisplay({ value, size = 232, caption, tone = 'neutral' }: QRDisplayProps) {
  if (!value) return null
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`rounded-3xl ring-1 p-5 ${toneStyles[tone]}`}>
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          marginSize={0}
          bgColor="transparent"
          fgColor="#0f1115"
        />
      </div>
      {caption && (
        <p className="text-[13px] text-[var(--grand-muted)] text-center max-w-sm leading-relaxed">
          {caption}
        </p>
      )}
    </div>
  )
}
