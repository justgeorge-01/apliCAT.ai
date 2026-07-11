import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Section kicker / micro-label – the single canonical treatment for
 * uppercase eyebrow labels across the app.
 * Accent variant is reserved for AI/feature callouts.
 */
function Kicker({
  as: Tag = "div",
  accent = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "h2" | "h3" | "span" | "p"; accent?: boolean }) {
  return (
    <Tag
      data-slot="kicker"
      className={cn(
        "text-xs font-semibold tracking-widest uppercase",
        accent ? "text-accent-text" : "text-fg-muted",
        className,
      )}
      {...props}
    />
  )
}

export { Kicker }
