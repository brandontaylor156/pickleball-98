import { useEffect, useState } from "react"
import { migrateSettings, resolveReducedMotion } from "./a11y.js"

// Pickleball 98's settings (sound, motion, accessibility, touch), kept in this browser.

const KEY = "pk98.settings"

export const DEFAULT_SETTINGS = {
  systemSounds: true, // the 98 click and ding sounds in dialogs
  volume: 80, // 0-100, for every sound in the game
  muted: false,
  soundScheme: "classic",
  // Accessibility (utils/a11y.js, hooks/useA11y.js, a11y.css)
  textSize: "normal", // normal | large | xlarge
  contrast: "off", // off | black | white
  reduceMotion: "system", // system (the device's setting) | on | off
  tapTargets: "normal", // normal | large
  // Mouse and touch
  doubleClickMs: 500,
  swapButtons: false,
  longPressMs: 500, // touch screens: hold this long for the right-click menu
}

const listeners = new Set()

// (migrateSettings fills in defaults and upgrades settings saved by older versions)
const read = () => {
  try {
    return migrateSettings(JSON.parse(localStorage.getItem(KEY)), DEFAULT_SETTINGS)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

let current = read()

export const getSettings = () => current

// Less motion: Accessibility Options' choice, else the device's Reduce Motion setting.
// For motion drawn in code (confetti, screen shake, trails); CSS animations stop by
// themselves (a11y.css and the PostCSS step in client/postcss-a11y.js).
export const reducedMotion = (s = current) => {
  let system = false
  try {
    system = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  } catch {
    // no window (Node)
  }
  return resolveReducedMotion(s.reduceMotion, system)
}

// the master volume as a gain multiplier (0 when muted)
export const masterGain = (s = current) => (s.muted ? 0 : Math.pow(Math.max(0, Math.min(100, s.volume ?? 80)) / 100, 2))

export const setSettings = (patch) => {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // storage full or blocked: keep it for this visit only
  }
  listeners.forEach((fn) => fn(current))
}

// Outside React: fn(settings) on every change. Returns the unsubscribe.
export const subscribeSettings = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const useSettings = () => {
  const [value, setValue] = useState(current)
  useEffect(() => {
    listeners.add(setValue)
    setValue(current)
    return () => listeners.delete(setValue)
  }, [])
  return value
}
