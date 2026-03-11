/**
 * Shared watchlist localStorage utility.
 * Used by both the Screener (add) and Watchlist page (CRUD).
 *
 * Storage format: JSON array of { symbol, addedAt } in localStorage.
 * Key: "jcn_watchlist"
 */

const STORAGE_KEY = "jcn_watchlist"

export interface WatchlistEntry {
  symbol: string
  addedAt: string // ISO timestamp
}

/** Get all watchlist entries, sorted by addedAt (newest first). */
export function getWatchlist(): WatchlistEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const entries = JSON.parse(raw) as WatchlistEntry[]
    return entries.sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
    )
  } catch {
    return []
  }
}

/** Add a symbol to the watchlist. No-op if already present. Returns true if added. */
export function addToWatchlist(symbol: string): boolean {
  const clean = symbol.trim().toUpperCase().replace(".US", "")
  if (!clean) return false

  const list = getWatchlist()
  if (list.some((e) => e.symbol === clean)) return false

  list.push({ symbol: clean, addedAt: new Date().toISOString() })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))

  // Dispatch custom event so other open tabs/components can react
  window.dispatchEvent(new CustomEvent("watchlist-change"))
  return true
}

/** Remove a symbol from the watchlist. Returns true if removed. */
export function removeFromWatchlist(symbol: string): boolean {
  const clean = symbol.trim().toUpperCase().replace(".US", "")
  const list = getWatchlist()
  const filtered = list.filter((e) => e.symbol !== clean)
  if (filtered.length === list.length) return false

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  window.dispatchEvent(new CustomEvent("watchlist-change"))
  return true
}

/** Clear entire watchlist. */
export function clearWatchlist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
  window.dispatchEvent(new CustomEvent("watchlist-change"))
}

/** Check if a symbol is on the watchlist. */
export function isOnWatchlist(symbol: string): boolean {
  const clean = symbol.trim().toUpperCase().replace(".US", "")
  return getWatchlist().some((e) => e.symbol === clean)
}
