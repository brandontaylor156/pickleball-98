import { Suspense, lazy, useCallback, useEffect, useState } from "react"
import io from "socket.io-client"
import { NetProvider } from "./components/applets/network/NetContext"
import PbClubBridge from "./components/applets/pbclub/PbClubBridge"
import Help from "./components/help/Help"
import Notices from "./components/Notices"
import PlayerGate from "./components/PlayerGate"
import ErrorBoundary from "./components/shared/ErrorBoundary"
import { useA11yRoot } from "./hooks/useA11y"
import { useIsMobile } from "./hooks/useMediaQuery"
import { openHelp } from "./utils/help"
import { SERVER, getPlayer, onAskForName, refreshMe, subscribePlayer, usePlayer } from "./utils/player"
import { useSettings } from "./utils/settings"
import { setClubSession } from "./utils/pbclub"
import { setTourneySession } from "./utils/tourney"
import { setLivingSession } from "./utils/livingpark"
import { setRoamLifeSession } from "./utils/roamLife"
import { handoffFromSearch, takeLinkHandoff } from "./utils/deepLink"
import { EMBEDDED, exitToHost, onHostOpen } from "./utils/embed"
import "./app.css"

// Pickleball 98, standalone: the game full screen (no 98 window round it: 98ish draws
// that), the server connection (NetProvider), Help, notices, and the player name
// (utils/player.js) that the online parts (Real Games, tournaments, Living Park, Explore's
// places) sign their requests with.

const Pickleball = lazy(() => import("./components/applets/pickleball/Pickleball"))

// the account-backed parts get the player's token (they used 98 Messenger's session in 98ish)
const shareSession = (player) => {
  const session = player ? { token: player.token, screenName: player.name } : null
  setClubSession(session)
  setTourneySession(session)
  setLivingSession(session)
  setRoamLifeSession(session)
}
shareSession(getPlayer())
subscribePlayer(shareSession)

// the token goes with every (re)connect, so a new name takes effect on the next one
const socket = io(SERVER, { auth: (cb) => cb({ token: getPlayer()?.token || null }) })

const OFFLINE_KEY = "pk98.offline" // "Play offline" picked this visit

export default function App() {
  const mobile = useIsMobile()
  const settings = useSettings()
  useA11yRoot(settings, mobile)
  const player = usePlayer()
  const [gate, setGate] = useState(() => {
    try {
      return !getPlayer() && sessionStorage.getItem(OFFLINE_KEY) !== "1"
    } catch {
      return !getPlayer()
    }
  })
  // a link from 98ish (?mode=&venue=): start there (utils/deepLink.js)
  const [handoff, setHandoff] = useState(takeLinkHandoff)

  // a screen asking for a name (askForName: the Tournaments tab, say) opens the name box
  useEffect(() => onAskForName(() => setGate(true)), [])
  // a saved name: check it's still there on the server (it may have been removed)
  useEffect(() => {
    refreshMe().catch(() => {})
  }, [])
  // a new (or forgotten) name: reconnect with its token
  useEffect(() => {
    socket.disconnect().connect()
  }, [player?.token])

  const playOffline = () => {
    try {
      sessionStorage.setItem(OFFLINE_KEY, "1")
    } catch {
      // asked again next time
    }
    setGate(false)
  }
  const onOpen = useCallback((h) => setHandoff(h), [])
  // in 98ish's window (utils/embed.js): a new start from 98ish while the game is open
  useEffect(() => onHostOpen((search) => setHandoff(handoffFromSearch(search))), [])

  return (
    <div className={`os-root pkApp${mobile ? " os-mobile" : ""}${EMBEDDED ? " is-embedded" : ""}`}>
      <NetProvider socket={socket} mobile={mobile}>
        <div className="mobileWindow pkAppFrame">
          {/* no 98 window round the game: that frame belongs to 98ish's desktop. (.window and
              .title-bar-controls stay as hooks: GameChat docks into them; app.css draws neither) */}
          <div className="window pkAppWin">
            <Suspense fallback={<div className="pkAppLoading">Loading Pickleball 98...</div>}>
              <ErrorBoundary>
                <Pickleball mobile={mobile} handoff={handoff} onClose={EMBEDDED ? exitToHost : undefined} />
              </ErrorBoundary>
            </Suspense>
            <div className="title-bar pkAppTop">
              <div className="title-bar-controls pkAppControls">
                <button type="button" className="pkPlayerBtn" onClick={() => setGate(true)} title={player ? "Your player name" : "Pick a player name"} data-player-btn>
                  {player ? player.name : "Pick a name"}
                </button>
                <button type="button" aria-label="Help" onClick={() => openHelp("pickleball")} />
              </div>
            </div>
          </div>
        </div>
        <PbClubBridge socket={socket} onOpen={onOpen} />
      </NetProvider>
      <Help />
      <Notices />
      {gate && <PlayerGate player={player} onDone={() => setGate(false)} onOffline={player ? null : playOffline} />}
    </div>
  )
}
