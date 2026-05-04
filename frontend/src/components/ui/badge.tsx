import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-tight",
  {
    variants: {
      variant: {
        default: "bg-emerald-500/10 text-emerald-400",
        secondary: "bg-[var(--grand-surface-2)] text-[var(--grand-muted)]",
        success: "bg-emerald-500/10 text-emerald-400",
        destructive: "bg-rose-500/10 text-rose-400",
        warning: "bg-amber-500/10 text-amber-400",
        outline:
          "bg-transparent text-[var(--grand-muted)] border border-[var(--grand-line)] font-mono rounded-md",
        muted: "bg-[var(--grand-surface-2)] text-[var(--grand-muted-2)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
