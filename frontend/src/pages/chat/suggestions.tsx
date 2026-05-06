import {
  Sparkles,
  Eye,
  Container,
  Gauge,
  Bell,
  GitBranch,
  Wrench,
  Zap,
  Play,
  Shield,
  FileText,
  Cloud,
  Link2,
  Clock,
  AlertCircle,
  Image,
  Sun,
  Terminal,
  type IconComponent,
} from '@/lib/icons'

export type SuggestionKind = 'answer' | 'image' | 'table' | 'chart' | 'gif' | 'action'

export type SuggestionGroupId = 'start' | 'web' | 'labs' | 'auto'

export const SUGGESTION_GROUP_ORDER: SuggestionGroupId[] = ['start', 'web', 'labs', 'auto']

export const SUGGESTION_GROUP_META: Record<
  SuggestionGroupId,
  { title: string; subtitle: string }
> = {
  start: {
    title: 'Getting started',
    subtitle: 'Find your footing in one or two tries',
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
    id: 'plan-tour',
    group: 'start',
    icon: GitBranch,
    title: 'Plan a quick tour',
    gets: 'plan · saved (not run)',
    kind: 'action',
    prompt:
      'Create a 3-step plan: 1) what you can do, 2) tools available now, 3) one easy task to try. Save it to my plans — do not run it. Send the final summary to me in Telegram.',
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
    id: 'screenshot-site',
    group: 'web',
    icon: Eye,
    title: 'Screenshot a website',
    gets: 'png image',
    kind: 'image',
    prompt: 'Screenshot the Hacker News homepage.',
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
    id: 'security-scan',
    group: 'auto',
    icon: Shield,
    title: 'Quick security scan',
    gets: 'open ports · short table',
    kind: 'table',
    prompt:
      'Quick port scan of scanme.nmap.org (public test target). Show open ports and services as a small table.',
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
]
