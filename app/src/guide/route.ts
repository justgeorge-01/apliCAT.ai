/**
 * Hash routes of the public guide. A hash survives GitHub Pages (no server
 * rewrites) and gives every university its own address to share:
 *
 *   #/                 – the catalog
 *   #/u/<id>           – one university
 *   #/about            – about the project
 *
 * Anything else falls back to the catalog.
 */
export type GuideRoute = { page: "home" } | { page: "university"; id: string } | { page: "about" }

const ID_RE = /^[a-z0-9-]{1,80}$/

export function parseRoute(hash: string): GuideRoute {
  const path = hash.replace(/^#/, "").replace(/^\/+/, "").replace(/\/+$/, "")
  if (path === "about") return { page: "about" }
  const m = /^u\/(.+)$/.exec(path)
  if (m) {
    let id = m[1]
    try {
      id = decodeURIComponent(id)
    } catch {
      return { page: "home" }
    }
    if (ID_RE.test(id)) return { page: "university", id }
  }
  return { page: "home" }
}

export function routeHref(route: GuideRoute): string {
  if (route.page === "about") return "#/about"
  if (route.page === "university") return `#/u/${encodeURIComponent(route.id)}`
  return "#/"
}

export function universityHref(id: string): string {
  return routeHref({ page: "university", id })
}
