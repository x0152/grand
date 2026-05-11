import { useEffect, useMemo, useState } from 'react'
import { Loader2, Terminal } from '@/lib/icons'
import { Markdown } from './Markdown'
import { extractGuardBlocks, GuardBlockBadge, type GuardBlock } from './chat-messages/GuardBlockBadge'
import type { LogEntry } from '../types'

export function parseCommand(content: string): string {
  try {
    const step = JSON.parse(content)
    if (step.args) {
      const args = JSON.parse(step.args)
      if (args.command) return args.command
      if (args.task) return args.task
    }
    return step.label ?? step.tool ?? content
  } catch {
    return content
  }
}

const STATUS_EXIT = /^status:\s*exit\s+(-?\d+)\s*(?:\([^)]*\))?\s*\n+output:\n?([\s\S]*)$/
const STATUS_ERR = /^status:\s*error\s*\(([^)]+)\)\s*\n+output:\n?([\s\S]*)$/

interface ParsedOutput {
  exitCode: number | null
  body: string
  guardBlocks: GuardBlock[]
  blocked: boolean
  errorText?: string
}

function parseToolOutput(raw: string): ParsedOutput {
  const text = raw ?? ''
  const m1 = text.match(STATUS_EXIT)
  if (m1) {
    const exitCode = parseInt(m1[1], 10)
    const { blocks, rest } = extractGuardBlocks(m1[2].trim())
    return { exitCode, body: rest, guardBlocks: blocks, blocked: false }
  }
  const m2 = text.match(STATUS_ERR)
  if (m2) {
    const { blocks, rest } = extractGuardBlocks(m2[2].trim())
    return { exitCode: null, body: rest, guardBlocks: blocks, blocked: false, errorText: m2[1] }
  }
  const { blocks, rest } = extractGuardBlocks(text)
  const blocked = blocks.some(b => b.kind === 'command') && rest.trim() === ''
  return { exitCode: null, body: rest, guardBlocks: blocks, blocked }
}

type GroupRun = { kind: 'run'; command: LogEntry; output?: LogEntry }
type GroupThought = { kind: 'thought'; entry: LogEntry }
type GroupOrphan = { kind: 'orphan'; entry: LogEntry }
type Group = GroupRun | GroupThought | GroupOrphan

function groupEntries(entries: LogEntry[]): Group[] {
  const out: Group[] = []
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

type RowStatus = 'ok' | 'fail' | 'blocked' | 'running' | 'pending'

interface RunRowData {
  group: GroupRun
  parsed: ParsedOutput | null
  status: RowStatus
  durationMs: number
}

function classifyRun(group: GroupRun, isLastRun: boolean, sessionRunning: boolean): RunRowData {
  if (!group.output) {
    const start = group.command.timestamp
    const status: RowStatus = sessionRunning && isLastRun ? 'running' : 'pending'
    return { group, parsed: null, status, durationMs: durationMs(start) }
  }
  const parsed = parseToolOutput(group.output.content)
  let status: RowStatus
  if (parsed.blocked) {
    status = 'blocked'
  } else if (group.output.type === 'error') {
    status = 'fail'
  } else if (parsed.exitCode == null) {
    status = parsed.errorText ? 'fail' : 'ok'
  } else {
    status = parsed.exitCode === 0 ? 'ok' : 'fail'
  }
  return {
    group,
    parsed,
    status,
    durationMs: durationMs(group.command.timestamp, group.output.timestamp),
  }
}

function fmtTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

function durationMs(start: string, end?: string): number {
  const startMs = new Date(start).getTime()
  const endMs = end ? new Date(end).getTime() : Date.now()
  return Math.max(0, endMs - startMs)
}

const STATUS_TONE: Record<RowStatus, { bg: string; fg: string; dollar: string; label: (exit: number | null) => string }> = {
  ok: {
    bg: 'bg-emerald-500/10',
    fg: 'text-emerald-500 dark:text-emerald-400',
    dollar: 'text-emerald-500 dark:text-emerald-400',
    label: () => 'OK',
  },
  fail: {
    bg: 'bg-rose-500/10',
    fg: 'text-rose-500 dark:text-rose-400',
    dollar: 'text-rose-500 dark:text-rose-400',
    label: (exit) => (exit != null ? String(exit) : 'ERR'),
  },
  blocked: {
    bg: 'bg-fuchsia-500/10',
    fg: 'text-fuchsia-500 dark:text-fuchsia-400',
    dollar: 'text-fuchsia-500 dark:text-fuchsia-400',
    label: () => 'BLK',
  },
  running: {
    bg: 'bg-sky-500/10',
    fg: 'text-sky-500 dark:text-sky-400',
    dollar: 'text-sky-500 dark:text-sky-400',
    label: () => '···',
  },
  pending: {
    bg: 'bg-zinc-500/10',
    fg: 'text-zinc-500 dark:text-zinc-400',
    dollar: 'text-zinc-500 dark:text-zinc-400',
    label: () => '?',
  },
}

function StatusGutter({ status, exit }: { status: RowStatus; exit: number | null }) {
  const tone = STATUS_TONE[status]
  return (
    <div className={`flex items-start justify-center pt-1.5 select-none border-r border-[var(--grand-border-2)] ${tone.bg}`}>
      <span className={`font-mono text-[10.5px] font-bold tracking-tight ${tone.fg}`}>
        {tone.label(exit)}
      </span>
    </div>
  )
}

function PromptLine({
  time,
  host,
  command,
  status,
  duration,
}: {
  time: string
  host?: string
  command: string
  status: RowStatus
  duration: string
}) {
  const tone = STATUS_TONE[status]
  return (
    <div className="font-mono text-xs flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-relaxed">
      <span className="text-[var(--grand-muted-2)] select-none">{time}</span>
      {host && (
        <>
          <span className="text-sky-500 dark:text-sky-400 select-none">{host}</span>
          <span className="text-[var(--grand-muted-2)] select-none">:~</span>
        </>
      )}
      <span className={`${tone.dollar} font-semibold select-none`}>$</span>
      <span className="text-[var(--grand-fg)] break-all">{command}</span>
      <span className="ml-auto text-[var(--grand-muted-2)] tabular-nums whitespace-nowrap pl-2">
        {duration}
      </span>
    </div>
  )
}

function StreamingCaret() {
  return (
    <span
      className="inline-block w-[7px] h-[12px] bg-sky-500/70 dark:bg-sky-400/70 align-middle animate-pulse"
      aria-hidden
    />
  )
}

function OutputBlock({ parsed }: { parsed: ParsedOutput }) {
  const isStderr = (parsed.exitCode != null && parsed.exitCode !== 0) || !!parsed.errorText
  const bodyClass = isStderr ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--grand-muted)]'
  return (
    <div className="mt-1 space-y-1">
      {parsed.errorText && (
        <p className="font-mono text-xs text-rose-500 dark:text-rose-400">
          {parsed.errorText}
        </p>
      )}
      {parsed.guardBlocks.map((b, i) => <GuardBlockBadge key={i} block={b} />)}
      {parsed.body && (
        <pre className={`font-mono text-xs whitespace-pre-wrap break-words m-0 leading-relaxed ${bodyClass}`}>
          {parsed.body}
        </pre>
      )}
    </div>
  )
}

function RunRow({ row, host }: { row: RunRowData; host?: string }) {
  const command = parseCommand(row.group.command.content)
  const duration = row.status === 'running' ? 'running…' : row.status === 'blocked' ? 'blocked' : fmtMs(row.durationMs)
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] border-t border-[var(--grand-border-2)] first:border-t-0">
      <StatusGutter status={row.status} exit={row.parsed?.exitCode ?? null} />
      <div className="px-3 py-1.5 min-w-0">
        <PromptLine
          time={fmtTime(row.group.command.timestamp)}
          host={host}
          command={command}
          status={row.status}
          duration={duration}
        />
        {row.parsed && <OutputBlock parsed={row.parsed} />}
        {row.status === 'running' && (
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-[var(--grand-muted-2)]">
            <StreamingCaret />
            <span>streaming…</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ThoughtBlock({ entry }: { entry: LogEntry }) {
  return (
    <div className="bg-[var(--grand-surface-2)] px-4 py-3">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-mono text-[10.5px] font-bold text-[var(--grand-fg)] tracking-[0.08em] uppercase">
          agent
        </span>
        <span className="ml-auto font-mono text-[10.5px] text-[var(--grand-muted-2)] select-none tabular-nums">
          {fmtTime(entry.timestamp)}
        </span>
      </div>
      <div className="text-[13.5px] leading-relaxed text-[var(--grand-fg-2)] dark:text-zinc-300">
        <Markdown content={entry.content} />
      </div>
    </div>
  )
}

function OrphanBlock({ entry }: { entry: LogEntry }) {
  const isError = entry.type === 'error'
  const { blocks, rest } = extractGuardBlocks(entry.content)
  return (
    <div className="my-1 font-mono text-xs flex gap-2 items-start">
      <span className="text-[var(--grand-muted-2)] shrink-0 select-none">{fmtTime(entry.timestamp)}</span>
      <span className={`shrink-0 select-none ${isError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--grand-muted-2)]'}`}>
        {isError ? '!' : '·'}
      </span>
      <div className="min-w-0 flex-1">
        {blocks.map((b, i) => <GuardBlockBadge key={i} block={b} />)}
        {rest && (
          <pre className={`whitespace-pre-wrap break-all m-0 ${isError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--grand-muted)]'}`}>
            {rest}
          </pre>
        )}
      </div>
    </div>
  )
}

interface SessionSummary {
  total: number
  ok: number
  fail: number
  blocked: number
  running: number
  totalMs: number
}

function summarize(rows: RunRowData[]): SessionSummary {
  let ok = 0, fail = 0, blocked = 0, running = 0, totalMs = 0
  for (const r of rows) {
    if (r.status === 'ok') ok++
    else if (r.status === 'fail') fail++
    else if (r.status === 'blocked') blocked++
    else if (r.status === 'running') running++
    totalMs += r.durationMs
  }
  return { total: rows.length, ok, fail, blocked, running, totalMs }
}

function SummaryPill({ summary }: { summary: SessionSummary }) {
  if (summary.blocked > 0) {
    return (
      <span className="px-1.5 py-0.5 rounded-full text-[10.5px] font-medium bg-fuchsia-500/15 text-fuchsia-500 dark:text-fuchsia-400">
        {summary.blocked} blocked
      </span>
    )
  }
  if (summary.running > 0) {
    return (
      <span className="px-1.5 py-0.5 rounded-full text-[10.5px] font-medium bg-sky-500/15 text-sky-500 dark:text-sky-400">
        running
      </span>
    )
  }
  if (summary.fail > 0) {
    return (
      <span className="px-1.5 py-0.5 rounded-full text-[10.5px] font-medium bg-rose-500/15 text-rose-500 dark:text-rose-400">
        {summary.fail} failed
      </span>
    )
  }
  return (
    <span className="px-1.5 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/15 text-emerald-500 dark:text-emerald-400">
      all ok
    </span>
  )
}

function PromptSection({ prompt }: { prompt: string }) {
  return (
    <div className="px-3 py-2 bg-[var(--grand-surface-2)] border-b border-[var(--grand-border-2)]">
      <div className="font-mono text-[10.5px] font-bold text-[var(--grand-fg)] tracking-[0.08em] uppercase mb-1">
        prompt
      </div>
      <p className="text-[13.5px] leading-relaxed text-[var(--grand-fg-2)] dark:text-zinc-300 whitespace-pre-wrap break-words">
        {prompt}
      </p>
    </div>
  )
}

function SessionHeader({
  host,
  agentName,
  summary,
}: {
  host?: string
  agentName?: string
  summary: SessionSummary
}) {
  const showHost = host || agentName
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--grand-surface-2)] border-b border-[var(--grand-border-2)] flex-wrap">
      <Terminal size={11} className="text-[var(--grand-muted-2)]" />
      <span className="font-mono text-[11px] text-[var(--grand-muted)] tracking-tight">session</span>
      {showHost && (
        <span className="font-mono text-[11px] text-[var(--grand-fg-2)] dark:text-[var(--grand-fg)] tracking-tight">
          {host || agentName}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1.5 flex-wrap">
        <span className="px-1.5 py-0.5 rounded-full text-[10.5px] font-medium bg-[var(--grand-surface-3)] text-[var(--grand-muted)]">
          {summary.total} {summary.total === 1 ? 'cmd' : 'cmds'}
        </span>
        {summary.total > 0 && <SummaryPill summary={summary} />}
        {summary.totalMs > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10.5px] font-medium bg-[var(--grand-surface-3)] text-[var(--grand-muted)] tabular-nums">
            {fmtMs(summary.totalMs)}
          </span>
        )}
      </div>
    </div>
  )
}

export interface SessionViewProps {
  entries: LogEntry[]
  host?: string
  agentName?: string
  isRunning?: boolean
  showHeader?: boolean
  prompt?: string
}

export function SessionView({ entries, host, agentName, isRunning, showHeader = true, prompt }: SessionViewProps) {
  const [now, setNow] = useState(() => Date.now())
  const hasRunning = isRunning ?? false

  useEffect(() => {
    if (!hasRunning) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [hasRunning])

  const groups = useMemo(() => groupEntries(entries), [entries])

  const rows = useMemo(() => {
    let lastRunIdx = -1
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i].kind === 'run') { lastRunIdx = i; break }
    }
    return groups.map((g, idx) => {
      if (g.kind !== 'run') return null
      return classifyRun(g, idx === lastRunIdx, hasRunning)
    })
  }, [groups, hasRunning, now])

  const runRows = rows.filter((r): r is RunRowData => r !== null)
  const summary = summarize(runRows)
  const hasRunCommands = summary.total > 0
  const hasPrompt = !!prompt && prompt.trim().length > 0
  const isEmpty = groups.length === 0 && !hasPrompt && !hasRunning

  if (isEmpty) return null

  return (
    <div className="rounded-md overflow-hidden border border-[var(--grand-border-2)] bg-[var(--grand-bg)]">
      {hasPrompt && <PromptSection prompt={prompt!} />}
      {showHeader && hasRunCommands && (
        <SessionHeader host={host} agentName={agentName} summary={summary} />
      )}
      {hasRunning && groups.length === 0 && (
        <div className="px-3 py-2.5 font-mono text-[12px] flex items-center gap-2 text-[var(--grand-muted)]">
          <Loader2 size={13} className="animate-spin" />
          <span>Waiting for output…</span>
        </div>
      )}
      <div>
        {groups.map((g, idx) => {
          if (g.kind === 'thought') {
            return (
              <div key={idx} className="border-t border-[var(--grand-border-2)] first:border-t-0">
                <ThoughtBlock entry={g.entry} />
              </div>
            )
          }
          if (g.kind === 'orphan') {
            return (
              <div key={idx} className="px-3 py-2 border-t border-[var(--grand-border-2)] first:border-t-0">
                <OrphanBlock entry={g.entry} />
              </div>
            )
          }
          const row = rows[idx]
          if (!row) return null
          return <RunRow key={idx} row={row} host={host} />
        })}
      </div>
    </div>
  )
}

export function EntryLine({ entry }: { entry: LogEntry }) {
  return <SessionView entries={[entry]} showHeader={false} />
}

export function PromptBanner({ prompt }: { prompt: string }) {
  if (!prompt) return null
  return (
    <div className="rounded-md bg-[var(--grand-surface-2)] border border-[var(--grand-border-2)] px-4 py-3">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-mono text-[10.5px] font-bold text-[var(--grand-fg)] tracking-[0.08em] uppercase">
          prompt
        </span>
      </div>
      <p className="text-[13.5px] leading-relaxed text-[var(--grand-fg-2)] dark:text-zinc-300 whitespace-pre-wrap">
        {prompt}
      </p>
    </div>
  )
}
