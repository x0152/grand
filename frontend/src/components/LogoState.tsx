import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api'
import type { MantisLogoState } from './MantisLogo'

interface LogoStateContextValue {
  state: MantisLogoState
  setState: (state: MantisLogoState) => void
}

const LogoStateContext = createContext<LogoStateContextValue>({
  state: 'idle',
  setState: () => {},
})

const SESSIONS_POLL_MS = 4000

export function LogoStateProvider({ children }: { children: ReactNode }) {
  const [localState, setLocalState] = useState<MantisLogoState>('idle')
  const [anyActive, setAnyActive] = useState(false)

  const setState = useCallback((next: MantisLogoState) => {
    setLocalState(prev => (prev === next ? prev : next))
  }, [])

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const list = await api.chat.listSessions({ limit: 100, offset: 0 })
        if (cancelled) return
        setAnyActive(list.some(s => s.active))
      } catch {}
    }
    void tick()
    const id = setInterval(tick, SESSIONS_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const state = useMemo<MantisLogoState>(() => {
    if (localState !== 'idle') return localState
    if (anyActive) return 'working'
    return 'idle'
  }, [localState, anyActive])

  const value = useMemo(() => ({ state, setState }), [state, setState])
  return <LogoStateContext.Provider value={value}>{children}</LogoStateContext.Provider>
}

export function useLogoState() {
  return useContext(LogoStateContext)
}
