import { useState, type FormEvent } from 'react'
import { api, UnauthorizedError } from '../api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { FormField } from '@/components/FormField'
import { BrandLogo, BRAND_NAME, BRAND_TAGLINE } from '@/components/Brand'
import type { User } from '../types'

export default function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return
    setLoading(true)
    setError('')
    try {
      const user = await api.auth.login(token.trim())
      onLogin(user)
    } catch (err) {
      if (err instanceof UnauthorizedError) setError('Invalid token')
      else setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--grand-bg)] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <BrandLogo size={44} />
          <div className="leading-tight">
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--grand-fg)]">{BRAND_NAME}</h1>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--grand-muted)] mt-1">{BRAND_TAGLINE}</p>
          </div>
        </div>

        <Card className="bg-[var(--grand-surface)] p-7 border-0 shadow-none">
          <div className="kicker mb-5">
            <span>auth</span>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <FormField label="Access token">
              <Input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="your token"
                autoFocus
              />
            </FormField>

            {error && <p className="font-mono text-[12px] text-rose-500">{error}</p>}

            <Button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full h-10"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
