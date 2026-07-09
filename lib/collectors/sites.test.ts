import { describe, expect, it } from 'vitest'
import { checkSite, siteStatusFrom } from './sites'

const NOW = new Date('2026-07-09T12:00:00.000Z')
const FRESH_SHOT = '2026-07-09T11:00:00.000Z'
const STALE_SHOT = '2026-07-07T00:00:00.000Z'

describe('siteStatusFrom', () => {
  it('maps 2xx with a fresh shot to ok', () => {
    expect(siteStatusFrom(200, FRESH_SHOT, NOW)).toBe('ok')
  })

  it('maps 4xx to warn', () => {
    expect(siteStatusFrom(404, FRESH_SHOT, NOW)).toBe('warn')
  })

  it('maps 5xx and timeout (null) to error', () => {
    expect(siteStatusFrom(503, FRESH_SHOT, NOW)).toBe('error')
    expect(siteStatusFrom(null, FRESH_SHOT, NOW)).toBe('error')
  })

  it('downgrades a healthy site to warn when the shot is older than 24h', () => {
    expect(siteStatusFrom(200, STALE_SHOT, NOW)).toBe('warn')
  })

  it('keeps a healthy site ok when no shot exists yet', () => {
    expect(siteStatusFrom(200, null, NOW)).toBe('ok')
  })
})

describe('checkSite', () => {
  const site = { id: 'aetherbloom', label: 'Aetherbloom', url: 'https://atherbloom.com' }
  const shot = { screenshotPath: '/shots/aetherbloom.png', capturedAt: FRESH_SHOT }

  it('records http status and response time on success', async () => {
    const fetchImpl = (async () => new Response('', { status: 200 })) as typeof fetch
    const card = await checkSite(site, shot, fetchImpl, () => NOW)
    expect(card.httpStatus).toBe(200)
    expect(card.status).toBe('ok')
    expect(card.responseMs).toBeGreaterThanOrEqual(0)
    expect(card.screenshotPath).toBe('/shots/aetherbloom.png')
  })

  it('treats a thrown fetch (down/timeout) as error with null httpStatus', async () => {
    const fetchImpl = (async () => {
      throw new Error('fetch failed')
    }) as unknown as typeof fetch
    const card = await checkSite(site, shot, fetchImpl, () => NOW)
    expect(card.httpStatus).toBeNull()
    expect(card.status).toBe('error')
  })
})
