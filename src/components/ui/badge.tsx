import * as React from "react";
import { Slot } from "@radix-ui/react-slot@1.1.2";
import { cva, type VariantProps } from "class-variance-authority@0.7.1";

import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden backdrop-blur-sm",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground backdrop-blur-md",
        buy:
          "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/50",
        sell:
          "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-400/50",
        long:
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/50",
        short:
          "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-400/50",
        open:
          "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-400/50",
        closed:
          "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-400/50",
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
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
