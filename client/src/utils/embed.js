// Inside 98ish: its Pickleball 98 window shows this site in a frame (98ish
// components/applets/pickleballLauncher), opened as ?embed=98ish. There the game plays as it
// did before the split: Game > Exit closes 98ish's window, and a new start (Messenger's
// "Play here", Floppy) arrives as a message instead of a reload.
//   ?name=      98ish's screen name, filled in on the name dialog
//   to 98ish:   { type: "pk98:exit" }
//   from 98ish: { type: "pk98:open", search: "?mode=&venue=&place=" } (utils/deepLink.js)

// where 98ish runs: only those pages may send starts
const HOSTS = [/^https:\/\/98ish\.vercel\.app$/, /^https:\/\/98ish-[a-z0-9-]+\.vercel\.app$/, /^http:\/\/localhost(:\d+)?$/]
export const hostAllowed = (origin) => HOSTS.some((re) => re.test(String(origin || "")))

const read = () => {
  if (typeof window === "undefined" || window.parent === window) return false
  try {
    return new URLSearchParams(window.location.search).get("embed") === "98ish"
  } catch {
    return false
  }
}
// (read once at start-up, before deepLink.js clears the address)
export const EMBEDDED = read()
// 98ish's Messenger screen name, offered as the player name (?name=; the player still says yes)
export const SUGGESTED_NAME = (() => {
  if (!EMBEDDED) return ""
  try {
    return (new URLSearchParams(window.location.search).get("name") || "").trim().slice(0, 24)
  } catch {
    return ""
  }
})()

// Game > Exit: 98ish closes the window (no data goes with it)
export const exitToHost = () => {
  try {
    window.parent.postMessage({ type: "pk98:exit" }, "*")
  } catch {}
}

// a new start from 98ish while the game is open -> onSearch(search)
export const onHostOpen = (onSearch) => {
  if (!EMBEDDED) return () => {}
  const listen = (event) => {
    if (event.source !== window.parent || !hostAllowed(event.origin)) return
    const m = event.data
    if (m?.type === "pk98:open" && typeof m.search === "string" && m.search.length <= 2400) onSearch(m.search)
  }
  window.addEventListener("message", listen)
  return () => window.removeEventListener("message", listen)
}
