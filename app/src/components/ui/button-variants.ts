import { cva } from "class-variance-authority"

/**
 * Button class variants. Kept apart from `button.tsx` so that file exports only
 * a component (react-refresh/only-export-components).
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-accent font-semibold text-accent-fg shadow-[0_8px_24px_-8px_var(--color-accent-glow)] hover:brightness-110",
        destructive: "bg-danger font-semibold text-danger-fg hover:brightness-110",
        outline: "border border-border-strong bg-transparent text-fg hover:bg-fg/5",
        secondary: "bg-card-2 text-fg border border-border hover:bg-fg/5",
        ghost: "text-fg-muted hover:bg-fg/5 hover:text-fg",
        link: "text-accent-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
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
