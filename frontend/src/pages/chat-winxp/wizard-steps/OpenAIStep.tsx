import { XpField, XpSection, XpStatusLine } from './shared'
import { ModelEditor } from './ModelEditor'
import type { WizardController } from './useWizardController'

interface Props {
  ctrl: WizardController
}

export function OpenAIStep({ ctrl }: Props) {
  if (!ctrl.state) return null
  const s = ctrl.state

  return (
    <div className="xp-wizard-step">
      <p className="xp-wizard-prose">
        Tell GRAND where to send your messages and which models to use.
      </p>

      <XpSection
        title="Endpoint"
        hint={
          <>
            Use <code>https://api.openai.com/v1</code> for OpenAI, your provider's OpenAI-compatible
            URL, or <code>http://localhost:11434/v1</code> for Ollama.
          </>
        }
      >
        <XpField
          label="Server URL"
          value={s.openaiBaseUrl}
          onChange={v => ctrl.update('openaiBaseUrl', v)}
          placeholder="https://api.openai.com/v1"
          monospace
        />
        <XpField
          label="API key"
          type="password"
          value={s.openaiApiKey}
          onChange={v => ctrl.update('openaiApiKey', v)}
          placeholder="sk-... (leave blank for local servers)"
        />
      </XpSection>

      <XpSection
        title="Models"
        actions={
          ctrl.loadingModels ? (
            <span className="xp-wizard-help">loading…</span>
          ) : ctrl.availableModels ? (
            <span className="xp-wizard-help">{ctrl.availableModels.length} found</span>
          ) : null
        }
      >
        {ctrl.modelsError && <XpStatusLine tone="error">{ctrl.modelsError}</XpStatusLine>}
        <ModelEditor
          rows={s.modelRows}
          onChange={rows => ctrl.update('modelRows', rows)}
          available={ctrl.availableModels}
          loadingModels={ctrl.loadingModels}
        />
      </XpSection>
    </div>
  )
}
