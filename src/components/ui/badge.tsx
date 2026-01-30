import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-transparent bg-success text-success-foreground hover:bg-success/80",
        warning: "border-transparent bg-warning text-warning-foreground hover:bg-warning/80",
        pending: "border-transparent bg-pending text-pending-foreground hover:bg-pending/80",
        // Oncology-specific variants with distinct purple/violet palette
        "onco-diagnosis": "border-transparent bg-[hsl(var(--onco-diagnosis))] text-[hsl(var(--onco-diagnosis-foreground))] hover:bg-[hsl(var(--onco-diagnosis))]/80",
        "onco-exam": "border-transparent bg-[hsl(var(--onco-exam))] text-[hsl(var(--onco-exam-foreground))] hover:bg-[hsl(var(--onco-exam))]/80",
        "onco-treatment": "border-transparent bg-[hsl(var(--onco-treatment))] text-[hsl(var(--onco-treatment-foreground))] hover:bg-[hsl(var(--onco-treatment))]/80",
        "onco-consultation": "border-transparent bg-[hsl(var(--onco-consultation))] text-[hsl(var(--onco-consultation-foreground))] hover:bg-[hsl(var(--onco-consultation))]/80",
        "onco-surgery": "border-transparent bg-[hsl(var(--onco-surgery))] text-[hsl(var(--onco-surgery-foreground))] hover:bg-[hsl(var(--onco-surgery))]/80",
        "onco-followup": "border-transparent bg-[hsl(var(--onco-followup))] text-[hsl(var(--onco-followup-foreground))] hover:bg-[hsl(var(--onco-followup))]/80",
        "onco-remission": "border-transparent bg-[hsl(var(--onco-remission))] text-[hsl(var(--onco-remission-foreground))] hover:bg-[hsl(var(--onco-remission))]/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
