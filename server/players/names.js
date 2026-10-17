// Player names: 3-16 characters, start with a letter, letters/digits/spaces only. Like 98
// Messenger's screen names they're case- and space-insensitive: "Cool Dude 98" and
// "cooldude98" are the same player (the key), displayed however the owner first typed it.

const NAME = /^[A-Za-z][A-Za-z0-9 ]{2,15}$/

const normalize = (name) => String(name || "").replace(/\s+/g, "").toLowerCase()

const validate = (name) => {
  const clean = String(name || "").trim().replace(/\s+/g, " ")
  if (!NAME.test(clean)) {
    return { error: "Names must be 3-16 characters, start with a letter, and contain only letters, numbers and spaces." }
  }
  return { screenName: clean, key: normalize(clean) }
}

module.exports = { normalize, validate }
