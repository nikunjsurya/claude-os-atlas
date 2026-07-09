import { describe, expect, it } from 'vitest'
import { mergeQueue } from './merge'
import type { DerivedQueueItem, QueueItem, QueueState } from '@/lib/types'

function curated(over: Partial<QueueItem> & { id: string }): QueueItem {
  return {
    title: over.id,
    projectId: null,
    kind: 'owner-action',
    source: 'curated',
    detail: '',
    promptSeed: '',
    createdAt: '2026-07-08T00:00:00.000Z',
    status: 'open',
    ...over,
  }
}

function derived(
  over: Partial<DerivedQueueItem> & { id: string; stateKey: string }
): DerivedQueueItem {
  return {
    title: over.id,
    projectId: null,
    kind: 'incident',
    source: 'n8n',
    detail: '',
    promptSeed: '',
    createdAt: '2026-07-09T00:00:00.000Z',
    status: 'open',
    ...over,
  }
}

const emptyState: QueueState = { statusOverrides: {}, suppressed: [] }

describe('mergeQueue', () => {
  it('unions curated and derived items', () => {
    const { items } = mergeQueue(
      [curated({ id: 'q-topsnip-golive' })],
      [derived({ id: 'n8n:wf1', stateKey: 'e2' })],
      emptyState
    )
    expect(items.map((i) => i.id).sort()).toEqual(['n8n:wf1', 'q-topsnip-golive'])
  })

  it('prefers curated on id collision', () => {
    const { items } = mergeQueue(
      [curated({ id: 'git:project-x', title: 'hand-written' })],
      [derived({ id: 'git:project-x', stateKey: 'main', title: 'auto' })],
      emptyState
    )
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('hand-written')
  })

  it('hides a derived item only when both id AND stateKey match a suppression', () => {
    const state: QueueState = {
      statusOverrides: {},
      suppressed: [{ id: 'n8n:wf1', stateKey: 'e2' }],
    }
    const suppressedRun = mergeQueue([], [derived({ id: 'n8n:wf1', stateKey: 'e2' })], state)
    expect(suppressedRun.items).toEqual([])

    const newOccurrence = mergeQueue([], [derived({ id: 'n8n:wf1', stateKey: 'e9' })], state)
    expect(newOccurrence.items).toHaveLength(1)
  })

  it('prunes suppressions whose id is absent from the current derivation', () => {
    const state: QueueState = {
      statusOverrides: {},
      suppressed: [
        { id: 'n8n:wf1', stateKey: 'e2' },
        { id: 'site:topsnip', stateKey: '503:2026-07-09' },
      ],
    }
    const { prunedState } = mergeQueue(
      [],
      [derived({ id: 'site:topsnip', stateKey: '503:2026-07-09', source: 'site' })],
      state
    )
    expect(prunedState.suppressed).toEqual([
      { id: 'site:topsnip', stateKey: '503:2026-07-09' },
    ])
  })

  it('applies status overrides to curated items without mutating the source file data', () => {
    const state: QueueState = {
      statusOverrides: { 'q-backup-key': 'done' },
      suppressed: [],
    }
    const source = [curated({ id: 'q-backup-key' })]
    const { items } = mergeQueue(source, [], state)
    expect(items[0].status).toBe('done')
    expect(source[0].status).toBe('open')
  })

  it('strips stateKey from returned items so the API payload matches QueueItem', () => {
    const { items } = mergeQueue([], [derived({ id: 'n8n:wf1', stateKey: 'e2' })], emptyState)
    expect('stateKey' in items[0]).toBe(false)
  })
})
