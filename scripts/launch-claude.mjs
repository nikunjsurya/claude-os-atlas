// Launch shim: reads the prompt file (argv[2]) and starts an interactive
// claude session with the content as ONE argv. Exists because Windows
// PowerShell 5.1 mangles embedded quotes in native args and Node
// child_process shell:false refuses .cmd shims (EINVAL); Node owns the
// Windows argv escaping instead, so quotes/newlines/unicode survive.
// Optional argv[3..] override the executable (used by the argv-fidelity
// test to substitute a JSON echo child for claude).
// Spec: docs/superpowers/specs/2026-07-09-mission-control-v2-design.md §6.

import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

const promptFile = process.argv[2]
if (!promptFile) {
  console.error('usage: launch-claude.mjs <promptFile> [exe [prefixArgs...]]')
  process.exit(2)
}

const prompt = readFileSync(promptFile, 'utf8')

function resolveClaude() {
  const home = os.homedir()
  const candidates = [
    path.join(home, '.local', 'bin', 'claude.exe'),
    path.join(home, '.local', 'bin', 'claude'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  // Last resort: PATH lookup. Works for native executables; .cmd shims
  // would fail here by design (never reintroduce shell:true).
  return 'claude'
}

const override = process.argv.slice(3)
const exe = override.length > 0 ? override[0] : resolveClaude()
const prefixArgs = override.slice(1)

const result = spawnSync(exe, [...prefixArgs, prompt], {
  stdio: 'inherit',
  shell: false,
})

if (result.error) {
  console.error(`launch-claude: failed to start ${exe}: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 0)
