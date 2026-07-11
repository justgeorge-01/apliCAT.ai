import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("block text-xs font-semibold text-fg-muted", className)}
      {...props}
    />
  )
}

export { Label }
