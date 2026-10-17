import { useSyncExternalStore } from "react"

// Who's playing: a player name picked on this device, no password. The server hands back a
// secret token with the name; it goes with every request ("Authorization: Bearer <token>")
// and on the socket (io(SERVER, { auth: { token } })). Kept in localStorage "pk98.player"
// as { name, key, token }; key is the name lowercased without spaces ("Cool Dude 98" ->
// "cooldude98"), the same rule the server uses.
//
//   const player = usePlayer()        // null until a name is picked (or "Play offline")
//   fetch(url, { headers: authHeaders() })

export const SERVER = import.meta.env.VITE_SOCKET_URL || "http://localhost:8000"
const KEY = "pk98.player"
const NAME = /^[A-Za-z][A-Za-z0-9 ]{2,15}$/

export const cleanName = (name) => String(name || "").trim().replace(/\s+/g, " ")
export const nameKey = (name) => String(name || "").replace(/\s+/g, "").toLowerCase()
// -> an error message, or null when the name is fine
export const checkName = (name) =>
  NAME.test(cleanName(name)) ? null : "Player names are 3-16 characters, start with a letter, and use only letters, numbers and spaces."

const read = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null")
    return saved?.name && saved?.token ? { name: saved.name, key: saved.key || nameKey(saved.name), token: saved.token } : null
  } catch {
    return null
  }
}

let current = read()
const listeners = new Set()

const set = (next) => {
  current = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    // storage blocked: the name lasts for this visit only
  }
  listeners.forEach((fn) => fn(current))
}

export const getPlayer = () => current

export const subscribePlayer = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const usePlayer = () => useSyncExternalStore(subscribePlayer, getPlayer, getPlayer)

export const authHeaders = () => (current?.token ? { Authorization: `Bearer ${current.token}` } : {})

const call = async (path, init = {}) => {
  let response
  try {
    response = await fetch(`${SERVER}${path}`, { ...init, headers: { "Content-Type": "application/json", ...authHeaders(), ...(init.headers || {}) } })
  } catch {
    return { ok: false, error: "Couldn't reach the Pickleball 98 server. Check your connection and try again." }
  }
  const body = await response.json().catch(() => ({}))
  return response.ok ? { ok: true, ...body } : { ok: false, status: response.status, error: body.error || `The server said no (HTTP ${response.status}).` }
}

// Claims a player name. -> { ok, player } | { ok: false, error }
export const createPlayer = async (name) => {
  const problem = checkName(name)
  if (problem) return { ok: false, error: problem }
  const result = await call("/api/players", { method: "POST", body: JSON.stringify({ name: cleanName(name) }) })
  if (!result.ok) return result
  const player = { name: result.name, key: result.key || nameKey(result.name), token: result.token }
  set(player)
  return { ok: true, player }
}

// Checks the saved name with the server (it may have been removed there). -> the player or null
export const refreshMe = async () => {
  if (!current) return null
  const result = await call("/api/players/me")
  if (result.ok && result.name) {
    if (result.name !== current.name) set({ ...current, name: result.name, key: result.key || nameKey(result.name) })
  } else if (result.status === 401 || result.status === 404) {
    set(null)
  }
  return current
}

export const forgetPlayer = () => set(null)
