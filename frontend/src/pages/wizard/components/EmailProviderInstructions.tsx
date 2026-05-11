import { ExternalLink } from '@/lib/icons'
import { BrandLogo } from './brandLogo'
import type { EmailProviderPreset } from '../data/emailPresets'

interface EmailProviderInstructionsProps {
  preset: EmailProviderPreset
}

export function EmailProviderInstructions({ preset }: EmailProviderInstructionsProps) {
  return (
    <div className="rounded-3xl bg-[var(--grand-surface)] ring-1 ring-[var(--grand-border-2)] p-6 space-y-5">
      <div className="flex items-center gap-3.5">
        <BrandLogo spec={preset.brand} size={48} rounded={16} />
        <div>
          <div className="text-[16px] font-semibold tracking-tight text-[var(--grand-fg)]">
            Set up {preset.label}
          </div>
          <div className="text-[12.5px] font-mono text-[var(--grand-muted-2)] mt-0.5">
            {preset.hostsLabel}
          </div>
        </div>
      </div>

      <ol className="space-y-3">
        {preset.steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="size-7 shrink-0 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-mono text-[12px] font-semibold mt-0.5">
              {i + 1}
            </span>
            <p className="text-[13.5px] leading-relaxed text-[var(--grand-fg-2)]">
              {s.text}
              {s.href && (
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                >
                  {s.linkLabel} <ExternalLink size={12} />
                </a>
              )}
              {s.tail}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}
