// Server-side collector singletons behind TTL caches (n8n 30s, sites 60s,
// projects 120s) so client polling never hammers n8n/git/Chrome.
// Spec: 2026-07-09-mission-control-v2-design.md section 4.2.

import fs from 'node:fs/promises'
import type {
  DerivedQueueItem,
  N8nPulse,
  ProjectPulse,
  SiteCard,
  SiteConfig,
} from '@/lib/types'
import { getRoots } from '@/lib/paths'
import { projectsExtraFile, sitesFile } from '@/lib/dataDir'
import { createTtlCache } from './cache'
import { loadN8nAuth } from './n8nAuth'
import { fetchN8nPulse } from './n8n'
import { collectProjectPulses } from './gitStatus'
import { checkSite } from './sites'
import { kickCapture, shotMetaFor } from './screenshot'

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T
  } catch {
    return fallback
  }
}

export async function readSiteConfigs(): Promise<SiteConfig[]> {
  return readJsonFile<SiteConfig[]>(sitesFile(), [])
}

async function buildSiteCards(): Promise<SiteCard[]> {
  const sites = await readSiteConfigs()
  return Promise.all(
    sites.map(async (site) => {
      const shot = await shotMetaFor(site.id)
      kickCapture(site)
      return checkSite(site, shot, fetch)
    })
  )
}

async function buildProjectPulses(): Promise<ProjectPulse[]> {
  const extraPaths = await readJsonFile<string[]>(projectsExtraFile(), [])
  return collectProjectPulses({ projectsRoot: getRoots().projects, extraPaths })
}

const n8nCache = createTtlCache<N8nPulse>(
  async () => fetchN8nPulse(await loadN8nAuth()),
  30_000
)
const sitesCache = createTtlCache<SiteCard[]>(buildSiteCards, 60_000)
const projectsCache = createTtlCache<ProjectPulse[]>(buildProjectPulses, 120_000)

export function getN8nPulse(): Promise<N8nPulse> {
  return n8nCache.get()
}

export function getSiteCards(): Promise<SiteCard[]> {
  return sitesCache.get()
}

export function getProjectPulses(): Promise<ProjectPulse[]> {
  return projectsCache.get()
}

export function invalidateSites(): void {
  sitesCache.invalidate()
}

// Current derivation snapshot for the queue merge; collector failures
// degrade to empty inputs rather than breaking the queue.
export async function deriveInputsNow(): Promise<{
  n8n: N8nPulse | null
  sites: SiteCard[]
  projects: ProjectPulse[]
  now: Date
}> {
  const [n8n, sites, projects] = await Promise.all([
    getN8nPulse().catch((): N8nPulse | null => null),
    getSiteCards().catch((): SiteCard[] => []),
    getProjectPulses().catch((): ProjectPulse[] => []),
  ])
  return { n8n, sites, projects, now: new Date() }
}

export type DeriveCurrent = () => Promise<DerivedQueueItem[]>
