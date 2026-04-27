import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { buildAtlasResponse, type AtlasRoots } from './buildAtlas'

const F = path.join(__dirname, '__fixtures__', 'atlas')

const ROOTS: AtlasRoots = {
  memoryDir: path.join(F, 'memory'),
  projectsRoot: path.join(F, 'Projects'),
  claudeSkills: path.join(F, 'skills'),
  agentRoots: [path.join(F, 'agents')],
  globalClaudeMd: path.join(F, 'global-claude-md', 'CLAUDE.md'),
}

describe('buildAtlasResponse (API integration)', () => {
  it('returns the AtlasResponse shape and merges nodes from every parser source', async () => {
    const res = await buildAtlasResponse(ROOTS)
    expect(res).toHaveProperty('nodes')
    expect(res).toHaveProperty('edges')
    expect(res).toHaveProperty('clusters')
    expect(res).toHaveProperty('stats')
    expect(res).toHaveProperty('generatedAt')
    expect(() => new Date(res.generatedAt).toISOString()).not.toThrow()
    // Cluster descriptors are 5 (content/software/voice/infra/meta).
    expect(res.clusters.map((c) => c.id).sort()).toEqual([
      'content',
      'infra',
      'meta',
      'software',
      'voice',
    ])
    const ids = new Set(res.nodes.map((n) => n.id))
    // Memory nodes
    expect(ids.has('reference-elevenlabs')).toBe(true)
    expect(ids.has('feedback-no-em-dashes')).toBe(true)
    // Project folder nodes
    expect(ids.has('project-topsnip')).toBe(true)
    expect(ids.has('project-hidden-systems')).toBe(true)
    // Skills
    expect(ids.has('skill-brainstorm')).toBe(true)
    expect(ids.has('skill-paperclip')).toBe(true)
    // Agents
    expect(ids.has('agent-code-simplifier')).toBe(true)
    expect(ids.has('agent-nikunj-agent')).toBe(true)
    // Instruction nodes
    expect(ids.has('instruction-global')).toBe(true)
    expect(ids.has('instruction-topsnip')).toBe(true)
  })

  it('classifies nodes correctly and stats counts add up', async () => {
    const res = await buildAtlasResponse(ROOTS)
    const topsnip = res.nodes.find((n) => n.id === 'project-topsnip')!
    // topsnip folder fixture has package.json, but also mentions ElevenLabs
    // (voice keyword). Voice rule fires first per spec 5.5.
    expect(topsnip.cluster).toBe('voice')
    // mtime is fresh in tests so projects fall to 'active' unless a textual
    // signal flips them. Disk wins per spec 7 so memory's "shipped" word
    // is dropped (disk description was already populated).
    expect(['active', 'shipped']).toContain(topsnip.status)
    const hidden = res.nodes.find((n) => n.id === 'project-hidden-systems')!
    expect(hidden.status).toBe('parked')
    const nikunj = res.nodes.find((n) => n.id === 'agent-nikunj-agent')!
    expect(nikunj.cluster).toBe('voice')
    // stats sanity
    expect(res.stats.nodes).toBe(res.nodes.length)
    expect(res.stats.edges).toBe(res.edges.length)
    expect(res.stats.parked).toBeGreaterThanOrEqual(1)
    expect(res.stats.skills).toBe(2)
    // Every node has a size in [14, 32].
    for (const n of res.nodes) {
      expect(n.size).toBeGreaterThanOrEqual(14)
      expect(n.size).toBeLessThanOrEqual(32)
    }
  })

  it('returns a partial response (never throws) when some roots are missing, with warnings populated', async () => {
    const res = await buildAtlasResponse({
      memoryDir: path.join(F, 'no-memory-here'),
      projectsRoot: path.join(F, 'Projects'),
      claudeSkills: path.join(F, 'no-skills-here'),
      agentRoots: [path.join(F, 'no-agents-here')],
      globalClaudeMd: path.join(F, 'no-global', 'CLAUDE.md'),
    })
    // Project folder parser still ran successfully.
    expect(res.nodes.find((n) => n.id === 'project-topsnip')).toBeDefined()
    expect(res.warnings).toBeDefined()
    expect(res.warnings!.length).toBeGreaterThan(0)
  })
})
