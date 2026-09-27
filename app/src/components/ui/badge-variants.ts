import { cva } from "class-variance-authority"

/**
 * Badge class variants. Kept apart from `badge.tsx` so that file exports only
 * a component (react-refresh/only-export-components).
 *
 * Black and white: a tint, a solid rim, a dashed rim, a muted grey. States
 * are told apart by the edge and the word, never by a hue; the only colour
 * is `destructive`.
 */
export const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-2 focus-visible:ring-accent/60 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/30 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-accent-soft text-accent-text",
        secondary: "border-border bg-card-2 text-fg-muted",
        positive: "bg-accent-soft text-fg",
        warning: "border-dashed border-fg/45 text-fg",
        destructive: "bg-danger/10 text-danger",
        outline: "border-fg/35 text-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
