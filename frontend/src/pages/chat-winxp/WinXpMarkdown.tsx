import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

interface Props {
  content: string
}

/**
 * Markdown renderer for the experimental XP chat. Mirrors the structure
 * of `components/Markdown.tsx` but swaps every Tailwind/dark-theme class
 * for an XP-flavoured one driven by `winxp.css`.
 *
 * We do NOT reuse the regular `Markdown` because that file references
 * `var(--grand-*)` colors which are dark-theme CSS variables and would
 * make the chat unreadable inside an XP window. Stripping `<think>`
 * blocks is also intentionally skipped — Clippy doesn't show its
 * thinking notes in this experimental view.
 */
export function WinXpMarkdown({ content }: Props) {
  if (!content) return null
  return (
    <div className="xp-md">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p: ({ children }) => <p className="xp-md-p">{children}</p>,
          a: ({ href, children }) => (
            <a
              href={href ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="xp-md-link"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="xp-md-b">{children}</strong>,
          em: ({ children }) => <em className="xp-md-i">{children}</em>,
          del: ({ children }) => <del className="xp-md-s">{children}</del>,
          h1: ({ children }) => <h1 className="xp-md-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="xp-md-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="xp-md-h3">{children}</h3>,
          h4: ({ children }) => <h4 className="xp-md-h4">{children}</h4>,
          h5: ({ children }) => <h5 className="xp-md-h4">{children}</h5>,
          h6: ({ children }) => <h6 className="xp-md-h4">{children}</h6>,
          ul: ({ children }) => <ul className="xp-md-ul">{children}</ul>,
          ol: ({ children }) => <ol className="xp-md-ol">{children}</ol>,
          li: ({ children }) => <li className="xp-md-li">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="xp-md-quote">{children}</blockquote>
          ),
          hr: () => <hr className="xp-md-hr" />,
          code: ({ className, children, ...props }) => {
            // The same component renders both inline `code` and the inner
            // <code> of a fenced block. react-markdown wraps fenced code
            // in <pre>, so the parent will already provide the block frame.
            const isInline = !className?.includes('language-')
            const text = String(children).replace(/\n$/, '')
            if (isInline) {
              return (
                <code className="xp-md-code-inline" {...props}>
                  {text}
                </code>
              )
            }
            return (
              <code className={`xp-md-code-block ${className ?? ''}`} {...props}>
                {text}
              </code>
            )
          },
          pre: ({ children }) => <pre className="xp-md-pre">{children}</pre>,
          table: ({ children }) => (
            <div className="xp-md-table-wrap">
              <table className="xp-md-table">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => <th className="xp-md-th">{children}</th>,
          td: ({ children }) => <td className="xp-md-td">{children}</td>,
          img: ({ src, alt }) => (
            <img src={src ?? ''} alt={alt ?? ''} className="xp-md-img" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
