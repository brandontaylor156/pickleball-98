import { useEffect, useState } from "react"
import { NOTICE_EVENT } from "../utils/notice"

// The player's notices (utils/notice.js), one at a time as 98 message boxes; more wait in line.

export default function Notices() {
  const [queue, setQueue] = useState([])
  useEffect(() => {
    const onNotice = (e) => setQueue((q) => [...q, { ...e.detail, id: Date.now() + Math.random() }].slice(-5))
    window.addEventListener(NOTICE_EVENT, onNotice)
    return () => window.removeEventListener(NOTICE_EVENT, onNotice)
  }, [])
  const top = queue[0]
  if (!top) return null
  const close = () => setQueue((q) => q.slice(1))
  return (
    <div className="pkNoticeBack" role="presentation">
      <div className="window pkNotice" role="alertdialog" aria-labelledby="pk-notice-title" aria-describedby="pk-notice-text">
        <div className="title-bar">
          <div className="title-bar-text" id="pk-notice-title">
            {top.title}
          </div>
          <div className="title-bar-controls">
            <button type="button" aria-label="Close" onClick={close} />
          </div>
        </div>
        <div className="window-body pkNoticeBody">
          <span className={`pkNoticeIcon is-${top.icon === "warn" ? "warn" : "info"}`} aria-hidden="true">
            {top.icon === "warn" ? "!" : "i"}
          </span>
          <p id="pk-notice-text">{top.text}</p>
        </div>
        <div className="pkGateButtons">
          {top.action && (
            <button
              type="button"
              className="default"
              onClick={() => {
                close()
                top.action.onClick?.()
              }}
            >
              {top.action.label || "Open"}
            </button>
          )}
          <button type="button" className={top.action ? "" : "default"} onClick={close} autoFocus>
            {top.action ? "Not now" : "OK"}
          </button>
        </div>
      </div>
    </div>
  )
}
