// Opening Help from anywhere (small and eager: it only sends an event; components/help/Help.jsx
// shows the window).
//
//   openHelp("pickleball-club")                 // a topic by id
//   menu items: helpItem("pickleball")          // "Help Topics F1"

export const HELP_EVENT = "pk98:help"

export const helpTarget = (what) => (typeof what === "string" ? { topic: what } : what && typeof what === "object" ? { ...what } : {})

export const openHelp = (what) => window.dispatchEvent(new CustomEvent(HELP_EVENT, { detail: helpTarget(what) }))

export const helpItem = (what, { f1 = true } = {}) => ({ label: f1 ? "Help Topics F1" : "Help Topics", onClick: () => openHelp(what) })
