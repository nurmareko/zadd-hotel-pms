import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Canonical V2 actions: slate primary, white secondary, and solid red danger.
        default: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
        primary: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
        outline:
          "border-slate-200 bg-white text-slate-900 hover:bg-slate-50 aria-expanded:bg-slate-50",
        secondary:
          "border-slate-200 bg-white text-slate-900 hover:bg-slate-50 aria-expanded:bg-slate-50",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "border-red-500 bg-red-500 text-white hover:bg-red-600 focus-visible:border-red-500 focus-visible:ring-red-500/20",
        danger:
          "border-red-500 bg-red-500 text-white hover:bg-red-600 focus-visible:border-red-500 focus-visible:ring-red-500/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 gap-1.5 px-3 desktop:h-10 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-11 gap-1 px-2 text-xs desktop:h-10 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-11 gap-1 px-2.5 text-[0.8rem] desktop:h-10 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-1.5 px-3 desktop:h-10 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-11 desktop:size-10",
        "icon-xs":
          "size-11 desktop:size-10 in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-11 desktop:size-10 in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-11 desktop:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
