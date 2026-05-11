import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api'
import type { LogEntry, SessionLog, Step } from '../../types'
import { extractStepPrompt } from '../../components/chat-messages/stepHelpers'
import { parseCommand, parseToolOutput } from '../../components/LogEntries'
import { useDraggable, type Position } from './useDraggable'
import { useResizable, type Size } from './useResizable'

interface Props {
  step: Step
  position: Position
  size: Size
  zIndex: number
  active: boolean
  maximized: boolean
  onActivate: () => void
  onMove: (next: Position) => void
  onResize: (next: Size) => void
  onMaximizeToggle: () => void
  onClose: () => void
}

const PROMPT = 'C:\\Mantis>'
const SSH_PROMPT = '[mantis@host]$'

/**
 * cmd.exe-styled popup window that surfaces a tool-call's prompt + log
 * entries as classic terminal output.
 *
 * The output format mirrors what the user expects when looking at a real
 * Windows XP shell:
 *
 *   Microsoft Windows XP [Version 5.1.2600]
 *   (C) Copyright 1985-2001 Microsoft Corp.
 *
 *   C:\Mantis> ssh user@example.com
 *   [mantis@host]$ ls -la
 *   total 32
 *   drwxr-xr-x  …
 *   [mantis@host]$ exit
 *
 * For non-ssh tools we render `<tool> <flag args>` then the prompt body as
 * a `REM prompt:` block — like a batch file comment — followed by any log
 * entries in their original order.
 */
export function WinXpCmdTerminal({
  step,
  position,
  size,
  zIndex,
  active,
  maximized,
  onActivate,
  onMove,
  onResize,
  onMaximizeToggle,
  onClose,
}: Props) {
  const [log, setLog] = useState<SessionLog | null>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const dragHandle = useDraggable(position, onMove, onActivate)
  const resizeRight = useResizable(size, onResize, { edge: 'right' }, onActivate)
  const resizeBottom = useResizable(size, onResize, { edge: 'bottom' }, onActivate)
  const resizeCorner = useResizable(size, onResize, { edge: 'corner' }, onActivate)

  // Prefer the freshly-polled log status over the captured step status.
  // The step prop is a snapshot, but the log is being polled live so it
  // reflects whether the tool is currently running or has completed.
  const liveStatus = log?.status ?? step.status
  const isRunning = liveStatus === 'running'
  const promptText = extractStepPrompt(step) || step.label || step.tool
  const fullCommand = useMemo(() => buildFullCommand(step, log), [step, log])
  const isSshLike = step.tool.toLowerCase().startsWith('ssh') || step.tool === 'shell'

  useEffect(() => {
    if (!step.logId) return
    let cancelled = false

    const fetchLog = async () => {
      try {
        const data = await api.sessionLogs.get(step.logId!)
        if (!cancelled) setLog(data)
      } catch {}
    }

    void fetchLog()
    // Keep polling for the entire lifetime of the window. Stale snapshots
    // were a real bug: when the user opened a cmd while the step was
    // running, then the step finished, our `step` prop never updated (the
    // experiment holds the snapshot the chat handed it). Polling the log
    // unconditionally fixes that and makes the cmd update in real time.
    const id = setInterval(fetchLog, 500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [step.logId])

  useEffect(() => {
    const el = screenRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log])

  return (
    <div
      className={`xp-window-wrap ${maximized ? 'maximized' : ''}`}
      style={{
        left: position.left,
        top: position.top,
        width: size.width,
        height: size.height,
        zIndex,
      }}
      onMouseDown={onActivate}
    >
      <div className="window xp-cmd">
        <div
          className={`title-bar ${active ? '' : 'inactive'}`}
          {...(maximized ? {} : dragHandle)}
          onDoubleClick={onMaximizeToggle}
        >
          <div className="title-bar-text">
            <img
              className="xp-title-icon"
              src="/winxp/cmd.png"
              alt=""
              draggable={false}
            />
            C:\WINDOWS\system32\cmd.exe — {step.tool}
          </div>
          <div className="title-bar-controls">
            <button aria-label="Minimize" />
            <button
              aria-label={maximized ? 'Restore' : 'Maximize'}
              onClick={onMaximizeToggle}
            />
            <button aria-label="Close" onClick={onClose} />
          </div>
        </div>
        <div className="window-body">
          <div ref={screenRef} className="xp-cmd-screen">
            <span className="cmd-meta">
{`Microsoft Windows XP [Version 5.1.2600]
(C) Copyright 1985-2001 Microsoft Corp.

`}
            </span>

            <span className="cmd-prompt">{PROMPT}</span> {fullCommand}
            {'\n'}

            {!isSshLike && promptText && (
              <>
                <span className="cmd-meta">REM prompt:</span>
                {'\n'}
                <span className="cmd-meta">
                  {`Skill: ${step.tool} ${formatArgsAsObject(step)}`}
                </span>
                {'\n\n'}
              </>
            )}

            {renderEntries(log, step, isSshLike)}

            {isRunning ? (
              <>
                <span className="cmd-meta">[ running… ]</span>
                <span className="xp-cmd-cursor" />
              </>
            ) : (
              <>
                <span className="cmd-prompt">{isSshLike ? SSH_PROMPT : PROMPT}</span>
                <span className="xp-cmd-cursor" />
              </>
            )}
          </div>
        </div>
        <div className="status-bar">
          <p className="status-bar-field">Tool: {step.tool}</p>
          <p className="status-bar-field">Status: {liveStatus}</p>
          <p className="status-bar-field">
            {step.modelName ? `Model: ${step.modelName}` : 'No model'}
          </p>
        </div>
      </div>

      {!maximized && (
        <>
          <div className="xp-resize xp-resize-r" {...resizeRight} />
          <div className="xp-resize xp-resize-b" {...resizeBottom} />
          <div className="xp-resize xp-resize-br" {...resizeCorner} />
        </>
      )}
    </div>
  )
}

/**
 * Build the full `tool …flags` string the user would have typed at the
 * prompt. For ssh-style tools this is `ssh user@host` (or whatever the log
 * recorded), with any inline command quoted just like real ssh would.
 */
function buildFullCommand(step: Step, log: SessionLog | null): string {
  const tool = step.tool
  const lower = tool.toLowerCase()

  if (lower.startsWith('ssh') || tool === 'shell') {
    const host = log?.host || (parseArg(step.args, ['host']) ?? 'host')
    const user = parseArg(step.args, ['user', 'username']) ?? 'user'
    const cmd = parseArg(step.args, ['command', 'cmd', 'shell'])
    if (cmd) return `ssh ${user}@${host} ${quote(cmd)}`
    return `ssh ${user}@${host}`
  }

  const flags = formatFlags(step)
  return flags ? `${tool} ${flags}` : tool
}

function formatFlags(step: Step): string {
  if (!step.args) return ''
  try {
    const parsed = JSON.parse(step.args) as Record<string, unknown>
    const out: string[] = []
    for (const [k, v] of Object.entries(parsed)) {
      if (k === 'task' || k === 'prompt') continue
      const s = typeof v === 'string' ? v : JSON.stringify(v)
      const trimmed = s.length > 120 ? s.slice(0, 117) + '…' : s
      out.push(`--${k}=${quote(trimmed)}`)
    }
    return out.join(' ')
  } catch {
    return ''
  }
}

function formatArgsAsObject(step: Step): string {
  if (!step.args) return '{}'
  try {
    const parsed = JSON.parse(step.args)
    return JSON.stringify(parsed)
  } catch {
    return '{}'
  }
}

function parseArg(raw: string | undefined, keys: string[]): string | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    for (const k of keys) {
      const v = parsed[k]
      if (typeof v === 'string' && v) return v
    }
    return null
  } catch {
    return null
  }
}

function quote(s: string): string {
  if (/^[A-Za-z0-9_\-./@]+$/.test(s)) return s
  // Escape inner quotes and wrap in double quotes — same rule a Windows
  // shell would use to round-trip an argument with spaces.
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * Group raw log entries into command/output pairs (same idea as
 * `LogEntries.groupEntries`) so we can render each command followed by its
 * parsed output, and surface a status pill — matches the regular logs UI
 * but in a strictly cmd.exe colour palette.
 */
type CmdGroup =
  | { kind: 'run'; command: LogEntry; output?: LogEntry }
  | { kind: 'thought'; entry: LogEntry }
  | { kind: 'orphan'; entry: LogEntry }

function groupCmdEntries(entries: LogEntry[]): CmdGroup[] {
  const out: CmdGroup[] = []
  let i = 0
  while (i < entries.length) {
    const e = entries[i]
    if (e.type === 'command') {
      const next = entries[i + 1]
      if (next && (next.type === 'output' || next.type === 'error')) {
        out.push({ kind: 'run', command: e, output: next })
        i += 2
        continue
      }
      out.push({ kind: 'run', command: e })
      i += 1
      continue
    }
    if (e.type === 'thought') {
      out.push({ kind: 'thought', entry: e })
      i += 1
      continue
    }
    out.push({ kind: 'orphan', entry: e })
    i += 1
  }
  return out
}

function fmtTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function renderEntries(log: SessionLog | null, step: Step, isSshLike: boolean) {
  if (log && log.entries && log.entries.length > 0) {
    const groups = groupCmdEntries(log.entries)
    return groups.map((g, i) => {
      if (g.kind === 'run') return <RunBlock key={i} group={g} sshLike={isSshLike} />
      if (g.kind === 'thought') return <ThoughtBlock key={i} entry={g.entry} />
      return <OrphanBlock key={i} entry={g.entry} />
    })
  }
  if (step.result) {
    const parsed = parseToolOutput(step.result)
    const cls = step.status === 'error' || (parsed.exitCode != null && parsed.exitCode !== 0)
      ? 'cmd-error'
      : 'cmd-ok'
    return (
      <span className={cls}>
        {parsed.body || step.result}
        {'\n'}
      </span>
    )
  }
  return null
}

/**
 * One command + its (optional) output. Renders as:
 *
 *   [HH:MM:SS] [mantis@host]$ <command>
 *   <output …multi-line, dimmed>
 *   [exit 0 · 124ms]
 *
 * Mirrors `LogEntries.RunRow` but with cmd.exe colours (white prompt,
 * dim grey timestamp, green/red status footer, white-ish stdout).
 */
function RunBlock({ group, sshLike }: { group: { kind: 'run'; command: LogEntry; output?: LogEntry }; sshLike: boolean }) {
  // The log stores the command as a JSON-stringified Step. Use the same
  // `parseCommand` the real LogEntries panel uses so we always print a
  // readable shell line, never the raw `{"id":"…","tool":"…",…}` blob.
  const command = parseCommand(group.command.content)
  const output = group.output
  const parsed = output ? parseToolOutput(output.content) : null
  const isError = !!output && output.type === 'error'
  const exitOk = parsed?.exitCode === 0
  const exitFail = parsed?.exitCode != null && parsed.exitCode !== 0
  const promptMark = sshLike ? SSH_PROMPT : PROMPT

  return (
    <div className="cmd-run">
      <span className="cmd-meta">[{fmtTime(group.command.timestamp)}]</span>{' '}
      <span className="cmd-prompt">{promptMark}</span>{' '}
      <span className="cmd-cmd">{command}</span>
      {'\n'}
      {parsed && parsed.body && (
        <span className={isError || exitFail ? 'cmd-error' : 'cmd-out'}>
          {parsed.body.replace(/\n+$/, '')}
          {'\n'}
        </span>
      )}
      {parsed && parsed.errorText && (
        <span className="cmd-error">{parsed.errorText}{'\n'}</span>
      )}
      {output && (
        <span className={exitFail || isError ? 'cmd-error' : 'cmd-ok'}>
          [
          {parsed?.exitCode != null
            ? `exit ${parsed.exitCode}`
            : isError
            ? 'exit ERR'
            : exitOk ? 'exit 0' : 'done'}
          {output.timestamp && (() => {
            const ms = new Date(output.timestamp).getTime() - new Date(group.command.timestamp).getTime()
            if (ms <= 0) return null
            return ` · ${ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's'}`
          })()}
          ]
          {'\n'}
        </span>
      )}
    </div>
  )
}

/**
 * Agent "thought" entries are rendered as REM (batch comment) blocks so
 * the cmd transcript still reads coherently without breaking the format.
 */
function ThoughtBlock({ entry }: { entry: LogEntry }) {
  return (
    <div className="cmd-thought">
      <span className="cmd-meta">[{fmtTime(entry.timestamp)}] REM agent:</span>
      {'\n'}
      <span className="cmd-meta">{entry.content.split('\n').map(l => `:: ${l}`).join('\n')}{'\n'}</span>
    </div>
  )
}

function OrphanBlock({ entry }: { entry: LogEntry }) {
  const isError = entry.type === 'error'
  return (
    <div className={isError ? 'cmd-error' : 'cmd-out'}>
      <span className="cmd-meta">[{fmtTime(entry.timestamp)}] {isError ? '!' : '·'}</span>{' '}
      <span>{entry.content}</span>
      {'\n'}
    </div>
  )
}
