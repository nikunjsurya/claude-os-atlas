// Argv-fidelity test for scripts/launch-claude.mjs: the torture prompt
// (embedded double quotes, newlines, unicode) must arrive in the child
// process as ONE argv, byte-identical. Uses the shim's executable override
// to spawn a JSON echo script instead of claude.
// Spec: 2026-07-09-mission-control-v2-design.md sections 9, 10.

import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const SHIM = path.resolve(__dirname, '../../scripts/launch-claude.mjs')
const ECHO = path.resolve(__dirname, '../../scripts/echo-argv.mjs')

const TORTURE_PROMPT = [
  'Fix the "quoted \\"nested\\" thing" now.',
  'Line two has a trailing backslash \\',
  'Line three: unicode snowman ☃ and emoji 🚀 and hindi नमस्ते',
  'Line four ends with "a quote"',
].join('\n')

let tmpDir: string | null = null

afterEach(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true })
    tmpDir = null
  }
})

describe('launch-claude shim', () => {
  it('delivers the torture prompt as one byte-identical argv', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-shim-'))
    const promptFile = path.join(tmpDir, 'prompt.md')
    await fs.writeFile(promptFile, TORTURE_PROMPT, 'utf8')

    const stdout = execFileSync(
      process.execPath,
      [SHIM, promptFile, process.execPath, ECHO],
      { encoding: 'utf8' }
    )
    const argv = JSON.parse(stdout) as string[]
    expect(argv).toHaveLength(1)
    expect(argv[0]).toBe(TORTURE_PROMPT)
  })
})
