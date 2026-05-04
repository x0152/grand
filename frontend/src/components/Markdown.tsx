import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { ThinkingBlock } from './ThinkingBlock'
import {
  AttachmentBadgeRow,
  hasAttachmentTags,
  parseAttachmentBlocks,
} from './AttachmentTag'

type Segment =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string; streaming: boolean }

function splitThinking(input: string): Segment[] {
  const segments: Segment[] = []
  let rest = input
  while (rest.length > 0) {
    const open = rest.indexOf('<think>')
    if (open < 0) {
      segments.push({ type: 'text', content: rest })
      break
    }
    if (open > 0) {
      segments.push({ type: 'text', content: rest.slice(0, open) })
    }
    const afterOpen = rest.slice(open + 7)
    const close = afterOpen.indexOf('</think>')
    if (close < 0) {
      segments.push({ type: 'thinking', content: afterOpen, streaming: true })
      break
    }
    segments.push({ type: 'thinking', content: afterOpen.slice(0, close), streaming: false })
    rest = afterOpen.slice(close + 8)
  }
  return segments
}

export function Markdown({
  content,
  sessionId,
}: {
  content: string
  sessionId?: string
}) {
  if (!content) return null

  const segments = splitThinking(content)

  return (
    <div className="markdown text-[15px] leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.type === 'thinking') {
          return <ThinkingBlock key={i} content={seg.content} streaming={seg.streaming} />
        }
        if (!seg.content) return null
        return <MarkdownTextSegment key={i} content={seg.content} sessionId={sessionId} />
      })}
    </div>
  )
}

function MarkdownTextSegment({
  content,
  sessionId,
}: {
  content: string
  sessionId?: string
}) {
  if (!sessionId || !hasAttachmentTags(content)) {
    return <MarkdownSegment content={content} />
  }
  const blocks = parseAttachmentBlocks(content)
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'text') {
          return <MarkdownSegment key={i} content={block.text} />
        }
        return (
          <div key={i} className="my-1.5">
            <AttachmentBadgeRow items={block.items} sessionId={sessionId} variant="message" />
          </div>
        )
      })}
    </>
  )
}

function MarkdownSegment({ content }: { content: string }) {
  return (
    <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p: ({ children }) => <p className="m-0 mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,

          a: ({ href, children }) => (
            <a
              href={href ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
            >
              {children}
            </a>
          ),

          strong: ({ children }) => <strong className="font-semibold text-[var(--grand-fg)]">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => <del className="line-through">{children}</del>,

          h1: ({ children }) => <h1 className="m-0 mt-3 mb-2 text-lg font-bold text-[var(--grand-fg)]">{children}</h1>,
          h2: ({ children }) => <h2 className="m-0 mt-3 mb-2 text-base font-bold text-[var(--grand-fg)]">{children}</h2>,
          h3: ({ children }) => <h3 className="m-0 mt-3 mb-2 text-sm font-semibold text-[var(--grand-fg-2)]">{children}</h3>,
          h4: ({ children }) => <h4 className="m-0 mt-3 mb-2 text-sm font-semibold text-[var(--grand-fg-2)]">{children}</h4>,
          h5: ({ children }) => <h5 className="m-0 mt-3 mb-2 text-sm font-semibold text-[var(--grand-fg-2)]">{children}</h5>,
          h6: ({ children }) => <h6 className="m-0 mt-3 mb-2 text-sm font-semibold text-[var(--grand-fg-2)]">{children}</h6>,

          ul: ({ children }) => <ul className="m-0 mb-2 last:mb-0 pl-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="m-0 mb-2 last:mb-0 pl-5 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="m-0">{children}</li>,

          blockquote: ({ children }) => (
            <blockquote className="m-0 mb-2 last:mb-0 pl-3 border-l-2 border-emerald-400/40 text-[var(--grand-muted)] italic">
              {children}
            </blockquote>
          ),

          hr: () => <hr className="my-3 border-[var(--grand-border)]" />,

          code: ({ className, children, ...props }) => {
            const code = String(children).replace(/\n$/, '')
            return (
              <code className={`font-mono ${className ?? ''}`} {...props}>
                {code}
              </code>
            )
          },

          pre: ({ children }) => (
            <pre className="m-0 mb-2 last:mb-0 bg-[var(--grand-bg)] text-[var(--grand-fg-2)] rounded-md p-3 overflow-auto border border-[var(--grand-border)]">
              {children}
            </pre>
          ),

          table: ({ children }) => (
            <div className="mb-2 last:mb-0 overflow-auto rounded-md border border-[var(--grand-border)]">
              <table className="w-full text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[var(--grand-surface-2)]">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 border-b border-[var(--grand-border)] font-semibold text-[var(--grand-fg-2)]">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 border-b border-[var(--grand-border-2)] align-top text-[var(--grand-fg-2)]">{children}</td>,

          img: ({ src, alt }) => (
            <img src={src ?? ''} alt={alt ?? ''} className="max-w-full rounded-md border border-[var(--grand-border)]" />
          ),
        }}
    >
      {content}
    </ReactMarkdown>
  )
}
