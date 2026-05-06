import { useState, useEffect, useCallback } from 'react'
import { ScrollText, Sparkles, ShieldAlert, Wrench, GitBranch, LogOut, Container, Wand2, Github, ExternalLink } from '@/lib/icons'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import LlmPage from './pages/LlmPage'
import HostsPage from './pages/HostsPage'
import ChannelsPage from './pages/ChannelsPage'
import ChatPage from './pages/ChatPage'
import LogsPage from './pages/LogsPage'
import GuardProfilesPage from './pages/GuardProfilesPage'
import SkillsPage from './pages/SkillsPage'
import PlansPage from './pages/PlansPage'
import SetupWizard from './pages/SetupWizard'
import SetupPage from './pages/SetupPage'
import { deriveStatus } from './pages/wizard/status'
import LoginPage from './pages/LoginPage'
import ChatSidebar from './components/ChatSidebar'
import { BrandLogo, BRAND_NAME, BRAND_TAGLINE } from './components/Brand'
import { LogoStateProvider, useLogoState } from './components/LogoState'
import { ModeToggle } from './components/mode-toggle'
import { api, setUnauthorizedHandler, UnauthorizedError } from './api'
import { parseRoute, navigate, type PageId, type Route } from './router'
import type { ChatSession, User } from './types'

type NavItem = { id: PageId; label: string; icon: typeof Sparkles }
type NavSection = { title: string; items: NavItem[] }
const REPO_URL = 'https://github.com/x0152/grand'

const nav: NavSection[] = [
  {
    title: 'Activity',
    items: [
      { id: 'plans', label: 'Plans', icon: GitBranch },
      { id: 'logs', label: 'Logs', icon: ScrollText },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { id: 'llm', label: 'AI Engine', icon: Sparkles },
      { id: 'hosts', label: 'Hosts', icon: Container },
      { id: 'skills', label: 'Skills', icon: Wrench },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'guard-profiles', label: 'Guard Profiles', icon: ShieldAlert },
      { id: 'setup', label: 'Setup', icon: Wand2 },
    ],
  },
]

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute)
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  /** Bumped after New chat so the sidebar list scrolls up to the selected session. */
  const [chatListScrollNonce, setChatListScrollNonce] = useState(0)

  useEffect(() => {
    const sync = () => setRoute(parseRoute())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setNeedsSetup(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    api.auth.me()
      .then(u => setUser(u))
      .catch(err => {
        if (!(err instanceof UnauthorizedError)) console.error(err)
        setUser(null)
      })
      .finally(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    if (!user) return
    api.config.get()
      .then(cfg => setNeedsSetup(!deriveStatus(cfg).done))
      .catch(() => setNeedsSetup(false))
  }, [user])

  useEffect(() => {
    if (route.page === 'chat' && 'sessionId' in route && route.sessionId) {
      setActiveSessionId(route.sessionId)
    }
  }, [route])

  useEffect(() => {
    if (needsSetup === false && !activeSessionId) {
      api.chat
        .listSessions({ limit: 100, offset: 0 })
        .then(async list => {
          const regular = list.filter(s => s.source !== 'plan')
          const session = regular.length > 0 ? regular[0] : await api.chat.createSession()
          setActiveSessionId(session.id)
          setSidebarRefreshKey(k => k + 1)
          if (route.page === 'chat') navigate({ page: 'chat', sessionId: session.id })
        })
        .catch(() => {})
    }
  }, [needsSetup, activeSessionId, route.page])

  const handleSelectSession = useCallback((session: ChatSession) => {
    setActiveSessionId(session.id)
    navigate({ page: 'chat', sessionId: session.id })
  }, [])

  const handleNewChat = useCallback(async () => {
    try {
      const list = await api.chat.listSessions({ limit: 100, offset: 0 })
      const regular = list.filter(s => s.source !== 'plan')
      // Sessions are newest-first; reuse the latest if it is still empty (no messages).
      if (regular.length > 0) {
        const newest = regular[0]
        const msgs = await api.chat.listMessages({ sessionId: newest.id, limit: 1, offset: 0 })
        if (msgs.length === 0) {
          setActiveSessionId(newest.id)
          navigate({ page: 'chat', sessionId: newest.id })
          setSidebarRefreshKey(k => k + 1)
          setChatListScrollNonce(n => n + 1)
          return
        }
      }
      const session = await api.chat.createSession()
      setActiveSessionId(session.id)
      navigate({ page: 'chat', sessionId: session.id })
      setSidebarRefreshKey(k => k + 1)
      setChatListScrollNonce(n => n + 1)
    } catch {}
  }, [])

  const handleFirstMessage = useCallback(() => {
    setSidebarRefreshKey(k => k + 1)
  }, [])

  const goTo = useCallback((page: PageId) => {
    navigate({ page } as Route)
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await api.auth.logout()
    } catch {}
    setUser(null)
    setNeedsSetup(null)
  }, [])

  if (!authChecked) return null
  if (!user) return <LoginPage onLogin={setUser} />
  if (needsSetup === null) return null
  if (needsSetup) return <SetupWizard mode="full" onDone={() => setNeedsSetup(false)} />

  const renderNav = (items: NavItem[]) => items.map(item => (
    <button
      key={item.id}
      onClick={() => goTo(item.id)}
      data-active={route.page === item.id}
      className="nav-row"
    >
      <item.icon size={14} strokeWidth={1.5} className="opacity-80" />
      <span className="truncate" title={item.label}>{item.label}</span>
    </button>
  ))

  const renderSectionLabel = (title: string) => (
    <div className="kicker px-4 pt-3 pb-1.5">
      <span>{title}</span>
    </div>
  )

  const planId = route.page === 'plans' && 'planId' in route ? route.planId : undefined

  return (
    <LogoStateProvider>
    <div className="flex h-screen bg-[var(--grand-bg)] text-[var(--grand-fg)] transition-colors">
      <aside className="w-64 bg-[var(--grand-surface)] border-r border-[var(--grand-border)] flex flex-col shrink-0 min-w-0 overflow-hidden">
        <div className="px-4 py-4 flex justify-between items-center gap-2 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <SidebarLogo />
            <div className="leading-tight min-w-0">
              <h1 className="text-[17px] font-semibold tracking-tight text-[var(--grand-fg)] truncate">{BRAND_NAME}</h1>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--grand-muted)] mt-0.5 truncate">{BRAND_TAGLINE}</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <ModeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title={user ? `Sign out ${user.name}` : 'Sign out'}
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
              <span className="sr-only">Sign out</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ChatSidebar
              activeSessionId={activeSessionId}
              onSelect={handleSelectSession}
              onNew={handleNewChat}
              refreshKey={sidebarRefreshKey}
              scrollChatsListTopKey={chatListScrollNonce}
            />
          </div>

          <div className="mx-2 shrink-0 border-t border-[var(--grand-border)]" aria-hidden />

          <div className="shrink-0 py-1 overflow-auto">
            {nav.map(s => (
              <div key={s.title}>
                {renderSectionLabel(s.title)}
                <div>
                  {renderNav(s.items)}
                </div>
              </div>
            ))}
            <div className="px-3 pb-3 pt-2">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                title="View source on GitHub"
                className="group flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-[var(--grand-border)] bg-[var(--grand-surface)] text-[12px] text-[var(--grand-muted)] hover:border-emerald-400/60 hover:bg-emerald-500/5 hover:text-[var(--grand-fg)] transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Github size={14} weight="fill" className="shrink-0 opacity-90 group-hover:text-emerald-400" />
                  <span className="font-mono uppercase tracking-[0.14em] text-[10.5px] truncate">View on GitHub</span>
                </span>
                <ExternalLink size={11} className="shrink-0 opacity-60 group-hover:opacity-100" />
              </a>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto bg-[var(--grand-bg)]">
        {route.page === 'chat' && <ChatPage sessionId={activeSessionId ?? ''} onFirstMessage={handleFirstMessage} />}
        {route.page === 'channels' && <ChannelsPage />}
        {route.page === 'llm' && <LlmPage />}
        {route.page === 'hosts' && <HostsPage />}
        {route.page === 'skills' && <SkillsPage />}
        {route.page === 'plans' && <PlansPage deepPlanId={planId} key={planId ?? '_'} />}
        {route.page === 'logs' && <LogsPage />}
        {route.page === 'guard-profiles' && <GuardProfilesPage />}
        {route.page === 'setup' && <SetupPage />}
      </main>
      <Toaster />
    </div>
    </LogoStateProvider>
  )
}

function SidebarLogo() {
  const { state } = useLogoState()
  return <BrandLogo size={32} state={state} className="shrink-0" />
}
