import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { parseSkills } from './parseSkills'

const FIXTURE_SKILLS = path.join(
  __dirname,
  '__fixtures__',
  'parseSkills',
  'skills'
)

describe('parseSkills', () => {
  it('emits one node per SKILL.md found one level deep', async () => {
    const { nodes } = await parseSkills(FIXTURE_SKILLS)
    const ids = nodes.map((n) => n.id).sort()
    expect(ids).toEqual([
      'skill-brainstorm',
      'skill-excalidraw',
      'skill-paperclip',
    ])
  })

  it('reads the name and description from frontmatter', async () => {
    const { nodes } = await parseSkills(FIXTURE_SKILLS)
    const brainstorm = nodes.find((n) => n.id === 'skill-brainstorm')!
    expect(brainstorm.label).toBe('brainstorm')
    expect(brainstorm.description).toBe(
      'Collaborative brainstorming sessions before dispatching agents.'
    )
    expect(brainstorm.kind).toBe('skill')
    expect(brainstorm.source.type).toBe('skill')
  })

  it('handles folded YAML descriptions (>) by joining lines into one', async () => {
    const { nodes } = await parseSkills(FIXTURE_SKILLS)
    const ex = nodes.find((n) => n.id === 'skill-excalidraw')!
    expect(ex.description).toContain('Generate programmatic Excalidraw diagrams')
    expect(ex.description).toContain('Activates on /excalidraw')
    // Folded scalars should not contain literal newlines.
    expect(ex.description.split('\n').length).toBe(1)
  })

  it('skips folders that do not contain a SKILL.md', async () => {
    const { nodes } = await parseSkills(FIXTURE_SKILLS)
    expect(nodes.find((n) => n.id === 'skill-not-a-skill')).toBeUndefined()
  })

  it('returns empty result with a warning when the skills root is missing', async () => {
    const result = await parseSkills(path.join(FIXTURE_SKILLS, 'does-not-exist'))
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(result.warnings).toBeDefined()
    expect(result.warnings!.length).toBeGreaterThan(0)
  })
})
