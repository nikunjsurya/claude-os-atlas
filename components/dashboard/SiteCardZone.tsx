// Live-site instruments: the screenshots are the biggest objects on the
// deck because pixels answer "is it up AND does it look right" at once.

'use client'

import type { SiteCard } from '@/lib/types'
import PulseDot from './PulseDot'

export default function SiteCardZone({
  sites,
  onRecapture,
}: {
  sites: SiteCard[] | null
  onRecapture: (() => void) | null
}) {
  if (!sites) {
    return <div className="font-mono text-xs text-deck-dim">warming instruments…</div>
  }
  return (
    <section>
      <div className="grid grid-cols-3 gap-6">
        {sites.map((site) => (
          <figure key={site.id}>
            <a href={site.url} target="_blank" rel="noreferrer" className="block">
              <div className="aspect-video overflow-hidden rounded-[3px] bg-black">
                {site.screenshotPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${site.screenshotPath}?t=${site.capturedAt ?? ''}`}
                    alt={`${site.label} live`}
                    className="h-full w-full object-cover object-top"
                    style={{ opacity: site.status === 'ok' ? 0.92 : 0.45 }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center font-mono text-xs text-deck-faint">
                    no shot yet
                  </div>
                )}
              </div>
            </a>
            <figcaption className="flex items-baseline gap-2.5 pt-2 font-mono text-xs text-deck-dim">
              <PulseDot status={site.status} />
              <span className="text-deck-ink">{site.label.toLowerCase()}</span>
              {site.status !== 'ok' && (
                <span className="text-deck-amber">{site.status}</span>
              )}
              <span className="ml-auto">
                {site.httpStatus ?? 'down'} · {site.responseMs ?? '–'}ms
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
      {onRecapture && (
        <button
          type="button"
          onClick={onRecapture}
          className="mt-2 font-mono text-[11px] text-deck-faint hover:text-deck-dim"
        >
          recapture shots
        </button>
      )}
    </section>
  )
}
