// The network over real sockets: guests and players, hiding, room invitations, reconnecting
const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const { Server } = require("socket.io")
const { attachNet } = require("..")
const { createPlayers } = require("../../players")
const { memoryStore } = require("../../players/store")

// socket.io-client is a dev dependency
let ioClient = null
try {
  ioClient = require("socket.io-client")
} catch {
  ioClient = null
}

const setup = async (options) => {
  const server = http.createServer()
  const io = new Server(server)
  const players = createPlayers({ store: memoryStore() })
  io.use(players.socketMiddleware)
  const net = attachNet(io, { players, ...options })
  await new Promise((r) => server.listen(0, r))
  const url = `http://127.0.0.1:${server.address().port}`
  const sockets = []
  const connect = async (hello = {}, auth = {}) => {
    const socket = ioClient(url, { transports: ["websocket"], forceNew: true, auth })
    sockets.push(socket)
    const me = await new Promise((resolve) => socket.emit("net:hello", hello, resolve))
    return { socket, me, ask: (event, payload = {}) => new Promise((resolve) => socket.emit(event, payload, resolve)) }
  }
  const close = () => {
    sockets.forEach((s) => s.close())
    io.close()
    server.close()
  }
  return { net, players, connect, close }
}

const next = (socket, event) => new Promise((resolve) => socket.once(event, resolve))

test("guests and players, hiding, room invitations and reconnecting", { skip: !ioClient && "socket.io-client not installed" }, async () => {
  const { net, players, connect, close } = await setup({ graceMs: 300 })
  try {
    const a = await connect()
    const made = await players.create("Dink Master")
    const b = await connect({ device: "phone" }, { token: made.body.token })
    assert.match(a.me.me.name, /^GUEST-[0-9A-F]{4}$/)
    assert.equal(b.me.me.name, "Dink Master", "a player's socket shows their name")
    assert.equal(b.me.me.user, true)
    assert.equal(b.me.me.device, "phone")
    assert.ok(players.sessions.get("dinkmaster")?.socket, "the player is online")
    const bad = await connect({}, { token: "f".repeat(48) })
    assert.match(bad.me.me.name, /^GUEST-/, "a bad token connects as a guest")
    assert.equal((await a.ask("net:list")).computers.length, 3)
    const bId = b.me.me.id

    // invitations need a room, and reach the player by id or by name
    assert.match((await a.ask("net:invite", { to: { id: bId }, matchId: "nope" })).error, /Open a room/)
    const room = net.rooms.create({ pid: a.me.me.id, name: a.me.me.name, key: null }, "pickleball")
    assert.ok(room.ok, room.error)
    const invited = next(b.socket, "net:invited")
    const sent = await a.ask("net:invite", { to: { screenName: "dinkmaster" }, matchId: room.roomId })
    assert.ok(sent.ok, sent.error)
    const card = await invited
    assert.equal(card.game, "pickleball")
    const reply = await b.ask("net:inviteReply", { id: card.id, accept: true })
    assert.equal(reply.onlineRoom, room.roomId)
    assert.equal((await a.ask("net:invite", { to: { id: a.me.me.id }, matchId: room.roomId })).ok, false, "not yourself")

    // hidden computers can't be reached or seen
    await b.ask("net:visible", { visible: false })
    assert.equal((await a.ask("net:list")).computers.length, 2)
    assert.equal((await a.ask("net:invite", { to: { id: bId }, matchId: room.roomId })).ok, false)
    await b.ask("net:visible", { visible: true })

    // reconnecting with the token keeps the same computer
    const token = b.me.token
    b.socket.close()
    const b2 = await connect({ token }, { token: made.body.token })
    assert.equal(b2.me.me.id, bId)
    assert.equal(b2.me.me.name, "Dink Master")

    // a duplicated tab with the same token becomes a new computer
    const b3 = await connect({ token })
    assert.notEqual(b3.me.me.id, bId)

    // gone for good after the grace period
    b2.socket.close()
    await new Promise((r) => setTimeout(r, 500))
    const c = await connect({ token })
    assert.notEqual(c.me.me.id, bId)
  } finally {
    close()
  }
})

test("a null hello is answered, not thrown (a throw in a socket handler stops the server)", { skip: !ioClient && "socket.io-client not installed" }, async () => {
  const { connect, close } = await setup({ graceMs: 300 })
  try {
    const a = await connect(null)
    assert.equal(a.me.ok, true)
    assert.match(a.me.me.name, /^GUEST-/)
  } finally {
    close()
  }
})

test("a socket that takes up another computer's token leaves no ghost of the one it was", { skip: !ioClient && "socket.io-client not installed" }, async () => {
  const { net, connect, close } = await setup({ graceMs: 5000 })
  try {
    const a = await connect()
    const b = await connect()
    b.socket.close()
    await new Promise((r) => setTimeout(r, 100))
    const again = await a.ask("net:hello", { token: b.me.token })
    assert.equal(again.me.id, b.me.me.id)
    assert.equal(net.computers.size, 1, "only the computer the socket is now")
  } finally {
    close()
  }
})
