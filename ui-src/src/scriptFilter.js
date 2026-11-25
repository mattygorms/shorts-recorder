// Pure helpers for the scripts list: today+yesterday filter, lock file I/O, sort.
// America/New_York calendar date is the source of truth, matching the rest of the app.

export const LOCK_FILE = 'locked.json'

export function isLockFile(name) {
  return String(name || '').toLowerCase() === LOCK_FILE
}

export function nyDay(ms) {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

export function isTodayNY(ms, now = Date.now()) {
  if (ms == null || isNaN(ms)) return false
  return nyDay(ms) === nyDay(now)
}

// Created today or yesterday (America/New_York calendar days). Scripts written
// the evening before still show up the next morning.
export function isRecentNY(ms, now = Date.now()) {
  if (ms == null || isNaN(ms)) return false
  return nyDay(ms) >= nyDay(now - 864e5)
}

// Parse a created: header (YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS]) to a timestamp.
// Datetimes without a zone are treated as local time (Matt's PC is America/New_York).
export function parseCreatedMs(created, fallbackMs = null) {
  if (created != null && String(created).trim()) {
    let s = String(created).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T12:00:00'
    else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) s += ':00'
    const t = Date.parse(s)
    if (!isNaN(t)) return t
  }
  return fallbackMs == null || isNaN(fallbackMs) ? null : fallbackMs
}

export function isLockedName(locks, k) {
  if (!k || !locks) return false
  if (locks[k]) return true
  const kl = String(k).toLowerCase()
  for (const key of Object.keys(locks)) {
    if (locks[key] && key.toLowerCase() === kl) return true
  }
  return false
}

export function shouldKeep(row, locks, now = Date.now()) {
  if (row && isLockedName(locks, row.k)) return true
  return isRecentNY(row && row.created, now)
}

// Locked scripts cannot be deleted (trash or keyboard) until unlocked.
export function canDelete(locks, k) {
  return !!k && !isLockedName(locks, k)
}

export function parseLocks(text) {
  try {
    const j = JSON.parse(text)
    if (Array.isArray(j)) {
      const out = {}
      for (const k of j) if (k && !isLockFile(k)) out[String(k)] = true
      return out
    }
    if (j && typeof j === 'object') {
      const src = j.locks && typeof j.locks === 'object' && !Array.isArray(j.locks) ? j.locks : j
      const out = {}
      for (const [k, v] of Object.entries(src)) {
        if (k && k !== 'locks' && v && !isLockFile(k)) out[k] = true
      }
      return out
    }
  } catch (e) { /* ignore invalid JSON */ }
  return {}
}

export function serializeLocks(locks) {
  const out = {}
  const keys = Object.keys(locks || {}).filter((k) => locks[k] && !isLockFile(k)).sort((a, b) => a.localeCompare(b))
  for (const k of keys) out[k] = true
  return JSON.stringify(out, null, 2) + '\n'
}

export function clearLock(locks, k) {
  const next = { ...locks }
  const kl = String(k).toLowerCase()
  for (const key of Object.keys(next)) {
    if (key === k || key.toLowerCase() === kl) delete next[key]
  }
  return next
}

export function sortVisible(rows) {
  return [...rows].sort((a, b) => {
    const la = a.locked ? 1 : 0
    const lb = b.locked ? 1 : 0
    if (lb !== la) return lb - la
    return ((b.created || 0) - (a.created || 0)) || String(a.k).localeCompare(String(b.k))
  })
}
