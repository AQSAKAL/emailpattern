// Finds ISP mailbox domains from their mail servers: a domain whose MX points at the same
// consumer platform as known free-mail providers is one of them (kotinet.com shares its
// servers with elisanet.fi). Pure: takes MX records and per-platform site counts, returns
// domains. The generated list lives in isp-domains.json.

export interface MxRecord {
  domain: string
  mx: readonly string[]
}

// Platforms companies run their own mail on; sharing one of these says nothing.
const BUSINESS_PLATFORMS = new Set([
  "google.com", "googlemail.com", "outlook.com", "microsoft.com", "office365.com", "pphosted.com", "ppe-hosted.com",
  "mimecast.com", "mimecast.co.za", "messagingengine.com", "zoho.com", "zoho.eu", "zohomail.com", "ovh.net",
  "one.com", "secureserver.net", "ionos.com", "ionos.de", "ionos.co.uk", "1and1.com", "kundenserver.de",
  "strato.de", "hostinger.com", "gandi.net", "mailgun.org", "sendgrid.net", "amazonaws.com", "amazonses.com",
  "barracudanetworks.com", "iphmx.com", "protonmail.ch", "hornetsecurity.com", "messagelabs.com", "emailsrvr.com",
  "registrar-servers.com", "titan.email", "spamexperts.com", "antispamcloud.com", "sophos.com", "trendmicro.com",
  "trendmicro.eu", "forcepoint.net", "mailcontrol.com", "cloudflare.net", "mxrouting.net", "fastmail.com",
  "yandex.net", "mail.ru", "aliyun.com", "qq.com", "icloud.com", "me.com", "simply.com", "hostpoint.ch",
  "infomaniak.ch", "webhuset.no", "domeneshop.no", "loopia.se", "binero.se", "websupport.sk", "wedos.net",
  "hostnet.nl", "transip.nl", "mijndomein.nl", "aruba.it", "register.it", "ovh.com",
  // Hosting, forwarding and filtering services that also carry many throwaway domains.
  "mxhichina.com", "cloudfilter.net", "mailspamprotection.com", "carrierzone.com", "privateemail.com",
  "spacemail.com", "improvmx.com", "forwardemail.net", "migadu.com", "purelymail.com", "dreamhost.com",
  "beget.com", "beget.ru", "porkbun.com", "mailhostbox.com", "hostinger.in", "jimdo.com", "netcup.net", "reg.ru",
  "timeweb.ru", "larksuite.com", "feishu.cn", "dynadot.com", "namebrightmail.com", "above.com", "everyone.net",
  "zoho.in", "mymailcheap.com", "mailfence.com", "netim.net", "nominalia.com", "spaceship.net", "zoneedit.com",
  "getmx.com", "mx.services", "stackmail.com", "gridhost.com", "dynv6.net", "no-ip.com", "cscdns.net",
  // Consumer brands that also host mail for people's and companies' own domains.
  "gmx.net", "mail.com", "posteo.de",
])

const SECOND_LEVEL = new Set(["co", "com", "net", "org", "ac", "gov", "edu", "ne", "or"])

/** The registrable part of a mail server name: "mx1.mail.elisa.fi" → "elisa.fi". */
export function registrableHost(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, "").split(".").filter(Boolean)
  if (labels.length <= 2) return labels.join(".")
  const tld = labels[labels.length - 1]
  const take = tld.length === 2 && SECOND_LEVEL.has(labels[labels.length - 2]) ? 3 : 2
  return labels.slice(-take).join(".")
}

/**
 * Mail platforms run for consumers: used by at least `minFree` known providers and by few
 * company websites (`businessSites` counts crawled company sites per platform), and not a
 * business platform. A host like one.com carries tens of thousands of company sites; an ISP's
 * mailbox platform carries almost none.
 */
export function consumerPlatforms(
  records: readonly MxRecord[],
  isFree: (domain: string) => boolean,
  businessSites: ReadonlyMap<string, number>,
  { minFree = 2, maxSitesPerProvider = 5 } = {},
): Set<string> {
  const free = new Map<string, number>()
  for (const { domain, mx } of records) {
    if (!isFree(domain)) continue
    for (const host of new Set(mx.map(registrableHost))) free.set(host, (free.get(host) ?? 0) + 1)
  }
  return new Set(
    [...free]
      .filter(([host, n]) => n >= minFree && (businessSites.get(host) ?? 0) <= maxSitesPerProvider * n && !BUSINESS_PLATFORMS.has(host))
      .map(([host]) => host),
  )
}

/** Domains (not already known providers) whose primary mail server is on a consumer platform. */
export function ispDomains(candidates: readonly MxRecord[], platforms: ReadonlySet<string>, isFree: (domain: string) => boolean): string[] {
  return candidates
    .filter(({ domain, mx }) => !isFree(domain) && mx.length > 0 && platforms.has(registrableHost(mx[0])))
    .map(({ domain }) => domain)
    .sort()
}
