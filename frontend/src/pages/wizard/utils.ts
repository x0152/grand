import type { MouseEvent } from 'react'
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

const MNEMONIC_LENGTHS = new Set([12, 15, 18, 21, 24])

export function normalizeMnemonic(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

export const isValidMnemonic = (raw: string): boolean => {
  const normalized = normalizeMnemonic(raw)
  if (!normalized) return false
  if (!/^[a-z ]+$/.test(normalized)) return false
  return MNEMONIC_LENGTHS.has(normalized.split(' ').length)
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

export function openExternal(url: string) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (e.button !== 0) return
    e.preventDefault()
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export function emailSummary(state: State): string {
  if (state.emailSkip) return 'off — connect later via env'
  const addr = state.emailAddress.trim()
  const hasSecret =
    state.emailSmtpPasswordKnown || state.emailImapPasswordKnown ||
    state.emailSmtpPassword.trim() !== '' || state.emailImapPassword.trim() !== ''
  if (addr && hasSecret) return `linked · ${addr}`
  if (addr) return `${addr} · pending password`
  return 'off — connect later via env'
}
