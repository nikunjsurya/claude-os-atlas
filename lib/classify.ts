// Pure heuristics: assign cluster + status to each node. Spec sections 5.5,
// 5.6, 5.2.1.

import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Cluster, Status, ParsedNode, AtlasEdge, AtlasNode } from './types'

export const CONTENT_KEYWORDS = [
  'channel',
  'shorts',
  'video',
  'podcast',
  'episode',
  'neither-bank',
  'hindi-ai',
  'faceless',
  'forgotten-myths',
  'hidden-systems',
  'render',
  'publishing',
  'remotion',
  'shorts-factory',
  'longform',
  'reel',
] as const

export const VOICE_KEYWORDS = [
  'nikunj-agent',
  'nikunj agent',
  'elevenlabs',
  'voice sample',
  'voice profile',
  'voice clone',
  'rapid-update',
  'voice-check',
] as const

export const INFRA_KEYWORDS = [
  'mcp',
  'n8n',
  'lightrag',
  'paperclip',
  'higgsfield',
  'vps',
  'codex',
  'plugin',
  'cli-anything',
  'remotion',
  'crawl4ai',
  'yt-dlp',
] as const

function searchText(node: ParsedNode | AtlasNode): string {
  return `${node.label} ${node.description}`.toLowerCase()
}

function containsAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((k) => haystack.includes(k.toLowerCase()))
}

export interface ClassifyContext {
  warnings?: string[]
}

export function assignCluster(
  node: ParsedNode | AtlasNode,
  ctx: ClassifyContext = {}
): Cluster {
  const text = searchText(node)

  if (containsAny(text, VOICE_KEYWORDS)) return 'voice'

  if (
    (node.kind === 'reference' || node.kind === 'feedback') &&
    containsAny(text, INFRA_KEYWORDS)
  ) {
    return 'infra'
  }

  if (node.kind === 'project' && containsAny(text, CONTENT_KEYWORDS)) {
    return 'content'
  }

  if (
    node.kind === 'project' &&
    existsSync(path.join(node.source.path, 'package.json'))
  ) {
    return 'software'
  }

  if (
    node.kind === 'skill' ||
    node.kind === 'feedback' ||
    node.kind === 'instruction' ||
    node.kind === 'reference'
  ) {
    return 'meta'
  }

  const msg = `unclassified: ${node.id}`
  console.warn(msg)
  ctx.warnings?.push(msg)
  return 'meta'
}

const PARKED_RE = /\bPARKED\b/i
const SHIPPED_RE = /\b(shipped|complete|production-ready)\b/i
const ACTIVE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

export function assignStatus(node: ParsedNode | AtlasNode): Status {
  const text = searchText(node) + ' ' + node.bodyMarkdown
  if (PARKED_RE.test(text)) return 'parked'
  // Check the PARKED.md sibling on disk for project nodes (folder-sourced).
  if (
    node.kind === 'project' &&
    node.source.type === 'folder' &&
    existsSync(path.join(node.source.path, 'PARKED.md'))
  ) {
    return 'parked'
  }
  if (SHIPPED_RE.test(text)) return 'shipped'
  if (node.kind === 'project') {
    const age = Date.now() - new Date(node.lastTouched).getTime()
    if (age < ACTIVE_WINDOW_MS) return 'active'
  }
  if (
    node.kind === 'reference' ||
    node.kind === 'feedback' ||
    node.kind === 'instruction'
  ) {
    return 'reference'
  }
  return node.kind === 'project' ? 'active' : 'reference'
}

// Spec 5.2.1: clamp(14 + edgeCount * 1.5 + (active ? 4 : 0), 14, 32)
export function computeNodeSize(edgeCount: number, status: Status): number {
  const raw = 14 + edgeCount * 1.5 + (status === 'active' ? 4 : 0)
  return Math.max(14, Math.min(32, raw))
}

// Edge derivation helpers used by merge / API route. Closed token list per
// spec section 5.7.
export const SHARED_ENTITY_TOKENS = [
  'ElevenLabs',
  'Higgsfield',
  'Nikunj',
  'NotebookLM',
  'LightRAG',
  'Paperclip',
  'n8n',
  'Pexels',
  'Vercel',
  'Excalidraw',
  'Codex',
  'Wispr Flow',
] as const

const STATUS_PRECEDENCE: Record<Status, number> = {
  active: 4,
  shipped: 3,
  parked: 2,
  reference: 1,
}

export function deriveInferredTagEdges(
  nodes: ParsedNode[],
  statusOf: Map<string, Status>
): AtlasEdge[] {
  const edges: AtlasEdge[] = []
  for (const token of SHARED_ENTITY_TOKENS) {
    const re = new RegExp(`\\b${token.replace(/\s+/g, '\\s+')}\\b`, 'i')
    const matched = nodes.filter(
      (n) => re.test(n.label) || re.test(n.description)
    )
    let pool = matched
    // Cap to top-8 by status precedence to prevent visual hairballs.
    if (matched.length > 8) {
      pool = [...matched]
        .sort(
          (a, b) =>
            (STATUS_PRECEDENCE[statusOf.get(b.id) ?? 'reference'] ?? 0) -
            (STATUS_PRECEDENCE[statusOf.get(a.id) ?? 'reference'] ?? 0)
        )
        .slice(0, 8)
    }
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        edges.push({
          source: pool[i].id,
          target: pool[j].id,
          kind: 'inferred-tag',
          weight: 0.3,
        })
      }
    }
  }
  return edges
}

export function deriveFolderRelationEdges(
  projectNodes: ParsedNode[]
): AtlasEdge[] {
  const edges: AtlasEdge[] = []
  // Build slug map: kebabed-folder-name -> id
  const slugToId = new Map<string, string>()
  for (const n of projectNodes) {
    const slug = n.id.replace(/^project-/, '')
    if (slug) slugToId.set(slug, n.id)
  }
  for (const node of projectNodes) {
    const text = node.bodyMarkdown.toLowerCase()
    for (const [slug, otherId] of slugToId) {
      if (otherId === node.id) continue
      // Whole-word match.
      const re = new RegExp(`\\b${slug.replace(/-/g, '[-\\s]')}\\b`, 'i')
      if (re.test(text)) {
        edges.push({
          source: node.id,
          target: otherId,
          kind: 'folder-relation',
          weight: 0.6,
        })
      }
    }
  }
  return edges
}
