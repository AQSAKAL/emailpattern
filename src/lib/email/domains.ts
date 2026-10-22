const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/
const TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/
// Image and asset file names look like addresses on web pages ("logo@2x.png"); never domains.
const FILE_ENDINGS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "ico", "bmp", "tif", "tiff", "css", "js", "pdf", "mp4", "webm"])

/**
 * Turns whatever someone pastes (a URL, an email address, "www.Acme.com/") into
 * a bare registrable host such as "acme.com". Null when it is not a domain.
 */
export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase()
  if (!value) return null
  if (value.includes("@")) value = value.slice(value.lastIndexOf("@") + 1)
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(value)) value = `http://${value}`

  let host: string
  try {
    host = new URL(value).hostname
  } catch {
    return null
  }
  host = host.replace(/\.$/, "").replace(/^www\d*\./, "")

  const labels = host.split(".")
  if (labels.length < 2) return null
  if (!labels.every((l) => LABEL.test(l))) return null
  if (!TLD.test(labels[labels.length - 1]) || FILE_ENDINGS.has(labels[labels.length - 1])) return null
  return host
}
