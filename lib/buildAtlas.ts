// Wire every parser through merge + classify + edge derivation + size +
// stats. Spec section 5.1 (pipeline), 5.4 (API contract), 5.2.1 (size).

import type {
  AtlasResponse,
  AtlasNode,
  ParsedNode,
  AtlasEdge,
  Cluster,
  Status,
} from './types'
import { mergeParserResults } from './merge'
import {
  assignCluster,
  assignStatus,
  computeNodeSize,
  deriveInferredTagEdges,
  deriveFolderRelationEdges,
} from './classify'
import { parseMemoryIndex } from './parsers/parseMemoryIndex'
import { parseProjectsFolder } from './parsers/parseProjectsFolder'
import { parseSkills } from './parsers/parseSkills'
import { parseAgents } from './parsers/parseAgents'
import { parseClaudeMd } from './parsers/parseClaudeMd'

export interface AtlasRoots {
  memoryDir: string
  projectsRoot: string
  claudeSkills: string
  agentRoots: string[]
  globalClaudeMd: string
}

const CLUSTER_DESCRIPTORS: AtlasResponse['clusters'] = [
  { id: 'content', label: 'Content', color: '#E07B4E' },
  { id: 'software', label: 'Software', color: '#5BA3B5' },
  { id: 'voice', label: 'Voice', color: '#9F7AEA' },
  { id: 'infra', label: 'Infra', color: '#5AA77A' },
  { id: 'meta', label: 'Meta', color: '#6B7280' },
]

export async function buildAtlasResponse(
  roots: AtlasRoots
): Promise<AtlasResponse> {
  const warnings: string[] = []

  const safe = async (name: string, p: Promise<unknown>) => {
    try {
      return await p
    } catch (err) {
      const msg = `parser ${name} threw: ${(err as Error).message}`
      console.warn(msg)
      warnings.push(msg)
      return { nodes: [], edges: [] }
    }
  }

  const [memory, projects, skills, agents, claudemd] = await Promise.all([
    safe('parseMemoryIndex', parseMemoryIndex(roots.memoryDir)),
    safe('parseProjectsFolder', parseProjectsFolder(roots.projectsRoot)),
    safe('parseSkills', parseSkills(roots.claudeSkills)),
    safe('parseAgents', parseAgents(roots.agentRoots)),
    safe(
      'parseClaudeMd',
      parseClaudeMd({
        globalClaudeMd: roots.globalClaudeMd,
        projectsRoot: roots.projectsRoot,
      })
    ),
  ]) as Awaited<ReturnType<typeof parseMemoryIndex>>[]

  const merged = mergeParserResults([memory, projects, skills, agents, claudemd])
  if (merged.warnings) warnings.push(...merged.warnings)

  // Derive folder-relation edges (cross-project README mentions) and
  // inferred-tag edges (shared entity tokens). Then re-merge edges so the
  // dedupe rules apply uniformly.
  const projectNodes = merged.nodes.filter((n) => n.kind === 'project')

  // Pre-compute statuses for edge cap precedence.
  const statusOf = new Map<string, Status>()
  for (const n of merged.nodes) statusOf.set(n.id, assignStatus(n))

  const folderEdges = deriveFolderRelationEdges(projectNodes)
  const tagEdges = deriveInferredTagEdges(merged.nodes, statusOf)

  // Merge once more to dedupe across the new edge sources.
  const finalMerge = mergeParserResults([
    { nodes: merged.nodes, edges: merged.edges },
    { nodes: [], edges: folderEdges },
    { nodes: [], edges: tagEdges },
  ])
  if (finalMerge.warnings) warnings.push(...finalMerge.warnings)

  // Edge counts for size formula.
  const incident = new Map<string, number>()
  for (const e of finalMerge.edges) {
    incident.set(e.source, (incident.get(e.source) ?? 0) + 1)
    incident.set(e.target, (incident.get(e.target) ?? 0) + 1)
  }

  // Classify and finalize each node.
  const ctx = { warnings }
  const finalNodes: AtlasNode[] = finalMerge.nodes.map((n: ParsedNode) => {
    const cluster: Cluster = assignCluster(n, ctx)
    const status: Status = statusOf.get(n.id) ?? assignStatus(n)
    const size = computeNodeSize(incident.get(n.id) ?? 0, status)
    return {
      id: n.id,
      label: n.label,
      kind: n.kind,
      cluster,
      status,
      size,
      description: n.description,
      bodyMarkdown: n.bodyMarkdown,
      lastTouched: n.lastTouched,
      source: n.source,
      links: n.links,
    }
  })

  const stats = {
    nodes: finalNodes.length,
    edges: finalMerge.edges.length,
    active: finalNodes.filter((n) => n.status === 'active').length,
    parked: finalNodes.filter((n) => n.status === 'parked').length,
    shipped: finalNodes.filter((n) => n.status === 'shipped').length,
    skills: finalNodes.filter((n) => n.kind === 'skill').length,
  }

  // Drop edges whose source/target wasn't kept (shouldn't happen but
  // defensive).
  const finalIds = new Set(finalNodes.map((n) => n.id))
  const finalEdges: AtlasEdge[] = finalMerge.edges.filter(
    (e) => finalIds.has(e.source) && finalIds.has(e.target)
  )

  return {
    nodes: finalNodes,
    edges: finalEdges,
    clusters: CLUSTER_DESCRIPTORS,
    stats,
    generatedAt: new Date().toISOString(),
    warnings: warnings.length ? warnings : undefined,
  }
}
