import { FileText, Image as ImageIcon, X } from '@/lib/icons'
import type { PendingFile } from './types'

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} mb`
    : `${Math.max(1, Math.round(bytes / 1024))} kb`
}

export function FilePreview({ file, onRemove }: { file: PendingFile; onRemove: () => void }) {
  const f = file.file
  const sizeLabel = formatSize(f.size)
  const isImage = !!file.previewUrl

  return (
    <div className="group relative flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-md border border-[var(--grand-border)] bg-[var(--grand-surface)]">
      {isImage ? (
        <img src={file.previewUrl} alt={f.name} className="w-8 h-8 object-cover rounded" />
      ) : (
        <div className="w-8 h-8 rounded bg-[var(--grand-surface-2)] flex items-center justify-center text-[var(--grand-muted)]">
          {f.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
        </div>
      )}
      <div className="leading-tight max-w-[160px]">
        <div className="truncate text-[12.5px] text-[var(--grand-fg-2)]">{f.name}</div>
        <div className="font-mono text-[10.5px] tabular-nums text-[var(--grand-muted)]">{sizeLabel}</div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 p-1 rounded text-[var(--grand-muted)] hover:text-rose-500 hover:bg-rose-500/10"
        title="Remove"
      >
        <X size={12} />
      </button>
    </div>
  )
}
