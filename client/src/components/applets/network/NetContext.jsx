import { createContext, useContext, useEffect, useRef, useState } from "react"
import { usePlayer } from "../../../utils/player"
import { notice } from "../../../utils/notice"
import { onlineProgram, setPendingJoin } from "../../shared/online/useOnlineRoom"

// The game's connection to the server: who's online, requests with answers, and the
// socket that online matches, My Park, Explore and Live Broadcast talk over.

const TOKEN_KEY = "pk98.net.token"

const session = {
  get: (key) => {
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: (key, value) => {
    try {
      sessionStorage.setItem(key, value)
    } catch {
      // private mode: a new identity after a reload
    }
  },
}

const NetContext = createContext(null)
export const useNet = () => useContext(NetContext)

export const NetProvider = ({ socket, mobile, children }) => {
  const player = usePlayer()
  const [status, setStatus] = useState("connecting") // connecting | online | offline
  const [me, setMe] = useState(null)
  const [computers, setComputers] = useState([])
  const joinLinkChecked = useRef(false)

  // ---- talking to the server ----

  const request = (event, payload = {}) =>
    new Promise((resolve) => {
      if (!socket.connected) return resolve({ ok: false, error: "You aren't connected to the server." })
      socket.timeout(15_000).emit(event, payload, (timeout, result) =>
        resolve(timeout ? { ok: false, error: "The server didn't respond. Please try again." } : result || { ok: false, error: "No answer." })
      )
    })

  const hello = () =>
    socket.emit("net:hello", { token: session.get(TOKEN_KEY), visible: true, device: mobile ? "phone" : "pc" }, (result) => {
      if (!result?.ok) return setStatus("offline")
      session.set(TOKEN_KEY, result.token)
      setMe(result.me)
      setComputers(result.computers)
      setStatus("online")
      followJoinLink()
    })

  // A shared link to an online room (https://.../?join=K7QX): join it
  const followJoinLink = async () => {
    if (joinLinkChecked.current) return
    joinLinkChecked.current = true
    let code = null
    try {
      code = new URLSearchParams(window.location.search).get("join")
    } catch {
      code = null
    }
    if (!code) return
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete("join")
      window.history.replaceState(window.history.state, "", url.toString())
    } catch {
      // the link stays in the address bar
    }
    const room = await request("room:peek", { code })
    if (!room.ok || !onlineProgram(room.game)) return notice("Play Online", `There's no game with the code ${code.toUpperCase()} any more. Ask your friend for a new code.`, "warn")
    setPendingJoin({ game: room.game, code })
  }

  useEffect(() => {
    const handlers = {
      connect: hello,
      disconnect: () => setStatus("offline"),
      connect_error: () => setStatus("offline"),
      "net:computers": (list) => {
        setComputers(list)
        const mine = list.find((c) => c.me)
        if (mine) setMe(mine)
      },
    }
    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler)
    if (socket.connected) hello()
    return () => {
      for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler)
    }
  }, [socket])

  // Picking (or forgetting) a player name changes who this computer is
  useEffect(() => {
    if (socket.connected) hello()
  }, [player?.key])

  const value = {
    socket, // the shared connection (game chat, My Park, Explore and Live Broadcast talk over it)
    status,
    me,
    computers,
    refresh: async () => {
      const result = await request("net:list")
      if (result.ok) setComputers(result.computers)
    },
    notice,
    // Pickleball 98 is the only program here: its Play Online is already on screen
    openPlayOnline: () => {},
    openOnlineGame: (game, where) => onlineProgram(game) && setPendingJoin({ game, ...where }),
    request,
  }

  return <NetContext.Provider value={value}>{children}</NetContext.Provider>
}
