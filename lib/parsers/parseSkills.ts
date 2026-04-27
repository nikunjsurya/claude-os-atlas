// Walk <skillsRoot>/*/SKILL.md (one level deep). Spec section 4.2 (parser shape),
// 5.3 (id convention).

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

export async function parseSkills(skillsRoot: string): Promise<ParserResult> {
  const warnings: string[] = []
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(skillsRoot, { withFileTypes: true })
  } catch {
    const msg = `parseSkills: root not found at ${skillsRoot}`
    console.warn(msg)
    return { nodes: [], edges: [], warnings: [msg] }
  }

  const nodes: ParsedNode[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const folderPath = path.join(skillsRoot, entry.name)
    const skillPath = path.join(folderPath, 'SKILL.md')
    let body: string
    try {
      body = await fs.readFile(skillPath, 'utf8')
    } catch {
      // Folder without SKILL.md: skip silently.
      continue
    }

    const fm = parseFrontmatter(body)
    const name = fm.name ?? entry.name
    const description = fm.description ?? ''
    const id = `skill-${kebab(name)}`

    let lastTouched = new Date().toISOString()
    try {
      lastTouched = (await fs.stat(skillPath)).mtime.toISOString()
    } catch {
      warnings.push(`parseSkills: stat failed for ${skillPath}`)
    }

    nodes.push({
      id,
      label: name,
      kind: 'skill',
      description,
      bodyMarkdown: body,
      lastTouched,
      source: { path: skillPath, type: 'skill' },
      links: {},
    })
  }

  return { nodes, edges: [], warnings: warnings.length ? warnings : undefined }
}
