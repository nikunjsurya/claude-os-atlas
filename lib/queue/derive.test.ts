import { describe, expect, it } from 'vitest'
import { deriveQueueItems } from './derive'
import type { DeriveInputs } from './derive'
import type { N8nPulse, ProjectPulse, SiteCard } from '@/lib/types'

const NOW = new Date('2026-07-09T12:00:00.000Z')

function inputs(over: Partial<DeriveInputs>): DeriveInputs {
  return { n8n: null, sites: [], projects: [], now: NOW, ...over }
}

function site(over: Partial<SiteCard> & { id: string }): SiteCard {
  return {
    label: over.id,
    url: `https://${over.id}.test`,
    screenshotPath: null,
    capturedAt: null,
    httpStatus: 200,
    responseMs: 50,
    status: 'ok',
    ...over,
  }
}

function project(over: Partial<ProjectPulse> & { id: string }): ProjectPulse {
  return {
    label: over.id,
    path: 'C:\\Users\\surya\\Projects\\' + over.id,
    git: { branch: 'main', dirty: 0, ahead: 0, behind: 0, lastCommitAt: null },
    status: 'ok',
    ...over,
  }
}

describe('deriveQueueItems', () => {
  it('emits an incident only for workflows whose LATEST execution errored', () => {
    const n8n: N8nPulse = {
      reachable: true,
      workflows: [
        {
          id: 'wf1',
          name: 'Autopilot',
          active: true,
          lastExecution: {
            id: 'e2',
            status: 'error',
            startedAt: '2026-07-09T11:00:00.000Z',
            errorMessage: 'Render timeout',
          },
        },
        {
          id: 'wf2',
          name: 'Watchdog',
          active: true,
          lastExecution: {
            id: 'e3',
            status: 'success',
            startedAt: '2026-07-09T11:30:00.000Z',
          },
        },
      ],
      recentErrors: [],
    }
    const items = deriveQueueItems(inputs({ n8n }))
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'n8n:wf1',
      kind: 'incident',
      source: 'n8n',
      stateKey: 'e2',
      status: 'open',
    })
    expect(items[0].title).toContain('Autopilot')
  })

  it('emits a site incident with httpStatus:UTC-day stateKey when a site errors', () => {
    const items = deriveQueueItems(
      inputs({ sites: [site({ id: 'topsnip', httpStatus: 503, status: 'error' })] })
    )
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('site:topsnip')
    expect(items[0].stateKey).toBe('503:2026-07-09')
  })

  it('emits a stranded-work task for dirty or ahead repos, with branch stateKey', () => {
    const items = deriveQueueItems(
      inputs({
        projects: [
          project({
            id: 'project-vaani',
            git: { branch: 'main', dirty: 3, ahead: 0, behind: 0, lastCommitAt: null },
            status: 'warn',
          }),
          project({ id: 'project-clean' }),
        ],
      })
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'git:project-vaani',
      kind: 'claude-task',
      source: 'git',
      stateKey: 'main',
      projectId: 'project-vaani',
    })
  })

  it('emits nothing when everything is healthy', () => {
    const n8n: N8nPulse = { reachable: true, workflows: [], recentErrors: [] }
    const items = deriveQueueItems(
      inputs({ n8n, sites: [site({ id: 'ok' })], projects: [project({ id: 'p' })] })
    )
    expect(items).toEqual([])
  })

  it('skips git derivation for projects with unknown git state', () => {
    const items = deriveQueueItems(
      inputs({ projects: [project({ id: 'p', git: null, status: 'unknown' })] })
    )
    expect(items).toEqual([])
  })
})
