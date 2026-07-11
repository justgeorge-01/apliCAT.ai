import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown } from "lucide-react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const EASE = [0.16, 1, 0.3, 1] as const

export function Accordion({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-3", className)}>{children}</div>
}

/**
 * Single collapsible section. Self-managed open state; multiple items can be
 * open at once. Animated height like the rest of the app (framer AnimatePresence).
 */
export function AccordionItem({
  title,
  defaultOpen = false,
  accent = false,
  children,
}: {
  title: React.ReactNode
  defaultOpen?: boolean
  accent?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className={cn("gap-0 overflow-hidden p-0", accent && "border-accent/40")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors duration-200 outline-none hover:bg-fg/5 focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {accent && <span className="size-1.5 shrink-0 rounded-full bg-accent" />}
        <span className="min-w-0 flex-1 text-[15px] font-semibold">{title}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-fg-faint transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
