import { useEffect, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { ArrowRight, Check, CircleAlert, Copy, MailCheck, Search } from "lucide-react"
import { AddressFormat, type TokenLabels } from "@/components/AddressFormat"
import { LikelihoodBar } from "@/components/LikelihoodBar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { FinderStrings } from "@/i18n/dictionaries/en"
import { fill } from "@/i18n/fill"
import { formatShare } from "@/i18n/format"
import { patternById } from "@/lib/email/patterns"
import { cn } from "@/lib/utils"
import type { FindResult } from "@/server/find"

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; result: FindResult }

export interface FinderProps {
  t: FinderStrings
  tokens: TokenLabels
  /** BCP 47 tag for number formatting. */
  lang: string
  /** Where a domain's page lives in this language, with {domain} in it. */
  domainHref: string
  defaultDomain?: string
  /** Id of an element elsewhere on the page to show results in; inline when absent. */
  resultsTarget?: string
}

export function Finder({ t, tokens, lang, domainHref, defaultDomain = "", resultsTarget }: FinderProps) {
  const [name, setName] = useState("")
  const [domain, setDomain] = useState(defaultDomain)
  const [state, setState] = useState<State>({ kind: "idle" })
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const share = (value: number) => formatShare(lang, value)

  useEffect(() => {
    if (resultsTarget) setTarget(document.getElementById(resultsTarget))
  }, [resultsTarget])

  useEffect(() => {
    if (state.kind === "done" && target) target.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [state, target])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setState({ kind: "loading" })
    try {
      const params = new URLSearchParams({ domain, name })
      const response = await fetch(`/api/v1/find?${params}`)
      if (response.status === 429) return setState({ kind: "error", message: t.errorRateLimited })
      const result = (await response.json()) as FindResult
      if (result.error === "invalid_domain") return setState({ kind: "error", message: t.errorDomain })
      if (result.error === "invalid_name") return setState({ kind: "error", message: t.errorName })
      if (!response.ok) return setState({ kind: "error", message: t.errorGeneric })
      setState({ kind: "done", result })
    } catch {
      setState({ kind: "error", message: t.errorGeneric })
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="finder-name">{t.nameLabel}</Label>
          <Input
            id="finder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.namePlaceholder}
            autoComplete="off"
            className="h-12 rounded-xl bg-white text-base md:text-base"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="finder-domain">{t.domainLabel}</Label>
          <Input
            id="finder-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={t.domainPlaceholder}
            required
            autoCapitalize="none"
            spellCheck={false}
            className="h-12 rounded-xl bg-white text-base md:text-base"
          />
        </div>
        <Button type="submit" size="lg" disabled={state.kind === "loading"} className="eyebrow h-12 rounded-full bg-ink px-7 text-white hover:bg-ink/85">
          <Search data-icon="inline-start" />
          {state.kind === "loading" ? t.searching : t.submit}
        </Button>
      </form>

      {state.kind === "error" && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4" /> {state.message}
        </p>
      )}

      {state.kind === "done" &&
        (target
          ? createPortal(<Result result={state.result} t={t} tokens={tokens} share={share} domainHref={domainHref} framed={false} />, target)
          : <Result result={state.result} t={t} tokens={tokens} share={share} domainHref={domainHref} />)}
    </div>
  )
}

function Result({
  result,
  t,
  tokens,
  share,
  domainHref,
  framed = true,
}: {
  framed?: boolean
  result: FindResult
  t: FinderStrings
  tokens: TokenLabels
  share: (value: number) => string
  domainHref: string
}) {
  const [copied, setCopied] = useState(false)
  const domain = result.domain!
  const [top, ...rest] = result.candidates
  if (!top) return null
  const topTemplate = patternById(top.pattern)!.template

  async function copy() {
    await navigator.clipboard.writeText(top.email!)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section aria-live="polite" className={cn("flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2", framed && "border-t border-border pt-8")}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow text-sage">{top.email ? t.mostLikely : fill(t.formatsAt, { domain })}</p>
          {result.known_domain && <Badge className="border border-ink bg-leaf text-ink">{share(top.confidence)}</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {top.email ? (
            <p className="text-3xl font-medium tracking-tight break-all sm:text-4xl">{top.email}</p>
          ) : (
            <AddressFormat template={topTemplate} domain={domain} labels={tokens} className="text-2xl font-semibold sm:text-3xl" />
          )}
          {top.email && (
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {copied ? t.copied : t.copy}
            </Button>
          )}
        </div>
        {top.email && <AddressFormat template={topTemplate} domain={domain} labels={tokens} className="text-sm" />}
        <p className="max-w-2xl text-sm text-muted-foreground">
          {result.known_domain
            ? fill(t.knownShare, { share: share(top.confidence), domain })
            : result.prior_basis === "mail_host" && result.mail.host
              ? fill(t.unknownDomainHost, { domain, host: result.mail.host })
              : fill(t.unknownDomain, { domain })}
          {!top.email && ` ${t.addName}`}
        </p>
        <MailLine result={result} t={t} />
      </div>

      {rest.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="eyebrow text-muted-foreground">{t.alternatives}</p>
          <Table>
            <TableHeader>
              <TableRow>
                {top.email && <TableHead>{t.colAddress}</TableHead>}
                <TableHead>{t.colFormat}</TableHead>
                <TableHead className="text-right">{t.colLikelihood}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rest.map((c) => (
                <TableRow key={c.pattern}>
                  {c.email && <TableCell className="font-medium">{c.email}</TableCell>}
                  <TableCell>
                    <AddressFormat template={patternById(c.pattern)!.template} labels={tokens} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <LikelihoodBar share={c.confidence} label={share(c.confidence)} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Button variant="link" asChild className="self-start px-0">
        <a href={fill(domainHref, { domain })}>
          {fill(t.openDomainPage, { domain })}
          <ArrowRight data-icon="inline-end" />
        </a>
      </Button>
    </section>
  )
}

function MailLine({ result, t }: { result: FindResult; t: FinderStrings }) {
  const domain = result.domain!
  const { accepts_mail, host } = result.mail
  if (accepts_mail === false)
    return (
      <p className="flex items-center gap-2 text-sm text-destructive">
        <CircleAlert className="size-4" /> {fill(t.mailNone, { domain })}
      </p>
    )
  if (accepts_mail === null)
    return <p className="text-sm text-muted-foreground">{fill(t.mailUnknown, { domain })}</p>
  return (
    <p className="flex items-center gap-2 text-sm">
      <MailCheck className="size-4 text-positive" />
      {fill(t.mailAccepts, { domain })}
      {host && <span className="text-muted-foreground">{fill(t.mailHost, { host })}</span>}
    </p>
  )
}
