import { useEffect, useState } from "react"

/**
 * Persistent state, byte-compatible with the legacy site:
 * same `admitica.<key>` localStorage keys, same JSON encoding.
 * DO NOT change the prefix or encoding – users already have data there.
 */
export function usePersist<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const s = localStorage.getItem("admitica." + key)
      return s ? (JSON.parse(s) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem("admitica." + key, JSON.stringify(value))
    } catch {
      /* quota / private mode */
    }
  }, [key, value])
  return [value, setValue] as const
}

export function readPersist<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem("admitica." + key)
    return s ? (JSON.parse(s) as T) : fallback
  } catch {
    return fallback
  }
}
