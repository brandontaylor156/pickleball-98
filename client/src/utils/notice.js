// Messages for the player, shown as a 98 dialog by <Notices /> (components/Notices.jsx).
// Small and eager: it only sends an event, so anything can call it (no React needed).
//
//   notice("Twin Replay", "The replay was saved.")              // info
//   notice("Play Online", "That code has expired.", "warn")
//   notice("Ben invited you", "Open Real Games?", "info", { label: "Open", onClick })   // a button too

export const NOTICE_EVENT = "pk98:notice"

export const notice = (title, text, icon = "info", action = null) =>
  window.dispatchEvent(new CustomEvent(NOTICE_EVENT, { detail: { title: String(title || "Pickleball 98"), text: String(text || ""), icon, action } }))
