import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-medium whitespace-nowrap ring-1",
  {
    variants: {
      variant: {
        default:
          "bg-primary/10 text-primary ring-primary/20 dark:bg-primary/20",
        secondary:
          "bg-secondary text-secondary-foreground ring-border",
        destructive:
          "bg-destructive/10 text-destructive ring-destructive/20 dark:bg-destructive/20",
        outline: "bg-background text-foreground ring-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
