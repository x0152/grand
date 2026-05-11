import type { ChangeEvent, ReactNode } from 'react'

export function XpField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  monospace = false,
  disabled = false,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'password' | 'email'
  monospace?: boolean
  disabled?: boolean
  hint?: ReactNode
}) {
  return (
    <label className="xp-wizard-field">
      <span className="xp-wizard-field-label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className={`xp-wizard-input ${monospace ? 'xp-wizard-input-mono' : ''}`}
      />
      {hint && <span className="xp-wizard-help">{hint}</span>}
    </label>
  )
}

export function XpTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled = false,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  hint?: ReactNode
}) {
  return (
    <label className="xp-wizard-field">
      <span className="xp-wizard-field-label">{label}</span>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className="xp-wizard-input xp-wizard-textarea xp-wizard-input-mono"
      />
      {hint && <span className="xp-wizard-help">{hint}</span>}
    </label>
  )
}

export function XpRadioRow({
  name,
  checked,
  onChange,
  label,
  disabled = false,
}: {
  name: string
  checked: boolean
  onChange: () => void
  label: ReactNode
  disabled?: boolean
}) {
  return (
    <label className={`xp-wizard-radio-row ${disabled ? 'is-disabled' : ''}`}>
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  )
}

export function XpCheckRow({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onChange: () => void
  label: ReactNode
  disabled?: boolean
}) {
  return (
    <label className={`xp-wizard-check-row ${disabled ? 'is-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  )
}

export function XpTile({
  name,
  selected,
  onSelect,
  title,
  tagline,
  description,
  bullets,
  disabled = false,
  badge,
}: {
  name: string
  selected: boolean
  onSelect: () => void
  title: string
  tagline?: string
  description?: ReactNode
  bullets?: ReactNode[]
  disabled?: boolean
  badge?: string
}) {
  return (
    <label
      className={`xp-wizard-tile ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}
    >
      <span className="xp-wizard-tile-head">
        <input
          type="radio"
          name={name}
          checked={selected}
          onChange={onSelect}
          disabled={disabled}
        />
        <span className="xp-wizard-tile-title">{title}</span>
        {badge && <span className="xp-wizard-tile-badge">{badge}</span>}
      </span>
      {tagline && <span className="xp-wizard-tile-tagline">{tagline}</span>}
      {description && <span className="xp-wizard-tile-desc">{description}</span>}
      {bullets && bullets.length > 0 && (
        <ul className="xp-wizard-tile-bullets">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
    </label>
  )
}

export function XpSection({
  title,
  children,
  hint,
  actions,
}: {
  title?: ReactNode
  children: ReactNode
  hint?: ReactNode
  actions?: ReactNode
}) {
  return (
    <fieldset className="xp-wizard-section">
      {title && (
        <legend className="xp-wizard-section-title">
          {title}
          {actions && <span className="xp-wizard-section-actions">{actions}</span>}
        </legend>
      )}
      <div className="xp-wizard-section-body">{children}</div>
      {hint && <p className="xp-wizard-help xp-wizard-help-block">{hint}</p>}
    </fieldset>
  )
}

export function XpButton({
  children,
  onClick,
  disabled = false,
  primary = false,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  primary?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      className={`xp-wizard-inline-btn ${primary ? 'xp-wizard-inline-btn-primary' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function XpStatusLine({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'ok' | 'warn' | 'error'
  children: ReactNode
}) {
  return <p className={`xp-wizard-status xp-wizard-status-${tone}`}>{children}</p>
}
