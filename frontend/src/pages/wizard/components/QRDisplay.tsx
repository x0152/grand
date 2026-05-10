import { QRCodeSVG } from 'qrcode.react'

interface QRDisplayProps {
  value: string
  size?: number
  caption?: string
  tone?: 'neutral' | 'amber'
}

const toneStyles: Record<NonNullable<QRDisplayProps['tone']>, string> = {
  neutral: 'border-zinc-200/80 dark:border-zinc-800/70 bg-white',
  amber: 'border-amber-500/40 bg-amber-50',
}

export function QRDisplay({ value, size = 168, caption, tone = 'neutral' }: QRDisplayProps) {
  if (!value) return null
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`rounded-lg border p-3 ${toneStyles[tone]}`}>
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
        <p className="text-[11.5px] text-zinc-500 dark:text-zinc-500 text-center max-w-[260px] leading-snug">
          {caption}
        </p>
      )}
    </div>
  )
}
