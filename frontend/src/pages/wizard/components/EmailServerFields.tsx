import { AppleField } from './apple/AppleField'
import { AppleListGroup } from './apple/AppleListGroup'
import { AppleSection } from './apple/AppleSection'

interface EmailServerFieldsProps {
  title: string
  hint?: string
  host: string
  port: string
  username: string
  password: string
  passwordKnown: boolean
  hostPlaceholder: string
  portPlaceholder: string
  usernamePlaceholder: string
  disabled: boolean
  onChangeHost: (v: string) => void
  onChangePort: (v: string) => void
  onChangeUsername: (v: string) => void
  onChangePassword: (v: string) => void
}

export function EmailServerFields({
  title,
  hint,
  host,
  port,
  username,
  password,
  passwordKnown,
  hostPlaceholder,
  portPlaceholder,
  usernamePlaceholder,
  disabled,
  onChangeHost,
  onChangePort,
  onChangeUsername,
  onChangePassword,
}: EmailServerFieldsProps) {
  return (
    <AppleSection title={title}>
      <AppleListGroup caption={hint}>
        <AppleField
          label="Host"
          value={host}
          onChange={e => onChangeHost(e.target.value)}
          placeholder={hostPlaceholder}
          monospace
          disabled={disabled}
          autoComplete="off"
        />
        <AppleField
          label="Port"
          value={port}
          onChange={e => onChangePort(e.target.value)}
          placeholder={portPlaceholder}
          monospace
          disabled={disabled}
          autoComplete="off"
          inputMode="numeric"
        />
        <AppleField
          label="Username"
          value={username}
          onChange={e => onChangeUsername(e.target.value)}
          placeholder={usernamePlaceholder}
          disabled={disabled}
          autoComplete="off"
        />
        <AppleField
          label="Password"
          type="password"
          value={password}
          onChange={e => onChangePassword(e.target.value)}
          placeholder={passwordKnown ? '•••••••• (saved)' : 'app password'}
          disabled={disabled}
          autoComplete="new-password"
        />
      </AppleListGroup>
    </AppleSection>
  )
}
