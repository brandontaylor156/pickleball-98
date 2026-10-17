// The network: every open Pickleball 98 is a computer on it. A computer whose socket signed in
// with a player token (server/players) shows up under the player's name, everyone else as
// GUEST-XXXX. Computers invite each other into online rooms (invites.js), walk around My Park
// (server/park), Explore (server/roam) and watch Live Broadcasts (server/broadcast).
//
// A computer is identified by a secret token the browser tab keeps, so a dropped
// connection that comes back within RESUME_GRACE_MS picks up where it left off (same name,
// same room). Everything here lives in memory.

const crypto = require("crypto")
const { limiter } = require("./limiter")
const { createInvites } = require("./invites")
const { createRooms } = require("../arcade/rooms")
const ROOM_GAMES = require("../arcade/games")
const { createPark } = require("../park")
const { createRoam } = require("../roam")
const { createBroadcasts } = require("../broadcast")

const RESUME_GRACE_MS = 30_000
const TOKEN = /^[a-f0-9]{32}$/

const newId = () => crypto.randomBytes(6).toString("hex")

// players: the players service (server/players), or anything with the same `sessions` map
const attachNet = (io, { players: initialPlayers = null, graceMs = RESUME_GRACE_MS, rooms: roomsOptions = {}, park: parkOptions = {}, roam: roamOptions = null, broadcast: broadcastOptions = {} } = {}) => {
  let players = initialPlayers
  const computers = new Map() // token -> computer
  const byPid = new Map() // pid -> computer

  const inviteLimit = limiter(12, 60_000)
  const helloLimit = limiter(30, 60_000)

  // ---------- who is who ----------

  // The player signed in through this computer's socket, if any
  const sessionOf = (computer) => {
    if (!players || !computer.socket) return null
    const session = players.sessions.get(computer.socket.data.key)
    return session && session.socket === computer.socket ? session : null
  }
  const nameOf = (computer) => sessionOf(computer)?.user.screenName || computer.guestName
  const whoOf = (computer) => ({ pid: computer.pid, name: nameOf(computer), key: sessionOf(computer)?.key || null })

  const publicView = (computer) => ({
    id: computer.pid,
    name: nameOf(computer),
    user: !!sessionOf(computer),
    device: computer.device,
    busy: rooms.busy(computer.pid),
    since: computer.since,
  })

  const listFor = (viewer) =>
    [...computers.values()]
      .filter((c) => c.socket && (c.visible || c === viewer))
      .map((c) => ({ ...publicView(c), me: c === viewer, hidden: !c.visible }))

  // Everyone's list, at most a few times a second
  let broadcastQueued = false
  const broadcast = () => {
    if (broadcastQueued) return
    broadcastQueued = true
    setTimeout(() => {
      broadcastQueued = false
      for (const c of computers.values()) if (c.socket) c.socket.emit("net:computers", listFor(c))
    }, 150)
  }

  const emitTo = (computer, event, payload) => computer?.socket?.emit(event, payload)
  const emitPid = (pid, event, payload) => emitTo(byPid.get(pid), event, payload)
  const emitVolatile = (pid, event, payload) => byPid.get(pid)?.socket?.volatile.emit(event, payload)
  const noBlocks = () => false

  // Online rooms (server/arcade): Quick Match, join codes and seats for Pickleball matches
  const rooms = createRooms({ games: ROOM_GAMES, emit: emitPid, emitVolatile, blocked: noBlocks, ...roomsOptions })
  const invites = createInvites({ emit: emitPid, rooms })
  // My Park: who is where, the paddle racks, handing a court's people into a room (server/park)
  const park = createPark({ emit: emitPid, emitVolatile, rooms, blocked: noBlocks, ...parkOptions })
  // Explore, the open world: who's where in town, cars, riding along (server/roam)
  const roam = createRoam({ emit: emitPid, emitVolatile, ...(roamOptions || { meterTotal: parkOptions.meterTotal, capBytes: parkOptions.capBytes }) })
  // Live Broadcast (Real Games > Go Live): a real game's tracked data relayed live (server/broadcast)
  const liveCasts = createBroadcasts({ emit: emitPid, emitVolatile, aim: () => players, ...broadcastOptions })

  const guestName = () => {
    const taken = new Set([...computers.values()].map((c) => c.guestName))
    for (;;) {
      const name = `GUEST-${crypto.randomBytes(2).toString("hex").toUpperCase()}`
      if (!taken.has(name)) return name
    }
  }

  const removeComputer = (computer) => {
    if (computers.get(computer.token) !== computer) return
    clearTimeout(computer.dropTimer)
    computers.delete(computer.token)
    byPid.delete(computer.pid)
    invites.drop(computer.pid)
    rooms.drop(computer.pid)
    park.drop(computer.pid)
    roam.drop(computer.pid)
    liveCasts.drop(computer.pid)
    broadcast()
  }

  // A computer someone wants to reach: { id } from the network list, or { screenName }
  const findTarget = (from, to = {}) => {
    let target = null
    if (typeof to.id === "string") {
      target = byPid.get(to.id)
      if (target && !target.visible) target = null
    } else if (typeof to.screenName === "string") {
      const key = to.screenName.replace(/\s+/g, "").toLowerCase()
      target = [...computers.values()].find((c) => c.socket && sessionOf(c)?.key === key) || null
    }
    if (!target || !target.socket) return { error: "That player isn't online right now." }
    if (target === from) return { error: "That's you!" }
    return { target }
  }

  io.on("connection", (socket) => {
    const current = () => {
      const c = computers.get(socket.data.netToken)
      return c && c.socket === socket ? c : null
    }

    // Handlers for a computer that has said hello; errors never crash the server
    const on = (event, handler) =>
      socket.on(event, (payload = {}, ack = () => {}) => {
        if (typeof ack !== "function") ack = () => {}
        const computer = current()
        if (!computer) return ack({ ok: false, error: "Not connected to the network." })
        try {
          ack(handler(computer, payload && typeof payload === "object" ? payload : {}) || { ok: true })
        } catch (error) {
          console.error(`[net] ${event} failed`, error)
          ack({ ok: false, error: "Something went wrong. Please try again." })
        }
      })

    // Join (or rejoin) the network
    socket.on("net:hello", (payload = {}, ack = () => {}) => {
      if (typeof ack !== "function") return
      // (a null or odd payload must not throw: a throw here would take the whole server down)
      if (!payload || typeof payload !== "object") payload = {}
      if (helloLimit(socket.id)) return ack({ ok: false, error: "Too many requests." })
      let token = TOKEN.test(payload.token) ? payload.token : null
      let computer = token && computers.get(token)
      // Someone else is using this token (a duplicated browser tab): start fresh
      if (computer && computer.socket && computer.socket !== socket && computer.socket.connected) {
        computer = null
        token = null
      }
      // A computer this socket was before (it asked to be someone new, or someone else coming
      // back) leaves first: it would stay listed for good, its socket taken
      const previous = current()
      if (previous && previous !== computer) removeComputer(previous)
      if (!computer) {
        token = token || crypto.randomBytes(16).toString("hex")
        computer = { token, pid: newId(), guestName: guestName(), visible: true, device: "pc", since: Date.now(), socket: null }
        computers.set(token, computer)
        byPid.set(computer.pid, computer)
      }
      const resumed = !!computer.socket || !!computer.dropTimer
      clearTimeout(computer.dropTimer)
      computer.dropTimer = null
      if (computer.socket && computer.socket !== socket) computer.socket.leave("net")
      computer.socket = socket
      computer.visible = payload.visible !== false
      computer.device = payload.device === "phone" ? "phone" : "pc"
      socket.data.netToken = token
      socket.join("net")
      ack({ ok: true, token, me: { ...publicView(computer), hidden: !computer.visible }, computers: listFor(computer) })
      if (resumed) rooms.setAway(computer.pid, false)
      invites.resync(computer.pid)
      broadcast()
    })

    socket.on("disconnect", () => {
      const computer = current()
      if (!computer) return
      computer.socket = null
      rooms.setAway(computer.pid, true)
      computer.dropTimer = setTimeout(() => removeComputer(computer), graceMs)
      broadcast()
    })

    on("net:visible", (computer, { visible }) => {
      computer.visible = !!visible
      broadcast()
      return { ok: true, visible: computer.visible }
    })

    on("net:list", (computer) => ({ ok: true, computers: listFor(computer) }))

    // ---- invitations into online rooms ----

    on("net:invite", (computer, { to, matchId }) => {
      const found = findTarget(computer, to)
      if (found.error) return { ok: false, error: found.error }
      if (inviteLimit(computer.pid)) return { ok: false, error: "You're sending invitations too fast. Wait a minute." }
      const result = invites.invite({ from: computer.pid, fromName: nameOf(computer), to: found.target.pid, toName: nameOf(found.target), matchId })
      return result.ok ? { ...result, to: nameOf(found.target) } : result
    })
    on("net:inviteReply", (computer, { id, accept }) => invites.replyInvite(computer.pid, String(id), !!accept))
    on("net:inviteCancel", (computer, { id }) => invites.cancelInvite(computer.pid, String(id)))

    rooms.wire(socket, current, whoOf)
    park.wire(socket, current, whoOf)
    roam.wire(socket, current, whoOf)
    liveCasts.wire(socket, current, whoOf)
  })

  // Names change as players sign in from another tab, and "busy" flags as games start and
  // end: look every few seconds
  setInterval(() => {
    let changed = false
    for (const c of computers.values()) {
      const signature = `${nameOf(c)} ${rooms.busy(c.pid)}`
      if (signature !== c.signature) changed = true
      c.signature = signature
    }
    if (changed) broadcast()
  }, 3000).unref?.()

  return {
    usePlayers: (value) => {
      players = value
      broadcast()
    },
    computers,
    invites,
    // who a socket is on the network ({ pid, name })
    whoIs: (socket) => {
      const c = computers.get(socket.data.netToken)
      return c && c.socket === socket ? { pid: c.pid, name: nameOf(c) } : null
    },
    rooms,
    park,
    roam,
    liveCasts,
  }
}

module.exports = { attachNet }
