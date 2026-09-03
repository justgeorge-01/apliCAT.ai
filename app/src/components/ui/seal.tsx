import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Seal (印章) – the product's main visual mark. A square stamp with a rim,
 * a thin inner line and one Han character inside (default «印», “seal”).
 *
 *  - variant="solid"   – red fill, cream glyph: «проверено» (auto / manual);
 *  - variant="outline" – contour only: demo and archive copies;
 *  - tone              – accent (red), warning (archive), muted (demo).
 *
 * Decorative by itself: the meaning must be in the text next to it, so the
 * seal is aria-hidden unless a `title`/aria-label is passed.
 */
const SIZES = {
  sm: { box: "size-5 rounded-[3px]", glyph: "text-[11px]" },
  md: { box: "size-7 rounded-[4px]", glyph: "text-[15px]" },
} as const

const TONES = {
  accent: {
    solid: "border-accent bg-accent text-accent-fg",
    outline: "border-accent bg-transparent text-accent-text",
    inner: { solid: "border-accent-fg/60", outline: "border-accent-text/50" },
  },
  warning: {
    solid: "border-warning bg-warning text-paper",
    outline: "border-warning bg-transparent text-warning",
    inner: { solid: "border-paper/60", outline: "border-warning/50" },
  },
  muted: {
    solid: "border-fg-faint bg-fg-faint text-bg",
    outline: "border-fg-faint bg-transparent text-fg-faint",
    inner: { solid: "border-bg/60", outline: "border-fg-faint/50" },
  },
} as const

export interface SealProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Character inside the stamp. Default «印». */
  glyph?: string
  size?: keyof typeof SIZES
  variant?: "solid" | "outline"
  tone?: keyof typeof TONES
}

function Seal({
  glyph = "印",
  size = "sm",
  variant = "solid",
  tone = "accent",
  className,
  ...props
}: SealProps) {
  const s = SIZES[size]
  const t = TONES[tone]
  const hidden = !props.title && !props["aria-label"]
  return (
    <span
      data-slot="seal"
      data-variant={variant}
      data-tone={tone}
      aria-hidden={hidden || undefined}
      className={cn(
        "inline-grid shrink-0 place-items-center border p-px align-middle",
        s.box,
        t[variant],
        className,
      )}
      {...props}
    >
      <span
        lang="zh-Hans"
        translate="no"
        className={cn(
          "grid size-full place-items-center rounded-[1px] border font-cjk leading-none font-semibold",
          s.glyph,
          t.inner[variant],
        )}
      >
        {glyph}
      </span>
    </span>
  )
}

export { Seal }
