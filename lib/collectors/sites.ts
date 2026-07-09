// Site health + screenshot-cache metadata for the site cards.
// siteStatusFrom is pure; checkSite takes an injectable fetch so tests
// never hit the network.
// Spec: 2026-07-09-mission-control-v2-design.md section 5.

import type { PulseStatus, SiteCard, SiteConfig } from '@/lib/types'

export const SHOT_STALE_WARN_MS = 24 * 60 * 60 * 1000
const SITE_TIMEOUT_MS = 10000

export interface ShotMeta {
  screenshotPath: string | null
  capturedAt: string | null
}

export function siteStatusFrom(
  httpStatus: number | null,
  capturedAt: string | null,
  now: Date
): PulseStatus {
  if (httpStatus === null || httpStatus >= 500) return 'error'
  if (httpStatus >= 400) return 'warn'
  if (capturedAt && now.getTime() - Date.parse(capturedAt) > SHOT_STALE_WARN_MS) {
    return 'warn'
  }
  return 'ok'
}

export async function checkSite(
  site: SiteConfig,
  shot: ShotMeta,
  fetchImpl: typeof fetch,
  now: () => Date = () => new Date()
): Promise<SiteCard> {
  const started = Date.now()
  let httpStatus: number | null = null
  try {
    const res = await fetchImpl(site.url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
    })
    httpStatus = res.status
    if (res.status === 405) {
      // Some hosts reject HEAD; retry once with GET.
      const res2 = await fetchImpl(site.url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
      })
      httpStatus = res2.status
    }
  } catch {
    httpStatus = null
  }
  const responseMs = Date.now() - started
  return {
    ...site,
    screenshotPath: shot.screenshotPath,
    capturedAt: shot.capturedAt,
    httpStatus,
    responseMs,
    status: siteStatusFrom(httpStatus, shot.capturedAt, now()),
  }
}
