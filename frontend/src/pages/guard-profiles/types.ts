import { Ban, Filter, Infinity as InfinityIcon, ShieldCheck, type LucideIcon } from '@/lib/icons'
import type { CommandRule, CommandsMode, EgressMode, EgressPolicy, GuardCapabilities, GuardProfile } from '@/types'

export interface StudioForm {
  name: string
  description: string
  capabilities: GuardCapabilities
  commandsMode: CommandsMode
  commands: CommandRule[]
  egress: EgressPolicy
}

export const DEFAULT_CAPS: GuardCapabilities = {
  pipes: false, redirects: false, cmdSubst: false, background: false,
  sudo: false, codeExec: false, download: false, install: false,
  writeFs: false, networkOut: false, cron: false, unrestricted: false,
}

export const DEFAULT_EGRESS: EgressPolicy = { mode: 'open', hosts: [], cidrs: [] }

export const EMPTY_FORM: StudioForm = {
  name: '', description: '',
  capabilities: { ...DEFAULT_CAPS },
  commandsMode: 'whitelist',
  commands: [],
  egress: cloneEgress(DEFAULT_EGRESS),
}

export function cloneEgress(e: EgressPolicy | undefined): EgressPolicy {
  return {
    mode: e?.mode ?? 'open',
    hosts: [...(e?.hosts ?? [])],
    cidrs: [...(e?.cidrs ?? [])],
  }
}

export function fromProfile(p: GuardProfile): StudioForm {
  return {
    name: p.name,
    description: p.description,
    capabilities: { ...p.capabilities },
    commandsMode: p.commandsMode ?? 'whitelist',
    commands: [...p.commands],
    egress: cloneEgress(p.egress),
  }
}

export function toPayload(form: StudioForm): Omit<GuardProfile, 'id' | 'builtin'> {
  return {
    name: form.name,
    description: form.description,
    capabilities: form.capabilities,
    commandsMode: form.commandsMode,
    commands: form.commands,
    egress: form.egress,
  }
}

export interface ModeOption<M extends string> {
  id: M
  label: string
  description: string
  icon: LucideIcon
  badge: string
  tone: 'open' | 'safe' | 'warn' | 'closed'
}

export const COMMANDS_MODES: ModeOption<CommandsMode>[] = [
  {
    id: 'open',
    label: 'Allow everything',
    description: 'The agent can run any shell command without checks.',
    icon: InfinityIcon,
    badge: 'Allow all',
    tone: 'open',
  },
  {
    id: 'whitelist',
    label: 'Only what I list',
    description: 'Strictest. Only commands you add below will run.',
    icon: ShieldCheck,
    badge: 'Listed only',
    tone: 'safe',
  },
  {
    id: 'blacklist',
    label: 'Allow except my list',
    description: 'Run anything, except the commands you forbid below.',
    icon: Filter,
    badge: 'Except listed',
    tone: 'warn',
  },
  {
    id: 'closed',
    label: 'Block everything',
    description: 'No commands can run at all.',
    icon: Ban,
    badge: 'Block all',
    tone: 'closed',
  },
]

export const EGRESS_MODES: ModeOption<EgressMode>[] = [
  {
    id: 'open',
    label: 'Reach anywhere',
    description: 'The agent can connect to any host on the network.',
    icon: InfinityIcon,
    badge: 'Allow all',
    tone: 'open',
  },
  {
    id: 'whitelist',
    label: 'Only what I list',
    description: 'Strictest. Only the hosts and IPs you add are reachable.',
    icon: ShieldCheck,
    badge: 'Listed only',
    tone: 'safe',
  },
  {
    id: 'blacklist',
    label: 'Allow except my list',
    description: 'Reach anywhere, except the hosts and IPs you forbid.',
    icon: Filter,
    badge: 'Except listed',
    tone: 'warn',
  },
  {
    id: 'closed',
    label: 'Block everything',
    description: 'No outbound network connections at all.',
    icon: Ban,
    badge: 'Block all',
    tone: 'closed',
  },
]

export function findCommandsMode(mode: CommandsMode | undefined): ModeOption<CommandsMode> {
  return COMMANDS_MODES.find(m => m.id === (mode ?? 'whitelist')) ?? COMMANDS_MODES[1]
}

export function findEgressMode(mode: EgressMode | undefined): ModeOption<EgressMode> {
  return EGRESS_MODES.find(m => m.id === (mode ?? 'open')) ?? EGRESS_MODES[0]
}

export const CAP_LABELS: Record<keyof GuardCapabilities, string> = {
  pipes: 'Chain commands together',
  redirects: 'Save output to files',
  cmdSubst: 'Use one command inside another',
  background: 'Run commands in the background',
  sudo: 'Run as administrator',
  codeExec: 'Run inline scripts',
  download: 'Download files from the internet',
  install: 'Install software packages',
  writeFs: 'Edit files and folders',
  networkOut: 'Connect to network services',
  cron: 'Schedule tasks for later',
  unrestricted: 'Bypass every check (use with care)',
}

export const CAP_HINTS: Record<keyof GuardCapabilities, string> = {
  pipes: 'Pipes like cmd1 | cmd2.',
  redirects: 'Redirects with > and <.',
  cmdSubst: 'Embed $(cmd) inside arguments.',
  background: 'Detach with & or nohup.',
  sudo: 'Elevate with sudo.',
  codeExec: 'bash -c, python -c, sh -c, …',
  download: 'curl, wget, scp, rsync, …',
  install: 'apt, pip, npm, brew, …',
  writeFs: 'cp, mv, mkdir, chmod, …',
  networkOut: 'Outbound TCP/UDP connections.',
  cron: 'crontab and at scheduling.',
  unrestricted: 'Skips every other rule on this profile.',
}

export const CAP_ORDER: (keyof GuardCapabilities)[] = [
  'pipes', 'redirects', 'cmdSubst', 'background',
  'sudo', 'codeExec', 'download', 'install',
  'writeFs', 'networkOut', 'cron', 'unrestricted',
]

const SQL_CLIENTS = new Set(['psql', 'mysql', 'sqlite3'])

export function parseCommandRule(input: string): CommandRule | null {
  const s = input.trim()
  if (!s) return null
  const head = s.match(/^([^\s[(!]+)/)
  if (!head) return null
  const command = head[1]
  let rest = s.slice(command.length).trim()
  const out: CommandRule = { command }

  const argMatch = rest.match(/^\[([^\]]*)\]\s*/)
  if (argMatch) {
    const args = argMatch[1].split(',').map(a => a.trim()).filter(Boolean)
    if (args.length) out.allowedArgs = args
    rest = rest.slice(argMatch[0].length).trim()
  }

  const sqlMatch = rest.match(/^\(([^)]*)\)\s*/)
  if (sqlMatch) {
    const sql = sqlMatch[1].split(',').map(a => a.trim()).filter(Boolean)
    if (sql.length) out.allowedSql = sql
    rest = rest.slice(sqlMatch[0].length).trim()
  }

  if (rest.startsWith('!')) {
    const items = rest
      .split(/,\s*(?=!)/)
      .map(t => t.replace(/^!\s*/, '').trim())
      .filter(Boolean)
    if (items.length) {
      if (SQL_CLIENTS.has(command)) out.blockedSql = items
      else out.blockedArgs = items
    }
  }

  return out
}

export function mergeCommandRule(a: CommandRule, b: CommandRule): CommandRule {
  const dedupe = (xs?: string[], ys?: string[]) => {
    const all = [...(xs ?? []), ...(ys ?? [])]
    const seen = new Set<string>()
    const out: string[] = []
    for (const v of all) {
      if (!seen.has(v)) { seen.add(v); out.push(v) }
    }
    return out.length ? out : undefined
  }
  return {
    command: a.command,
    allowedArgs: dedupe(a.allowedArgs, b.allowedArgs),
    allowedSql: dedupe(a.allowedSql, b.allowedSql),
    blockedArgs: dedupe(a.blockedArgs, b.blockedArgs),
    blockedSql: dedupe(a.blockedSql, b.blockedSql),
  }
}

export function formatCommandRule(c: CommandRule): string {
  const blocks: string[] = []
  if (c.blockedSql?.length) blocks.push(`!${c.blockedSql.join(', !')}`)
  if (c.blockedArgs?.length) blocks.push(`!${c.blockedArgs.join(', !')}`)
  if (c.allowedArgs?.length) return `${c.command} [${c.allowedArgs.join(', ')}]${blocks.length ? ` ${blocks.join(' ')}` : ''}`
  if (c.allowedSql?.length) return `${c.command} (${c.allowedSql.join(', ')})${blocks.length ? ` ${blocks.join(' ')}` : ''}`
  if (blocks.length) return `${c.command} ${blocks.join(' ')}`
  return c.command
}

export function capList(caps: GuardCapabilities): string {
  if (caps.unrestricted) return CAP_LABELS.unrestricted
  const on = CAP_ORDER.filter(k => k !== 'unrestricted' && caps[k])
  return on.length > 0 ? on.map(k => CAP_LABELS[k]).join(', ') : 'Nothing extra enabled'
}

const RULE_TO_CAP: Partial<Record<string, keyof GuardCapabilities>> = {
  'pipes-disabled': 'pipes',
  'redirects-disabled': 'redirects',
  'cmd-subst-disabled': 'cmdSubst',
  'background-disabled': 'background',
  'sudo-disabled': 'sudo',
  'code-exec-disabled': 'codeExec',
  'download-disabled': 'download',
  'install-disabled': 'install',
  'write-fs-disabled': 'writeFs',
  'cron-disabled': 'cron',
}

export interface SuggestedFix {
  label: string
  apply: (form: StudioForm) => StudioForm
}

export function suggestAllowCommand(command: string, rule: string, message: string): SuggestedFix | null {
  if (RULE_TO_CAP[rule]) {
    const cap = RULE_TO_CAP[rule]!
    return {
      label: `Enable "${CAP_LABELS[cap]}"`,
      apply: (form) => ({ ...form, capabilities: { ...form.capabilities, [cap]: true } }),
    }
  }
  if (rule === 'commands-closed') {
    const name = extractCommandName(command)
    if (!name) return null
    return {
      label: `Allow "${name}"`,
      apply: (form) => addCommandRule({ ...form, commandsMode: 'whitelist' }, { command: name }),
    }
  }
  if (rule === 'command-blacklisted') {
    const name = extractCommandName(command)
    if (!name) return null
    return {
      label: `Unblock "${name}"`,
      apply: (form) => removeCommand(form, name),
    }
  }
  if (rule === 'command-not-allowed') {
    const name = extractCommandName(command)
    if (!name) return null
    return {
      label: `Allow "${name}"`,
      apply: (form) => addCommandRule(form, { command: name }),
    }
  }
  if (rule === 'arg-not-allowed') {
    const m = message.match(/"([^"]+) ([^"]+)" not allowed/)
    if (!m) return null
    const cmdName = m[1]
    const arg = m[2]
    return {
      label: `Allow "${cmdName} ${arg}"`,
      apply: (form) => addArgToCommand(form, cmdName, arg),
    }
  }
  if (rule === 'sql-not-allowed') {
    const cmdName = extractCommandName(command) ?? ''
    const m = message.match(/SQL "?(\\?\w+)/i)
    const keyword = m?.[1]
    if (!keyword) return null
    return {
      label: `Allow ${keyword.toUpperCase()} via ${cmdName}`,
      apply: (form) => addSqlToCommand(form, cmdName, keyword.toUpperCase()),
    }
  }
  if (rule === 'pipe-to-shell') {
    return {
      label: 'Enable inline scripts',
      apply: (form) => ({ ...form, capabilities: { ...form.capabilities, codeExec: true } }),
    }
  }
  return null
}

export function suggestBlockCommand(command: string): SuggestedFix | null {
  const name = extractCommandName(command)
  if (!name) return null
  return {
    label: `Block "${name}"`,
    apply: (form) => {
      if (form.commandsMode === 'open' || form.commandsMode === 'whitelist') {
        return removeCommand({ ...form, commandsMode: 'blacklist', commands: [] }, name)
          .commands.length === 0
          ? { ...form, commandsMode: 'blacklist', commands: [{ command: name }] }
          : addCommandRule({ ...form, commandsMode: 'blacklist' }, { command: name })
      }
      if (form.commandsMode === 'blacklist') {
        return addCommandRule(form, { command: name })
      }
      return form
    },
  }
}

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/

export function suggestAllowHost(target: string, reason: string): SuggestedFix | null {
  if (reason === 'closed') {
    return {
      label: `Allow "${target}"`,
      apply: (form) => ({
        ...form,
        egress: { mode: 'whitelist', hosts: addHost(form.egress.hosts, target), cidrs: [...form.egress.cidrs] },
      }),
    }
  }
  if (reason === 'not-in-whitelist') {
    if (IPV4_RE.test(target)) {
      return {
        label: `Allow ${target}`,
        apply: (form) => ({ ...form, egress: { ...form.egress, cidrs: addHost(form.egress.cidrs, target) } }),
      }
    }
    return {
      label: `Allow "${target}"`,
      apply: (form) => ({ ...form, egress: { ...form.egress, hosts: addHost(form.egress.hosts, target) } }),
    }
  }
  if (reason.startsWith('blacklist:')) {
    const matched = reason.slice('blacklist:'.length).replace(/^host:|^cidr:|^ip:/, '')
    return {
      label: `Unblock ${matched}`,
      apply: (form) => ({
        ...form,
        egress: {
          ...form.egress,
          hosts: form.egress.hosts.filter(h => h !== matched),
          cidrs: form.egress.cidrs.filter(c => c !== matched),
        },
      }),
    }
  }
  return null
}

export function suggestBlockHost(target: string): SuggestedFix | null {
  if (!target) return null
  return {
    label: `Block "${target}"`,
    apply: (form) => {
      if (form.egress.mode === 'open' || form.egress.mode === 'whitelist') {
        return {
          ...form,
          egress: {
            mode: 'blacklist',
            hosts: IPV4_RE.test(target) ? [...form.egress.hosts] : addHost([], target),
            cidrs: IPV4_RE.test(target) ? addHost([], target) : [...form.egress.cidrs],
          },
        }
      }
      if (form.egress.mode === 'blacklist') {
        return {
          ...form,
          egress: {
            ...form.egress,
            hosts: IPV4_RE.test(target) ? form.egress.hosts : addHost(form.egress.hosts, target),
            cidrs: IPV4_RE.test(target) ? addHost(form.egress.cidrs, target) : form.egress.cidrs,
          },
        }
      }
      return form
    },
  }
}

function extractCommandName(command: string): string | null {
  const trimmed = command.trim()
  if (!trimmed) return null
  const head = trimmed.split(/\s+/, 1)[0] ?? ''
  if (head === 'sudo' || head === 'nohup') {
    return trimmed.split(/\s+/)[1] ?? null
  }
  return head
}

function addCommandRule(form: StudioForm, rule: CommandRule): StudioForm {
  if (form.commands.some(c => c.command === rule.command)) return form
  return { ...form, commands: [...form.commands, rule] }
}

function removeCommand(form: StudioForm, name: string): StudioForm {
  return { ...form, commands: form.commands.filter(c => c.command !== name) }
}

function addArgToCommand(form: StudioForm, name: string, arg: string): StudioForm {
  const idx = form.commands.findIndex(c => c.command === name)
  if (idx === -1) {
    return { ...form, commands: [...form.commands, { command: name, allowedArgs: [arg] }] }
  }
  const next = [...form.commands]
  const c = next[idx]
  const args = new Set([...(c.allowedArgs ?? []), arg])
  next[idx] = { ...c, allowedArgs: [...args] }
  return { ...form, commands: next }
}

function addSqlToCommand(form: StudioForm, name: string, keyword: string): StudioForm {
  const idx = form.commands.findIndex(c => c.command === name)
  if (idx === -1) {
    return { ...form, commands: [...form.commands, { command: name, allowedSql: [keyword] }] }
  }
  const next = [...form.commands]
  const c = next[idx]
  const set = new Set([...(c.allowedSql ?? []), keyword])
  next[idx] = { ...c, allowedSql: [...set] }
  return { ...form, commands: next }
}

function addHost(list: string[], host: string): string[] {
  if (list.includes(host)) return list
  return [...list, host]
}

export interface PresetCard {
  id: string
  label: string
  hint: string
  build: () => StudioForm
}

export function presets(): PresetCard[] {
  return [
    {
      id: 'readonly',
      label: 'Look but don\u2019t touch',
      hint: 'Inspect-only commands, no internet.',
      build: () => ({
        name: '', description: 'Read-only inspection',
        capabilities: { ...DEFAULT_CAPS, pipes: true },
        commandsMode: 'whitelist',
        commands: ['ls', 'cat', 'grep', 'head', 'tail', 'df', 'ps', 'wc', 'find', 'jq']
          .map(c => ({ command: c })),
        egress: { mode: 'closed', hosts: [], cidrs: [] },
      }),
    },
    {
      id: 'web',
      label: 'Talk to APIs',
      hint: 'curl, jq, downloads to a few trusted hosts.',
      build: () => ({
        name: '', description: 'Curl + jq with a short list of hosts',
        capabilities: { ...DEFAULT_CAPS, pipes: true, redirects: true, networkOut: true, download: true },
        commandsMode: 'whitelist',
        commands: ['curl', 'jq', 'cat', 'head'].map(c => ({ command: c })),
        egress: { mode: 'whitelist', hosts: ['api.openai.com', '*.github.com'], cidrs: [] },
      }),
    },
    {
      id: 'blocklist',
      label: 'Mostly free',
      hint: 'Allow most things, block dangerous commands.',
      build: () => ({
        name: '', description: 'Most commands allowed; dangerous ones blocked',
        capabilities: { ...DEFAULT_CAPS, pipes: true, redirects: true, cmdSubst: true, networkOut: true, download: true, writeFs: true, install: true },
        commandsMode: 'blacklist',
        commands: ['rm', 'dd', 'mkfs', 'reboot', 'shutdown', 'halt', 'init'].map(c => ({ command: c })),
        egress: { mode: 'blacklist', hosts: [], cidrs: [] },
      }),
    },
    {
      id: 'unrestricted',
      label: 'No limits',
      hint: 'Allow absolutely everything (risky).',
      build: () => ({
        name: '', description: 'Allow everything (dangerous)',
        capabilities: { ...DEFAULT_CAPS, unrestricted: true },
        commandsMode: 'open',
        commands: [],
        egress: { mode: 'open', hosts: [], cidrs: [] },
      }),
    },
  ]
}
