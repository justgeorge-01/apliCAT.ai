import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Segmented pill control – the one canonical incarnation
 * (track bg-surface p-1; active option = teal fill with glow).
 */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: string; icon?: React.ReactNode }[]
  className?: string
}) {
  return (
    <div className={cn("flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
            value === o.id
              ? "bg-accent font-semibold text-accent-fg shadow-[0_8px_24px_-12px_var(--color-accent-glow)]"
              : "text-fg-muted hover:bg-fg/5 hover:text-fg",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export { Segmented }
