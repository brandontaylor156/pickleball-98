// The rules for sharing out of the game (a replay, a clone, highlights, a live link), with no
// browser in them so they can be tested in Node: what a share sends and what a browser can do
// with it. utils/share.js does the work.

// A share payload: { title, text, url, files: [{ name, data, mime }], preferText }
//   files       what a file share carries (data is a string or bytes)
//   text / url  what a text share carries
//   preferText  "apps" shares the text, not the file (words read better than an attachment)

// What the browser offers: { share: navigator.share exists, files: it can share these files }
// -> "share" (the system share sheet), "download", "copy" or "none"
//   "phone": save to the phone (the share sheet's Save Image / Save to Files)
//   "apps":  hand it to another app (Messages, Mail, WhatsApp...)
export const planShare = (env, payload, mode = "apps") => {
  const files = payload?.files || []
  const words = !!(payload?.text || payload?.url)
  const wantsText = mode === "apps" && words && (payload.preferText || !files.length)
  if (wantsText) return env.share ? "share" : "copy"
  if (files.length) return env.share && env.files ? "share" : "download"
  if (words) return env.share ? "share" : "copy"
  return "none"
}

// The object handed to navigator.share for a plan of "share". makeFile turns
// { name, data, mime } into a File (the browser's File, or a stand-in in tests).
export const shareData = (payload, mode, makeFile) => {
  const files = payload.files || []
  const words = !!(payload.text || payload.url)
  if (mode === "apps" && words && (payload.preferText || !files.length)) {
    const out = {}
    if (payload.title) out.title = payload.title
    if (payload.text) out.text = payload.text
    if (payload.url) out.url = payload.url
    return out
  }
  if (files.length) {
    const out = { files: files.map(makeFile) }
    // iOS offers Save Image / Save to Files only for a bare file: no title or text then
    if (mode === "apps" && payload.title) out.title = payload.title
    return out
  }
  const out = {}
  if (payload.title) out.title = payload.title
  if (payload.text) out.text = payload.text
  if (payload.url) out.url = payload.url
  return out
}

// What the clipboard gets when copying is the fallback
export const copyTextFor = (payload) => [payload.text, payload.url].filter(Boolean).join(payload.text && payload.url ? "\n" : "") || payload.title || ""

// What the user is told after a fallback (null: nothing to say)
export const fallbackMessage = (how, payload, mode) => {
  const names = (payload.files || []).map((f) => f.name)
  const list = names.length === 1 ? names[0] : `${names.length} files`
  if (how === "download")
    return mode === "phone"
      ? `This browser can't send files to your phone's apps, so ${list} ${names.length === 1 ? "was" : "were"} downloaded instead. On an iPhone, open Safari's Downloads (or the Files app) to find ${names.length === 1 ? "it" : "them"}.`
      : `This browser can't share files with other apps, so ${list} ${names.length === 1 ? "was" : "were"} downloaded instead. Attach ${names.length === 1 ? "it" : "them"} from your Downloads folder.`
  if (how === "copied") return "This browser can't open the share sheet, so it was copied to the clipboard instead. Paste it wherever you like."
  if (how === "copyFailed") return "This browser can't share or copy from here. Select the text and copy it yourself."
  return null
}

// a plain text file for a share: { name, data, mime }
export const textFile = (name, text) => ({ name: safeFileName(name, ".txt"), data: String(text).replace(/\r?\n/g, "\r\n"), mime: "text/plain" })

// a name every phone accepts, with the extension it should have
export const safeFileName = (name, ext = "") => {
  let base = String(name || "")
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_")
    .replace(/[. ]+$/, "")
    .trim()
    .slice(0, 80) || "Pickleball 98"
  if (ext && !base.toLowerCase().endsWith(ext.toLowerCase())) base += ext
  return base
}
