import { appendFileSync, mkdirSync } from "node:fs"
import { appendFile, mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import type { LookupEvent, RequestEvent } from "../lib/usage"

// Append-only JSON Lines, one file per kind and UTC day, so any JSON Lines reader can take them all with one glob:
//   requests-2026-10-21.jsonl, lookups-2026-10-21.jsonl

type Kind = "requests" | "lookups"

interface Entry {
  file: string
  line: string
}

export interface UsageLog {
  request(event: RequestEvent): void
  lookup(event: LookupEvent): void
  /** Writes what is queued. Called on a timer; awaitable for tests. */
  flush(): Promise<void>
  /** For shutdown, where nothing async survives. */
  flushSync(): void
  start(): void
  stop(): void
}

export interface UsageLogOptions {
  dir: string
  flushMs?: number
  /** Events beyond this many waiting for a flush are dropped rather than growing memory. */
  maxBuffered?: number
}

function group(entries: readonly Entry[]): Map<string, string> {
  const files = new Map<string, string>()
  for (const { file, line } of entries) files.set(file, (files.get(file) ?? "") + line)
  return files
}

export function createUsageLog({ dir, flushMs = 1000, maxBuffered = 20_000 }: UsageLogOptions): UsageLog {
  let queue: Entry[] = []
  let timer: ReturnType<typeof setInterval> | null = null
  let warnedDropped = false

  function add(kind: Kind, event: { ts: string }) {
    if (queue.length >= maxBuffered) {
      if (!warnedDropped) console.warn(`usage log: ${maxBuffered} events waiting, dropping new ones until the disk catches up`)
      warnedDropped = true
      return
    }
    warnedDropped = false
    queue.push({ file: `${kind}-${event.ts.slice(0, 10)}.jsonl`, line: `${JSON.stringify(event)}\n` })
  }

  function take(): Entry[] {
    const batch = queue
    queue = []
    return batch
  }

  async function flush() {
    const batch = take()
    if (batch.length === 0) return
    try {
      await mkdir(dir, { recursive: true })
      for (const [file, text] of group(batch)) await appendFile(resolve(dir, file), text)
    } catch (error) {
      console.error(`usage log: could not write ${batch.length} events`, error)
    }
  }

  function flushSync() {
    const batch = take()
    if (batch.length === 0) return
    try {
      mkdirSync(dir, { recursive: true })
      for (const [file, text] of group(batch)) appendFileSync(resolve(dir, file), text)
    } catch (error) {
      console.error(`usage log: could not write ${batch.length} events`, error)
    }
  }

  return {
    request: (event) => add("requests", event),
    lookup: (event) => add("lookups", event),
    flush,
    flushSync,
    start() {
      if (timer) return
      timer = setInterval(() => void flush(), flushMs)
      timer.unref()
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
  }
}
