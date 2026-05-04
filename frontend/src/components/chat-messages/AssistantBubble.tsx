import { useEffect, useRef } from 'react'
import { Download, Loader2, RotateCcw, Square } from '@/lib/icons'
import { Markdown } from '../Markdown'
import type { Attachment, ChatMessage, Step } from '../../types'
import { AttachmentImage } from './AttachmentImage'
import { CopyMessageButton } from './CopyMessageButton'
import { PendingIndicator } from './PendingIndicator'
import { StepBadge } from './StepBadge'
import { useTicker } from './useTicker'
import { buildInterleavedParts } from './parts'
import { estimateTokens, fmtElapsed, fmtTokens, formatBytes, stripThinking } from './utils'

interface AssistantBubbleProps {
  msg: ChatMessage
  onStepClick: (s: Step) => void
  canRegenerate?: boolean
  onRegenerate?: () => void
  regenerating?: boolean
}

export function AssistantBubble({ msg, onStepClick, canRegenerate, onRegenerate, regenerating }: AssistantBubbleProps) {
  const steps = msg.steps ?? []
  const isPending = msg.status === 'pending'
  const isCancelled = msg.status === 'cancelled'
  const hasRunningStep = steps.some(s => s.status === 'running')
  const parts = buildInterleavedParts(msg.content, steps)
  useTicker(isPending)

  const contentLen = msg.content?.length ?? 0
  const lastContentChangeRef = useRef<number>(Date.now())
  const prevContentLenRef = useRef<number>(contentLen)
  useEffect(() => {
    if (contentLen !== prevContentLenRef.current) {
      prevContentLenRef.current = contentLen
      lastContentChangeRef.current = Date.now()
    }
  }, [contentLen])

  const sinceContentChange = Date.now() - lastContentChangeRef.current
  const lastOpen = msg.content ? msg.content.lastIndexOf('<think>') : -1
  const lastClose = msg.content ? msg.content.lastIndexOf('</think>') : -1
  const inThinkTag = isPending && lastOpen >= 0 && lastOpen > lastClose
  const isTyping = isPending && contentLen > 0 && sinceContentChange < 900 && !inThinkTag
  const showThinking = isPending && !hasRunningStep && !isTyping && !inThinkTag
  const showTyping = isTyping && !hasRunningStep

  const msgStart = new Date(msg.createdAt).getTime()
  const msgEnd = msg.finishedAt ? new Date(msg.finishedAt).getTime() : Date.now()
  const msgElapsed = msgEnd - msgStart
  const showMsgDuration = msgElapsed >= 300 && (isPending || !!msg.finishedAt)

  const isImage = (a: Attachment) =>
    a.mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(a.fileName)
  const images = (msg.attachments ?? []).filter(isImage)
  const otherFiles = (msg.attachments ?? []).filter(a => !isImage(a))

  const hasMeasuredTokens = typeof msg.tokens === 'number' && msg.tokens > 0
  const showMeasuredTokens = hasMeasuredTokens && !isPending
  const visibleContent = stripThinking(msg.content)
  const estimatedTokens = showMeasuredTokens ? msg.tokens! : estimateTokens(visibleContent)
  const showTokens = estimatedTokens > 0
  const showHeader = !!(msg.modelName || msg.presetName || msg.modelRole === 'fallback' || showMsgDuration || showTokens)
  const hasText = parts.some(p => p.type === 'text')
  const hasAnyContent =
    parts.length > 0 ||
    images.length > 0 ||
    otherFiles.length > 0 ||
    showThinking ||
    showTyping ||
    isCancelled
  const showEmpty = !hasAnyContent && !isPending

  return (
    <div className="flex justify-start">
      <div className="bubble bubble-assistant max-w-[80%] text-[15px] overflow-hidden px-5 py-3 space-y-2.5 leading-relaxed">
        {showHeader && (
          <Header
            presetName={msg.presetName}
            modelName={msg.modelName}
            modelRole={msg.modelRole}
            showMsgDuration={showMsgDuration}
            msgElapsed={msgElapsed}
            showTokens={showTokens}
            estimatedTokens={estimatedTokens}
            hasMeasuredTokens={showMeasuredTokens}
          />
        )}
        {parts.map((part, i) => {
          if (part.type === 'step') {
            return (
              <div key={part.step!.id}>
                <StepBadge step={part.step!} onClick={() => onStepClick(part.step!)} />
              </div>
            )
          }
          return (
            <div key={`text-${i}`} className={hasText ? 'py-0.5' : ''}>
              <Markdown content={part.text!} sessionId={msg.sessionId} />
            </div>
          )
        })}
        {images.length > 0 && (
          <div className={`grid gap-1.5 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} -mx-2`}>
            {images.map(a => (
              <AttachmentImage key={a.id} attachment={a} sessionId={msg.sessionId} />
            ))}
          </div>
        )}
        {otherFiles.length > 0 && (
          <div className="space-y-1.5">
            {otherFiles.map(a => (
              <a
                key={a.id}
                href={`/api/artifacts/${msg.sessionId}/${a.id}`}
                download={a.fileName}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--grand-border)] text-[13px] bg-[var(--grand-bg)] text-[var(--grand-fg-2)] hover:border-emerald-400/60 hover:text-emerald-400 transition-colors"
              >
                <Download size={13} />
                <span className="truncate">{a.fileName}</span>
                <span className="text-[11px] text-[var(--grand-muted)] shrink-0">{formatBytes(a.size)}</span>
              </a>
            ))}
          </div>
        )}
        {showThinking && <PendingIndicator mode="thinking" />}
        {showTyping && <PendingIndicator mode="typing" />}
        {isCancelled && (
          <div>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.10em] rounded bg-[var(--grand-surface-2)] text-[var(--grand-muted)]">
              <Square size={9} className="fill-current" />
              stopped
            </span>
          </div>
        )}
        {showEmpty && (
          <div className="text-[13px] text-[var(--grand-muted)]">
            No response
          </div>
        )}
        {!isPending && (
          <Footer
            content={msg.content}
            canRegenerate={canRegenerate}
            onRegenerate={onRegenerate}
            regenerating={regenerating}
          />
        )}
      </div>
    </div>
  )
}

interface HeaderProps {
  presetName?: string
  modelName?: string
  modelRole?: string
  showMsgDuration: boolean
  msgElapsed: number
  showTokens: boolean
  estimatedTokens: number
  hasMeasuredTokens: boolean
}

function Header({
  presetName,
  modelName,
  modelRole,
  showMsgDuration,
  msgElapsed,
  showTokens,
  estimatedTokens,
  hasMeasuredTokens,
}: HeaderProps) {
  return (
    <div className="flex items-center gap-x-2 gap-y-1 flex-wrap font-mono text-[11px] tabular-nums text-[var(--grand-muted-2)]">
      {presetName && <span className="text-[var(--grand-muted)]">{presetName}</span>}
      {modelName && (
        <>
          {presetName && <span className="opacity-50">·</span>}
          <span className="text-[var(--grand-muted)]">{modelName}</span>
        </>
      )}
      {modelRole === 'fallback' && (
        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">fallback</span>
      )}
      {showMsgDuration && (
        <>
          <span className="opacity-50">·</span>
          <span>{fmtElapsed(msgElapsed)}</span>
        </>
      )}
      {showTokens && (
        <>
          <span className="opacity-50">·</span>
          <span
            title={hasMeasuredTokens ? 'Model-reported tokens in this message' : 'Estimated tokens in visible response text'}
          >
            {hasMeasuredTokens ? fmtTokens(estimatedTokens) : `~${fmtTokens(estimatedTokens)}`} tok
          </span>
        </>
      )}
    </div>
  )
}

interface FooterProps {
  content: string
  canRegenerate?: boolean
  onRegenerate?: () => void
  regenerating?: boolean
}

function Footer({ content, canRegenerate, onRegenerate, regenerating }: FooterProps) {
  const copyText = stripThinking(content)
  const canShowCopy = copyText.length > 0
  const canShowRegenerate = !!canRegenerate && !!onRegenerate
  if (!canShowCopy && !canShowRegenerate) return null
  return (
    <div className="flex items-center gap-1">
      {canShowCopy && <CopyMessageButton text={copyText} />}
      {canShowRegenerate && (
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium rounded-md text-[var(--grand-muted)] hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
          title="Regenerate response"
        >
          {regenerating ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
          Regenerate
        </button>
      )}
    </div>
  )
}
