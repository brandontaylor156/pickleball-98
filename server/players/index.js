// Players: Pickleball 98 has no accounts or passwords. Picking a name (POST /api/players)
// hands back a secret token the browser keeps; that token is the player from then on, for
// HTTP ("Authorization: Bearer <token>") and the socket (io(url, { auth: { token } })).
// Lose the token (cleared browser data) and the name is gone with it.
//
//   POST   /api/players  { name }  -> 201 { name, key, token } | 409 name taken | 400 bad name
//   GET    /api/players/me         -> { name, key } | 401
//   PATCH  /api/players/me { name } -> { name, key }  (only case/spacing: see rename)
//   DELETE /api/players/me         -> { ok, erased }  (everything kept for the player, then them)
//
// The service also answers the questions the game's server modules used to ask 98 Messenger
// (authenticate, sessions, store.find), so they work unchanged.

const crypto = require("crypto")
const express = require("express")
const { limiter } = require("../net/limiter")
const { validate } = require("./names")
const { sessionFrom } = require("./auth")
const { createPlayerStore } = require("./store")

const TOKEN = /^[a-f0-9]{48}$/
const SEEN_EVERY_MS = 60 * 60_000 // lastSeen is written at most hourly
const hashOf = (token) => crypto.createHash("sha256").update(token).digest("hex")

const createPlayers = ({ store, now = Date.now, limits = {} } = {}) => {
  const storeReady = Promise.resolve(store || createPlayerStore())
  storeReady.catch((error) => console.error("[players] store failed", error))
  // key -> { key, token, screenName, user: { screenName, blocked, groups }, socket }: the players
  // with a socket open (98 Messenger's sessions map, which the game modules read)
  const sessions = new Map()
  const known = new Map() // tokenHash -> { key, name } (saves a database read per request)
  let eraser = null

  const sessionView = (player, token, socket = null) => ({
    key: player.key,
    token,
    screenName: player.name,
    user: { screenName: player.name, blocked: [], groups: [] },
    socket,
  })

  // The player for a token, or null
  const authenticate = async (token) => {
    if (!TOKEN.test(String(token || ""))) return null
    const hash = hashOf(token)
    let player = known.get(hash)
    if (!player) {
      const found = await (await storeReady).byTokenHash(hash)
      if (!found) return null
      player = { key: found.key, name: found.name, seenAt: found.lastSeen }
      known.set(hash, player)
    }
    if (now() - (player.seenAt || 0) > SEEN_EVERY_MS) {
      player.seenAt = now()
      ;(await storeReady).update(player.key, { lastSeen: player.seenAt }).catch(() => {})
    }
    return sessionView(player, token, sessions.get(player.key)?.socket || null)
  }

  const create = async (rawName) => {
    const checked = validate(rawName)
    if (checked.error) return { status: 400, body: { error: checked.error } }
    const token = crypto.randomBytes(24).toString("hex")
    const at = now()
    const ok = await (await storeReady).create({ key: checked.key, name: checked.screenName, tokenHash: hashOf(token), createdAt: at, lastSeen: at })
    if (!ok) return { status: 409, body: { error: "That name is taken." } }
    return { status: 201, body: { name: checked.screenName, key: checked.key, token } }
  }

  // Everything the game keeps is filed under the key, and nothing moves it to a new key yet,
  // so a rename may only change how the same name is written ("cool dude" -> "Cool Dude").
  const rename = async (session, rawName) => {
    const checked = validate(rawName)
    if (checked.error) return { status: 400, body: { error: checked.error } }
    if (checked.key !== session.key) return { status: 409, body: { error: "Names can't change yet." } }
    await (await storeReady).update(session.key, { name: checked.screenName })
    for (const player of known.values()) if (player.key === session.key) player.name = checked.screenName
    const live = sessions.get(session.key)
    if (live) {
      live.screenName = checked.screenName
      live.user.screenName = checked.screenName
    }
    return { status: 200, body: { name: checked.screenName, key: session.key } }
  }

  const remove = async (session) => {
    const erased = eraser ? await eraser({ key: session.key, name: session.screenName }) : {}
    await (await storeReady).remove(session.key)
    for (const [hash, player] of known) if (player.key === session.key) known.delete(hash)
    const live = sessions.get(session.key)
    sessions.delete(session.key)
    live?.socket?.disconnect?.(true)
    return erased
  }

  // ---------- socket.io: io(url, { auth: { token } }) ----------

  // A good token signs the socket in as the player; none (or a bad one) connects as a guest,
  // who can still pick a name and reconnect
  const socketMiddleware = async (socket, next) => {
    try {
      const session = await authenticate(socket.handshake?.auth?.token)
      if (session) {
        socket.data.key = session.key
        socket.data.screenName = session.screenName
        sessions.set(session.key, { ...session, socket })
        socket.on("disconnect", () => {
          if (sessions.get(session.key)?.socket === socket) sessions.delete(session.key)
        })
      }
      next()
    } catch (error) {
      console.error("[players] socket sign-in failed", error?.message)
      next()
    }
  }

  // ---------- HTTP ----------

  const router = () => {
    const r = express.Router()
    const creates = limiter(limits.creates ?? 10, 60 * 60_000) // new names per IP per hour
    const badTokens = limiter(limits.badTokens ?? 30, 15 * 60_000) // per IP
    const ipOf = (request) => String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "").split(",")[0].trim()
    r.use(express.json({ limit: "4kb" }))

    const handle = (fn) => async (request, response) => {
      try {
        const { status = 200, body } = await fn(request)
        response.status(status).json(body)
      } catch (error) {
        console.error("[players]", error?.message)
        response.status(503).json({ error: "Pickleball 98 isn't answering. Try again in a minute." })
      }
    }
    const signedIn = (fn) =>
      handle(async (request) => {
        const ip = ipOf(request)
        if (badTokens.over(ip)) return { status: 429, body: { error: "Too many tries. Please wait a few minutes." } }
        const session = await sessionFrom(service, request)
        if (!session) {
          badTokens(ip)
          return { status: 401, body: { error: "Pick a player name first." } }
        }
        return fn(session, request)
      })

    r.post(
      "/",
      handle(async (request) => {
        if (creates(ipOf(request))) return { status: 429, body: { error: "That's a lot of new names. Try again later." } }
        return create(request.body?.name)
      }),
    )
    r.get("/me", signedIn(async (session) => ({ body: { name: session.screenName, key: session.key } })))
    r.patch("/me", signedIn((session, request) => rename(session, request.body?.name)))
    r.delete("/me", signedIn(async (session) => ({ body: { ok: true, erased: await remove(session) } })))
    return r
  }

  const service = {
    authenticate,
    sessions,
    // 98 Messenger's user lookup: { key, screenName, blocked } or null
    store: {
      find: async (key) => {
        const player = await (await storeReady).byKey(String(key || ""))
        return player ? { key: player.key, screenName: player.name, blocked: [], groups: [] } : null
      },
    },
    push: null,
    create,
    rename,
    remove,
    router,
    socketMiddleware,
    // erase({ key, name }) -> what was removed: everything the game keeps for a player
    useEraser: (fn) => {
      eraser = fn
    },
    getStore: () => storeReady,
  }
  return service
}

module.exports = { createPlayers }
