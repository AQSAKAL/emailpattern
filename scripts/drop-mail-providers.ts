// Removes mailbox-provider domains (free-mail lists, ISP mailboxes, reserved names) from the
// store. Run after the provider lists grow:  npm run -s drop-mail-providers
import { resolve } from "node:path"
import { isFreeMail } from "../src/lib/email/free-mail"
import { openStore } from "../src/server/store"

const store = openStore(resolve(process.env.DATA_DIR ?? "data", "emailpattern.sqlite"))
const providers = store.allDomains().filter(isFreeMail)
const removed = store.deleteDomains(providers)
store.close()
console.log(`${removed} mailbox-provider domains removed${providers.length ? `, e.g. ${providers.slice(0, 12).join(" ")}` : ""}`)
