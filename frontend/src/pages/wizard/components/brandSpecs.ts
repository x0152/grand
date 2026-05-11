import type { BrandLogoSpec } from './brandLogo'

export const AI_PROVIDER_BRANDS: { id: string; name: string; spec: BrandLogoSpec }[] = [
  { id: 'openai', name: 'OpenAI', spec: { slug: 'openai', color: '412991' } },
  { id: 'anthropic', name: 'Anthropic', spec: { slug: 'anthropic', color: 'D4A27F' } },
  { id: 'google', name: 'Google', spec: { slug: 'googlegemini', color: '8E75B2' } },
  { id: 'mistral', name: 'Mistral', spec: { slug: 'mistralai', color: 'FA520F' } },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    spec: { slug: null, color: '6366F1', monogram: 'OR' },
  },
  { id: 'groq', name: 'Groq', spec: { slug: null, color: 'F55036', monogram: 'Gq' } },
  {
    id: 'together',
    name: 'Together',
    spec: { slug: null, color: '0F6FFF', monogram: 'Tg' },
  },
  { id: 'ollama', name: 'Ollama (local)', spec: { slug: 'ollama', color: '000000' } },
]

export const EMAIL_PROVIDER_BRANDS: Record<string, BrandLogoSpec> = {
  gmail: { slug: 'gmail', color: 'EA4335' },
  yandex: { slug: 'yandex', color: 'FF0000' },
  icloud: { slug: 'icloud', color: '3693F3' },
  outlook: { slug: 'microsoftoutlook', color: '0078D4' },
  custom: { slug: null, color: '94A3B8', monogram: '@' },
}

export const TELEGRAM_BRAND: BrandLogoSpec = { slug: 'telegram', color: '26A5E4' }
export const GONKA_BRAND: BrandLogoSpec = { slug: null, color: '10B981', monogram: 'Gk' }
