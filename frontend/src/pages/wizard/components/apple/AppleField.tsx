import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'

interface AppleFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: ReactNode
  hint?: ReactNode
  trailing?: ReactNode
  monospace?: boolean
  inputRef?: Ref<HTMLInputElement>
}

export function AppleField({
  label,
  hint,
  trailing,
  monospace,
  className,
  inputRef,
  ...props
}: AppleFieldProps) {
  const id = useId()
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-center gap-3">
        <label
          htmlFor={id}
          className="w-[110px] shrink-0 text-[14px] font-medium text-[var(--grand-muted)]"
        >
          {label}
        </label>
        <input
          {...props}
          id={id}
          ref={inputRef}
          className={[
            'flex-1 min-w-0 bg-transparent outline-none text-[16px] text-[var(--grand-fg)]',
            'placeholder:text-[var(--grand-muted-2)] disabled:cursor-not-allowed disabled:opacity-50',
            monospace ? 'font-mono' : '',
            props.readOnly ? 'text-[var(--grand-muted)]' : '',
            className ?? '',
          ].join(' ')}
        />
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
      {hint && (
        <p className="mt-1.5 ml-[122px] text-[12.5px] text-[var(--grand-muted-2)] leading-snug">
          {hint}
        </p>
      )}
    </div>
  )
}
