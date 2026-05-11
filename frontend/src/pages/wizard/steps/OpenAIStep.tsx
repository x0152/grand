import { Loader2 } from '@/lib/icons'
import type { ProviderModel } from '@/types'
import { AppleField } from '../components/apple/AppleField'
import { AppleListGroup } from '../components/apple/AppleListGroup'
import { AppleSection } from '../components/apple/AppleSection'
import { ModelEditor } from '../components/ModelEditor'
import { StepHero } from '../components/StepHero'
import type { ModelRow } from '../types'

interface OpenAIStepProps {
  baseUrl: string
  apiKey: string
  modelRows: ModelRow[]
  available: ProviderModel[] | null
  loadingModels: boolean
  modelsError: string
  onChangeBaseUrl: (v: string) => void
  onChangeApiKey: (v: string) => void
  onChangeModelRows: (rows: ModelRow[]) => void
}

export function OpenAIStep({
  baseUrl,
  apiKey,
  modelRows,
  available,
  loadingModels,
  modelsError,
  onChangeBaseUrl,
  onChangeApiKey,
  onChangeModelRows,
}: OpenAIStepProps) {
  return (
    <div className="space-y-10">
      <StepHero stepId="openai" align="left" />

      <AppleSection title="Endpoint">
        <AppleListGroup
          caption={
            <>
              Use <span className="font-mono">https://api.openai.com/v1</span> for OpenAI directly,
              your provider’s OpenAI-compatible URL, or{' '}
              <span className="font-mono">http://localhost:11434/v1</span> for Ollama.
            </>
          }
        >
          <AppleField
            label="Server URL"
            value={baseUrl}
            onChange={e => onChangeBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            monospace
            autoComplete="off"
          />
          <AppleField
            label="API key"
            type="password"
            value={apiKey}
            onChange={e => onChangeApiKey(e.target.value)}
            placeholder="sk-... (leave blank for local servers)"
            autoComplete="new-password"
          />
        </AppleListGroup>
      </AppleSection>

      <AppleSection
        title="Models"
        trailing={
          <div className="flex items-center gap-3 text-[12px] font-mono text-[var(--grand-muted-2)]">
            {loadingModels && (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                loading
              </span>
            )}
            {!loadingModels && available && <span>{available.length} found</span>}
          </div>
        }
      >
        {modelsError && (
          <div className="mb-3 rounded-2xl ring-1 ring-rose-500/30 bg-rose-500/[0.06] px-4 py-3 text-[13px] text-rose-600 dark:text-rose-400">
            {modelsError}
          </div>
        )}
        <ModelEditor
          rows={modelRows}
          onChange={onChangeModelRows}
          available={available}
          loadingModels={loadingModels}
        />
      </AppleSection>
    </div>
  )
}
