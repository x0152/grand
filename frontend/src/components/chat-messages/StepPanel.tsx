import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, ScrollText, X } from '@/lib/icons'
import { api } from '../../api'
import type { SessionLog, Step } from '../../types'
import { SessionView } from '../LogEntries'
import { extractStepPrompt, stepToEntries } from './stepHelpers'
import { fmtDuration, formatArgs } from './utils'

export function StepPanel({ step, onClose }: { step: Step; onClose: () => void }) {
  const [log, setLog] = useState<SessionLog | null>(null)
  const logPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logScrollRef = useRef<HTMLDivElement>(null)
  const prevLogId = useRef(step.logId)
  const stickToBottomRef = useRef(true)
  const autoScrollingRef = useRef(false)

  const isRunning = step.status === 'running'
  const isError = step.status === 'error'
  const prompt = extractStepPrompt(step)
  const stepEntries = stepToEntries(step)
  const hasLog = !!step.logId
  const logPrompt = log?.prompt || prompt

  const fetchLog = useCallback(async () => {
    if (!step.logId) return
    try {
      const data = await api.sessionLogs.get(step.logId)
      setLog(data)
    } catch {}
  }, [step.logId])

  useEffect(() => {
    if (step.logId !== prevLogId.current) {
      prevLogId.current = step.logId
      setLog(null)
      stickToBottomRef.current = true
    }
  }, [step.logId])

  useEffect(() => {
    if (!step.logId) return
    fetchLog()
  }, [step.logId, fetchLog])

  useEffect(() => {
    if (!step.logId) return
    const shouldPoll = isRunning || log?.status === 'running' || !log
    if (shouldPoll) logPollRef.current = setInterval(fetchLog, 500)
    return () => {
      if (logPollRef.current) {
        clearInterval(logPollRef.current)
        logPollRef.current = null
      }
    }
  }, [step.logId, isRunning, log?.status, log, fetchLog])

  const handleScroll = useCallback(() => {
    if (autoScrollingRef.current) return
    const el = logScrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = distance < 40
  }, [])

  useEffect(() => {
    if (!stickToBottomRef.current) return
    const el = logScrollRef.current
    if (!el) return
    autoScrollingRef.current = true
    el.scrollTop = el.scrollHeight
    requestAnimationFrame(() => {
      autoScrollingRef.current = false
    })
  }, [log?.entries.length, stepEntries.length])

  return (
    <div className="w-[560px] max-w-[60vw] min-w-[400px] h-full bg-[var(--grand-surface)] border-l border-[var(--grand-border)] flex flex-col shadow-2xl">
      <PanelHeader step={step} isRunning={isRunning} isError={isError} onClose={onClose} />
      <PanelMeta step={step} log={log} hasLog={hasLog} />
      <div ref={logScrollRef} onScroll={handleScroll} className="flex-1 overflow-auto min-h-0">
        <div className="bg-[var(--grand-bg)] px-4 py-4 space-y-3 min-h-[120px]">
          <PanelBody
            log={log}
            hasLog={hasLog}
            isRunning={isRunning}
            stepEntries={stepEntries}
            stepResultPresent={!!step.result}
            prompt={logPrompt}
          />
        </div>
      </div>
    </div>
  )
}

function PanelHeader({
  step,
  isRunning,
  isError,
  onClose,
}: {
  step: Step
  isRunning: boolean
  isError: boolean
  onClose: () => void
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {isRunning ? (
          <Loader2 size={16} className="text-emerald-400 animate-spin shrink-0" />
        ) : isError ? (
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
        ) : (
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
        )}
        <span className="font-medium text-[15px] text-[var(--grand-fg)] whitespace-normal break-words leading-snug">
          {step.label}
        </span>
      </div>
      <button
        onClick={onClose}
        className="p-1.5 rounded-md text-[var(--grand-muted)] hover:text-[var(--grand-fg)] hover:bg-[var(--grand-surface-2)] shrink-0 ml-2"
      >
        <X size={18} />
      </button>
    </div>
  )
}

function PanelMeta({ step, log, hasLog }: { step: Step; log: SessionLog | null; hasLog: boolean }) {
  return (
    <div className="px-5 py-3 space-y-2 shrink-0 bg-[var(--grand-surface-2)]">
      <div className="flex items-center gap-x-2 gap-y-1 flex-wrap font-mono text-[11.5px] tracking-tight text-[var(--grand-muted)]">
        <span>{step.tool}</span>
        {hasLog && (log?.agentName || log?.status) && (
          <>
            <span className="text-[var(--grand-muted-2)]">/</span>
            <span className="flex items-center gap-1">
              <ScrollText size={12} className="text-emerald-400" />
              {log?.agentName ?? 'agent'}
              {log?.status === 'running' && (
                <span className="px-1.5 py-px rounded-sm bg-amber-500/15 text-amber-400">running</span>
              )}
            </span>
          </>
        )}
        {(step.presetName || log?.presetName) && (
          <>
            <span className="text-[var(--grand-muted-2)]">·</span>
            <span>{step.presetName || log?.presetName}</span>
          </>
        )}
        {(step.modelName || log?.modelName) && (
          <>
            <span className="text-[var(--grand-muted-2)]">/</span>
            <span>{step.modelName || log?.modelName}</span>
          </>
        )}
        {(step.modelRole === 'fallback' || log?.modelRole === 'fallback') && (
          <span className="px-1.5 py-px rounded-sm bg-amber-500/15 text-amber-400">fallback</span>
        )}
        {step.finishedAt && step.startedAt && (
          <>
            <span className="text-[var(--grand-muted-2)]">·</span>
            <span className="tabular-nums">{fmtDuration(step.startedAt, step.finishedAt)}</span>
          </>
        )}
      </div>
      {step.args && step.args !== '{}' && (
        <pre className="text-[11.5px] font-mono text-[var(--grand-muted)] bg-[var(--grand-bg)] rounded-md px-3 py-2 overflow-x-auto max-h-28 whitespace-pre-wrap break-all">
          {formatArgs(step.args)}
        </pre>
      )}
    </div>
  )
}

interface PanelBodyProps {
  log: SessionLog | null
  hasLog: boolean
  isRunning: boolean
  stepEntries: ReturnType<typeof stepToEntries>
  stepResultPresent: boolean
  prompt?: string
}

function PanelBody({ log, hasLog, isRunning, stepEntries, stepResultPresent, prompt }: PanelBodyProps) {
  if (hasLog) {
    if (!log) {
      return (
        <SessionView entries={[]} prompt={prompt} isRunning={true} />
      )
    }
    const sessionRunning = log.status === 'running' || isRunning
    return (
      <>
        <SessionView
          entries={log.entries}
          host={log.host}
          agentName={log.agentName}
          isRunning={sessionRunning}
          prompt={prompt}
        />
        {log.entries.length === 0 && !sessionRunning && !prompt && (
          <p className="text-[var(--grand-muted)] text-[12.5px] font-mono mt-2">No entries</p>
        )}
      </>
    )
  }
  const stepRunning = isRunning && !stepResultPresent
  return (
    <SessionView entries={stepEntries} isRunning={stepRunning} prompt={prompt} />
  )
}
