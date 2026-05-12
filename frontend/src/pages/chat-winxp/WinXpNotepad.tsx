import { useEffect, useRef, useState } from 'react'
import { useDraggable, type Position } from './useDraggable'
import { useResizable, type Size } from './useResizable'

interface Props {
  position: Position
  size: Size
  zIndex: number
  active: boolean
  maximized: boolean
  title: string
  initialContent: string
  onActivate: () => void
  onMove: (next: Position) => void
  onResize: (next: Size) => void
  onMaximizeToggle: () => void
  onClose: () => void
}

/**
 * Pixel-faithful Windows XP "Notepad" clone. Reproduces the parts of the
 * real binary that mattered visually:
 *
 *   - 32px title bar that says "<file> - Notepad"
 *   - one-row menu bar (File / Edit / Format / View / Help) with mnemonic
 *     underlines, sitting on the canonical XP beige (#ECE9D8)
 *   - editable monospace text surface drawn with a 1px sunken border
 *   - status bar at the foot showing line/column + zoom + line-endings, the
 *     same way Notepad on XP does when "View > Status Bar" is enabled.
 *
 * Menus are decorative — they show the names so the chrome looks complete
 * but don't actually drop down. That keeps the file deletable as a unit
 * without dragging in a real menu manager.
 */
export function WinXpNotepad({
  position,
  size,
  zIndex,
  active,
  maximized,
  title,
  initialContent,
  onActivate,
  onMove,
  onResize,
  onMaximizeToggle,
  onClose,
}: Props) {
  const dragHandle = useDraggable(position, onMove, onActivate)
  const resizeRight = useResizable(size, onResize, { edge: 'right' }, onActivate)
  const resizeBottom = useResizable(size, onResize, { edge: 'bottom' }, onActivate)
  const resizeCorner = useResizable(size, onResize, { edge: 'corner' }, onActivate)

  const [text, setText] = useState(initialContent)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [caret, setCaret] = useState({ line: 1, col: 1 })

  useEffect(() => {
    setText(initialContent)
  }, [initialContent])

  function recomputeCaret() {
    const el = taRef.current
    if (!el) return
    const upTo = el.value.slice(0, el.selectionStart)
    const lines = upTo.split('\n')
    setCaret({ line: lines.length, col: (lines[lines.length - 1]?.length ?? 0) + 1 })
  }

  return (
    <div
      className={`xp-window-wrap xp-notepad-wrap ${maximized ? 'maximized' : ''}`}
      style={{
        left: position.left,
        top: position.top,
        width: size.width,
        height: size.height,
        zIndex,
      }}
      onMouseDown={onActivate}
    >
      <div className="window xp-notepad">
        <div
          className={`title-bar ${active ? '' : 'inactive'}`}
          {...(maximized ? {} : dragHandle)}
          onDoubleClick={onMaximizeToggle}
        >
          <div className="title-bar-text">
            <img
              className="xp-title-icon"
              src="/winxp/notepad-app.png"
              alt=""
              draggable={false}
            />
            {title} - Notepad
          </div>
          <div className="title-bar-controls">
            <button aria-label="Minimize" />
            <button
              aria-label={maximized ? 'Restore' : 'Maximize'}
              onClick={onMaximizeToggle}
            />
            <button aria-label="Close" onClick={onClose} />
          </div>
        </div>
        <div className="window-body">
          <div className="xp-notepad-menu">
            {[
              ['F', 'ile'],
              ['E', 'dit'],
              ['F', 'ormat'],
              ['V', 'iew'],
              ['H', 'elp'],
            ].map(([k, rest]) => (
              <span key={k + rest} className="xp-notepad-menu-item">
                <u>{k}</u>
                {rest}
              </span>
            ))}
          </div>
          <textarea
            ref={taRef}
            className="xp-notepad-area"
            value={text}
            onChange={e => setText(e.target.value)}
            onSelect={recomputeCaret}
            onKeyUp={recomputeCaret}
            onClick={recomputeCaret}
            spellCheck={false}
            wrap="off"
          />
        </div>
        <div className="status-bar xp-notepad-status">
          <p className="status-bar-field xp-notepad-status-spacer">{' '}</p>
          <p className="status-bar-field">
            Ln {caret.line}, Col {caret.col}
          </p>
        </div>
      </div>

      {!maximized && (
        <>
          <div className="xp-resize xp-resize-r" {...resizeRight} />
          <div className="xp-resize xp-resize-b" {...resizeBottom} />
          <div className="xp-resize xp-resize-br" {...resizeCorner} />
        </>
      )}
    </div>
  )
}

/**
 * Placeholder copy for `New Text Document.txt`. Pretends to be a leaked
 * export from the old Windows XP "Address Book" (wab.exe) — a single
 * contact card for the author themselves. The "Reachable at" wording
 * carries the joke: address book entries list how to reach a person,
 * and for this person you reach them on-chain. No explicit tip framing.
 */
export const UNTITLED1_INITIAL_TEXT = `==========================================
 Windows Address Book — exported contact
==========================================

  Display name : self
  Nickname     : author
  Group        : Personal
  Updated      : 2026-05-12

  Reachable at:

     Ξ  EVM       0xf7b9369aeae7a3ed9a5f782a9793fb378e4d9aa6
     ◎  Solana    DGSbfoBtzMZ6ozGkSvTfwLK1DUetX3wsk3Rib5mDhBux
     ◆  TON       UQB_SNoUeMg-BHYjk5lmVSUWqPEORmUM4fV-o9QvIrPDiVeZ
     ₿  Bitcoin   bc1qxnh22fkp22g9cyu0qrzaq74wuj3kuyftu6lj8q
     ⚛  Gonka     gonka1mwscga703ek9f7zspkkmnn8f2cvtmyatxkfgpd

  Notes        : verified on mainnet. all five answer.
`

export const GONKA_TXT_INITIAL_TEXT = `==========================================
 gonka.txt — what is Gonka?
==========================================

  Gonka is a decentralized AI inference
  network. Not a marketplace. Not a
  company. A protocol.

  How it works
  ------------
    - Independent GPU hosts run open
      models (Kimi K2.6, Qwen3-235B, ...)
    - Your inference request is signed
      from your wallet and routed across
      the network — no middleman
    - You pay a tiny per-token fee from
      your GNK balance, settled on-chain

  Why it is cheap
  ---------------
    - Under $0.001 per 1M tokens on
      Kimi K2.6 — less than a tenth of
      a cent per million
    - No subscription, no credit card

  What you need
  -------------
    - A Gonka-compatible wallet
      (Keplr / Cosmostation / Leap /
       GG Wallet Chrome extension)
    - A small GNK balance — see the
      "Add some GNK" step of the wizard
      for ways to get it

  Where to learn more
  -------------------
    Website : https://gonka.ai
    Docs    : https://gonka.ai/docs/
    Faucet  : https://gonka.gg/faucet
    GitHub  : https://github.com/gonka-ai/gonka
    Discord : https://discord.gg/RADwCT2U6R
`
