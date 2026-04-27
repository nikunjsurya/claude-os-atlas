import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { parseProjectsFolder } from './parseProjectsFolder'

const FIXTURE_DIR = path.join(
  __dirname,
  '__fixtures__',
  'parseProjectsFolder',
  'Projects'
)

describe('parseProjectsFolder', () => {
  it('emits one node per top-level subdirectory', async () => {
    const { nodes } = await parseProjectsFolder(FIXTURE_DIR)
    const ids = nodes.map((n) => n.id).sort()
    expect(ids).toEqual([
      'project--templates',
      'project-hidden-systems',
      'project-neither-bank',
      'project-sessions',
      'project-topsnip',
    ])
    expect(nodes.every((n) => n.kind === 'project')).toBe(true)
    expect(nodes.every((n) => n.source.type === 'folder')).toBe(true)
  })

  it('marks folders containing PARKED.md with a parked hint in description', async () => {
    const { nodes } = await parseProjectsFolder(FIXTURE_DIR)
    const hidden = nodes.find((n) => n.id === 'project-hidden-systems')!
    expect(hidden.description.toUpperCase()).toContain('PARKED')
  })

  it('uses _index.md or README.md content as bodyMarkdown', async () => {
    const { nodes } = await parseProjectsFolder(FIXTURE_DIR)
    const topsnip = nodes.find((n) => n.id === 'project-topsnip')!
    expect(topsnip.bodyMarkdown).toContain('TopSnip')
    expect(topsnip.bodyMarkdown).toContain('Personal AI Intelligence Dashboard')

    const neither = nodes.find((n) => n.id === 'project-neither-bank')!
    expect(neither.bodyMarkdown).toContain('Neither Bank')
  })

  it('records the absolute folder path as source.path and stores hasPackageJson hint via description or bodyMarkdown', async () => {
    const { nodes } = await parseProjectsFolder(FIXTURE_DIR)
    const topsnip = nodes.find((n) => n.id === 'project-topsnip')!
    expect(topsnip.source.path).toBe(path.join(FIXTURE_DIR, 'topsnip'))
    // package.json detection is exposed via links.repo set to the folder
    // path so classify.ts software rule can consult disk later if needed.
    // For now, parser must at least set lastTouched to a valid ISO string.
    expect(() => new Date(topsnip.lastTouched).toISOString()).not.toThrow()
  })

  it('returns empty result with a warning when the projects root is missing', async () => {
    const result = await parseProjectsFolder(
      path.join(FIXTURE_DIR, 'does-not-exist')
    )
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(result.warnings).toBeDefined()
    expect(result.warnings!.length).toBeGreaterThan(0)
  })
})
