// Players: MongoDB collection "players" when MONGODB_URI is set, otherwise memory (lost on
// restart). A player is { key, name, tokenHash, createdAt, lastSeen }; only the token's
// SHA-256 is kept, so the database alone can't sign anyone in.

const mongoose = require("mongoose")

const playerSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    createdAt: { type: Number, required: true },
    lastSeen: { type: Number, required: true },
  },
  { minimize: false },
)

const clone = (p) => (p ? { ...p } : null)

const memoryStore = () => {
  const byKey = new Map()
  return {
    // false when the key is taken
    create: async (player) => {
      if (byKey.has(player.key)) return false
      byKey.set(player.key, { ...player })
      return true
    },
    byKey: async (key) => clone(byKey.get(key)),
    byTokenHash: async (hash) => clone([...byKey.values()].find((p) => p.tokenHash === hash)),
    update: async (key, fields) => {
      const p = byKey.get(key)
      if (!p) return false
      Object.assign(p, fields)
      return true
    },
    remove: async (key) => byKey.delete(key),
  }
}

const mongoStore = (Player) => ({
  create: async (player) => {
    try {
      await Player.create(player)
      return true
    } catch (error) {
      if (error?.code === 11000) return false
      throw error
    }
  },
  byKey: async (key) => Player.findOne({ key }, { _id: 0, __v: 0 }).lean(),
  byTokenHash: async (hash) => Player.findOne({ tokenHash: hash }, { _id: 0, __v: 0 }).lean(),
  update: async (key, fields) => (await Player.updateOne({ key }, { $set: fields })).matchedCount > 0,
  remove: async (key) => (await Player.deleteOne({ key })).deletedCount > 0,
})

const createPlayerStore = async (uri = process.env.MONGODB_URI) => {
  if (!uri) {
    console.warn("[players] MONGODB_URI not set: players are kept in memory and lost on restart")
    return memoryStore()
  }
  const connection = await mongoose.createConnection(uri, { maxPoolSize: 3 }).asPromise()
  console.log("[players] connected to MongoDB")
  return mongoStore(connection.model("Player", playerSchema, "players"))
}

module.exports = { createPlayerStore, memoryStore }
