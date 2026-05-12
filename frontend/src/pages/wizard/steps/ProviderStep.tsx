import { Plug, Wallet } from '@/lib/icons'
import type { GonkaConfig } from '@/types'
import { AppleForkCard } from '../components/apple/AppleForkCard'
import { StepHero } from '../components/StepHero'
import type { Provider } from '../types'

interface ProviderStepProps {
  provider: Provider | null
  gonkaConfig: GonkaConfig | null
  onSelect: (p: Provider) => void
}

export function ProviderStep({ provider, gonkaConfig, onSelect }: ProviderStepProps) {
  const gonkaUnavailable = gonkaConfig != null && !gonkaConfig.inferencedAvailable
  return (
    <div className="space-y-10">
      <StepHero stepId="provider" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <AppleForkCard
          icon={Plug}
          title="Bring your own AI"
          tagline="OpenAI · OpenRouter · Ollama · LM Studio · …"
          description="Connect to any OpenAI-compatible provider — paid cloud service or a local LLM running on your own machine."
          bullets={[
            'Bring an API key, or run locally with no key',
            'Pick exactly which models to use',
            'Pay your provider directly — no middleman',
          ]}
          hint="Best if you already pay for AI, or run Ollama / LM Studio at home."
          selected={provider === 'openai'}
          onClick={() => onSelect('openai')}
        />

        <AppleForkCard
          icon={Wallet}
          title="Gonka network"
          tagline="Decentralized · Pay-per-token · Crypto"
          description="Decentralized AI inference network — independent GPU hosts serve open models, and you pay a tiny fee per request straight from your wallet. No company in the middle, no subscription."
          bullets={[
            'Under $0.001 per 1M tokens on Kimi K2.6 — and other open models',
            'No subscription, no credit card — pay per request',
            'You’ll need a crypto wallet with a small GNK balance on it',
          ]}
          hint="Best if you’re comfortable with a one-minute crypto setup and want the cheapest open-model inference around."
          selected={provider === 'gonka'}
          disabled={gonkaUnavailable}
          badge={gonkaUnavailable ? { label: 'unavailable here', tone: 'amber' } : undefined}
          onClick={() => onSelect('gonka')}
        />
      </div>
    </div>
  )
}
