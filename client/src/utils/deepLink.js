// Links from 98ish (its Pickleball 98 icon, Messenger's venue cards, Floppy: 98ish
// utils/pickleballSite.js) open this site as ?mode=&venue=&place=. Read once at start-up and
// turned into the same handoff 98ish used to pass in, so Pickleball.jsx starts there.

const MODES = new Set(["quick", "practice", "park", "real", "online", "tour"])

// search: a location.search string -> a handoff ({ id, floppy }) or null
export const handoffFromSearch = (search, id = Date.now()) => {
  const q = new URLSearchParams(search || "")
  const mode = q.get("mode")
  const venue = (q.get("venue") || "").slice(0, 80) || null
  let place = null
  const raw = q.get("place")
  if (raw && raw.length <= 2000) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) place = parsed
    } catch {}
  }
  if (MODES.has(mode)) return { id, floppy: { mode, venue: mode === "park" ? venue : null, place: mode === "park" ? place : null } }
  if (venue) return { id, floppy: { mode: "park", venue, place } }
  return null
}

// the handoff in this page's address, which is then cleared so a reload doesn't start it again
export const takeLinkHandoff = () => {
  if (typeof window === "undefined") return null
  const handoff = handoffFromSearch(window.location.search)
  if (handoff) {
    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.hash)
    } catch {}
  }
  return handoff
}
