import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium tracking-tight transition-[background,color,transform,box-shadow] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-40 active:translate-y-[0.5px] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-emerald-400 text-zinc-950 hover:bg-emerald-300 dark:text-zinc-950",
        secondary:
          "bg-[var(--grand-surface-2)] text-[var(--grand-fg-2)] hover:text-[var(--grand-fg)] hover:bg-[var(--grand-surface)]",
        outline:
          "bg-transparent text-[var(--grand-fg-2)] hover:bg-[var(--grand-surface-2)] hover:text-[var(--grand-fg)]",
        destructive:
          "text-[var(--grand-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-md",
        ghost:
          "text-[var(--grand-muted)] hover:text-[var(--grand-fg)] hover:bg-[var(--grand-surface-2)] rounded-md",
        link:
          "text-emerald-400 underline-offset-4 hover:underline px-0",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-[12px]",
        icon: "size-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
