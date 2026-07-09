import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { EMPTY_STATE, readCurated, readState, writeState } from './store'

let tmpDir: string | null = null

async function makeTmpDir(): Promise<string> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-queue-'))
  return tmpDir
}

afterEach(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true })
    tmpDir = null
  }
})

describe('queue store', () => {
  it('round-trips state through writeState/readState', async () => {
    const dir = await makeTmpDir()
    const file = path.join(dir, 'queue-state.json')
    const state = {
      statusOverrides: { 'q-x': 'done' as const },
      suppressed: [{ id: 'n8n:wf1', stateKey: 'e2' }],
    }
    await writeState(file, state)
    const result = await readState(file)
    expect(result.value).toEqual(state)
    expect(result.warning).toBeNull()
  })

  it('returns empty state without warning when the state file does not exist yet', async () => {
    const dir = await makeTmpDir()
    const result = await readState(path.join(dir, 'missing.json'))
    expect(result.value).toEqual(EMPTY_STATE)
    expect(result.warning).toBeNull()
  })

  it('backs up a malformed file to <name>.bad-<ts> and continues with a warning', async () => {
    const dir = await makeTmpDir()
    const file = path.join(dir, 'queue.json')
    await fs.writeFile(file, '{ not json', 'utf8')
    const result = await readCurated(file)
    expect(result.value).toEqual([])
    expect(result.warning).toMatch(/malformed/i)
    const entries = await fs.readdir(dir)
    expect(entries.some((e) => e.startsWith('queue.json.bad-'))).toBe(true)
  })
})
