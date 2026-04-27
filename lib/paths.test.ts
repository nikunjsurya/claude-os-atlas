import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { getRoots, setRootOverride, clearRootOverride } from './paths'

describe('paths', () => {
  afterEach(() => {
    clearRootOverride()
  })

  it('defaults home directory to os.homedir() when no override is set', () => {
    clearRootOverride()
    const roots = getRoots()
    const home = os.homedir()
    expect(roots.home).toBe(home)
    expect(roots.memoryIndex).toBe(
      path.join(home, '.claude', 'projects', 'C--Users-surya', 'memory', 'MEMORY.md')
    )
    expect(roots.projects).toBe(path.join(home, 'Projects'))
    expect(roots.claudeGlobal).toBe(path.join(home, '.claude'))
    expect(roots.templatesAgents).toBe(
      path.join(home, 'Projects', '_templates', '.claude', 'agents')
    )
    expect(roots.globalClaudeMd).toBe(path.join(home, '.claude', 'CLAUDE.md'))
  })

  it('uses the override root for every resolved path when set', () => {
    const fixtureHome = path.join('/tmp', 'fixture-home')
    setRootOverride(fixtureHome)
    const roots = getRoots()
    expect(roots.home).toBe(fixtureHome)
    expect(roots.memoryIndex).toBe(
      path.join(fixtureHome, '.claude', 'projects', 'C--Users-surya', 'memory', 'MEMORY.md')
    )
    expect(roots.projects).toBe(path.join(fixtureHome, 'Projects'))
    expect(roots.claudeGlobal).toBe(path.join(fixtureHome, '.claude'))
    expect(roots.templatesAgents).toBe(
      path.join(fixtureHome, 'Projects', '_templates', '.claude', 'agents')
    )
    expect(roots.globalClaudeMd).toBe(path.join(fixtureHome, '.claude', 'CLAUDE.md'))
  })
})
