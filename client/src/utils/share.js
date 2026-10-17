import { notice } from "./notice"
import { copyTextFor, fallbackMessage, planShare, shareData, textFile } from "./shareRules"

export { textFile }

// Sending something out of the game: the phone's share sheet (Web Share API), or a download /
// the clipboard where the browser has no share sheet or can't share files (desktop Firefox,
// older browsers). Always call shareOut straight from the tap or click: iOS only opens the
// share sheet while the tap is still "fresh", so everything it sends is made synchronously
// here (no awaits before navigator.share).

const makeFile = ({ name, data, mime }) => new File([data], name, { type: mime || "application/octet-stream" })

export const downloadBlob = (data, name, mime) => {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime || "application/octet-stream" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const env = (data) => {
  const share = typeof navigator.share === "function"
  let files = false
  if (share && data?.files?.length) {
    try {
      files = typeof navigator.canShare === "function" ? navigator.canShare({ files: data.files }) : false
    } catch {
      files = false
    }
  }
  return { share, files }
}

// payload: see shareRules.js. mode: "phone" (save it) | "apps" (send it to another app).
// -> Promise<"shared" | "cancelled" | "downloaded" | "copied" | "failed">; fallbacks tell the
// player what happened.
export const shareOut = (payload, mode = "apps", { title = "Share" } = {}) => {
  if (!payload || payload.error) {
    notice(title, payload?.error || "There's nothing to send.")
    return Promise.resolve("failed")
  }
  // the File objects are made first, so canShare can look at the real thing
  const files = (payload.files || []).map(makeFile)
  const plan = planShare(env({ files }), payload, mode)
  const fallback = (how) => {
    if (how === "download") {
      for (const f of payload.files) downloadBlob(f.data, f.name, f.mime)
      notice(title, fallbackMessage("download", payload, mode))
      return Promise.resolve("downloaded")
    }
    if (how === "copy") {
      return copyText(copyTextFor(payload)).then((ok) => {
        notice(title, fallbackMessage(ok ? "copied" : "copyFailed", payload, mode))
        return ok ? "copied" : "failed"
      })
    }
    notice(title, "There's nothing to send.")
    return Promise.resolve("failed")
  }
  if (plan !== "share") return fallback(plan)
  const data = shareData(payload, mode, (f) => files[payload.files.indexOf(f)] || makeFile(f))
  let pending
  try {
    pending = navigator.share(data)
  } catch (error) {
    pending = Promise.reject(error)
  }
  return pending.then(
    () => "shared",
    (error) => {
      if (error?.name === "AbortError") return "cancelled" // closed the share sheet
      // NotAllowedError (the tap went stale) or a type the phone won't take: fall back
      return fallback(data.files ? "download" : "copy")
    }
  )
}

// A ready-made file (a replay, a clone)
export const filePayload = (title, file, extra = {}) => ({ title, files: [file], ...extra })
