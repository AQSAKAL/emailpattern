// Truecolor styling in the site's forest-and-leaf palette. Plain text when the
// output is not a terminal, or when NO_COLOR is set; FORCE_COLOR turns it on.

const PALETTE = {
  leaf: [95, 212, 126],
  lime: [230, 247, 176],
  sage: [127, 169, 155],
  frame: [44, 90, 76],
  first: [95, 212, 126],
  last: [124, 196, 216],
  initial: [182, 217, 138],
  brace: [74, 107, 97],
  muted: [143, 166, 158],
  warn: [240, 138, 108],
  ink: [15, 31, 26],
}

export function colorEnabled(stream = process.stdout, env = process.env) {
  if ("NO_COLOR" in env) return false
  if (env.FORCE_COLOR && env.FORCE_COLOR !== "0") return true
  return Boolean(stream?.isTTY)
}

/** Style helpers bound to whether colour is on. */
export function palette(enabled) {
  const wrap = (open, close) => (text) => (enabled ? `${open}${text}${close}` : String(text))
  const fg = ([r, g, b]) => wrap(`\x1b[38;2;${r};${g};${b}m`, "\x1b[39m")
  const styles = Object.fromEntries(Object.entries(PALETTE).map(([name, rgb]) => [name, fg(rgb)]))
  return {
    enabled,
    ...styles,
    bold: wrap("\x1b[1m", "\x1b[22m"),
    badge: (text) => (enabled ? `\x1b[48;2;95;212;126m\x1b[38;2;15;31;26m\x1b[1m ${text} \x1b[0m` : `[${text}]`),
    hex: (name) => "#" + PALETTE[name].map((n) => n.toString(16).padStart(2, "0")).join(""),
  }
}
