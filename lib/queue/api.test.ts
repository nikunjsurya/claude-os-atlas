import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { applyQueuePatch, buildQueueResponse } from './api'
import type { QueueDeps } from './api'
import type { DerivedQueueItem, QueueItem } from '@/lib/types'

let tmpDir: string | null = null

async function makeDeps(
  curated: QueueItem[],
  derived: DerivedQueueItem[]
): Promise<QueueDeps> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-queue-api-'))
  const queueFile = path.join(tmpDir, 'queue.json')
  await fs.writeFile(queueFile, JSON.stringify(curated), 'utf8')
  return {
    queueFile,
    queueStateFile: path.join(tmpDir, 'queue-state.json'),
    deriveCurrent: async () => derived,
  }
}

afterEach(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true })
    tmpDir = null
  }
})

const CURATED: QueueItem = {
  id: 'q-topsnip-golive',
  title: 'TopSnip go-live',
  projectId: 'project-topsnip-web',
  kind: 'owner-action',
  source: 'curated',
  detail: 'Run migration-v6 then merge.',
  promptSeed: 'Run the TopSnip go-live runbook.',
  createdAt: '2026-07-08T00:00:00.000Z',
  status: 'open',
}

const DERIVED: DerivedQueueItem = {
  id: 'n8n:wf1',
  stateKey: 'e2',
  title: 'n8n: Autopilot is failing',
  projectId: null,
  kind: 'incident',
  source: 'n8n',
  detail: 'Latest execution e2 errored.',
  promptSeed: 'Fix it.',
  createdAt: '2026-07-09T00:00:00.000Z',
  status: 'open',
}

describe('buildQueueResponse', () => {
  it('merges curated file items with the current derivation', async () => {
    const deps = await makeDeps([CURATED], [DERIVED])
    const body = await buildQueueResponse(deps)
    expect(body.items.map((i) => i.id).sort()).toEqual(['n8n:wf1', 'q-topsnip-golive'])
    expect(body.warnings).toEqual([])
  })
})

describe('applyQueuePatch', () => {
  it('records a curated status override and it round-trips through the next GET', async () => {
    const deps = await makeDeps([CURATED], [])
    const result = await applyQueuePatch(deps, 'q-topsnip-golive', 'done')
    expect(result).toMatchObject({ ok: true, status: 200 })
    const body = await buildQueueResponse(deps)
    expect(body.items[0].status).toBe('done')
  })

  it('dismissing a derived item writes an id+stateKey suppression that hides it', async () => {
    const deps = await makeDeps([], [DERIVED])
    const result = await applyQueuePatch(deps, 'n8n:wf1', 'dismissed')
    expect(result.ok).toBe(true)
    const body = await buildQueueResponse(deps)
    expect(body.items).toEqual([])
    const state = JSON.parse(
      await fs.readFile(deps.queueStateFile, 'utf8')
    )
    expect(state.suppressed).toEqual([{ id: 'n8n:wf1', stateKey: 'e2' }])
  })

  it('reopening a derived item clears its suppression', async () => {
    const deps = await makeDeps([], [DERIVED])
    await applyQueuePatch(deps, 'n8n:wf1', 'dismissed')
    await applyQueuePatch(deps, 'n8n:wf1', 'open')
    const body = await buildQueueResponse(deps)
    expect(body.items).toHaveLength(1)
  })

  it('rejects an invalid status with 400 and a missing derived item with 404', async () => {
    const deps = await makeDeps([], [])
    expect((await applyQueuePatch(deps, 'q-x', 'archived')).status).toBe(400)
    expect((await applyQueuePatch(deps, 'n8n:ghost', 'dismissed')).status).toBe(404)
  })
})
