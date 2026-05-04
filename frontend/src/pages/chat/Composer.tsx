import { forwardRef, useEffect, useRef } from 'react'
import { Paperclip, Send, Square } from '@/lib/icons'
import { Textarea } from '@/components/ui/textarea'
import { ContextMeter } from '../../components/ContextMeter'
import type { ChatMessage, ContextStatus } from '../../types'
import { FilePreview } from './FilePreview'
import type { PendingFile } from './types'

interface ComposerProps {
  input: string
  onChangeInput: (v: string) => void
  onSend: () => void
  onStop: () => void
  sending: boolean
  hasPending: boolean
  stopping: boolean
  files: PendingFile[]
  onAddFiles: (files: FileList | File[]) => void
  onRemoveFile: (id: string) => void
  attachError: string | null
  messages: ChatMessage[]
  partial: boolean
  contextStatus: ContextStatus | null
}

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  {
    input,
    onChangeInput,
    onSend,
    onStop,
    sending,
    hasPending,
    stopping,
    files,
    onAddFiles,
    onRemoveFile,
    attachError,
    messages,
    partial,
    contextStatus,
  },
  textareaRef,
) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = (textareaRef as React.RefObject<HTMLTextAreaElement>).current
    if (!el) return
    el.style.height = 'auto'
    const max = 220
    el.style.height = `${Math.min(el.scrollHeight, max)}px`
  }, [input, textareaRef])

  return (
    <div className="px-6 py-4 bg-[var(--grand-bg)] shrink-0 space-y-3">
      {messages.length > 0 && (
        <ContextMeter
          messages={messages}
          partial={partial}
          threshold={contextStatus?.compactThreshold}
          serverTokens={contextStatus?.lastContextTokens}
          compactionCount={contextStatus?.summaryVersion ?? 0}
        />
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map(pf => (
            <FilePreview key={pf.id} file={pf} onRemove={() => onRemoveFile(pf.id)} />
          ))}
        </div>
      )}
      {attachError && (
        <div className="text-[12px] text-rose-500">{attachError}</div>
      )}
      <div className="flex gap-2 items-end bg-[var(--grand-surface)] border border-[var(--grand-border)] rounded-xl p-2.5 focus-within:border-emerald-400/60 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files) onAddFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <AttachButton
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || hasPending}
        />
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={e => onChangeInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder="Type a message — Shift+Enter for newline"
          rows={1}
          className="flex-1 min-h-[36px] max-h-[220px] py-2 px-2 text-[15px]
                     bg-transparent border-0 rounded-none
                     leading-relaxed overflow-y-auto placeholder:text-[var(--grand-muted-2)]
                     focus:bg-transparent focus:ring-0 focus:border-0"
          disabled={sending || hasPending}
        />
        {hasPending ? (
          <StopButton onClick={onStop} disabled={stopping} />
        ) : (
          <SendButton onClick={onSend} disabled={sending || (!input.trim() && files.length === 0)} />
        )}
      </div>
    </div>
  )
})

function AttachButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Attach files"
      className="shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-md
                 text-[var(--grand-muted)] hover:text-[var(--grand-fg)]
                 hover:bg-[var(--grand-surface-2)]
                 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Paperclip size={16} strokeWidth={1.5} />
    </button>
  )
}

function StopButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title="Stop generation"
      className="shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-md
                 text-rose-500 hover:bg-rose-500/10
                 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Square size={14} className="fill-current" />
    </button>
  )
}

function SendButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title="Send"
      className="shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-md
                 bg-emerald-400 text-zinc-950 hover:bg-emerald-300
                 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Send size={16} strokeWidth={2} />
    </button>
  )
}
