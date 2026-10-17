import { useEffect } from "react"
import { notice } from "../../../utils/notice"
import { refreshSoon } from "../../../utils/pbclub"

// Lives beside the game (App.jsx) whether or not Real Games is open: the server's "pb:changed"
// notices refresh utils/pbclub.js, and an invitation, a match waiting for you or a friend going
// live shows a notice whose Open button takes you there (onOpen(handoff): Pickleball's handoff).

const PbClubBridge = ({ socket, onOpen }) => {
  useEffect(() => {
    if (!socket) return
    const onChanged = (p) => {
      // tournaments (utils/tourney.js): a partner invitation, the draw, a result
      if (p?.kind === "tourney") {
        import("../../../utils/tourney").then((m) => (m.refreshSoon(), p.id && m.getTourneys().docs[p.id] && m.open(p.id))).catch(() => {})
        if (p.partner) notice(`${p.by} wants you as a tournament partner`, "Accept in Pickleball 98 > Real Games > Tournaments.", "info", { label: "Open", onClick: () => onOpen?.({ id: Date.now(), tourney: p.id }) })
        return
      }
      refreshSoon()
      if (p?.invited && p.kind === "session") {
        notice(`${p.by} invited you to play pickleball`, "In or out? Open Real Games in Pickleball 98.", "info", { label: "Open", onClick: () => onOpen?.({ id: Date.now(), session: p.id }) })
      }
      if (p?.confirm && p.kind === "match") {
        notice(`${p.by} logged a match with you`, "Confirm the score so it counts.", "info", { label: "Open", onClick: () => onOpen?.({ id: Date.now(), match: p.id }) })
      }
    }
    // Live Broadcast: a friend went live (server/broadcast bc:live)
    const onLive = (b) => {
      if (!b?.id) return
      notice(`${b.host} is live${b.court ? ` on court ${b.court}` : ""}`, `${b.title}. Watch it live in 3D.`, "info", { label: "Watch", onClick: () => onOpen?.({ id: Date.now(), live: b.id }) })
    }
    socket.on("pb:changed", onChanged)
    socket.on("bc:live", onLive)
    return () => {
      socket.off("pb:changed", onChanged)
      socket.off("bc:live", onLive)
    }
  }, [socket, onOpen])
  return null
}

export default PbClubBridge
