import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"

interface FormFieldProps {
  label: string
  children: ReactNode
  hint?: ReactNode
  error?: string
}

export function FormField({ label, children, hint, error }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[12px] text-[var(--grand-muted)] mt-1.5">{hint}</p>}
      {error && <p className="text-[12px] text-rose-500 mt-1.5">{error}</p>}
    </div>
  )
}
