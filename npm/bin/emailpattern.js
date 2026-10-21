#!/usr/bin/env node
import { run } from "../src/cli.js"

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
