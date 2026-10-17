// Invitations into online rooms (server/arcade/rooms.js): "come play in my room". The room
// decides the game; an accepted invitation lets the invitee into the private room, and the
// game window joins it. An invitation lasts a minute.

const crypto = require("crypto")

const INVITE_MS = 60_000
const MAX_WAITING = 6 // per inviter

const newId = () => crypto.randomBytes(6).toString("hex")

const createInvites = ({ emit, rooms }) => {
  const invites = new Map() // id -> { id, game, from, fromName, to, toName, matchId, expiresAt, timer }

  const send = (pid, event, payload) => pid && emit(pid, event, payload)
  const view = (inv) => ({ id: inv.id, game: inv.game, gameName: rooms.nameOf(inv.game), online: true, from: inv.fromName, fromId: inv.from, options: {}, expiresAt: inv.expiresAt })

  // status: accepted | declined | expired | canceled | gone (the other side left)
  const end = (inv, status, error) => {
    if (!invites.has(inv.id)) return
    clearTimeout(inv.timer)
    invites.delete(inv.id)
    if (status !== "accepted") send(inv.to, "net:inviteGone", { id: inv.id })
    if (status !== "canceled") send(inv.from, "net:inviteResult", { id: inv.id, status, to: inv.toName, game: inv.game, gameName: rooms.nameOf(inv.game), error })
    if (status !== "accepted") rooms.inviteEnded(inv.matchId, inv.toName)
  }

  const invite = ({ from, fromName, to, toName, matchId }) => {
    const roomId = String(matchId || "")
    if (!rooms.rooms.has(roomId)) return { ok: false, error: "Open a room first." }
    if (from === to) return { ok: false, error: "You can't play against yourself." }
    const waiting = [...invites.values()]
    if (waiting.filter((i) => i.from === from).length >= MAX_WAITING) return { ok: false, error: "You have too many invitations waiting. Wait for some answers first." }
    if (waiting.some((i) => i.from === from && i.to === to && i.matchId === roomId)) return { ok: false, error: `You already invited ${toName}.` }
    const check = rooms.canInvite(from, roomId)
    if (!check.ok) return check
    const inv = { id: newId(), game: rooms.rooms.get(roomId).game.id, from, fromName, to, toName, matchId: roomId, expiresAt: Date.now() + INVITE_MS }
    inv.timer = setTimeout(() => end(inv, "expired"), INVITE_MS)
    inv.timer.unref?.()
    invites.set(inv.id, inv)
    send(to, "net:invited", view(inv))
    rooms.invitedTo(roomId, toName)
    return { ok: true, inviteId: inv.id, gameName: rooms.nameOf(inv.game) }
  }

  const replyInvite = (pid, id, accept) => {
    const inv = invites.get(id)
    if (!inv || inv.to !== pid) return { ok: false, error: "That invitation has expired." }
    if (!accept) {
      end(inv, "declined")
      return { ok: true }
    }
    const result = rooms.allow(pid, inv.matchId)
    end(inv, result.ok ? "accepted" : "gone")
    return result
  }

  const cancelInvite = (pid, id) => {
    const inv = invites.get(id)
    if (inv && inv.from === pid) end(inv, "canceled")
    return { ok: true }
  }

  // Gone for good: drop their invitations both ways
  const drop = (pid) => {
    for (const inv of [...invites.values()]) {
      if (inv.to === pid) end(inv, "gone")
      else if (inv.from === pid) end(inv, "canceled")
    }
  }

  // Reconnected: invitations waiting for them again
  const resync = (pid) => {
    for (const inv of invites.values()) if (inv.to === pid) send(pid, "net:invited", view(inv))
  }

  return { invite, replyInvite, cancelInvite, drop, resync, invites }
}

module.exports = { createInvites, INVITE_MS }
