// the base styles first, so the app's own (App.jsx and below) come after and win
import "../node_modules/98.css/dist/98.css"
import "./main.css"
import "./a11y.css"
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { installTouchGuard } from "./utils/touchGuard"
import { installInputGuard } from "./utils/inputGuard"

// no phone "hold" menus outside text boxes and reading areas (utils/touchGuard.js)
installTouchGuard()
// taps that stop working: resets on coming back / turning the phone, ?tapdebug=1 (utils/inputGuard.js)
installInputGuard()

ReactDOM.createRoot(document.getElementById("root")).render(<App />)

// Save the game for offline use (and installing to a phone's home screen). Only on the
// real site: a service worker would get in the way of the dev server.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}))
}
