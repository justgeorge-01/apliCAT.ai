import { useEffect, useState } from "react"

import type { AuthUser, Backend } from "./api"

/**
 * Who is signed in (cabinet spec §3 `useSession`).
 *  - `off`     – the cabinet is disabled in this build (no backend);
 *  - `loading` – the backend is resolving the session (and a magic link, if any);
 *  - `guest`   – no session;
 *  - `signed`  – a user.
 */
export type SessionState =
  | { status: "off" }
  | { status: "loading" }
  | { status: "guest" }
  | { status: "signed"; user: AuthUser }

export function useSession(backend: Backend | null): SessionState {
  const [state, setState] = useState<SessionState>(() => (backend ? { status: "loading" } : { status: "off" }))

  useEffect(() => {
    if (!backend) return
    let alive = true
    const apply = (u: AuthUser | null) => {
      if (!alive) return
      setState(u ? { status: "signed", user: u } : { status: "guest" })
    }
    const off = backend.auth.onChange(apply)
    backend.auth.getUser().then(apply, () => apply(null))
    return () => {
      alive = false
      off()
    }
  }, [backend])

  return state
}
