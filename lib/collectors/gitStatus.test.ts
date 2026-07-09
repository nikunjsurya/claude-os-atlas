import { describe, expect, it } from 'vitest'
import { parseGitStatus } from './gitStatus'

describe('parseGitStatus', () => {
  it('reports a clean repo with upstream as zero dirty/ahead/behind', () => {
    const out = '## main...origin/main\n'
    expect(parseGitStatus(out)).toEqual({
      branch: 'main',
      dirty: 0,
      ahead: 0,
      behind: 0,
    })
  })

  it('counts every changed/untracked line as dirty, including renames once', () => {
    const out = [
      '## main...origin/main',
      ' M lib/a.ts',
      '?? new-file.ts',
      'A  staged.ts',
      'R  old.ts -> renamed.ts',
      '',
    ].join('\n')
    expect(parseGitStatus(out).dirty).toBe(4)
  })

  it('extracts ahead and behind from the branch header', () => {
    const out = '## main...origin/main [ahead 2, behind 1]\n'
    const parsed = parseGitStatus(out)
    expect(parsed.ahead).toBe(2)
    expect(parsed.behind).toBe(1)
  })

  it('extracts ahead-only headers', () => {
    const out = '## codex/fix...origin/codex/fix [ahead 16]\n M x.ts\n'
    const parsed = parseGitStatus(out)
    expect(parsed.branch).toBe('codex/fix')
    expect(parsed.ahead).toBe(16)
    expect(parsed.behind).toBe(0)
    expect(parsed.dirty).toBe(1)
  })

  it('handles a local-only branch with no upstream', () => {
    const out = '## surya-local\n M cv.md\n'
    expect(parseGitStatus(out)).toEqual({
      branch: 'surya-local',
      dirty: 1,
      ahead: 0,
      behind: 0,
    })
  })

  it('reports detached HEAD as branch "detached"', () => {
    const out = '## HEAD (no branch)\n'
    expect(parseGitStatus(out).branch).toBe('detached')
  })
})
