// Parse the memory index table at <memoryDir>/MEMORY.md and the body files
// it links to. Spec: section 4.2 (parser shape), 5.3 (id convention),
// 5.7 (wikilink edges).

import fs from 'node:fs/promises'
import path from 'node:path'
import type { ParsedNode, ParserResult, AtlasEdge, NodeKind } from '../types'

// "[label.md](file.md) | type | description"
const ROW_RE = /^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*$/

// "[Title](file.md)" markdown link
const MD_LINK_RE = /\[[^\]]+\]\(([^)]+\.md)\)/g
// "[[wikilink]]" Obsidian-style. Strips the `.md` if present.
const WIKILINK_RE = /\[\[([^\]]+?)\]\]/g

const KIND_MAP: Record<string, NodeKind> = {
  project: 'project',
  reference: 'reference',
  feedback: 'feedback',
  user: 'reference',
}

function rowKind(rawType: string): NodeKind {
  const t = rawType.trim().toLowerCase()
  return KIND_MAP[t] ?? 'reference'
}

// project_topsnip.md → project-topsnip
function fileToId(filename: string): string {
  return filename.replace(/\.md$/i, '').replace(/_/g, '-').toLowerCase()
}

// project_topsnip.md → "project topsnip" → "TopSnip"-ish; we just kebab the
// stem and let the row label drive the human-readable label.
function rowLabel(linkText: string, filename: string): string {
  // Prefer the row label if it isn't just the filename.
  if (linkText && !linkText.endsWith('.md')) return linkText
  return filename.replace(/\.md$/i, '').replace(/_/g, ' ')
}

export async function parseMemoryIndex(memoryDir: string): Promise<ParserResult> {
  const indexPath = path.join(memoryDir, 'MEMORY.md')
  const warnings: string[] = []

  let indexText: string
  try {
    indexText = await fs.readFile(indexPath, 'utf8')
  } catch {
    const msg = `parseMemoryIndex: MEMORY.md not found at ${indexPath}`
    console.warn(msg)
    return { nodes: [], edges: [], warnings: [msg] }
  }

  const nodes: ParsedNode[] = []
  // filename -> id, used to resolve wikilink targets back to ids
  const fileToNodeId = new Map<string, string>()

  for (const line of indexText.split(/\r?\n/)) {
    const m = line.match(ROW_RE)
    if (!m) continue
    const [, linkText, filename, type, description] = m
    if (filename.toLowerCase() === 'file') continue // skip table header
    const id = fileToId(filename)
    fileToNodeId.set(filename, id)

    const filePath = path.join(memoryDir, filename)
    let body = ''
    let mtime = new Date().toISOString()
    try {
      body = await fs.readFile(filePath, 'utf8')
      const stat = await fs.stat(filePath)
      mtime = stat.mtime.toISOString()
    } catch {
      warnings.push(`parseMemoryIndex: missing body file ${filename}`)
    }

    nodes.push({
      id,
      label: rowLabel(linkText, filename),
      kind: rowKind(type),
      description: description.trim(),
      bodyMarkdown: body,
      lastTouched: mtime,
      source: { path: filePath, type: 'memory' },
      links: { memoryFile: filename },
    })
  }

  // Build edges from wikilinks inside each entry's body.
  const edges: AtlasEdge[] = []
  for (const node of nodes) {
    const filename = node.links.memoryFile!
    const sourceId = node.id
    const seen = new Set<string>()

    for (const match of node.bodyMarkdown.matchAll(MD_LINK_RE)) {
      const target = match[1]
      // Strip leading "./" if present.
      const targetFile = target.replace(/^\.\//, '')
      const targetId = fileToNodeId.get(targetFile)
      if (!targetId || targetId === sourceId) continue
      const key = `${sourceId}->${targetId}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ source: sourceId, target: targetId, kind: 'wikilink', weight: 1.0 })
    }

    for (const match of node.bodyMarkdown.matchAll(WIKILINK_RE)) {
      const raw = match[1].trim()
      const stem = raw.replace(/\.md$/i, '')
      const targetFile = `${stem}.md`
      const targetId = fileToNodeId.get(targetFile)
      if (!targetId || targetId === sourceId) continue
      const key = `${sourceId}->${targetId}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ source: sourceId, target: targetId, kind: 'wikilink', weight: 1.0 })
    }

    // Avoid the unused-variable lint complaint while keeping the local
    // alias for readability.
    void filename
  }

  return { nodes, edges, warnings: warnings.length ? warnings : undefined }
}
