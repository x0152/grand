import { ShieldAlert, ExternalLink } from '@/lib/icons'
import { navigate } from '../../router'

export type GuardBlockKind = 'network' | 'command'

export interface GuardBlock {
  kind: GuardBlockKind
  /** Raw entries (host[:reason][ xN] for network, single cmd line for command). */
  items: string[]
  /** Human-readable note shown in the badge body (e.g. "not network/DNS"). */
  note: string
  /** Source guard profile IDs (deduped). Empty when unknown. */
  profileIds: string[]
}

const TAG_RE = /<guard-block kind="(network|command)"(?: profiles="([^"]*)")?>([\s\S]*?)<\/guard-block>/g

const NOTE_BY_KIND: Record<GuardBlockKind, string> = {
  network: 'Not a network/DNS error — the egress gateway blocked these hosts.',
  command: 'Not a server error — your guard profile blocked this command.',
}

export interface ExtractedGuardBlocks {
  blocks: GuardBlock[]
  /** Original text minus the matched tags (and the leading newline they introduce). */
  rest: string
}

export function extractGuardBlocks(input: string): ExtractedGuardBlocks {
  if (!input || input.indexOf('<guard-block') === -1) {
    return { blocks: [], rest: input }
  }
  const blocks: GuardBlock[] = []
  let rest = input
  for (const match of input.matchAll(TAG_RE)) {
    const kind = match[1] as GuardBlockKind
    const profileIds = (match[2] ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    const body = match[3].trim()
    blocks.push(parseBody(kind, body, profileIds))
  }
  rest = rest.replace(TAG_RE, '').replace(/\n{3,}/g, '\n\n').trim()
  return { blocks, rest }
}

function parseBody(kind: GuardBlockKind, body: string, profileIds: string[]): GuardBlock {
  const split = (separator: string): { items: string[] } => {
    const idx = body.indexOf(separator)
    if (idx === -1) return { items: [body] }
    const tail = body.slice(idx + separator.length).trim()
    if (kind === 'network') {
      return { items: tail.split(',').map(s => s.trim()).filter(Boolean) }
    }
    return { items: [tail] }
  }
  const { items } = split(kind === 'network' ? 'hosts:' : 'cmd:')
  return { kind, items, note: NOTE_BY_KIND[kind], profileIds }
}

export function GuardBlockBadge({ block }: { block: GuardBlock }) {
  const titleByKind: Record<GuardBlockKind, string> = {
    network: 'Network blocked by guard profile',
    command: 'Command blocked by guard profile',
  }
  const primaryProfile = block.profileIds[0]
  const extra = block.profileIds.length - 1
  const handleEdit = () => {
    if (primaryProfile) {
      navigate({ page: 'guard-profiles', profileId: primaryProfile })
    } else {
      navigate({ page: 'guard-profiles' })
    }
  }
  return (
    <div className="my-1.5 rounded-md bg-rose-500/[0.07] border border-rose-500/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <ShieldAlert size={13} className="text-rose-400" />
        <span className="text-[11.5px] font-medium text-rose-300">{titleByKind[block.kind]}</span>
        <button
          onClick={handleEdit}
          title={primaryProfile ? `Open guard profile ${primaryProfile}${extra > 0 ? ` (+${extra} more)` : ''}` : 'Open guard profiles'}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-rose-300/80 hover:text-rose-200 underline-offset-2 hover:underline"
        >
          {primaryProfile ? 'Edit profile' : 'Open profiles'}
          {extra > 0 && <span className="opacity-70">+{extra}</span>}
          <ExternalLink size={10} />
        </button>
      </div>
      <p className="pl-[19px] text-[11.5px] text-rose-300/70 mb-1.5 leading-snug">{block.note}</p>
      <ul className="pl-[19px] space-y-0.5 font-mono text-[12px] text-rose-200/95 break-all">
        {block.items.map((item, i) => (
          <li key={i}>{formatItem(block.kind, item)}</li>
        ))}
      </ul>
    </div>
  )
}

function formatItem(kind: GuardBlockKind, raw: string): string {
  if (kind !== 'network') return raw
  const xMatch = raw.match(/^(.*?)( x\d+)?$/)
  const main = xMatch?.[1] ?? raw
  const count = xMatch?.[2] ?? ''
  const colon = main.indexOf(':')
  if (colon === -1) return raw
  return `${main.slice(0, colon)} (${main.slice(colon + 1).trim()})${count}`
}
