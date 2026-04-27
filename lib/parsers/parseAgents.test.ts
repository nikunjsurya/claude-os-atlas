import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { parseAgents } from './parseAgents'

const FIXTURE = path.join(__dirname, '__fixtures__', 'parseAgents')
const GLOBAL = path.join(FIXTURE, 'global')
const TEMPLATES = path.join(FIXTURE, 'templates')

describe('parseAgents', () => {
  it('emits one node per .md file across all provided roots', async () => {
    const { nodes } = await parseAgents([GLOBAL, TEMPLATES])
    const ids = nodes.map((n) => n.id).sort()
    expect(ids).toEqual([
      'agent-code-simplifier',
      'agent-nikunj-agent',
      'agent-researcher',
    ])
    expect(nodes.every((n) => n.kind === 'agent')).toBe(true)
    expect(nodes.every((n) => n.source.type === 'agent')).toBe(true)
  })

  it('reads name and description from frontmatter', async () => {
    const { nodes } = await parseAgents([GLOBAL])
    const cs = nodes.find((n) => n.id === 'agent-code-simplifier')!
    expect(cs.label).toBe('code-simplifier')
    expect(cs.description).toContain('Simplifies and refines code')
  })

  it('handles folded YAML descriptions in agent frontmatter', async () => {
    const { nodes } = await parseAgents([TEMPLATES])
    const nik = nodes.find((n) => n.id === 'agent-nikunj-agent')!
    expect(nik.description).toContain('5-mode voice/identity system')
    expect(nik.description.split('\n').length).toBe(1)
  })

  it('skips non-markdown siblings like routing-history.json', async () => {
    const { nodes } = await parseAgents([GLOBAL])
    expect(nodes.find((n) => n.id.includes('routing-history'))).toBeUndefined()
  })

  it('returns empty result with a warning when a root is missing (and continues for the rest)', async () => {
    const result = await parseAgents([
      path.join(FIXTURE, 'does-not-exist'),
      GLOBAL,
    ])
    // Still got the global ones.
    expect(result.nodes.find((n) => n.id === 'agent-code-simplifier')).toBeDefined()
    expect(result.warnings).toBeDefined()
    expect(result.warnings!.some((w) => w.includes('does-not-exist'))).toBe(true)
  })
})
