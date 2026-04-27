// Read ~/.claude/CLAUDE.md (global) and ~/Projects/*/CLAUDE.md (one level
// deep, no recursion). Spec section 4.2, 5.3 (id convention).

import fs from 'node:fs/promises'
import path from 'node:path'
import type { ParsedNode, ParserResult } from '../types'

export interface ClaudeMdRoots {
  globalClaudeMd: string
  projectsRoot: string
}

function kebab(s: string): string {
  return s
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}

async function readFileIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8')
  } catch {
    return null
  }
}

async function statMtime(p: string): Promise<string> {
  try {
    return (await fs.stat(p)).mtime.toISOString()
  } catch {
    return new Date().toISOString()
  }
}

function firstParagraph(body: string): string {
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#')) continue
    return line
  }
  return ''
}

export async function parseClaudeMd(
  roots: ClaudeMdRoots
): Promise<ParserResult> {
  const warnings: string[] = []
  const nodes: ParsedNode[] = []

  // Global instruction file.
  const globalBody = await readFileIfExists(roots.globalClaudeMd)
  if (globalBody === null) {
    const msg = `parseClaudeMd: global CLAUDE.md not found at ${roots.globalClaudeMd}`
    console.warn(msg)
    warnings.push(msg)
  } else {
    nodes.push({
      id: 'instruction-global',
      label: 'global CLAUDE.md',
      kind: 'instruction',
      description: firstParagraph(globalBody),
      bodyMarkdown: globalBody,
      lastTouched: await statMtime(roots.globalClaudeMd),
      source: { path: roots.globalClaudeMd, type: 'claudemd' },
      links: {},
    })
  }

  // Project-scoped instruction files: one level deep only.
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(roots.projectsRoot, { withFileTypes: true })
  } catch {
    const msg = `parseClaudeMd: Projects root not found at ${roots.projectsRoot}`
    console.warn(msg)
    warnings.push(msg)
    return { nodes, edges: [], warnings: warnings.length ? warnings : undefined }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const folder = path.join(roots.projectsRoot, entry.name)
    const claudePath = path.join(folder, 'CLAUDE.md')
    const body = await readFileIfExists(claudePath)
    if (body === null) continue
    const id = `instruction-${kebab(entry.name)}`
    nodes.push({
      id,
      label: `${entry.name}/CLAUDE.md`,
      kind: 'instruction',
      description: firstParagraph(body),
      bodyMarkdown: body,
      lastTouched: await statMtime(claudePath),
      source: { path: claudePath, type: 'claudemd' },
      links: {},
    })
  }

  return { nodes, edges: [], warnings: warnings.length ? warnings : undefined }
}
