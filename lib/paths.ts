// Resolve home-rooted filesystem paths for the data layer.
// Spec: section 4.2, 8.2 (root override needed so parsers can be pointed
// at fixtures during tests).

import os from 'node:os'
import path from 'node:path'

let override: string | null = null

export function setRootOverride(root: string): void {
  override = root
}

export function clearRootOverride(): void {
  override = null
}

export interface Roots {
  home: string
  memoryIndex: string
  projects: string
  claudeGlobal: string
  claudeSkills: string
  claudeAgents: string
  templatesAgents: string
  templatesSkills: string
  globalClaudeMd: string
}

export function getRoots(): Roots {
  const home = override ?? os.homedir()
  return {
    home,
    memoryIndex: path.join(
      home,
      '.claude',
      'projects',
      'C--Users-surya',
      'memory',
      'MEMORY.md'
    ),
    projects: path.join(home, 'Projects'),
    claudeGlobal: path.join(home, '.claude'),
    claudeSkills: path.join(home, '.claude', 'skills'),
    claudeAgents: path.join(home, '.claude', 'agents'),
    templatesAgents: path.join(
      home,
      'Projects',
      '_templates',
      '.claude',
      'agents'
    ),
    templatesSkills: path.join(home, 'Projects', '_templates', 'skills'),
    globalClaudeMd: path.join(home, '.claude', 'CLAUDE.md'),
  }
}
