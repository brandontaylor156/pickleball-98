import { useEffect, useRef, useState } from "react"
import { checkName, createPlayer, forgetPlayer } from "../utils/player"
import { SUGGESTED_NAME } from "../utils/embed"

// "Pick a player name": the first time the game opens (and from the title bar's name button).
// No password: the name is yours on this device. "Play offline" skips it for this visit:
// solo play and practice work, and anything online asks for a name when you try it.
//   <PlayerGate player={player} onDone={() => ...} onOffline={() => ...} />

export default function PlayerGate({ player = null, onDone, onOffline = null }) {
  // (in 98ish's window: its screen name to start from, utils/embed.js)
  const [name, setName] = useState(player ? "" : SUGGESTED_NAME)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  useEffect(() => input.current?.focus({ preventScroll: true }), [])

  const submit = async (e) => {
    e.preventDefault()
    const problem = checkName(name)
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    const r = await createPlayer(name)
    setBusy(false)
    if (!r.ok) return setError(r.status === 409 ? `Someone already plays as "${name.trim()}". Try another name.` : r.error)
    onDone?.()
  }

  return (
    <div className="pkGateBack" role="presentation">
      <form className="window pkGate" role="dialog" aria-labelledby="pk-gate-title" onSubmit={submit}>
        <div className="title-bar">
          <div className="title-bar-text" id="pk-gate-title">
            {player ? "Your player name" : "Welcome to Pickleball 98"}
          </div>
          {player && (
            <div className="title-bar-controls">
              <button type="button" aria-label="Close" onClick={onDone} />
            </div>
          )}
        </div>
        <div className="window-body pkGateBody">
          <img src="/assets/program_icons/pickleball.svg" alt="" width="48" height="48" />
          <div>
            {player ? (
              <p>
                You play as <b>{player.name}</b>. A new name starts fresh: your matches, tournaments and park clone stay with the old one.
              </p>
            ) : (
              <p>Pick a player name. It's what other players see online, in Real Games and in tournaments. No password: it's kept on this device.</p>
            )}
            <label className="pkGateField">
              Player name
              <input ref={input} type="text" maxLength={16} autoComplete="nickname" spellCheck={false} value={name} onChange={(e) => setName(e.target.value)} aria-describedby="pk-gate-rule" data-player-name />
            </label>
            <p id="pk-gate-rule" className="pkGateRule">
              3-16 letters, numbers and spaces, starting with a letter.
            </p>
            {error && (
              <p className="pkGateError" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="pkGateButtons">
          <button type="submit" className="default" disabled={busy || !name.trim()} data-player-ok>
            {busy ? "Saving..." : player ? "Change Name" : "Play"}
          </button>
          {!player && onOffline && (
            <button type="button" onClick={onOffline} data-play-offline>
              Play offline
            </button>
          )}
          {player && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(`Forget "${player.name}" on this device? You'll pick a name again next time.`)) return
                forgetPlayer()
                onDone?.()
              }}
            >
              Forget Name
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
