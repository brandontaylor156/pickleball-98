// Players: picking a name hands out a token; the token signs HTTP requests and sockets in
const test = require("node:test")
const assert = require("node:assert/strict")
const express = require("express")
const { createPlayers } = require("..")
const { memoryStore } = require("../store")
const { validate, normalize } = require("../names")

const setup = async (options = {}) => {
  const players = createPlayers({ store: memoryStore(), ...options })
  const app = express()
  app.use("/api/players", players.router())
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s))
  })
  const base = `http://127.0.0.1:${server.address().port}/api/players`
  const call = async (method, path, { body, token } = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: response.status, body: await response.json() }
  }
  return { players, call, close: () => server.close() }
}

test("names: the 98 Messenger rules, case- and space-insensitive keys", () => {
  assert.deepEqual(validate("  Cool   Dude 98 "), { screenName: "Cool Dude 98", key: "cooldude98" })
  assert.equal(normalize("Cool Dude 98"), "cooldude98")
  for (const bad of ["ab", "9lives", "way too long a name here", "dash-name", ""]) assert.ok(validate(bad).error, bad)
})

test("HTTP: pick a name, use the token, a taken name, a bad name", async () => {
  const { call, close } = await setup()
  try {
    const made = await call("POST", "/", { body: { name: "Kitchen Queen" } })
    assert.equal(made.status, 201)
    assert.equal(made.body.name, "Kitchen Queen")
    assert.equal(made.body.key, "kitchenqueen")
    assert.match(made.body.token, /^[a-f0-9]{48}$/)
    assert.equal((await call("POST", "/", { body: { name: "kitchen queen" } })).status, 409)
    assert.equal((await call("POST", "/", { body: { name: "kitchen queen" } })).body.error, "That name is taken.")
    assert.equal((await call("POST", "/", { body: { name: "x" } })).status, 400)

    const me = await call("GET", "/me", { token: made.body.token })
    assert.equal(me.status, 200)
    assert.deepEqual(me.body, { name: "Kitchen Queen", key: "kitchenqueen" })
    assert.equal((await call("GET", "/me")).status, 401)
    assert.equal((await call("GET", "/me", { token: "a".repeat(48) })).status, 401)
  } finally {
    close()
  }
})

test("renaming: only how the same name is written", async () => {
  const { call, close } = await setup()
  try {
    const { token } = (await call("POST", "/", { body: { name: "lob star" } })).body
    const renamed = await call("PATCH", "/me", { token, body: { name: "Lob Star" } })
    assert.deepEqual(renamed.body, { name: "Lob Star", key: "lobstar" })
    assert.equal((await call("GET", "/me", { token })).body.name, "Lob Star")
    const other = await call("PATCH", "/me", { token, body: { name: "Someone Else" } })
    assert.equal(other.status, 409)
    assert.equal(other.body.error, "Names can't change yet.")
  } finally {
    close()
  }
})

test("deleting: the eraser runs, then the name is free again and the token is dead", async () => {
  const { players, call, close } = await setup()
  try {
    const erased = []
    players.useEraser(async (ctx) => (erased.push(ctx), { pickleball: { removed: 1 } }))
    const { token } = (await call("POST", "/", { body: { name: "Drop Shot" } })).body
    const gone = await call("DELETE", "/me", { token })
    assert.equal(gone.status, 200)
    assert.deepEqual(gone.body.erased, { pickleball: { removed: 1 } })
    assert.deepEqual(erased, [{ key: "dropshot", name: "Drop Shot" }])
    assert.equal((await call("GET", "/me", { token })).status, 401)
    assert.equal((await call("POST", "/", { body: { name: "Drop Shot" } })).status, 201)
  } finally {
    close()
  }
})

test("new names are rate-limited per address", async () => {
  const { call, close } = await setup({ limits: { creates: 2 } })
  try {
    assert.equal((await call("POST", "/", { body: { name: "One One" } })).status, 201)
    assert.equal((await call("POST", "/", { body: { name: "Two Two" } })).status, 201)
    assert.equal((await call("POST", "/", { body: { name: "Three Three" } })).status, 429)
  } finally {
    close()
  }
})

test("the 98 Messenger facade: authenticate, store.find, sessions from the socket middleware", async () => {
  const players = createPlayers({ store: memoryStore() })
  const { token } = (await players.create("Ernie Fan")).body
  const session = await players.authenticate(token)
  assert.equal(session.key, "erniefan")
  assert.equal(session.user.screenName, "Ernie Fan")
  assert.deepEqual(session.user.blocked, [])
  assert.equal(await players.authenticate("nope"), null)
  assert.deepEqual(await players.store.find("erniefan"), { key: "erniefan", screenName: "Ernie Fan", blocked: [], groups: [] })
  assert.equal(await players.store.find("nobody"), null)

  // a socket with the token is the player; without one, a guest; disconnecting signs out
  const fakeSocket = (auth) => {
    const handlers = {}
    return { handshake: { auth }, data: {}, on: (event, fn) => (handlers[event] = fn), fire: (event) => handlers[event]?.() }
  }
  const signed = fakeSocket({ token })
  await new Promise((resolve) => players.socketMiddleware(signed, resolve))
  assert.equal(signed.data.key, "erniefan")
  assert.equal(players.sessions.get("erniefan").socket, signed)
  assert.equal((await players.authenticate(token)).socket, signed)
  const guest = fakeSocket({})
  await new Promise((resolve) => players.socketMiddleware(guest, resolve))
  assert.equal(guest.data.key, undefined)
  signed.fire("disconnect")
  assert.equal(players.sessions.has("erniefan"), false)
})
