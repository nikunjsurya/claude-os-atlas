// Run locally to regenerate the public atlas snapshot.
// Output: data/atlas-snapshot.json. Commit the result.
//
// Usage:
//   npm run snapshot              # writes the file
//   npm run snapshot -- --dry     # prints stats without writing

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { getRoots } from '../lib/paths'
import { buildAtlasResponse } from '../lib/buildAtlas'
import { toPublicResponse } from '../lib/publicMode'

async function main() {
  const dry = process.argv.includes('--dry')

  const roots = getRoots()
  const full = await buildAtlasResponse({
    memoryDir: roots.memoryDir,
    projectsRoot: roots.projects,
    claudeSkills: roots.claudeSkills,
    agentRoots: [roots.claudeAgents, roots.templatesAgents],
    globalClaudeMd: roots.globalClaudeMd,
  })

  const publicResp = toPublicResponse(full)

  console.log(`Full atlas:   ${full.nodes.length} nodes / ${full.edges.length} edges`)
  console.log(
    `Public atlas: ${publicResp.nodes.length} nodes / ${publicResp.edges.length} edges`,
  )
  console.log('Public stats:', publicResp.stats)

  if (publicResp.nodes.length === 0) {
    console.error(
      'Snapshot is empty. PUBLIC_ALLOWLIST ids do not match any parsed node ids.',
    )
    process.exit(1)
  }

  if (dry) {
    console.log('\nDry run. Re-run without --dry to write data/atlas-snapshot.json.')
    return
  }

  const outDir = path.join(process.cwd(), 'data')
  const outPath = path.join(outDir, 'atlas-snapshot.json')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(outPath, JSON.stringify(publicResp, null, 2), 'utf8')
  console.log(
    `\nWrote ${outPath} (${Math.round(JSON.stringify(publicResp).length / 1024)} KB)`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
