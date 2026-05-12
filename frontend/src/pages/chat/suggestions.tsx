import {
  Sparkles,
  Eye,
  Container,
  Gauge,
  Bell,
  Wrench,
  Zap,
  Play,
  Plug,
  Shield,
  FileText,
  Cloud,
  Link2,
  Clock,
  AlertCircle,
  Image,
  Sun,
  Terminal,
  Mail,
  Filter,
  MessageSquareText,
  type IconComponent,
} from '@/lib/icons'

export type SuggestionKind = 'answer' | 'image' | 'table' | 'chart' | 'gif' | 'action'

export type SuggestionGroupId = 'start' | 'email' | 'web' | 'labs' | 'auto'

export const SUGGESTION_GROUP_ORDER: SuggestionGroupId[] = [
  'start',
  'email',
  'web',
  'labs',
  'auto',
]

export const SUGGESTION_GROUP_META: Record<
  SuggestionGroupId,
  { title: string; subtitle: string }
> = {
  start: {
    title: 'Getting started',
    subtitle: 'Find your footing in one or two tries',
  },
  email: {
    title: 'Email',
    subtitle: 'Triage, sort, reply and digest your inbox',
  },
  web: {
    title: 'Web & research',
    subtitle: 'Browser, public APIs, live pages',
  },
  labs: {
    title: 'Labs & media',
    subtitle: 'Charts, sandboxes, images, networking',
  },
  auto: {
    title: 'Automation & ops',
    subtitle: 'Schedules, scans, diagnostics',
  },
}

export interface Suggestion {
  id: string
  group: SuggestionGroupId
  icon: IconComponent
  title: string
  gets: string
  kind: SuggestionKind
  prompt: string
}

export const SUGGESTIONS: Suggestion[] = [
  {
    id: 'what-can-you-do',
    group: 'start',
    icon: Sparkles,
    title: 'What can you do?',
    gets: 'short list · 3 examples',
    kind: 'answer',
    prompt: 'What can you help me with? Add 3 example tasks I could try.',
  },
  {
    id: 'validate-json',
    group: 'start',
    icon: Terminal,
    title: 'Validate JSON',
    gets: 'valid or fix list',
    kind: 'answer',
    prompt:
      'Validate this JSON and list issues: {"name":"demo","items":[{"id":1,"ok":true},{"id":2}]}',
  },
  {
    id: 'whats-connected',
    group: 'start',
    icon: Plug,
    title: "What's connected?",
    gets: 'short summary · integrations',
    kind: 'answer',
    prompt:
      'List my wired integrations and their status: LLM provider and active model, Telegram, hosts/SSH, sandboxes. Short summary, mark anything that is missing or broken.',
  },
  {
    id: 'weather-now',
    group: 'web',
    icon: Sun,
    title: 'Weather right now',
    gets: 'one paragraph',
    kind: 'answer',
    prompt: 'Weather in Berlin right now — temp and conditions.',
  },
  {
    id: 'site-health',
    group: 'web',
    icon: Zap,
    title: 'Is this site healthy?',
    gets: 'health check · status + latency',
    kind: 'answer',
    prompt: 'Is github.com up? Show status, latency and TLS cert validity.',
  },
  {
    id: 'readme-bullets',
    group: 'web',
    icon: FileText,
    title: 'README in 5 bullets',
    gets: 'bullets · one repo',
    kind: 'answer',
    prompt:
      'Open https://github.com/golang/go and give me 5 bullet takeaways from the README.',
  },
  {
    id: 'compare-landings',
    group: 'web',
    icon: Link2,
    title: 'Compare two sites',
    gets: 'two columns · bullets',
    kind: 'answer',
    prompt:
      'Compare https://stripe.com and https://vercel.com landing pages: one line on what they sell, one line on the main CTA, for each.',
  },
  {
    id: 'trending-repos',
    group: 'web',
    icon: Container,
    title: 'Trending repos this week',
    gets: 'table · 5 rows',
    kind: 'table',
    prompt:
      'Top 5 trending GitHub repos this week as a table: name, description, stars, link.',
  },
  {
    id: 'screenshot-site',
    group: 'web',
    icon: Eye,
    title: 'Screenshot a website',
    gets: 'png image',
    kind: 'image',
    prompt: 'Screenshot the Hacker News homepage.',
  },
  {
    id: 'text-from-image',
    group: 'labs',
    icon: Image,
    title: 'Text from a screenshot',
    gets: 'plain text · vision',
    kind: 'answer',
    prompt: 'I will send a screenshot with text. Extract all visible text.',
  },
  {
    id: 'dns-lookup',
    group: 'labs',
    icon: Cloud,
    title: 'DNS lookup',
    gets: 'records · tiny table',
    kind: 'table',
    prompt:
      'DNS lookup for api.github.com — show A records (and CNAME if any) as a tiny table.',
  },
  {
    id: 'bitcoin-chart',
    group: 'labs',
    icon: Gauge,
    title: 'Plot Bitcoin price',
    gets: 'line chart · png',
    kind: 'chart',
    prompt:
      'Bitcoin price for the last 30 days. Plot it with matplotlib (pyplot) and send me the PNG.',
  },
  {
    id: 'video-gif',
    group: 'labs',
    icon: Play,
    title: 'Video → GIF',
    gets: 'gif · first 5 seconds',
    kind: 'gif',
    prompt:
      'When I send a short video, turn the first 5 seconds into a small GIF and send it back. Reply "ok" when ready.',
  },
  {
    id: 'rust-workspace',
    group: 'labs',
    icon: Wrench,
    title: 'Set up a Rust workspace',
    gets: 'sandbox · async build',
    kind: 'action',
    prompt:
      'Provision a sandbox with Rust + Cargo in the background. Tell me the sandbox name and how to check when it is ready.',
  },
  {
    id: 'explain-error',
    group: 'auto',
    icon: AlertCircle,
    title: 'Decode an error',
    gets: 'cause · one fix',
    kind: 'answer',
    prompt:
      'Explain this error in plain English and the first thing to check: `Error: connect ECONNREFUSED 127.0.0.1:5432`',
  },
  {
    id: 'security-scan',
    group: 'auto',
    icon: Shield,
    title: 'Quick security scan',
    gets: 'open ports · short table',
    kind: 'table',
    prompt:
      'Quick port scan of scanme.nmap.org (public test target). Strict rules: (0) DO NOT run any wrapper (`net-port`, `net-banner`, …) with no arguments to discover usage — the signatures below are authoritative, call them directly. (1) use the `net-port` wrapper from the netsec sandbox, NOT raw `nmap` — the wrapper already enforces hard timeouts. (2) First attempt: `net-port scanme.nmap.org top100` (budget ≤ 60s). (3) If it times out, do AT MOST one retry with a smaller scope like `net-port scanme.nmap.org common`. Announce the retry on its own line in the form `REM [retry 1/1 after timeout] <reason>` BEFORE running it. (4) If both attempts time out, return whatever partial data you have and prefix the final answer with `Status: partial — scan timed out`. (5) For service names on open ports, run 1–3 `net-banner <host> <port>` calls instead of re-scanning with `-sV`. Output: a small markdown table — Port | Proto | State | Service. Total time budget ≤ 90s.',
  },
  {
    id: 'security-scan-deep',
    group: 'auto',
    icon: Shield,
    title: 'Deep security scan',
    gets: 'top1000 ports · services · banners',
    kind: 'table',
    prompt:
      'Deep security scan of scanme.nmap.org (public test target). This is the slow path — top-1000 ports with service detection. Rules: (0) DO NOT run any wrapper with no arguments to discover usage — the signatures below are authoritative, call them directly. (1) primary command: `net-port scanme.nmap.org top1000 --service` (budget ≤ 4 min). (2) If it times out, fall back ONCE to `net-port scanme.nmap.org top100 --service`, prefix the retry line with `REM [retry 1/1 after timeout]`, and mark the final answer `Status: partial — top1000 timed out`. (3) For up to 3 open ports, follow up with `net-banner <host> <port>` to confirm the service (truncate each banner to 80 chars). (4) Use raw `nmap -sV -sC` only if a specific check requires it AND wrap it in `timeout`. Output: a markdown table — Port | Proto | State | Service | Banner — followed by a one-line summary of obvious risks (or "no obvious risks").',
  },
  {
    id: 'weekly-digest',
    group: 'auto',
    icon: Clock,
    title: 'Weekly digest',
    gets: 'recurring · monday 09:00',
    kind: 'action',
    prompt:
      'Weekly plan, Mondays 9:00: top 5 Hacker News stories with one-sentence summaries. Save it and tell me the next run time.',
  },
  {
    id: 'daily-brief',
    group: 'auto',
    icon: Bell,
    title: 'Daily news brief',
    gets: 'recurring · mon–fri 09:00',
    kind: 'action',
    prompt:
      'Daily plan, weekdays 9:00: top 5 Hacker News stories with one-sentence summaries, sent to me. Save it and tell me the next run time.',
  },
  {
    id: 'inbox-unread-summary',
    group: 'email',
    icon: Mail,
    title: 'What new mail do I have?',
    gets: 'short digest · grouped by sender',
    kind: 'answer',
    prompt:
      'Look at my email inbox. Summarize all unread messages grouped by sender, with one short line per message (subject + the gist). Skip newsletters and notifications unless something looks important.',
  },
  {
    id: 'find-that-email',
    group: 'email',
    icon: Eye,
    title: 'Find that one email',
    gets: 'best matches · short list',
    kind: 'answer',
    prompt:
      'Search my mailbox (including Spam) for the most recent invoice from Stripe. Show me the date, subject, sender and the amount, plus the UID so I can open it later.',
  },
  {
    id: 'sort-mail-by-sender',
    group: 'email',
    icon: Filter,
    title: 'Sort newsletters into a folder',
    gets: 'inbox cleanup · folder + move',
    kind: 'action',
    prompt:
      'In my mailbox, find every message that looks like a newsletter (Substack, GitHub digest, Stripe receipts, Hacker News, etc.). Create a folder called "Newsletters" if it does not exist and move all of those messages into it. Show me a short report: how many were moved and from whom.',
  },
  {
    id: 'draft-reply',
    group: 'email',
    icon: MessageSquareText,
    title: 'Draft a reply for me',
    gets: 'draft only · I confirm before send',
    kind: 'answer',
    prompt:
      'Find the most recent message in my inbox that I have not replied to yet. Show me the subject + a 2-sentence summary of what they want, then draft a polite reply in my voice. DO NOT send — just show me the draft and the UID, I will say "send it" if I am happy with it.',
  },
  {
    id: 'morning-mail-digest',
    group: 'email',
    icon: Bell,
    title: 'Morning mail digest',
    gets: 'recurring · mon–fri 08:30',
    kind: 'action',
    prompt:
      'Daily plan, weekdays 8:30: scan my email inbox since yesterday morning, group unread mail by sender, drop newsletters, and send me a short digest with the top 5 things that actually need my attention. Save the plan and tell me the next run time.',
  },
]
