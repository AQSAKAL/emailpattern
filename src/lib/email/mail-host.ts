// Recognises who runs a domain's mail from its MX hosts. Shown on domain pages
// because the mail host changes how strict address guessing has to be.

const HOSTS: [RegExp, string][] = [
  [/(^|\.)google(mail)?\.com$|\.googlemail\.com$/, "Google Workspace"],
  [/\.protection\.outlook\.com$|\.outlook\.com$/, "Microsoft 365"],
  [/\.zoho\.(com|eu|in)$/, "Zoho Mail"],
  [/\.protonmail\.ch$|\.proton\.me$/, "Proton Mail"],
  [/\.messagingengine\.com$/, "Fastmail"],
  [/\.pphosted\.com$/, "Proofpoint"],
  [/\.mimecast\.com$/, "Mimecast"],
  [/\.ovh\.net$/, "OVHcloud"],
  [/\.one\.com$/, "one.com"],
  [/\.secureserver\.net$/, "GoDaddy"],
  [/\.yandex\.(net|ru)$/, "Yandex"],
]

export function mailHostName(mxHosts: readonly string[]): string | null {
  for (const host of mxHosts) {
    const h = host.toLowerCase().replace(/\.$/, "")
    for (const [pattern, name] of HOSTS) if (pattern.test(h)) return name
  }
  return null
}
