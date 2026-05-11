import {
  SUGGESTIONS,
  SUGGESTION_GROUP_META,
  SUGGESTION_GROUP_ORDER,
} from '../chat/suggestions'

interface Props {
  disabled?: boolean
  onInsert: (prompt: string) => void
  onSend: (prompt: string) => void
}

/**
 * Empty-chat starter prompts, but skinned for the XP experiment. Reuses the
 * same `SUGGESTIONS` data + group metadata as the regular chat so the two
 * UIs stay in sync — when the team adds a new prompt it just appears here.
 *
 * Interaction matches the regular UI:
 *   • single click → load prompt into composer (no send)
 *   • double click → send immediately
 *
 * Visually: each prompt is a Windows 9x-style "panel button" (raised
 * 1px white/gray bevel) with a Lucide icon. Groups are stacked with a
 * small caption header — like the section labels in XP control panel.
 */
export function WinXpSuggestions({ disabled, onInsert, onSend }: Props) {
  return (
    <div className="xp-suggest" aria-hidden={disabled || undefined}>
      <div className="xp-suggest-hero">
        <img src="/winxp/clippy-idle.png" alt="" width={56} height={70} />
        <div>
          <div className="xp-suggest-title">It looks like you're starting a new chat!</div>
          <div className="xp-suggest-sub">
            Pick a starter — single click loads it into the box, double click sends.
          </div>
        </div>
      </div>

      {SUGGESTION_GROUP_ORDER.map(groupId => {
        const tiles = SUGGESTIONS.filter(s => s.group === groupId)
        if (tiles.length === 0) return null
        const meta = SUGGESTION_GROUP_META[groupId]
        return (
          <section key={groupId} className="xp-suggest-section">
            <header className="xp-suggest-section-head">
              <h4>{meta.title}</h4>
              <p>{meta.subtitle}</p>
            </header>
            <div className="xp-suggest-grid">
              {tiles.map(s => {
                const Icon = s.icon
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="xp-suggest-tile"
                    title={`${s.prompt}\n\nClick to insert · double-click to send`}
                    disabled={disabled}
                    onClick={() => onInsert(s.prompt)}
                    onDoubleClick={() => onSend(s.prompt)}
                  >
                    <span className="xp-suggest-icon" aria-hidden>
                      <Icon size={18} strokeWidth={1.6} />
                    </span>
                    <span className="xp-suggest-body">
                      <span className="xp-suggest-tile-title">{s.title}</span>
                      <span className="xp-suggest-gets">→ {s.gets}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
