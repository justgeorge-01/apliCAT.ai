import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Section kicker / micro-label – the single canonical treatment for
 * uppercase eyebrow labels across the app (Noto Sans 600, wide tracking).
 * Accent variant paints it red (gold in the ink theme) – for section heads
 * and feature callouts. For a Han character plus its Russian meaning use
 * `HanziKicker` instead.
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
        "font-body text-xs font-semibold tracking-[0.14em] uppercase",
        accent ? "text-accent-text" : "text-fg-muted",
        className,
      )}
      {...props}
    />
  )
}

export { Kicker }
