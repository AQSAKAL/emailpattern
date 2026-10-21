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
])

export function isFreeMail(domain: string): boolean {
  return FREE_MAIL.has(domain.toLowerCase())
}
