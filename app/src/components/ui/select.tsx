import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/** Styled native select – options follow the theme via color-scheme. */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        data-slot="select"
        className="h-9 w-full appearance-none rounded-xl border border-border bg-card-2 pr-8 pl-3 text-sm text-fg transition-colors duration-200 outline-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-fg-faint" />
    </div>
  )
}

export { Select }
