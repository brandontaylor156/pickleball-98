// HTTP requests from a player carry their token as "Authorization: Bearer <token>"
// (server/players hands it out when the name is picked).

const BEARER = /^Bearer ([a-f0-9]{48})$/

// The player behind a request ({ key, screenName, ... }), or null
const sessionFrom = async (players, request) => {
  const match = BEARER.exec(String(request.headers.authorization || ""))
  return (match && (await players?.authenticate?.(match[1]))) || null
}

module.exports = { sessionFrom, BEARER }
