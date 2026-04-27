import { describe, expect, it } from 'vitest'
import { assignCluster, assignStatus } from './classify'
import type { ParsedNode } from './types'

function makeNode(over: Partial<ParsedNode>): ParsedNode {
  return {
    id: 'project-x',
    label: 'X',
    kind: 'project',
    description: '',
    bodyMarkdown: '',
    lastTouched: new Date().toISOString(),
    source: { path: '/tmp/x', type: 'folder' },
    links: {},
    ...over,
  }
}

describe('assignCluster', () => {
  it('returns voice when search text contains a VOICE keyword (highest precedence)', () => {
    const n = makeNode({
      label: 'Nikunj agent',
      kind: 'agent',
      description: 'voice profile system',
    })
    expect(assignCluster(n)).toBe('voice')
  })

  it('returns infra for non-project nodes containing INFRA keywords', () => {
    const n = makeNode({
      kind: 'reference',
      label: 'lightrag setup',
      description: 'LightRAG install notes',
    })
    expect(assignCluster(n)).toBe('infra')
  })

  it('returns content for projects containing CONTENT keywords', () => {
    const n = makeNode({
      kind: 'project',
      label: 'shorts-factory',
      description: 'Hindi AI Shorts pipeline with remotion',
    })
    expect(assignCluster(n)).toBe('content')
  })

  it('returns software for projects with package.json on disk', () => {
    // Use the real fixture project that has a package.json sibling.
    const fixturePath = require('node:path').join(
      __dirname,
      'parsers',
      '__fixtures__',
      'parseProjectsFolder',
      'Projects',
      'topsnip'
    )
    const n = makeNode({
      kind: 'project',
      label: 'topsnip',
      description: 'Personal AI dashboard',
      source: { path: fixturePath, type: 'folder' },
    })
    expect(assignCluster(n)).toBe('software')
  })

  it('falls back to meta for unclassifiable projects without package.json', () => {
    const n = makeNode({
      kind: 'project',
      label: 'misc',
      description: 'unrelated project',
      source: { path: '/tmp/no-pkg-here', type: 'folder' },
    })
    expect(assignCluster(n)).toBe('meta')
  })

  it('resolves the remotion overlap correctly: infra for non-projects, content for projects', () => {
    expect(
      assignCluster(
        makeNode({
          kind: 'reference',
          label: 'remotion notes',
          description: 'reference for remotion API',
        })
      )
    ).toBe('infra')
    expect(
      assignCluster(
        makeNode({
          kind: 'project',
          label: 'remotion-shorts',
          description: 'remotion-based shorts pipeline',
        })
      )
    ).toBe('content')
  })
})

describe('assignStatus', () => {
  it('marks nodes whose search text contains PARKED as parked (highest precedence)', () => {
    const n = makeNode({
      kind: 'project',
      label: 'hidden systems',
      description: 'PARKED 2026-04-10. V2 approved.',
      lastTouched: new Date().toISOString(),
    })
    expect(assignStatus(n)).toBe('parked')
  })

  it('marks nodes containing shipped/complete/production-ready as shipped', () => {
    expect(
      assignStatus(makeNode({ kind: 'project', description: 'TopSnip shipped' }))
    ).toBe('shipped')
    expect(
      assignStatus(
        makeNode({ kind: 'project', description: 'Pipeline is production-ready' })
      )
    ).toBe('shipped')
  })

  it('marks recently-touched projects as active', () => {
    const recent = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString()
    expect(
      assignStatus(
        makeNode({
          kind: 'project',
          label: 'fresh',
          description: 'recently created',
          lastTouched: recent,
        })
      )
    ).toBe('active')
  })

  it('returns reference for kind in reference/feedback/instruction', () => {
    expect(assignStatus(makeNode({ kind: 'reference' }))).toBe('reference')
    expect(assignStatus(makeNode({ kind: 'feedback' }))).toBe('reference')
    expect(assignStatus(makeNode({ kind: 'instruction' }))).toBe('reference')
  })
})
