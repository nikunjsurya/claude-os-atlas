// Walk <projectsRoot>/* (one level deep) and emit one node per
// subdirectory. Spec section 4.2 (parser shape), 5.3 (id convention),
// 5.6 (PARKED textual signal).

import fs from 'node:fs/promises'
import path from 'node:path'
import type { ParsedNode, ParserResult } from '../types'

function kebab(name: string): string {
  return name
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}

function humanLabel(name: string): string {
  return name
}

async function readIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8')
  } catch {
    return null
  }
}

async function existsFile(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p)
    return stat.isFile()
  } catch {
    return false
  }
}

export async function parseProjectsFolder(
  projectsRoot: string
): Promise<ParserResult> {
  const warnings: string[] = []
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(projectsRoot, { withFileTypes: true })
  } catch {
    const msg = `parseProjectsFolder: root not found at ${projectsRoot}`
    console.warn(msg)
    return { nodes: [], edges: [], warnings: [msg] }
  }

  const nodes: ParsedNode[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const folderName = entry.name
    const folderPath = path.join(projectsRoot, folderName)
    const id = `project-${kebab(folderName)}`

    // Read first available description source.
    const indexBody = await readIfExists(path.join(folderPath, '_index.md'))
    const readmeBody = await readIfExists(path.join(folderPath, 'README.md'))
    const parkedBody = await readIfExists(path.join(folderPath, 'PARKED.md'))
    const body = indexBody ?? readmeBody ?? ''

    let description = ''
    // First non-blank, non-frontmatter, non-heading line of the body.
    const lines = body.split(/\r?\n/)
    let inFrontmatter = false
    for (const raw of lines) {
      const line = raw.trim()
      if (line === '---') {
        inFrontmatter = !inFrontmatter
        continue
      }
      if (inFrontmatter) continue
      if (!line) continue
      if (line.startsWith('#')) continue
      description = line
      break
    }
    if (parkedBody) {
      description = description
        ? `PARKED. ${description}`
        : `PARKED. ${parkedBody.split(/\r?\n/)[0].trim()}`
    }

    let lastTouched = new Date().toISOString()
    try {
      const stat = await fs.stat(folderPath)
      lastTouched = stat.mtime.toISOString()
    } catch {
      warnings.push(`parseProjectsFolder: stat failed for ${folderPath}`)
    }

    void (await existsFile(path.join(folderPath, 'package.json')))

    nodes.push({
      id,
      label: humanLabel(folderName),
      kind: 'project',
      description,
      bodyMarkdown: body,
      lastTouched,
      source: { path: folderPath, type: 'folder' },
      links: {},
    })
  }

  return { nodes, edges: [], warnings: warnings.length ? warnings : undefined }
}
