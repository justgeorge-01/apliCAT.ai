import * as React from "react"

/**
 * Toast context – a single `show(message)` function (auto-hides after 2.5s).
 * Lives apart from `toast.tsx` so that file exports only a component.
 */
export const ToastCtx = React.createContext<(msg: string) => void>(() => {})

export function useToast() {
  return React.useContext(ToastCtx)
}
