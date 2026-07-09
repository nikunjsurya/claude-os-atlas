// DIRECTION 1: "Flight deck at night."
// Organizing idea: a cockpit read in half a second in the dark; nothing
// lights up unless it needs a hand on it. Forbids: card borders, decorative
// color, any second accent, loud headings. Amber is the caution light and
// appears ONLY on things waiting for Surya. Everything healthy stays dim.

'use client'

import { useDirectionData } from './useDirectionData'

const AMBER = '#E8A33D'
const INK = '#D9DEE7'
const DIM = '#5C6470'
const HAIR = '#1A2029'

export default function D1FlightDeck() {
  const data = useDirectionData()
  if (!data) return <div className="min-h-screen bg-[#0B0E13]" />
  const { sites, n8n, projects, queue } = data

  const needsYou = queue.filter((q) => q.status === 'open')
  const incidents = needsYou.filter((q) => q.kind === 'incident')
  const flagged = projects.filter(
    (p) => p.git && (p.git.dirty > 0 || p.git.ahead > 0)
  )

  return (
    <div
      className="min-h-screen px-10 py-8"
      style={{ backgroundColor: '#0B0E13', color: INK, fontFamily: 'var(--font-geist-sans)' }}
    >
      {/* status line */}
      <div
        className="flex items-baseline gap-6 pb-6 text-[12px]"
        style={{ color: DIM, fontFamily: 'var(--font-geist-mono)' }}
      >
        <span style={{ color: INK, fontWeight: 600, letterSpacing: '0.08em' }}>
          CLAUDE OS
        </span>
        <span>{sites.filter((s) => s.status === 'ok').length}/{sites.length} sites up</span>
        <span>{n8n?.workflows.length ?? 0} flows · {n8n?.recentErrors.length ?? 0} failing</span>
        <span>{flagged.length} repos unsynced</span>
        <span className="ml-auto" style={{ color: needsYou.length ? AMBER : DIM }}>
          ● {needsYou.length} waiting on you
        </span>
      </div>

      {/* sites: the pictures are the instruments */}
      <div className="grid grid-cols-3 gap-6">
        {sites.map((s) => (
          <figure key={s.id}>
            <div className="aspect-video overflow-hidden rounded-sm bg-black">
              {s.screenshotPath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.screenshotPath}
                  alt={s.label}
                  className="h-full w-full object-cover object-top"
                  style={{ opacity: s.status === 'ok' ? 0.92 : 0.5 }}
                />
              )}
            </div>
            <figcaption
              className="flex items-baseline gap-3 pt-2 text-[12px]"
              style={{ fontFamily: 'var(--font-geist-mono)', color: DIM }}
            >
              <span
                style={{
                  color:
                    s.status === 'error' ? AMBER : s.status === 'warn' ? AMBER : '#4E5F52',
                }}
              >
                ●
              </span>
              <span style={{ color: INK }}>{s.label.toLowerCase()}</span>
              <span className="ml-auto">
                {s.httpStatus} · {s.responseMs}ms
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-12 grid grid-cols-[1fr_380px] gap-16">
        {/* left: quiet inventory */}
        <div>
          <div
            className="pb-3 text-[11px] uppercase"
            style={{ color: DIM, letterSpacing: '0.12em' }}
          >
            Projects
          </div>
          <div className="grid grid-cols-2 gap-x-12">
            {projects.map((p) => {
              const hot = p.git && (p.git.dirty > 0 || p.git.ahead > 0)
              return (
                <div
                  key={p.id}
                  className="flex items-baseline gap-2 py-[7px] text-[14px]"
                  style={{ borderBottom: `1px solid ${HAIR}` }}
                >
                  <span style={{ color: hot ? INK : DIM }}>{p.label}</span>
                  <span
                    className="ml-auto text-[12px]"
                    style={{
                      fontFamily: 'var(--font-geist-mono)',
                      color: hot ? AMBER : '#39414D',
                    }}
                  >
                    {p.git
                      ? hot
                        ? `${p.git.dirty > 0 ? `±${p.git.dirty}` : ''}${p.git.ahead > 0 ? ` ↑${p.git.ahead}` : ''}`
                        : 'synced'
                      : '?'}
                  </span>
                </div>
              )
            })}
          </div>

          <div
            className="mt-10 pb-3 text-[11px] uppercase"
            style={{ color: DIM, letterSpacing: '0.12em' }}
          >
            Flows
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {n8n?.workflows.map((wf) => {
              const err = wf.lastExecution?.status === 'error'
              return (
                <span
                  key={wf.id}
                  className="text-[12px]"
                  style={{
                    fontFamily: 'var(--font-geist-mono)',
                    color: err ? AMBER : '#39414D',
                  }}
                >
                  {err ? '▲' : '·'} {err ? wf.name : wf.name.replace(/AI LinkedIn Autopilot - /, '')}
                </span>
              )
            })}
          </div>
        </div>

        {/* right: the only bright thing on the deck */}
        <div>
          <div
            className="pb-3 text-[11px] uppercase"
            style={{ color: AMBER, letterSpacing: '0.12em' }}
          >
            Needs a hand · {needsYou.length}
          </div>
          {incidents.map((q) => (
            <div key={q.id} className="py-2" style={{ borderBottom: `1px solid ${HAIR}` }}>
              <span className="text-[14px]" style={{ color: AMBER }}>
                ▲ {q.title}
              </span>
            </div>
          ))}
          {needsYou
            .filter((q) => q.kind !== 'incident')
            .slice(0, 9)
            .map((q) => (
              <div key={q.id} className="py-2" style={{ borderBottom: `1px solid ${HAIR}` }}>
                <div className="text-[14px]" style={{ color: INK }}>
                  {q.title}
                </div>
                <div
                  className="pt-0.5 text-[11px]"
                  style={{ fontFamily: 'var(--font-geist-mono)', color: DIM }}
                >
                  {q.kind} · {q.projectId ?? 'system'}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
