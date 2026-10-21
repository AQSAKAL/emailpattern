import { cn } from "@/lib/utils"

/** A thin bar with the share written next to it. */
export function LikelihoodBar({ share, label, strong }: { share: number; label: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:w-36" role="presentation">
        <div
          className={cn("h-full rounded-full", strong ? "bg-leaf" : "bg-sage/70")}
          style={{ width: `${Math.max(2, Math.round(share * 100))}%` }}
        />
      </div>
      <span className="w-10 text-right text-sm tabular-nums">{label}</span>
    </div>
  )
}
