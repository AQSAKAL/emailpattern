import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface CodeSample {
  id: string
  label: string
  code: string
}

/** Code samples in tabs, with one copy button for the open tab. */
export function CodeTabs({ samples, copyLabel, copiedLabel }: { samples: CodeSample[]; copyLabel: string; copiedLabel: string }) {
  const [active, setActive] = useState(samples[0].id)
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(samples.find((s) => s.id === active)!.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Tabs value={active} onValueChange={setActive} className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <TabsList className="bg-white/10">
          {samples.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="text-white/70 hover:text-white data-active:bg-white data-active:text-ink">{s.label}</TabsTrigger>
          ))}
        </TabsList>
        <Button variant="ghost" size="sm" onClick={copy} className="text-white/75 hover:bg-white/10 hover:text-white">
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
      {samples.map((s) => (
        <TabsContent key={s.id} value={s.id}>
          <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-forest-deep p-5 font-mono text-[13px] leading-relaxed text-mint">
            <code>{s.code}</code>
          </pre>
        </TabsContent>
      ))}
    </Tabs>
  )
}
