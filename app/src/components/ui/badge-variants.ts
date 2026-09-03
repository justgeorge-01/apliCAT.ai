import { cva } from "class-variance-authority"

/**
 * Badge class variants. Kept apart from `badge.tsx` so that file exports only
 * a component (react-refresh/only-export-components).
 *
 * Printed-label look: small radius, soft tints, no pills.
 */
export const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-2 focus-visible:ring-accent/60 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/30 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-accent-soft text-accent-text",
        secondary: "border-border bg-card-2 text-fg-muted",
        positive: "bg-positive/12 text-positive",
        warning: "bg-warning/12 text-warning",
        destructive: "bg-danger/12 text-danger",
        outline: "border-border-strong text-fg-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
