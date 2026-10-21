import { templateSegments } from "@/lib/email/patterns"
import { cn } from "@/lib/utils"

const TOKEN_COLOR: Record<string, string> = {
  first: "text-token-first",
  last: "text-token-last",
  f: "text-token-initial",
  l: "text-token-initial",
}

export type TokenLabels = Record<"first" | "last" | "f" | "l", string>

/**
 * A format written out with coloured tokens: {first}.{last}@acme.com.
 * Token words come from the dictionary so the format reads in the page's language.
 */
export function AddressFormat({
  template,
  domain,
  labels,
  className,
}: {
  template: string
  domain?: string
  labels: TokenLabels
  className?: string
}) {
  return (
    <code className={cn("font-sans whitespace-nowrap", className)}>
      {templateSegments(template).map((segment, i) =>
        segment.kind === "token" ? (
          <span key={i} className={cn("font-medium", TOKEN_COLOR[segment.value])}>
            <span className="opacity-35">{"{"}</span>
            {labels[segment.value as keyof TokenLabels]}
            <span className="opacity-35">{"}"}</span>
          </span>
        ) : (
          <span key={i}>{segment.value}</span>
        ),
      )}
      {domain && <span className="text-muted-foreground">@{domain}</span>}
    </code>
  )
}
