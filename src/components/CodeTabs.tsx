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
        <TabsList>
          {samples.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>{s.label}</TabsTrigger>
          ))}
        </TabsList>
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
      {samples.map((s) => (
        <TabsContent key={s.id} value={s.id}>
          <pre className="overflow-x-auto rounded-lg bg-[oklch(0.21_0.03_264)] p-5 font-mono text-[13px] leading-relaxed text-[oklch(0.93_0.01_255)] dark:border dark:border-border">
            <code>{s.code}</code>
          </pre>
        </TabsContent>
      ))}
    </Tabs>
  )
}
