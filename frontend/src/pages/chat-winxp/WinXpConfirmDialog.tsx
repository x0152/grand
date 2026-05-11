import { useEffect, useRef } from 'react'

interface Props {
  title: string
  iconSrc?: string
  /** Body — accepts JSX so callers can highlight the file name etc. */
  children: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  /** Render the focus on Yes (true) or No (false). Defaults to No, same
   *  as XP's destructive prompts which always default to "Cancel". */
  defaultButton?: 'confirm' | 'cancel'
}

/**
 * Pixel-faithful Windows-XP "Confirm File Delete" dialog. We use it to
 * guard the drag-to-Recycle-Bin flow, because actually nuking a chat
 * session is a destructive backend call.
 *
 * Design notes:
 *  - Frame uses xp.css's `.window` chrome so the title bar matches every
 *    other XP window in the experiment.
 *  - The body renders one big icon on the left (the standard XP "delete
 *    confirmation" yellow folder + red dot bitmap) and the prose on the
 *    right, exactly like the real shell32.dll dialog.
 *  - Buttons are right-aligned and ENTER triggers the default one;
 *    Escape always fires `onCancel`.
 *  - Modal backdrop traps clicks so the user can't accidentally drop
 *    another icon while the prompt is open.
 */
export function WinXpConfirmDialog({
  title,
  iconSrc = '/winxp/delete-confirm.png',
  children,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  onConfirm,
  onCancel,
  defaultButton = 'cancel',
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const target = defaultButton === 'confirm' ? confirmRef.current : cancelRef.current
    target?.focus()
  }, [defaultButton])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === 'Enter') {
        // Only trigger when our buttons own focus — otherwise let the
        // host page handle it (e.g. someone is typing in a textarea).
        const active = document.activeElement
        if (active === confirmRef.current || active === cancelRef.current) {
          e.preventDefault()
          if (active === confirmRef.current) onConfirm()
          else onCancel()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onConfirm, onCancel])

  return (
    <div
      className="xp-confirm-backdrop"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="xp-confirm-dialog"
        role="dialog"
        aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <div className="window">
          <div className="title-bar">
            <div className="title-bar-text">
              <img className="xp-title-icon" src={iconSrc} alt="" draggable={false} />
              {title}
            </div>
            <div className="title-bar-controls">
              <button aria-label="Close" onClick={onCancel} />
            </div>
          </div>
          <div className="window-body xp-confirm-body">
            <img className="xp-confirm-icon" src={iconSrc} alt="" draggable={false} />
            <div className="xp-confirm-text">{children}</div>
          </div>
          <div className="xp-confirm-actions">
            <button ref={confirmRef} onClick={onConfirm}>
              {confirmLabel}
            </button>
            <button ref={cancelRef} onClick={onCancel}>
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
