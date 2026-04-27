// Walk each provided root for top-level *.md agent definitions.
// Spec section 4.2 (parser shape), 5.3 (id convention).

import fs from 'node:fs/promises'
import path from 'node:path'
import type { ParsedNode, ParserResult } from '../types'
import { parseFrontmatter } from './frontmatter'

function kebab(s: string): string {
  return s
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}

export async function parseAgents(roots: string[]): Promise<ParserResult> {
  const warnings: string[] = []
  const nodes: ParsedNode[] = []
  const seen = new Set<string>()

  for (const root of roots) {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(root, { withFileTypes: true })
    } catch {
      const msg = `parseAgents: root not found at ${root}`
      console.warn(msg)
      warnings.push(msg)
      continue
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!entry.name.toLowerCase().endsWith('.md')) continue
      const filePath = path.join(root, entry.name)
      const body = await fs.readFile(filePath, 'utf8')
      const fm = parseFrontmatter(body)
      const name = fm.name ?? entry.name.replace(/\.md$/i, '')
      const description = fm.description ?? ''
      const id = `agent-${kebab(name)}`
      if (seen.has(id)) continue
      seen.add(id)

      let lastTouched = new Date().toISOString()
      try {
        lastTouched = (await fs.stat(filePath)).mtime.toISOString()
      } catch {
        warnings.push(`parseAgents: stat failed for ${filePath}`)
      }

      nodes.push({
        id,
        label: name,
        kind: 'agent',
        description,
        bodyMarkdown: body,
        lastTouched,
        source: { path: filePath, type: 'agent' },
        links: {},
      })
    }
  }

  return { nodes, edges: [], warnings: warnings.length ? warnings : undefined }
}
