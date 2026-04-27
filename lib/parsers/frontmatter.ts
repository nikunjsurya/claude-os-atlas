// Tiny inline YAML extractor for the keys we actually use in skill, agent
// and CLAUDE.md frontmatter blocks. Supports single-line scalars (with
// optional quotes) and YAML-folded `>` / literal `|` blocks. Anything more
// demands a real YAML lib and we are not paying that cost in V1.

export type Frontmatter = Record<string, string>

export function parseFrontmatter(text: string): Frontmatter {
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

    if (value === '>' || value === '|') {
      const folded: string[] = []
      const baseIndent =
        (lines[i + 1] ?? '').match(/^(\s*)/)?.[1].length ?? 0
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
      const quoted = value.match(/^"(.*)"$/) ?? value.match(/^'(.*)'$/)
      if (quoted) value = quoted[1]
    }

    out[key] = value
  }

  return out
}
