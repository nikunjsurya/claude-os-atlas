// Git state for the project grid. parseGitStatus is a pure parse of
// `git status --porcelain=v1 --branch` output; collectProjectPulses is the
// impure runner (per-repo isolation, concurrency cap 6, 4s timeout).
// Spec: 2026-07-09-mission-control-v2-design.md sections 4.2, 5, 9.

import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitSummary, ProjectPulse } from '@/lib/types'
import { kebab } from '@/lib/parsers/parseProjectsFolder'

const pExecFile = promisify(execFile)

export type ParsedGitStatus = Omit<GitSummary, 'lastCommitAt'>

const GIT_TIMEOUT_MS = 4000
const CONCURRENCY = 6

// Folders under ~/Projects that are not code repos (spec section 4.3).
const EXCLUDED_FOLDERS = new Set([
  '_archive',
  '_parked',
  'sessions',
  'reference',
  "Nikunj's Vault",
])

export function parseGitStatus(porcelainOutput: string): ParsedGitStatus {
  const lines = porcelainOutput.split('\n').filter((l) => l.length > 0)
  const header = lines.find((l) => l.startsWith('## '))
  const fileLines = lines.filter((l) => !l.startsWith('## '))

  let branch = 'unknown'
  let ahead = 0
  let behind = 0

  if (header) {
    const h = header.slice(3)
    if (h.startsWith('HEAD (no branch)')) {
      branch = 'detached'
    } else {
      const noCommits = h.match(/^No commits yet on (.+)$/)
      branch = noCommits ? noCommits[1] : h.split('...')[0].split(' ')[0]
      const a = h.match(/ahead (\d+)/)
      if (a) ahead = parseInt(a[1], 10)
      const b = h.match(/behind (\d+)/)
      if (b) behind = parseInt(b[1], 10)
    }
  }

  return { branch, dirty: fileLines.length, ahead, behind }
}

export async function gitSummaryFor(repoPath: string): Promise<GitSummary | null> {
  try {
    const { stdout } = await pExecFile(
      'git',
      ['-C', repoPath, 'status', '--porcelain=v1', '--branch'],
      { timeout: GIT_TIMEOUT_MS, windowsHide: true }
    )
    const parsed = parseGitStatus(stdout)
    let lastCommitAt: string | null = null
    try {
      const { stdout: log } = await pExecFile(
        'git',
        ['-C', repoPath, 'log', '-1', '--format=%cI'],
        { timeout: GIT_TIMEOUT_MS, windowsHide: true }
      )
      lastCommitAt = log.trim() || null
    } catch {
      // Fresh repo without commits: leave lastCommitAt null.
    }
    return { ...parsed, lastCommitAt }
  } catch {
    return null
  }
}

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await fs.stat(path.join(dir, '.git'))
    return true
  } catch {
    return false
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export interface ProjectDirsOptions {
  projectsRoot: string
  extraPaths: string[]
}

export async function collectProjectPulses(
  opts: ProjectDirsOptions
): Promise<ProjectPulse[]> {
  let entries: import('node:fs').Dirent[] = []
  try {
    entries = await fs.readdir(opts.projectsRoot, { withFileTypes: true })
  } catch {
    // Missing projects root: fall through with extras only.
  }

  const dirs = entries
    .filter((e) => e.isDirectory() && !EXCLUDED_FOLDERS.has(e.name))
    .map((e) => path.join(opts.projectsRoot, e.name))
    .concat(opts.extraPaths)

  const repoDirs: string[] = []
  for (const dir of dirs) {
    if (await isGitRepo(dir)) repoDirs.push(dir)
  }

  const pulses = await mapLimit(repoDirs, CONCURRENCY, async (dir): Promise<ProjectPulse> => {
    const label = path.basename(dir)
    const git = await gitSummaryFor(dir)
    const status = git === null ? 'unknown' : git.dirty > 0 || git.ahead > 0 ? 'warn' : 'ok'
    return { id: `project-${kebab(label)}`, label, path: dir, git, status }
  })

  return pulses.sort((a, b) => a.label.localeCompare(b.label))
}
