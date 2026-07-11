import { cn } from "@/lib/utils"

interface LogoItem {
  color?: string
  initial?: string
  flag?: string
  name: string
}

/**
 * Program logo tile.
 * Desktop (lg+): colored tile with the initial letter – the desktop language.
 * Below lg: country flag on a tinted surface – the legacy mobile FlagLogo
 * look (fill = brand color at ~8% alpha, border at ~20%).
 * Pass size/radius/text classes via className (e.g. "size-9 rounded-xl text-sm font-semibold").
 */
export function ProgramLogo({ item, className }: { item: LogoItem; className?: string }) {
  const color = item.color ?? "#0f766e" /* white label needs a dark fill in both themes */
  return (
    <>
      <div
        className={cn("hidden shrink-0 place-items-center text-white lg:grid", className)}
        style={{ background: color }}
      >
        {item.initial ?? item.name[0]}
      </div>
      <div
        className={cn("grid shrink-0 place-items-center lg:hidden", className)}
        style={{ background: `${color}14`, border: `1px solid ${color}33` }}
        aria-hidden="true"
      >
        {/* Neutral placeholder ring – real SVG flags will replace this later. */}
        <span className="block h-1/2 w-1/2 rounded-full border-2" style={{ borderColor: color }} />
      </div>
    </>
  )
}
