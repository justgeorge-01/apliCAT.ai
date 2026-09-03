import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Han-character kicker: «大学 Каталог», «我的计划 Мой план», «事实 Факты»,
 * «截止日期 Дедлайны», «考试 CSCA». The glyphs are set in the system CJK
 * face and painted with the accent; the Russian meaning always sits next to
 * them – never a decorative character on its own. At most one per block.
 *
 * tone="inverse" is for red or ink bands: gold glyphs, paper label.
 */
function HanziKicker({
  as: Tag = "div",
  hanzi,
  tone = "default",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  as?: "div" | "h2" | "h3" | "span" | "p"
  /** The characters, e.g. «大学». */
  hanzi: string
  /** default – on paper / card; inverse – on a red or ink band. */
  tone?: "default" | "inverse"
  /** The Russian meaning, e.g. «Каталог». */
  children: React.ReactNode
}) {
  return (
    <Tag
      data-slot="hanzi-kicker"
      data-tone={tone}
      className={cn(
        "flex items-baseline gap-2 font-body text-xs font-semibold tracking-[0.14em] uppercase",
        tone === "inverse" ? "text-paper/90" : "text-fg-muted",
        className,
      )}
      {...props}
    >
      <span
        lang="zh-Hans"
        translate="no"
        className={cn(
          "font-cjk text-[15px] leading-none font-semibold tracking-normal normal-case",
          tone === "inverse" ? "text-gold" : "text-accent-text",
        )}
      >
        {hanzi}
      </span>
      <span>{children}</span>
    </Tag>
  )
}

export { HanziKicker }
