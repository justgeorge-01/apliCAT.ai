/**
 * What the app reads from the address bar on load (cabinet spec §3):
 *  - `?join=CODE`       – an invitation; applied after sign-in;
 *  - `?confirm=delete`  – the return of the «удалить аккаунт» e-mail;
 *  - the auth tokens Supabase appends after a magic link (`#access_token=…`
 *    in the implicit flow, `?code=…` in PKCE) and its `error*` params.
 * `cleanAuthUrl` strips all of that and keeps everything else (`?partner=`).
 */

export const JOIN_PARAM = "join"
export const CONFIRM_PARAM = "confirm"
export const CONFIRM_DELETE = "delete"

/** Storage key of an invitation code waiting for sign-in (`admitica.cn.join`). */
export const PENDING_JOIN_KEY = "cn.join"

const AUTH_HASH_PARAMS = new Set([
  "access_token",
  "refresh_token",
  "expires_in",
  "expires_at",
  "token_type",
  "type",
  "provider_token",
  "provider_refresh_token",
  "error",
  "error_code",
  "error_description",
])
const AUTH_QUERY_PARAMS = new Set(["code", "error", "error_code", "error_description", JOIN_PARAM, CONFIRM_PARAM])

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,38}[A-Z0-9]$/

/** Upper-cased, trimmed invitation code; null when it cannot be one. */
export function normalizeJoinCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null
  const s = raw.trim().toUpperCase()
  return CODE_RE.test(s) ? s : null
}

export interface AuthUrlState {
  join: string | null
  confirmDelete: boolean
  /** Supabase tokens / code are present – a magic link is being consumed. */
  hasAuthParams: boolean
  /** `error_description` from Supabase (e.g. an expired link), null otherwise. */
  error: string | null
}

function params(s: string): URLSearchParams {
  try {
    return new URLSearchParams(s.replace(/^[#?]/, ""))
  } catch {
    return new URLSearchParams()
  }
}

export function parseAuthUrl(search: string, hash: string): AuthUrlState {
  const q = params(search)
  const h = params(hash)
  const error = h.get("error_description") ?? q.get("error_description") ?? h.get("error") ?? q.get("error")
  return {
    join: normalizeJoinCode(q.get(JOIN_PARAM)),
    confirmDelete: q.get(CONFIRM_PARAM) === CONFIRM_DELETE,
    hasAuthParams: h.has("access_token") || h.has("refresh_token") || q.has("code"),
    error: error ? error.replace(/\+/g, " ") : null,
  }
}

/** The same URL without auth / join / confirm params; the hash is dropped when only tokens were in it. */
export function cleanAuthUrl(href: string): string {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return href
  }
  for (const k of [...url.searchParams.keys()]) if (AUTH_QUERY_PARAMS.has(k)) url.searchParams.delete(k)
  const h = params(url.hash)
  let hashHadTokens = false
  for (const k of [...h.keys()]) {
    if (AUTH_HASH_PARAMS.has(k)) {
      h.delete(k)
      hashHadTokens = true
    }
  }
  if (hashHadTokens) url.hash = [...h.keys()].length ? `#${h.toString()}` : ""
  return url.toString()
}

/** Return address for the magic link: this page, optionally with `?confirm=delete`. */
export function redirectUrl(base: string, confirmDelete = false): string {
  const url = new URL(cleanAuthUrl(base))
  url.hash = ""
  if (confirmDelete) url.searchParams.set(CONFIRM_PARAM, CONFIRM_DELETE)
  return url.toString()
}

/** The invitation link the mentor shares. */
export function inviteUrl(base: string, code: string): string {
  const url = new URL(cleanAuthUrl(base))
  url.hash = ""
  url.search = ""
  url.searchParams.set(JOIN_PARAM, code)
  return url.toString()
}
