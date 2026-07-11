import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex h-5.5 w-9.5 shrink-0 cursor-pointer items-center rounded-full border border-border bg-card-2 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-transparent data-[state=checked]:bg-accent",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-fg shadow transition-transform duration-200 data-[state=checked]:translate-x-4.5 data-[state=checked]:bg-accent-fg" />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
