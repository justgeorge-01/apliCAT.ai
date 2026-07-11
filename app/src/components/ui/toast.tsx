import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"

/**
 * Minimal toast – API mirrors the legacy ToastCtx (a single `show(message)`
 * function, auto-hides after 2.5s).
 */
const ToastCtx = React.createContext<(msg: string) => void>(() => {})

export function useToast() {
  return React.useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = React.useState<string | null>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = React.useCallback((m: string) => {
    setMsg(m)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 2500)
  }, [])

  React.useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {/* sits above the mobile bottom tab bar; lg+ has no bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-100 flex justify-center px-4 lg:bottom-6">
        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto rounded-xl border border-border-strong bg-card-2 px-4 py-2.5 text-sm font-medium text-fg shadow-xl"
              role="status"
            >
              {msg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
