import { toast } from 'sonner'
import { Copy } from '@/lib/icons'

interface AddressDisplayProps {
  label: string
  address: string
  copyMessage?: string
}

export function AddressDisplay({ label, address, copyMessage }: AddressDisplayProps) {
  const copy = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      toast.success(copyMessage ?? `${label} copied`)
    } catch {
      toast.error('Copy failed')
    }
  }
  return (
    <div className="rounded-2xl bg-[var(--grand-surface)] ring-1 ring-[var(--grand-border-2)] px-5 py-4 space-y-2">
      <div className="text-[12px] font-mono uppercase tracking-[0.16em] text-[var(--grand-muted-2)]">
        {label}
      </div>
      <button
        type="button"
        onClick={copy}
        disabled={!address}
        className="group w-full flex items-center gap-3 text-left disabled:cursor-not-allowed"
      >
        <code className="flex-1 min-w-0 truncate font-mono text-[15px] text-[var(--grand-fg)] group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
          {address || '—'}
        </code>
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[var(--grand-surface-2)] text-[var(--grand-fg-2)] px-3 py-1.5 text-[12.5px] font-medium group-hover:bg-emerald-500/15 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
          <Copy size={13} weight="bold" /> Copy
        </span>
      </button>
    </div>
  )
}
