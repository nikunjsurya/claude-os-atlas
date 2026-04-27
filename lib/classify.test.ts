import { describe, expect, it } from 'vitest'
import { assignCluster, assignStatus, deriveInferredTagEdges } from './classify'
import type { ParsedNode, Status } from './types'

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

  it('shipped textual signal beats recent mtime (rule order: shipped before active)', () => {
    // Spec section 5.6: rule 2 (shipped) fires before rule 3 (active). A
    // project that says "shipped" AND was touched today must be shipped.
    const recent = new Date(Date.now() - 1000 * 60 * 60).toISOString()
    const n = makeNode({
      kind: 'project',
      label: 'recent-and-done',
      description: 'TopSnip v3 shipped 2026-04-10. Live in production.',
      lastTouched: recent,
    })
    expect(assignStatus(n)).toBe('shipped')
  })
})

describe('assignCluster keyword overlap', () => {
  it('voice rule wins when search text matches both VOICE and INFRA keywords (rule order)', () => {
    // Spec section 5.5 rule 1 (voice) fires before rule 2 (infra). A
    // reference about "elevenlabs n8n integration" hits both VOICE
    // (elevenlabs) and INFRA (n8n) keyword sets. Voice must win.
    const n = makeNode({
      kind: 'reference',
      label: 'elevenlabs n8n integration',
      description: 'Wire ElevenLabs voice clone into n8n workflow',
    })
    expect(assignCluster(n)).toBe('voice')
  })
})

describe('deriveInferredTagEdges cap', () => {
  function tagNode(id: string, label: string): ParsedNode {
    return {
      id,
      label,
      kind: 'reference',
      description: '',
      bodyMarkdown: '',
      lastTouched: new Date().toISOString(),
      source: { path: '/tmp/' + id, type: 'memory' },
      links: {},
    }
  }

  it('caps inferred-tag edges to top-8 by status precedence when more than 8 nodes match a token', () => {
    // Spec section 5.7: if a token would emit edges among more than 8
    // nodes, keep top-8 by status precedence (active > shipped > parked >
    // reference). Build 9 nodes that all mention "Higgsfield" so a single
    // token triggers the cap. Edge count for K nodes = K*(K-1)/2; capped
    // at 8 nodes that's 28, uncapped at 9 it would be 36.
    const nodes: ParsedNode[] = Array.from({ length: 9 }, (_, i) =>
      tagNode(`ref-higgs-${i}`, `Higgsfield note ${i}`)
    )
    const statusOf = new Map<string, Status>(
      nodes.map((n) => [n.id, 'reference' as Status])
    )
    // Promote one node to active so we can verify it survives the cap.
    statusOf.set('ref-higgs-3', 'active')
    const edges = deriveInferredTagEdges(nodes, statusOf)
    const higgsEdges = edges.filter((e) =>
      e.source.startsWith('ref-higgs') && e.target.startsWith('ref-higgs')
    )
    expect(higgsEdges).toHaveLength(28)
    // The active node must be in the surviving pool, so it must touch
    // every other surviving node (7 edges incident).
    const incidentToActive = higgsEdges.filter(
      (e) => e.source === 'ref-higgs-3' || e.target === 'ref-higgs-3'
    )
    expect(incidentToActive).toHaveLength(7)
  })

  it('emits all pairs uncapped when exactly 8 nodes match a token', () => {
    const nodes: ParsedNode[] = Array.from({ length: 8 }, (_, i) =>
      tagNode(`ref-pcl-${i}`, `Paperclip note ${i}`)
    )
    const statusOf = new Map<string, Status>(
      nodes.map((n) => [n.id, 'reference' as Status])
    )
    const edges = deriveInferredTagEdges(nodes, statusOf)
    // 8 nodes, all pairs = 28 edges, no cap applied.
    expect(edges.filter((e) => e.kind === 'inferred-tag')).toHaveLength(28)
  })
})
