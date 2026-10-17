// Pickleball 98's server: players (no accounts, just a name and a token: server/players),
// Venue Finder, Real Games, tournaments, Living Park, Explore's places and Bag over HTTP; online
// rooms, My Park, Explore and Live Broadcast over socket.io (server/net).
//
// Environment (all optional for local play): MONGODB_URI (without it everything is kept in
// memory and lost on restart), PORT, OVERPASS_URL and VENUES_* (server/venues),
// WEB_MONTHLY_TOTAL_MB, TURN settings for voice (server/voice/ice.js), KEEP_AWAKE.

const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const { createPlayers } = require("./server/players")
const { attachNet } = require("./server/net")
const { venuesService } = require("./server/venues")
const { clubService } = require("./server/pbclub")
const { tourneyService } = require("./server/tourney")
const { livingParkService } = require("./server/livingpark")
const { createParkFinds } = require("./server/park/finds")
const { createRoamLife } = require("./server/roam/life")
const { createMeter } = require("./server/meter")

// Living Park, My Park finds and Explore's life use mongoose's default connection (the other
// stores open their own); in 98ish another module opened it, so it's opened here
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI, { maxPoolSize: 3 })
    .then(() => console.log("[mongoose] default connection open"))
    .catch((error) => console.error("[mongoose] default connection failed", error?.message))
}

const app = express()
app.use(cors())
app.get("/", (request, response) => response.send("Pickleball 98 server is running"))

const players = createPlayers()
app.use("/api/players", players.router())
// Venue Finder: any pickleball venue on Earth, built from OpenStreetMap (public map data,
// cached; nothing per player)
const venues = venuesService()
app.use("/api/venues", venues.router())
// Real Games: real-life matches, friends' ratings, play sessions
const pbclub = clubService({ aim: () => players, push: null })
app.use("/api/pbclub", pbclub.router())
pbclub.start()
// weekly in-game tournaments at the real venues, trophies
const tourneys = tourneyService({ aim: () => players, push: null })
app.use("/api/tourney", tourneys.router())
tourneys.start()
// Living Park: clones left in My Park while their owners are away (one small record per player)
const livingPark = livingParkService({ aim: () => players, push: null })
app.use("/api/livingpark", livingPark.router())
livingPark.start()
// My Park finds per player (Vince's car keys: server/park/finds.js)
const parkFinds = createParkFinds()
// Explore's private Home/Work places, the Bag and gifts per player (server/roam/life.js)
const roamLife = createRoamLife({ aim: () => players })
app.use("/api/roamlife", roamLife.router())
// errors no route answered (bad JSON, too big a body, a route that threw): a short JSON answer
// the game shows, never Express's HTML page with the server's stack trace
app.use((error, request, response, next) => {
  if (response.headersSent) return next(error)
  const status = Number(error?.status || error?.statusCode) || 500
  if (status >= 500) console.error("[http]", request.method, request.path, error?.message)
  response.status(status).json({ error: status === 413 ? "That's too big to send." : status < 500 ? "The game couldn't read that request." : "Something went wrong on the server. Try again in a minute." })
})

// DELETE /api/players/me: everything kept for a player, in order, then the player
players.useEraser(async (ctx) => {
  const steps = [
    ["pickleball", () => pbclub.eraseAccount(ctx)],
    ["park clones", () => livingPark.eraseAccount(ctx)],
    ["park finds", () => parkFinds.eraseAccount(ctx)],
    ["roam life", () => roamLife.eraseAccount(ctx)],
    ["tournaments", () => tourneys.eraseAccount(ctx)],
  ]
  const erased = {}
  for (const [name, step] of steps) erased[name] = await step()
  return erased
})

const meter = createMeter()
const port = process.env.PORT || 8000
const server = app.listen(port, () => {
  console.log(`Pickleball 98 server on port ${port}`)
  // voice in My Park and Explore: which TURN relay is set up (names only)
  const turn = require("./server/voice/ice").createIce().providers()
  console.log(turn.length ? `[ice] TURN relay on (${turn.join(", ")})` : "[ice] no TURN relay set up: voice is STUN-only (cellular often can't connect)")
})
meter.attach(server)

for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => process.exit(0))

// Render's free plan puts the server to sleep after 15 minutes without a visitor (waking
// takes 20-50 s). On Render (which sets RENDER_EXTERNAL_URL) it visits itself every 10
// minutes through the public address, which counts as a visit. KEEP_AWAKE=0 turns it off.
if (process.env.RENDER_EXTERNAL_URL && process.env.KEEP_AWAKE !== "0") {
  const selfUrl = process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "") + "/"
  setInterval(() => {
    fetch(selfUrl, { headers: { "user-agent": "pickleball-98-keep-awake" } }).catch(() => {})
  }, 10 * 60 * 1000).unref()
}

const io = require("socket.io")(server, { cors: true, maxHttpBufferSize: 2 * 1024 * 1024 })
// io(url, { auth: { token } }): a player's socket; no token connects as a guest
io.use(players.socketMiddleware)
// (My Park sends positions less often when the month's traffic runs high: server/park)
attachNet(io, {
  players,
  park: { meterTotal: () => meter.total(), capBytes: (Number(process.env.WEB_MONTHLY_TOTAL_MB) || 3000) * 1024 * 1024, liveVenues: venues.liveVenues, finds: parkFinds },
})
