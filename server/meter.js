// Bytes this server has sent this month (HTTP and socket.io), in memory: My Park and Explore
// send positions less often when the month runs high (WEB_MONTHLY_TOTAL_MB). A restart
// starts the count again, which only ever errs toward sending more.

const createMeter = ({ now = Date.now } = {}) => {
  const monthOf = (t) => new Date(t).toISOString().slice(0, 7)
  let month = monthOf(now())
  let closed = 0 // bytes from connections that have ended
  const open = new Set()

  const roll = () => {
    const m = monthOf(now())
    if (m === month) return
    month = m
    closed = 0
    for (const socket of open) socket.meterBase = socket.bytesWritten
  }

  return {
    attach: (server) => {
      server.on("connection", (socket) => {
        socket.meterBase = 0
        open.add(socket)
        socket.on("close", () => {
          open.delete(socket)
          roll()
          closed += socket.bytesWritten - socket.meterBase
        })
      })
    },
    total: () => {
      roll()
      let sum = closed
      for (const socket of open) sum += socket.bytesWritten - socket.meterBase
      return sum
    },
  }
}

module.exports = { createMeter }
