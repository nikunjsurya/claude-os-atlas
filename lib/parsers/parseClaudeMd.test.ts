import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { parseClaudeMd } from './parseClaudeMd'

const FIXTURE = path.join(__dirname, '__fixtures__', 'parseClaudeMd')
const GLOBAL_PATH = path.join(FIXTURE, 'global', 'CLAUDE.md')
const PROJECTS_ROOT = path.join(FIXTURE, 'Projects')

describe('parseClaudeMd', () => {
  it('emits a single instruction-global node when the global CLAUDE.md exists', async () => {
    const { nodes } = await parseClaudeMd({
      globalClaudeMd: GLOBAL_PATH,
      projectsRoot: PROJECTS_ROOT,
    })
    const global = nodes.find((n) => n.id === 'instruction-global')
    expect(global).toBeDefined()
    expect(global!.kind).toBe('instruction')
    expect(global!.source.type).toBe('claudemd')
    expect(global!.bodyMarkdown).toContain('Global Claude Code Instructions')
  })

  it('emits one instruction-<project> node per Projects/*/CLAUDE.md (one level only)', async () => {
    const { nodes } = await parseClaudeMd({
      globalClaudeMd: GLOBAL_PATH,
      projectsRoot: PROJECTS_ROOT,
    })
    const ids = nodes.map((n) => n.id).sort()
    expect(ids).toEqual([
      'instruction-global',
      'instruction-hidden-systems',
      'instruction-topsnip',
    ])
  })

  it('does NOT recurse beyond Projects/*/CLAUDE.md', async () => {
    const { nodes } = await parseClaudeMd({
      globalClaudeMd: GLOBAL_PATH,
      projectsRoot: PROJECTS_ROOT,
    })
    expect(nodes.find((n) => n.id === 'instruction-subdir')).toBeUndefined()
    expect(nodes.find((n) => n.id === 'instruction-nested-project')).toBeUndefined()
  })

  it('omits the global node and warns when ~/.claude/CLAUDE.md is missing', async () => {
    const result = await parseClaudeMd({
      globalClaudeMd: path.join(FIXTURE, 'no-such-global', 'CLAUDE.md'),
      projectsRoot: PROJECTS_ROOT,
    })
    expect(result.nodes.find((n) => n.id === 'instruction-global')).toBeUndefined()
    expect(result.warnings).toBeDefined()
    expect(result.warnings!.some((w) => w.includes('global CLAUDE.md'))).toBe(true)
  })

  it('still returns a partial result with a warning when Projects root is missing', async () => {
    const result = await parseClaudeMd({
      globalClaudeMd: GLOBAL_PATH,
      projectsRoot: path.join(FIXTURE, 'no-such-projects'),
    })
    // Global still made it.
    expect(result.nodes.find((n) => n.id === 'instruction-global')).toBeDefined()
    expect(result.warnings).toBeDefined()
    expect(result.warnings!.some((w) => w.toLowerCase().includes('projects'))).toBe(
      true
    )
  })
})
