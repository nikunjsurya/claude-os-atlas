// Resolves the repo-local data/ directory, overridable so route logic can
// be pointed at fixture directories in tests (same pattern as lib/paths.ts).
// Spec: 2026-07-09-mission-control-v2-design.md section 4.3.

import path from 'node:path'

let override: string | null = null

export function setDataDirOverride(dir: string): void {
  override = dir
}

export function clearDataDirOverride(): void {
  override = null
}

export function dataDir(): string {
  return override ?? path.join(process.cwd(), 'data')
}

export function queueFile(): string {
  return path.join(dataDir(), 'queue.json')
}

export function queueStateFile(): string {
  return path.join(dataDir(), 'queue-state.json')
}

export function sitesFile(): string {
  return path.join(dataDir(), 'sites.json')
}

export function projectsExtraFile(): string {
  return path.join(dataDir(), 'projects-extra.json')
}

export function launchDir(): string {
  return path.join(dataDir(), 'launch')
}
