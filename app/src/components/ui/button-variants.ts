import { cva } from "class-variance-authority"

/**
 * Button class variants. Kept apart from `button.tsx` so that file exports only
 * a component (react-refresh/only-export-components).
 *
 * «Азия / красный»: the primary is a red fill with cream semibold text, the
 * secondary an ink outline. Moderate radius, no glow, no arrows.
 *
 * Disabled is a state of its own, not a faded fill: a half-transparent red
 * button still reads as a red button (and cream on 50% red is 1.7:1), so a
 * disabled button drops the fill and becomes a muted contour instead.
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:border disabled:border-border-strong disabled:bg-transparent disabled:font-medium disabled:text-fg-faint disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent font-semibold text-accent-fg hover:brightness-110 active:brightness-95",
        destructive: "bg-danger font-semibold text-danger-fg hover:brightness-110",
        outline: "border border-fg/50 bg-transparent font-semibold text-fg hover:border-fg hover:bg-fg/5",
        secondary: "border border-border bg-card-2 text-fg hover:bg-fg/5",
        ghost: "text-fg-muted hover:bg-fg/5 hover:text-fg",
        link: "text-accent-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        xl: "h-12 px-6 text-base has-[>svg]:px-5",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
