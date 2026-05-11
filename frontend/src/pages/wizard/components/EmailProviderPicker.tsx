import { Mail } from '@/lib/icons'
import { BrandLogo } from './brandLogo'
import { EMAIL_PRESETS, type EmailProviderId } from '../data/emailPresets'

interface EmailProviderPickerProps {
  selected: EmailProviderId | null
  onSelect: (id: EmailProviderId | null) => void
  disabled?: boolean
}

export function EmailProviderPicker({ selected, onSelect, disabled }: EmailProviderPickerProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {EMAIL_PRESETS.map(p => {
        const active = selected === p.id
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(p.id)}
            className={`flex flex-col items-center gap-2 rounded-2xl ring-1 px-3 py-4 transition-all ${
              active
                ? 'ring-2 ring-emerald-500 bg-emerald-500/[0.05]'
                : 'ring-[var(--grand-border-2)] bg-[var(--grand-surface)] hover:ring-[var(--grand-border)]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <BrandLogo spec={p.brand} size={42} rounded={14} />
            <span className="text-[13px] font-medium tracking-tight text-[var(--grand-fg)]">
              {p.label}
            </span>
          </button>
        )
      })}

      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(null)}
        className={`flex flex-col items-center gap-2 rounded-2xl ring-1 ring-dashed px-3 py-4 transition-all ${
          selected === null
            ? 'ring-[var(--grand-border)] bg-[var(--grand-surface-2)]'
            : 'ring-[var(--grand-border-2)] bg-transparent hover:ring-[var(--grand-border)] hover:bg-[var(--grand-surface)]'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="size-[42px] rounded-[14px] bg-[var(--grand-surface-2)] text-[var(--grand-muted)] flex items-center justify-center ring-1 ring-inset ring-black/5 dark:ring-white/10">
          <Mail size={20} />
        </span>
        <span className="text-[13px] font-medium tracking-tight text-[var(--grand-fg-2)]">
          Custom
        </span>
      </button>
    </div>
  )
}
