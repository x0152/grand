import { telegramSummary, emailSummary } from '../../wizard/utils'
import type { WizardController } from './useWizardController'

interface Props {
  ctrl: WizardController
}

export function FinishStep({ ctrl }: Props) {
  if (!ctrl.state) return null
  const s = ctrl.state
  const chatModel = s.modelRows.find(r => r.role === 'chat')?.name || '—'
  const endpoint = s.provider === 'openai' ? s.openaiBaseUrl : s.gonkaNodeUrl

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Powered by', value: s.provider === 'openai' ? 'OpenAI-compatible API' : 'Gonka wallet' },
    { label: 'Server', value: endpoint || '—' },
    { label: 'Chat model', value: chatModel },
    { label: 'Telegram', value: telegramSummary(s) },
    { label: 'Email', value: emailSummary(s) },
  ]

  return (
    <div className="xp-wizard-welcome">
      <h1 className="xp-wizard-title">
        Completing the GRAND
        <br />
        Setup Wizard
      </h1>
      <p className="xp-wizard-prose">
        Here's what we'll save. Click <strong>Finish</strong> to apply it and start chatting.
      </p>
      <table className="xp-wizard-summary">
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <th>{r.label}</th>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
