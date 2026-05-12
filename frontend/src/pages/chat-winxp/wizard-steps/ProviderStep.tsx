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
          tagline="Decentralized · Pay-per-token · Crypto"
          description="Decentralized AI inference network — independent GPU hosts serve open models, you pay a tiny fee per request from your wallet. No company in the middle, no subscription."
          bullets={[
            'Under $0.001 per 1M tokens on Kimi K2.6 — and other open models',
            'No subscription, no credit card — pay per request',
            "You'll need a crypto wallet with a small GNK balance on it",
          ]}
          disabled={gonkaUnavailable}
          badge={gonkaUnavailable ? 'unavailable' : undefined}
        />
      </div>
    </div>
  )
}
