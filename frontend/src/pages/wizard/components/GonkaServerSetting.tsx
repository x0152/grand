import { useState } from 'react'
import { AppleField } from './apple/AppleField'
import { AppleListGroup } from './apple/AppleListGroup'

interface GonkaServerSettingProps {
  nodeUrl: string
  onChange: (v: string) => void
}

export function GonkaServerSetting({ nodeUrl, onChange }: GonkaServerSettingProps) {
  const [expanded, setExpanded] = useState(false)
  const display = nodeUrl || 'default'

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="block w-full text-center text-[13px] text-[var(--grand-muted)] hover:text-[var(--grand-fg)] transition-colors"
      >
        Server: <span className="font-mono text-[var(--grand-fg-2)]">{display}</span>
        <span className="ml-2 text-emerald-600 dark:text-emerald-400">change</span>
      </button>
    )
  }

  return (
    <AppleListGroup caption="Where GRAND sends your AI requests. The default works for most people.">
      <AppleField
        label="Gonka server"
        value={nodeUrl}
        onChange={e => onChange(e.target.value)}
        placeholder="https://node4.gonka.ai"
        monospace
        autoComplete="off"
      />
    </AppleListGroup>
  )
}
