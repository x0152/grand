import { Loader2, RotateCw } from '@/lib/icons'
import type { ProviderModel } from '@/types'
import { AppleAction } from '../components/apple/AppleAction'
import { AppleNote } from '../components/apple/AppleNote'
import { AppleSection } from '../components/apple/AppleSection'
import { ModelEditor } from '../components/ModelEditor'
import { StepHero } from '../components/StepHero'
import type { ModelRow } from '../types'

interface GonkaModelsStepProps {
  modelRows: ModelRow[]
  available: ProviderModel[] | null
  loadingModels: boolean
  modelsError: string
  onChange: (rows: ModelRow[]) => void
  onReload: () => void
}

export function GonkaModelsStep({
  modelRows,
  available,
  loadingModels,
  modelsError,
  onChange,
  onReload,
}: GonkaModelsStepProps) {
  const empty = available && available.length === 0 && !loadingModels && !modelsError
  return (
    <div className="space-y-10">
      <StepHero stepId="gonka-models" align="left" />

      <AppleSection
        title="Available on this server"
        trailing={
          <div className="flex items-center gap-3">
            {available && (
              <span className="text-[12px] font-mono text-[var(--grand-muted-2)]">
                {available.length} found
              </span>
            )}
            <AppleAction
              variant="secondary"
              className="h-9 px-4 text-[13px] rounded-xl"
              onClick={onReload}
              disabled={loadingModels}
              leading={
                loadingModels ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RotateCw size={13} />
                )
              }
            >
              {loadingModels ? 'Loading' : 'Reload'}
            </AppleAction>
          </div>
        }
      >
        {modelsError && (
          <div className="mb-3 rounded-2xl ring-1 ring-rose-500/30 bg-rose-500/[0.06] px-4 py-3 text-[13px] text-rose-600 dark:text-rose-400">
            {modelsError}
          </div>
        )}
        {empty && (
          <AppleNote tone="warning" title="No models advertised">
            This Gonka node didn’t list any models. You can still type the model name manually,
            or change the server in the previous step.
          </AppleNote>
        )}
        <ModelEditor
          rows={modelRows}
          onChange={onChange}
          available={available}
          loadingModels={loadingModels}
        />
      </AppleSection>
    </div>
  )
}
