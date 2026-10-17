// Venue backdrops: one splat per venue, kept on this device in IndexedDB "pk98-splats" (the
// bytes and the placement), never uploaded. At most MAX_BACKDROPS (the oldest goes).
// A backdrop: { venue, format, transform, splats, source, title, at, file } where file is
// { id, size }, for readBytes.
import { MAX_BACKDROPS } from "./files.js"

// pure: the list after adding/replacing one (newest first), and what to drop
export const nextBackdrops = (list, add, max = MAX_BACKDROPS) => {
  const others = list.filter((b) => b.venue !== add.venue).sort((a, b) => (b.at || 0) - (a.at || 0))
  const replaced = list.filter((b) => b.venue === add.venue)
  const keep = [add, ...others].slice(0, max)
  const drop = [...replaced, ...others.slice(max - 1)]
  return { keep, drop }
}

const DB = "pk98-splats"
const STORE = "backdrops"

let opening = null
const openDb = () => {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("This browser can't keep backdrops."))
  opening ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "venue" })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      opening = null
      reject(req.error || new Error("The backdrops couldn't be opened."))
    }
  })
  return opening
}

// one transaction: fn(store) -> a request or nothing; resolves with the request's result
const tx = async (mode, fn) => {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(req?.result)
    t.onerror = () => reject(t.error || new Error("The backdrop couldn't be saved."))
    t.onabort = () => reject(t.error || new Error("The backdrop couldn't be saved (is the device full?)."))
  })
}

// (the record without its bytes: what the panel and the park show)
const view = ({ bytes, ...meta }) => ({ ...meta, file: { id: meta.venue, size: bytes?.byteLength || 0 } })

export const listBackdrops = async () => {
  try {
    const all = (await tx("readonly", (s) => s.getAll())) || []
    return all.map(view).sort((a, b) => (b.at || 0) - (a.at || 0))
  } catch {
    return []
  }
}

export const getBackdrop = async (venue) => (await listBackdrops()).find((b) => b.venue === venue) || null

export const readBytes = async (file) => {
  const rec = await tx("readonly", (s) => s.get(file.id))
  if (!rec?.bytes) throw new Error("The backdrop isn't on this device any more.")
  return new Uint8Array(rec.bytes)
}

// save (or replace) a venue's backdrop; returns { ok, error? }
export const saveBackdrop = async (venue, bytes, { format, transform = null, splats = 0, source = "import", title = "" } = {}) => {
  const meta = { venue, format, transform, splats, source, title, at: Date.now() }
  const { drop } = nextBackdrops(await listBackdrops(), meta)
  try {
    await tx("readwrite", (s) => {
      for (const b of drop) if (b.venue !== venue) s.delete(b.venue)
      return s.put({ ...meta, bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) })
    })
  } catch {
    return { ok: false, error: "This device is out of room, so the backdrop wasn't saved. Free up some space and try again." }
  }
  return { ok: true, file: { id: venue, size: bytes.byteLength } }
}

export const setPlacement = async (venue, transform) => {
  const rec = await tx("readonly", (s) => s.get(venue)).catch(() => null)
  if (!rec) return false
  await tx("readwrite", (s) => s.put({ ...rec, transform, at: Date.now() }))
  return true
}

export const removeBackdrop = async (venue) => {
  if (!(await getBackdrop(venue))) return false
  await tx("readwrite", (s) => s.delete(venue))
  return true
}
