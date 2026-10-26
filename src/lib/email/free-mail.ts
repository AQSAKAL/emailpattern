import openList from "free-email-domains"
import ispDomains from "./isp-domains.json"

// Mailbox providers where people hold private addresses. Their domains say nothing
// about a company's format, so samples there are never learned from.

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.co.uk", "hotmail.dk", "hotmail.se", "hotmail.fr",
  "hotmail.de", "hotmail.es", "hotmail.it", "outlook.com", "outlook.dk", "outlook.de", "outlook.fr", "outlook.es",
  "live.com", "live.dk", "live.se", "live.fr", "live.co.uk", "msn.com", "yahoo.com", "yahoo.co.uk", "yahoo.fr",
  "yahoo.de", "yahoo.es", "ymail.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com",
  "pm.me", "gmx.de", "gmx.net", "gmx.at", "gmx.com", "web.de", "t-online.de", "freenet.de", "mail.ru", "yandex.ru",
  "yandex.com", "inbox.lv", "hot.ee", "mail.ee", "online.ee", "neti.ee", "orange.fr", "free.fr", "laposte.net",
  "wanadoo.fr", "sfr.fr", "telenet.be", "skynet.be", "online.no", "libero.it", "tiscali.it", "virgilio.it",
  "seznam.cz", "centrum.cz", "wp.pl", "o2.pl", "onet.pl", "interia.pl", "zoho.com", "qq.com", "163.com",
  "126.com", "fastmail.com", "tutanota.com", "hey.com", "telia.com", "jubii.dk", "ofir.dk", "post.cz", "abv.bg",
  // Shared certified-mail and ISP mailboxes seen in crawled pages (Oct 22 2026).
  "pec.it", "legalmail.it", "arubapec.it", "registerpec.it", "postacert.it", "aruba.it", "alice.it", "tin.it", "fastwebnet.it", "bluewin.ch", "sunrise.ch", "hispeed.ch", "gmx.ch", "mail.dk", "email.cz", "atlas.cz", "volny.cz", "azet.sk", "zoznam.sk", "post.sk", "inbox.lt", "one.lt", "mail.lv", "kpnmail.nl", "ziggo.nl", "planet.nl", "hetnet.nl", "home.nl", "chello.nl", "xs4all.nl", "pandora.be", "eircom.net", "btinternet.com", "sky.com", "virginmedia.com", "ntlworld.com", "talktalk.net", "neuf.fr", "bbox.fr", "comhem.se", "bredband.net", "tele2.se", "telia.se", "spray.se", "get2net.dk", "stofanet.dk", "webspeed.dk", "c.dk", "tdcadsl.dk", "outlook.it", "hotmail.no", "live.no", "online.de", "arcor.de", "vodafone.de", "posteo.de", "mailbox.org", "gmx.fr", "laposte.fr",
])

// Reserved for documentation and tests (RFC 2606, RFC 6761); addresses there are placeholders.
const RESERVED = /(^|\.)(example|test|invalid|localhost)$|(^|\.)example\.(com|net|org)$/

/**
 * Mailbox providers where people hold private addresses, including ISPs found by their mail
 * servers (isp-domains.json). Their domains say nothing about a company's format.
 */
// The free-email-domains list (MIT, ~31k providers).
const OPEN_LIST: ReadonlySet<string> = new Set(openList as string[])
const ISP: ReadonlySet<string> = new Set(ispDomains as string[])

export function isFreeMail(domain: string): boolean {
  const d = domain.toLowerCase()
  return FREE_MAIL.has(d) || OPEN_LIST.has(d) || ISP.has(d) || RESERVED.test(d)
}

/** Only the hand-kept list of providers people really use (no open list, no ISP list). */
export function isCuratedFreeMail(domain: string): boolean {
  return FREE_MAIL.has(domain.toLowerCase())
}

/** Only the curated and open lists, without the ISP list derived from them. */
export function isListedFreeMail(domain: string): boolean {
  const d = domain.toLowerCase()
  return FREE_MAIL.has(d) || OPEN_LIST.has(d)
}
