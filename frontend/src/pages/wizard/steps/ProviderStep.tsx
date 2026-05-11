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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
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
          tagline="Pay-per-call · No subscription · Crypto"
          description="Decentralized marketplace of AI providers. Top up your wallet once and chat — no monthly bill."
          bullets={[
            'One wallet routes to many providers automatically',
            'No subscription, no credit card',
            'Top up with a small amount of GNK and you are set',
          ]}
          hint="Best if you’re not already paying for AI and don’t mind a one-minute wallet setup."
          selected={provider === 'gonka'}
          disabled={gonkaUnavailable}
          badge={gonkaUnavailable ? { label: 'unavailable here', tone: 'amber' } : undefined}
          onClick={() => onSelect('gonka')}
        />
      </div>
    </div>
  )
}
