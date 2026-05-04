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

// Kind drives the visual tone of the output chip.
// `action` is used for recurring / automation / plan suggestions that don't
// literally return a single artifact — they schedule or plan something.
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
  /** Short lead line — what the user gets in one phrase. Shown prominently. */
  gets: string
  /** Category of outcome — drives chip tone. */
  kind: SuggestionKind
  /** The actual prompt inserted/sent when the card is clicked. */
  prompt: string
}

// 18 tiles → full rows at 1 / 2 / 3 columns (divisible by 6).
export const SUGGESTIONS: Suggestion[] = [
  {
    id: 'what-can-you-do',
    group: 'start',
    icon: Sparkles,
    title: 'What can you do?',
    gets: 'short list · 3 examples',
    kind: 'answer',
    prompt:
      'In a few short bullet points, tell me what kinds of things you can help me with. Give me 3 simple examples I could try right now.',
  },
  {
    id: 'plan-tour',
    group: 'start',
    icon: GitBranch,
    title: 'Plan a quick tour',
    gets: 'plan · 3 steps',
    kind: 'action',
    prompt:
      'Make a small plan with three steps: 1) list the most useful things you can do, 2) list what tools are ready right now, 3) suggest one easy task I could try next. Then run the plan and show me what came out.',
  },
  {
    id: 'validate-json',
    group: 'start',
    icon: Terminal,
    title: 'Validate JSON',
    gets: 'valid or fix list',
    kind: 'answer',
    prompt:
      'Validate this JSON and list any issues: {"name":"demo","items":[{"id":1,"ok":true},{"id":2}]}. Say if it is valid; if not, what is wrong.',
  },
  {
    id: 'screenshot-site',
    group: 'web',
    icon: Eye,
    title: 'Screenshot a website',
    gets: 'png image',
    kind: 'image',
    prompt: 'Take a screenshot of the Hacker News homepage and send me the picture.',
  },
  {
    id: 'trending-repos',
    group: 'web',
    icon: Container,
    title: 'Trending repos this week',
    gets: 'table · 5 rows',
    kind: 'table',
    prompt:
      'Find the 5 most popular GitHub projects from the last 7 days and show them in a small table — name, what it does, star count, and a link.',
  },
  {
    id: 'readme-bullets',
    group: 'web',
    icon: FileText,
    title: 'README in 5 bullets',
    gets: 'bullets · one repo',
    kind: 'answer',
    prompt:
      'Open the README for https://github.com/golang/go on GitHub and give me five bullet takeaways — what it is, who it is for, and how to get started.',
  },
  {
    id: 'compare-landings',
    group: 'web',
    icon: Link2,
    title: 'Compare two sites',
    gets: 'two columns · bullets',
    kind: 'answer',
    prompt:
      'Compare the public landing pages of https://stripe.com and https://vercel.com: for each site, one line on what they sell and one line on the main call to action. Keep it tight.',
  },
  {
    id: 'weather-now',
    group: 'web',
    icon: Sun,
    title: 'Weather right now',
    gets: 'one paragraph',
    kind: 'answer',
    prompt:
      'What is the weather in Berlin right now? Use a public source if needed. Answer in one short paragraph — temp, conditions, and whether it looks rough for walking.',
  },
  {
    id: 'site-health',
    group: 'web',
    icon: Zap,
    title: 'Is this site healthy?',
    gets: 'health check · status + latency',
    kind: 'answer',
    prompt:
      'Check if github.com is up. Tell me how fast it responds, the status, and whether its security certificate looks fine. Keep it short.',
  },
  {
    id: 'bitcoin-chart',
    group: 'labs',
    icon: Gauge,
    title: 'Plot Bitcoin price',
    gets: 'line chart · png',
    kind: 'chart',
    prompt: 'Get the Bitcoin price for the last 30 days, draw a simple line chart, and send me the picture.',
  },
  {
    id: 'video-gif',
    group: 'labs',
    icon: Play,
    title: 'Video → GIF',
    gets: 'gif · first 5 seconds',
    kind: 'gif',
    prompt:
      'When I attach a short video, turn the first 5 seconds into a small GIF and send it back. Just say "ok" when you are ready.',
  },
  {
    id: 'rust-workspace',
    group: 'labs',
    icon: Wrench,
    title: 'Set up a Rust workspace',
    gets: 'running hello-world',
    kind: 'action',
    prompt:
      'I want to play with Rust. Set up a fresh environment with Rust and Cargo, then write and run a tiny hello-world program in it so I see it works.',
  },
  {
    id: 'text-from-image',
    group: 'labs',
    icon: Image,
    title: 'Text from a screenshot',
    gets: 'plain text · vision',
    kind: 'answer',
    prompt:
      'When I attach a screenshot that contains text (UI, terminal, or document), extract all readable text as plain UTF-8 and send it back. If nothing is attached yet, say you are ready.',
  },
  {
    id: 'dns-lookup',
    group: 'labs',
    icon: Cloud,
    title: 'DNS lookup',
    gets: 'records · tiny table',
    kind: 'table',
    prompt:
      'Resolve api.github.com: show the IPv4 A records (and CNAME if any) in a tiny table with hostname and value. Keep it read-only and safe.',
  },
  {
    id: 'daily-brief',
    group: 'auto',
    icon: Bell,
    title: 'Daily news brief',
    gets: 'recurring · mon–fri 09:00',
    kind: 'action',
    prompt:
      'Set up a daily reminder that runs every weekday morning around 9:00. It should grab the top 5 Hacker News stories, write a one-sentence summary for each, and send the digest to me. Save it and tell me when it will run next.',
  },
  {
    id: 'weekly-digest',
    group: 'auto',
    icon: Clock,
    title: 'Weekly digest',
    gets: 'recurring · monday 09:00',
    kind: 'action',
    prompt:
      'Create a weekly reminder every Monday at 9:00 that pulls the top 5 stories from Hacker News, one-sentence summary each, and sends me the digest. Save it and tell me the next run time.',
  },
  {
    id: 'security-scan',
    group: 'auto',
    icon: Shield,
    title: 'Quick security scan',
    gets: 'open ports · short table',
    kind: 'table',
    prompt:
      'Do a quick, friendly security scan of scanme.nmap.org (it is a public test target made for this). Show me which ports are open and what is listening, in a short table.',
  },
  {
    id: 'explain-error',
    group: 'auto',
    icon: AlertCircle,
    title: 'Decode an error',
    gets: 'cause · one fix',
    kind: 'answer',
    prompt:
      'Here is a log line: `Error: connect ECONNREFUSED 127.0.0.1:5432`. In plain English: what failed, and what should I check first?',
  },
]
