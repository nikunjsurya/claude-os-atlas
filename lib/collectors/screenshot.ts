// Screenshot capture via the user's installed Chrome (fallback Edge).
// NEVER bundled Chromium: Device Guard blocks it on this machine.
// Single-flight per site; captures use a throwaway profile dir so a running
// desktop Chrome never conflicts. Impure by design; verified live, not unit
// tested. Spec: 2026-07-09-mission-control-v2-design.md sections 5, 9.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { SiteConfig } from '@/lib/types'
import type { ShotMeta } from './sites'

const pExecFile = promisify(execFile)

const CAPTURE_TIMEOUT_MS = 30000
export const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000

const ENGINE_CANDIDATES: string[] = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
    : '',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter((p) => p.length > 0)

let engineCache: string | null | undefined

export async function findCaptureEngine(): Promise<string | null> {
  if (engineCache !== undefined) return engineCache
  for (const candidate of ENGINE_CANDIDATES) {
    try {
      await fs.stat(candidate)
      engineCache = candidate
      return candidate
    } catch {
      // try next
    }
  }
  engineCache = null
  return null
}

export function shotsDir(): string {
  return path.join(process.cwd(), 'public', 'shots')
}

export async function shotMetaFor(siteId: string): Promise<ShotMeta> {
  const file = path.join(shotsDir(), `${siteId}.png`)
  try {
    const stat = await fs.stat(file)
    return {
      screenshotPath: `/shots/${siteId}.png`,
      capturedAt: stat.mtime.toISOString(),
    }
  } catch {
    return { screenshotPath: null, capturedAt: null }
  }
}

async function captureSite(site: SiteConfig): Promise<void> {
  const engine = await findCaptureEngine()
  if (!engine) return
  await fs.mkdir(shotsDir(), { recursive: true })
  const outFile = path.join(shotsDir(), `${site.id}.png`)
  // Per-site profile dir: concurrent captures cannot share a user-data-dir
  // (Chrome refuses the second instance with "profile in use").
  const profileDir = path.join(os.tmpdir(), `atlas-shots-profile-${site.id}`)
  await pExecFile(
    engine,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--window-size=1440,900',
      `--user-data-dir=${profileDir}`,
      '--virtual-time-budget=8000',
      `--screenshot=${outFile}`,
      site.url,
    ],
    { timeout: CAPTURE_TIMEOUT_MS, windowsHide: true }
  )
}

const inflight = new Map<string, Promise<void>>()

// Fire-and-forget capture, single-flight per site. Failures keep the last
// good shot on disk; the card's capturedAt staleness surfaces the problem.
export function kickCapture(site: SiteConfig, force = false): void {
  if (inflight.has(site.id)) return
  const run = (async () => {
    if (!force) {
      const meta = await shotMetaFor(site.id)
      if (
        meta.capturedAt &&
        Date.now() - Date.parse(meta.capturedAt) < REFRESH_AFTER_MS
      ) {
        return
      }
    }
    try {
      await captureSite(site)
    } catch {
      // Keep last good shot; staleness badge communicates the failure.
    }
  })().finally(() => {
    inflight.delete(site.id)
  })
  inflight.set(site.id, run)
}
