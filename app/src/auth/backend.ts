/**
 * Which backend this build talks to (cabinet spec §3 `supabase.ts`):
 *  - `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` → Supabase (always wins);
 *  - dev server with `VITE_CABINET_FAKE=1` and no keys → the in-memory backend;
 *  - otherwise null: the cabinet is off (`FEATURES.accounts === false`) and the
 *    storefront never makes a request.
 *
 * `import.meta.env.DEV` is a build-time constant, so the fake backend is dead
 * code in `vite build` and is not emitted into dist.
 */
import { FEATURES, SUPABASE_ENV } from "@/lib/features"
import type { Backend } from "./api"
import { createFakeBackend } from "./fakeBackend"
import { supabaseBackend } from "./supabaseBackend"

let backend: Backend | null | undefined

export function getBackend(): Backend | null {
  if (backend !== undefined) return backend
  backend = null
  if (SUPABASE_ENV) {
    backend = supabaseBackend(SUPABASE_ENV.url, SUPABASE_ENV.anonKey)
  } else if (import.meta.env.DEV) {
    // dead code in `vite build`: the fake backend and its seed never reach dist
    if (FEATURES.cabinetFake) {
      backend = createFakeBackend({ storage: typeof localStorage !== "undefined" ? localStorage : null })
      console.info("[cabinet] VITE_CABINET_FAKE=1: in-memory бэкенд, вход без письма (mentor@demo.abitura / student@demo.abitura)")
    }
  }
  return backend
}

/** Tests only. */
export function setBackendForTests(b: Backend | null | undefined): void {
  backend = b
}
