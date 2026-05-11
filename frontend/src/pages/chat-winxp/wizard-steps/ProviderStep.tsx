import { XpTile } from './shared'
import type { WizardController } from './useWizardController'

interface Props {
  ctrl: WizardController
}

export function ProviderStep({ ctrl }: Props) {
  if (!ctrl.state) return null
  const provider = ctrl.state.provider
  const gonkaUnavailable = ctrl.gonkaConfig != null && !ctrl.gonkaConfig.inferencedAvailable

  return (
    <div className="xp-wizard-step">
      <p className="xp-wizard-prose">
        Where should GRAND send your messages? Pick the option that fits — you can change it later
        in Setup.
      </p>
      <div className="xp-wizard-grid-2">
        <XpTile
          name="provider"
          selected={provider === 'openai'}
          onSelect={() => ctrl.onProviderSelect('openai')}
          title="Bring your own AI"
          tagline="OpenAI · OpenRouter · Ollama · LM Studio"
          description="Connect to any OpenAI-compatible provider — paid cloud service or a local LLM on your machine."
          bullets={[
            'Bring an API key, or run locally with no key',
            'Pick exactly which models to use',
            'Pay your provider directly — no middleman',
          ]}
        />
        <XpTile
          name="provider"
          selected={provider === 'gonka'}
          onSelect={() => ctrl.onProviderSelect('gonka')}
          title="Gonka network"
          tagline="Pay-per-call · No subscription · Crypto"
          description="Decentralized marketplace of AI providers. Top up your wallet once and chat — no monthly bill."
          bullets={[
            'One wallet routes to many providers automatically',
            'No subscription, no credit card',
            'Top up with a small amount of GNK and you are set',
          ]}
          disabled={gonkaUnavailable}
          badge={gonkaUnavailable ? 'unavailable' : undefined}
        />
      </div>
    </div>
  )
}
