import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { parseMemoryIndex } from './parseMemoryIndex'

const FIXTURE_DIR = path.join(
  __dirname,
  '__fixtures__',
  'parseMemoryIndex',
  'memory'
)

describe('parseMemoryIndex', () => {
  it('emits one node per memory index row', async () => {
    const { nodes } = await parseMemoryIndex(FIXTURE_DIR)
    expect(nodes).toHaveLength(5)
    const ids = nodes.map((n) => n.id).sort()
    expect(ids).toEqual([
      'feedback-no-em-dashes',
      'project-hidden-systems',
      'project-topsnip',
      'reference-elevenlabs',
      'user-profile',
    ])
  })

  it('preserves the row description and assigns the correct kind', async () => {
    const { nodes } = await parseMemoryIndex(FIXTURE_DIR)
    const topsnip = nodes.find((n) => n.id === 'project-topsnip')
    expect(topsnip).toBeDefined()
    expect(topsnip!.kind).toBe('project')
    expect(topsnip!.description).toBe(
      'TopSnip v3 shipped 2026-04-10. InShorts feed + visual learn pages.'
    )
    expect(topsnip!.source.type).toBe('memory')
    expect(topsnip!.source.path).toBe(
      path.join(FIXTURE_DIR, 'project_topsnip.md')
    )
    expect(topsnip!.links.memoryFile).toBe('project_topsnip.md')
  })

  it('reads the body markdown of each entry into bodyMarkdown', async () => {
    const { nodes } = await parseMemoryIndex(FIXTURE_DIR)
    const ev = nodes.find((n) => n.id === 'reference-elevenlabs')!
    expect(ev.bodyMarkdown).toContain('ElevenLabs API key location')
    expect(ev.bodyMarkdown).toContain('Nikunj voice clone')
  })

  it('emits wikilink edges for both [Title](file.md) and [[Wikilink]] forms', async () => {
    const { edges } = await parseMemoryIndex(FIXTURE_DIR)
    const fromUser = edges.filter((e) => e.source === 'user-profile')
    const targets = fromUser.map((e) => e.target).sort()
    expect(targets).toEqual([
      'project-hidden-systems',
      'project-topsnip',
      'reference-elevenlabs',
    ])
    expect(fromUser.every((e) => e.kind === 'wikilink')).toBe(true)
    expect(fromUser.every((e) => e.weight === 1.0)).toBe(true)
  })

  it('returns empty result with a warning when MEMORY.md is missing', async () => {
    const result = await parseMemoryIndex(path.join(FIXTURE_DIR, 'does-not-exist'))
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(result.warnings).toBeDefined()
    expect(result.warnings!.length).toBeGreaterThan(0)
  })
})
