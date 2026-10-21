import { defineConfig } from "vitest/config"

// The site's tests only; cli/ and npm/ run their own test runners.
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
})
