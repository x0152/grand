import { XpButton, XpSection, XpStatusLine } from './shared'
import { ModelEditor } from './ModelEditor'
import type { WizardController } from './useWizardController'

interface Props {
  ctrl: WizardController
}

export function GonkaModelsStep({ ctrl }: Props) {
  if (!ctrl.state) return null
  const empty =
    ctrl.availableModels && ctrl.availableModels.length === 0 && !ctrl.loadingModels && !ctrl.modelsError

  return (
    <div className="xp-wizard-step">
      <p className="xp-wizard-prose">
        Pick the models you want to use. One <em>chat</em> model is required. Summary and vision are
        nice-to-haves.
      </p>

      <XpSection
        title="Available on this server"
        actions={
          <span className="xp-wizard-actions-inline">
            {ctrl.availableModels && (
              <span className="xp-wizard-help">{ctrl.availableModels.length} found</span>
            )}
            <XpButton onClick={() => void ctrl.onReloadGonkaModels()} disabled={ctrl.loadingModels}>
              {ctrl.loadingModels ? 'Loading…' : 'Reload'}
            </XpButton>
          </span>
        }
      >
        {ctrl.modelsError && <XpStatusLine tone="error">{ctrl.modelsError}</XpStatusLine>}
        {empty && (
          <XpStatusLine tone="warn">
            This Gonka node didn't list any models. Type the model name manually, or change the
            server.
          </XpStatusLine>
        )}
        <ModelEditor
          rows={ctrl.state.modelRows}
          onChange={rows => ctrl.update('modelRows', rows)}
          available={ctrl.availableModels}
          loadingModels={ctrl.loadingModels}
        />
      </XpSection>
    </div>
  )
}
