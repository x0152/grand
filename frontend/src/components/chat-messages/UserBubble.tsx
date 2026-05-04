import type { ChatMessage } from '../../types'
import { CopyMessageButton } from './CopyMessageButton'
import { UserMessageContent } from './UserMessageContent'
import { estimateTokens, fmtTokens } from './utils'

export function UserBubble({ msg }: { msg: ChatMessage }) {
  const userTokens = msg.tokens ?? estimateTokens(msg.content)
  return (
    <div className="group flex justify-end items-center gap-2">
      {msg.content && <CopyMessageButton text={msg.content} variant="hover" />}
      <div className="bubble bubble-user max-w-[80%] text-[15px] px-5 py-3 leading-relaxed">
        <UserMessageContent content={msg.content} sessionId={msg.sessionId} />
        {userTokens > 0 && (
          <div className="mt-1.5 font-mono text-[10.5px] tabular-nums text-[var(--grand-muted-2)] text-right">
            ~{fmtTokens(userTokens)} tok
          </div>
        )}
      </div>
    </div>
  )
}
