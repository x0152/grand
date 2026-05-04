import { forwardRef, useCallback, useEffect, useRef } from 'react'
import { Mic, Paperclip, Send, Square } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { ContextMeter } from '../../components/ContextMeter'
import type { ChatMessage, ContextStatus } from '../../types'
import { FilePreview } from './FilePreview'
import { PresetBar } from './PresetBar'
import type { PendingFile } from './types'
import { useBrowserSpeechToText } from './useBrowserSpeechToText'

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
  const inputRef = useRef(input)
  inputRef.current = input

  const getInputSnapshot = useCallback(() => inputRef.current, [])

  const voice = useBrowserSpeechToText(getInputSnapshot, onChangeInput)

  const handleSend = useCallback(() => {
    if (voice.listening) voice.stop()
    onSend()
  }, [voice.listening, voice.stop, onSend])

  useEffect(() => {
    const el = (textareaRef as React.RefObject<HTMLTextAreaElement>).current
    if (!el) return
    el.style.height = 'auto'
    const max = 220
    el.style.height = `${Math.min(el.scrollHeight, max)}px`
  }, [input, textareaRef])

  return (
    <div className="shrink-0 space-y-3 border-t border-[var(--grand-line-2)] bg-transparent px-6 py-4">
      <PresetBar />
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
      {(attachError || voice.error) && (
        <div className="text-[12px] text-rose-500">
          {attachError}
          {attachError && voice.error ? ' · ' : null}
          {voice.error}
        </div>
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
        {voice.supported && (
          <VoiceDictationButton
            listening={voice.listening}
            onClick={() => voice.toggle()}
            disabled={sending || hasPending}
          />
        )}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={e => onChangeInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder={
            voice.listening
              ? 'Listening — text streams in as you speak; click mic to stop'
              : 'Type a message — Shift+Enter for newline'
          }
          rows={1}
          className="flex-1 min-h-[36px] max-h-[220px] py-2 px-2 text-[15px]
                     bg-transparent border-0 rounded-none
                     leading-relaxed overflow-y-auto placeholder:text-[var(--grand-muted-2)]
                     focus:bg-transparent focus:ring-0 focus:border-0"
          readOnly={voice.listening}
          disabled={sending || hasPending}
        />
        {hasPending ? (
          <StopButton onClick={onStop} disabled={stopping} />
        ) : (
          <SendButton
            onClick={handleSend}
            disabled={sending || (!input.trim() && files.length === 0)}
          />
        )}
      </div>
    </div>
  )
})

function VoiceDictationButton({
  listening,
  onClick,
  disabled,
}: {
  listening: boolean
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={
        listening
          ? 'Stop dictation'
          : 'Dictate live (speech streams into the box; language follows the browser / OS)'
      }
      className={cn(
        'shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-md transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        listening
          ? 'text-rose-500 bg-rose-500/12 ring-1 ring-rose-500/35'
          : 'text-[var(--grand-muted)] hover:text-[var(--grand-fg)] hover:bg-[var(--grand-surface-2)]',
      )}
    >
      <Mic size={18} weight={listening ? 'fill' : 'regular'} />
    </button>
  )
}

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
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Stop generation"
      className="shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-md border border-rose-500/45
                 bg-rose-500/8 text-rose-500 shadow-sm
                 hover:border-rose-500/70 hover:bg-rose-500/15
                 transition-[background-color,border-color,box-shadow] duration-100
                 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Square size={13} className="fill-current" />
    </button>
  )
}

function SendButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Send message"
      className={cn(
        'shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-md transition-[background-color,border-color,box-shadow,color] duration-100',
        'border shadow-sm',
        'border-emerald-500/45 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        'hover:border-emerald-500/70 hover:bg-emerald-500/18',
        'disabled:cursor-not-allowed disabled:border-[var(--grand-border)] disabled:bg-transparent disabled:text-[var(--grand-muted-2)] disabled:shadow-none disabled:opacity-55',
      )}
    >
      <Send size={17} strokeWidth={1.75} />
    </button>
  )
}
