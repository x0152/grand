import { useCallback, useEffect, useRef, useState } from 'react'

/** Web Speech API — keep local types so we do not depend on dom lib shipping every event name. */
type SRResult = { isFinal: boolean; 0: { transcript: string } }
type SRResultList = { length: number; [i: number]: SRResult }
type SREvent = { resultIndex: number; results: SRResultList }
type SRErrorEvent = { error: string }

type RecognitionCtor = new () => {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: SRErrorEvent) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & { webkitSpeechRecognition?: RecognitionCtor; SpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isBrowserSpeechToTextSupported(): boolean {
  return getSpeechRecognitionCtor() !== null
}

function joinText(a: string, b: string): string {
  if (!b) return a
  if (!a) return b
  if (/\s$/.test(a) || /^\s/.test(b)) return a + b
  return `${a} ${b}`
}

/**
 * Live dictation: interim results stream into the field as you speak; finals stay committed.
 * Uses the browser speech engine (Chrome / Edge / Safari). `lang` follows `navigator.language`.
 */
export function useBrowserSpeechToText(getInput: () => string, setInput: (value: string) => void) {
  const [supported] = useState(isBrowserSpeechToTextSupported)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<InstanceType<RecognitionCtor> | null>(null)
  /** Text that was in the field when this dictation session started. */
  const snapshotRef = useRef('')
  /** Final transcript accumulated during this session (after snapshot). */
  const committedRef = useRef('')

  const stop = useCallback(() => {
    recRef.current?.stop()
    recRef.current = null
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return
    setError(null)
    snapshotRef.current = getInput()
    committedRef.current = ''

    const r = new Ctor()
    r.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US'
    r.continuous = true
    r.interimResults = true

    r.onresult = (e: SREvent) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (!res.isFinal) continue
        const piece = res[0]?.transcript ?? ''
        if (piece) committedRef.current = joinText(committedRef.current, piece)
      }

      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (!e.results[i].isFinal) interim += e.results[i][0]?.transcript ?? ''
      }

      const withCommitted = joinText(snapshotRef.current, committedRef.current)
      const full = joinText(withCommitted, interim)
      setInput(full)
    }

    r.onerror = (ev: SRErrorEvent) => {
      if (ev.error === 'aborted' || ev.error === 'no-speech') return
      if (ev.error === 'not-allowed') setError('Microphone access denied — allow the site in browser settings.')
      else if (ev.error === 'not-found') setError('No microphone found.')
      else if (ev.error === 'network') setError('Speech recognition needs a network connection in this browser.')
      else setError(`Voice: ${ev.error}`)
    }
    r.onend = () => {
      setListening(false)
      recRef.current = null
    }
    recRef.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      setError('Could not start voice input.')
    }
  }, [getInput, setInput])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  useEffect(() => () => recRef.current?.stop(), [])

  return { supported, listening, error, clearError: () => setError(null), toggle, stop }
}
