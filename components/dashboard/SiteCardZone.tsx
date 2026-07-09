// Live-site cards: real screenshot + health per deployed property.
// Screenshots are the visual heroes of this zone (spec section 8.4).

'use client'

import type { SiteCard } from '@/lib/types'
import PulseDot from './PulseDot'

export default function SiteCardZone({ sites }: { sites: SiteCard[] | null }) {
  if (!sites) return <ZoneShell>loading sites…</ZoneShell>
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
        Live sites
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {sites.map((site) => (
          <a
            key={site.id}
            href={site.url}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-lg border border-[#2A2D34] bg-[#15171D]"
          >
            <div className="aspect-video w-full overflow-hidden bg-[#0E1014]">
              {site.screenshotPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${site.screenshotPath}?t=${site.capturedAt ?? ''}`}
                  alt={`${site.label} screenshot`}
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[#6B7280]">
                  capturing…
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-[#E6E8EE]">
              <PulseDot status={site.status} />
              <span className="font-medium">{site.label}</span>
              <span className="ml-auto text-xs text-[#6B7280]">
                {site.httpStatus ?? 'down'} · {site.responseMs ?? '–'}ms
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}

function ZoneShell({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-[#6B7280]">{children}</div>
}
