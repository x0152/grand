import type { State } from './types'

export function formatGnk(v: number): string {
  if (v >= 1000) return v.toFixed(0)
  if (v >= 1) return v.toFixed(2)
  if (v > 0) return v.toFixed(4)
  return '0'
}

export const isValidPrivateKey = (raw: string): boolean => {
  const trimmed = raw.trim().replace(/^0x/i, '')
  return /^[0-9a-fA-F]{64}$/.test(trimmed)
}

export function telegramSummary(state: State): string {
  if (state.tgSkip) return 'off — connect later via env'
  if (state.tgLinkedUser) {
    const name = state.tgLinkedUser.name || state.tgLinkedUser.username || String(state.tgLinkedUser.id)
    return `linked · ${name}`
  }
  if (state.tgToken.trim() || state.tgTokenKnown) return 'token saved · pending link'
  return 'off — connect later via env'
}
