import { searchName } from "../lib/company-name"
import { isFreeMail } from "../lib/email/free-mail"
import type { ReleaseCandidate } from "./store"

/**
 * The next domains to let into the index without address evidence: the first `count` candidates
 * whose registered company is plainly the domain's owner (its name matches the domain), never a
 * mailbox provider. Candidates come biggest first. Pure.
 */
export function pickRelease(candidates: Iterable<ReleaseCandidate>, count: number): string[] {
  const picked: string[] = []
  for (const c of candidates) {
    if (picked.length >= count) break
    if (isFreeMail(c.domain) || !searchName(c.name, c.domain)) continue
    picked.push(c.domain)
  }
  return picked
}
