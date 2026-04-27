// Walk <skillsRoot>/*/SKILL.md (one level deep). Spec section 4.2 (parser shape),
// 5.3 (id convention).

import fs from 'node:fs/promises'
import path from 'node:path'
import type { ParsedNode, ParserResult } from '../types'

interface Frontmatter {
  name?: string
  description?: string
}

// Tiny YAML extractor for our two known keys. Handles single-line scalars,
// quoted strings, and YAML-folded `>` blocks. Sufficient for SKILL.md files
// (which use a fixed shape per the templates repo). Anything more demands a
// real YAML lib and we are not paying that cost here.
function parseFrontmatter(text: string): Frontmatter {
  const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmMatch) return {}
  const lines = fmMatch[1].split(/\r?\n/)
  const out: Frontmatter = {}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/)
    if (!kv) continue
    const key = kv[1]
    let value = kv[2].trim()

    // Folded scalar: gather following indented lines until indent drops.
    if (value === '>' || value === '|') {
      const folded: string[] = []
      const baseIndent = (lines[i + 1] ?? '').match(/^(\s*)/)?.[1].length ?? 0
      let j = i + 1
      while (j < lines.length) {
        const next = lines[j]
        if (!next.trim()) {
          j++
          continue
        }
        const indent = next.match(/^(\s*)/)?.[1].length ?? 0
        if (indent < baseIndent) break
        folded.push(next.slice(baseIndent).trim())
        j++
      }
      value = value === '>' ? folded.join(' ') : folded.join('\n')
      i = j - 1
    } else {
      // Strip surrounding quotes if present.
      const quoted = value.match(/^"(.*)"$/) ?? value.match(/^'(.*)'$/)
      if (quoted) value = quoted[1]
    }

    if (key === 'name' || key === 'description') {
      out[key] = value
    }
  }

  return out
}

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
