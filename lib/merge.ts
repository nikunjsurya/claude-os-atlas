// Merge multiple ParserResults into one. Spec section 5.7 (edge dedupe key,
// undirected), 4.2 (disk-prefer node merge), 7 (drop edges to unknown ids).

import type { AtlasEdge, ParsedNode, ParserResult, EdgeKind } from './types'

export interface MergeOutput {
  nodes: ParsedNode[]
  edges: AtlasEdge[]
  warnings?: string[]
}

// Disk wins for source. We rank source.type so the highest takes precedence.
const SOURCE_PRECEDENCE: Record<ParsedNode['source']['type'], number> = {
  folder: 5,
  skill: 4,
  agent: 3,
  claudemd: 2,
  memory: 1,
}

function pickPreferred(a: ParsedNode, b: ParsedNode): {
  primary: ParsedNode
  secondary: ParsedNode
} {
  if (SOURCE_PRECEDENCE[a.source.type] >= SOURCE_PRECEDENCE[b.source.type]) {
    return { primary: a, secondary: b }
  }
  return { primary: b, secondary: a }
}

function mergePair(a: ParsedNode, b: ParsedNode): ParsedNode {
  const { primary, secondary } = pickPreferred(a, b)
  return {
    ...primary,
    description: primary.description || secondary.description,
    bodyMarkdown: primary.bodyMarkdown || secondary.bodyMarkdown,
    links: { ...secondary.links, ...primary.links },
  }
}

export function edgeDedupeKey(e: AtlasEdge): string {
  const lo = e.source < e.target ? e.source : e.target
  const hi = e.source < e.target ? e.target : e.source
  return `${lo}__${hi}__${e.kind}`
}

const EDGE_KIND_WEIGHT_RANK: Record<EdgeKind, number> = {
  wikilink: 3,
  'folder-relation': 2,
  'inferred-tag': 1,
}

function pairKey(e: AtlasEdge): string {
  const lo = e.source < e.target ? e.source : e.target
  const hi = e.source < e.target ? e.target : e.source
  return `${lo}__${hi}`
}

export function mergeParserResults(results: ParserResult[]): MergeOutput {
  const warnings: string[] = []

  // Merge nodes by id.
  const byId = new Map<string, ParsedNode>()
  for (const r of results) {
    if (r.warnings) warnings.push(...r.warnings)
    for (const node of r.nodes) {
      const existing = byId.get(node.id)
      byId.set(node.id, existing ? mergePair(existing, node) : node)
    }
  }
  const nodes = [...byId.values()]
  const knownIds = new Set(nodes.map((n) => n.id))

  // Collect edges, drop those pointing at unknown ids (warn once per missing).
  const allEdges: AtlasEdge[] = []
  const missingTargetsWarned = new Set<string>()
  for (const r of results) {
    for (const e of r.edges) {
      if (!knownIds.has(e.source)) {
        if (!missingTargetsWarned.has(e.source)) {
          missingTargetsWarned.add(e.source)
          warnings.push(`merge: edge skipped, unknown source ${e.source}`)
        }
        continue
      }
      if (!knownIds.has(e.target)) {
        if (!missingTargetsWarned.has(e.target)) {
          missingTargetsWarned.add(e.target)
          warnings.push(`merge: edge skipped, unknown target ${e.target}`)
        }
        continue
      }
      allEdges.push(e)
    }
  }

  // Dedupe by (min,max,kind), then collapse multi-kind same-pair to highest
  // weight + highest kind precedence.
  const byKindKey = new Map<string, AtlasEdge>()
  for (const e of allEdges) {
    const key = edgeDedupeKey(e)
    const prev = byKindKey.get(key)
    if (!prev || e.weight > prev.weight) byKindKey.set(key, e)
  }

  const byPair = new Map<string, AtlasEdge>()
  for (const e of byKindKey.values()) {
    const key = pairKey(e)
    const prev = byPair.get(key)
    if (
      !prev ||
      e.weight > prev.weight ||
      (e.weight === prev.weight &&
        EDGE_KIND_WEIGHT_RANK[e.kind] > EDGE_KIND_WEIGHT_RANK[prev.kind])
    ) {
      byPair.set(key, e)
    }
  }

  return {
    nodes,
    edges: [...byPair.values()],
    warnings: warnings.length ? warnings : undefined,
  }
}
