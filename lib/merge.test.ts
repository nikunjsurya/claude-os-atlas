import { describe, expect, it } from 'vitest'
import { mergeParserResults, edgeDedupeKey } from './merge'
import type { ParsedNode, AtlasEdge } from './types'

function n(over: Partial<ParsedNode> & { id: string }): ParsedNode {
  return {
    label: over.id,
    kind: 'project',
    description: '',
    bodyMarkdown: '',
    lastTouched: '2026-01-01T00:00:00.000Z',
    source: { path: '/tmp/' + over.id, type: 'memory' },
    links: {},
    ...over,
  }
}

describe('merge', () => {
  it('keeps disk metadata when memory and disk emit the same id, layering memory description if disk has none', () => {
    const memory = {
      nodes: [
        n({
          id: 'project-topsnip',
          description: 'TopSnip v3 from memory',
          source: { path: '/m/project_topsnip.md', type: 'memory' },
          bodyMarkdown: 'memory body',
        }),
      ],
      edges: [],
    }
    const disk = {
      nodes: [
        n({
          id: 'project-topsnip',
          description: '',
          source: { path: '/c/topsnip', type: 'folder' },
          bodyMarkdown: 'disk body',
        }),
      ],
      edges: [],
    }
    const merged = mergeParserResults([memory, disk])
    const out = merged.nodes.find((x) => x.id === 'project-topsnip')!
    expect(out.source.type).toBe('folder')
    expect(out.source.path).toBe('/c/topsnip')
    expect(out.bodyMarkdown).toBe('disk body')
    expect(out.description).toBe('TopSnip v3 from memory')
  })

  it('unions edges and dedupes by undirected (min,max,kind) key', () => {
    const a: AtlasEdge = { source: 'b', target: 'a', kind: 'wikilink', weight: 1.0 }
    const b: AtlasEdge = { source: 'a', target: 'b', kind: 'wikilink', weight: 1.0 }
    const c: AtlasEdge = {
      source: 'a',
      target: 'c',
      kind: 'folder-relation',
      weight: 0.6,
    }
    expect(edgeDedupeKey(a)).toBe(edgeDedupeKey(b))
    const merged = mergeParserResults([
      { nodes: [n({ id: 'a' }), n({ id: 'b' }), n({ id: 'c' })], edges: [a] },
      { nodes: [], edges: [b, c] },
    ])
    expect(merged.edges).toHaveLength(2)
  })

  it('drops edges that point at unknown node ids and warns once per missing target', () => {
    const merged = mergeParserResults([
      {
        nodes: [n({ id: 'a' })],
        edges: [
          { source: 'a', target: 'ghost', kind: 'wikilink', weight: 1.0 },
          { source: 'a', target: 'ghost', kind: 'wikilink', weight: 1.0 },
        ],
      },
    ])
    expect(merged.edges).toHaveLength(0)
    expect(merged.warnings).toBeDefined()
    expect(merged.warnings!.filter((w) => w.includes('ghost'))).toHaveLength(1)
  })

  it('when the same node-pair has multiple edge kinds, keeps the highest-weight edge only', () => {
    const merged = mergeParserResults([
      {
        nodes: [n({ id: 'a' }), n({ id: 'b' })],
        edges: [
          { source: 'a', target: 'b', kind: 'inferred-tag', weight: 0.3 },
          { source: 'a', target: 'b', kind: 'folder-relation', weight: 0.6 },
          { source: 'b', target: 'a', kind: 'wikilink', weight: 1.0 },
        ],
      },
    ])
    expect(merged.edges).toHaveLength(1)
    expect(merged.edges[0].kind).toBe('wikilink')
    expect(merged.edges[0].weight).toBe(1.0)
  })
})
