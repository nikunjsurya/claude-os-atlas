// DIRECTION 2: "The morning docket."
// Organizing idea: the system files its report overnight and Surya reads it
// like a paper over coffee; a docket, not a dashboard. Forbids: cards,
// chrome, dots-without-words, icons. Fraunces masthead (kinship with
// Aetherbloom, the house's existing editorial voice), numbered matters,
// screenshots framed like photographs with captions. Red is the docket
// stamp, spent only on incidents.

'use client'

import { Fraunces } from 'next/font/google'
import { useDirectionData } from './useDirectionData'

const fraunces = Fraunces({ subsets: ['latin'], weight: ['400', '500', '600'] })

const PAPER = '#161309'
const INK = '#EAE3D3'
const DIM = '#8B816B'
const STAMP = '#C4553B'
const RULE = '#2A251A'

export default function D2MorningDocket() {
  const data = useDirectionData()
  if (!data) return <div className="min-h-screen" style={{ backgroundColor: PAPER }} />
  const { sites, n8n, projects, queue } = data

  const open = queue.filter((q) => q.status === 'open')
  const incidents = open.filter((q) => q.kind === 'incident')
  const flagged = projects.filter((p) => p.git && (p.git.dirty > 0 || p.git.ahead > 0))
  const failing = n8n?.recentErrors.length ?? 0
  const date = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const summary = [
    `${sites.filter((s) => s.status === 'ok').length} of ${sites.length} properties answering`,
    failing === 0 ? `all ${n8n?.workflows.length ?? 0} flows quiet` : `${failing} flow${failing > 1 ? 's' : ''} failing`,
    `${flagged.length} repos carrying unsynced work`,
    `${open.length} matters await your hand`,
  ].join('; ')

  return (
    <div
      className="min-h-screen px-16 py-12"
      style={{ backgroundColor: PAPER, color: INK }}
    >
      {/* masthead */}
      <header style={{ borderBottom: `2px solid ${INK}` }} className="pb-5">
        <div
          className="flex items-baseline justify-between text-[12px] uppercase"
          style={{ color: DIM, letterSpacing: '0.1em', fontFamily: 'var(--font-geist-mono)' }}
        >
          <span>claude OS</span>
          <span>{date}</span>
        </div>
        <h1
          className={fraunces.className}
          style={{ fontSize: 54, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.015em', marginTop: 10 }}
        >
          The Morning Docket
        </h1>
        <p className="mt-3 max-w-[68ch] text-[16px]" style={{ color: DIM, lineHeight: 1.6 }}>
          {summary}.
        </p>
      </header>

      {/* the pictures */}
      <section className="mt-10">
        <div className="grid grid-cols-3 gap-10">
          {sites.map((s) => (
            <figure key={s.id}>
              <div
                className="aspect-video overflow-hidden"
                style={{ border: `1px solid ${RULE}` }}
              >
                {s.screenshotPath && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.screenshotPath}
                    alt={s.label}
                    className="h-full w-full object-cover object-top"
                  />
                )}
              </div>
              <figcaption className="pt-3">
                <span className={fraunces.className} style={{ fontSize: 19, fontWeight: 500 }}>
                  {s.label}
                </span>
                <span
                  className="ml-3 text-[12px]"
                  style={{ fontFamily: 'var(--font-geist-mono)', color: s.status === 'ok' ? DIM : STAMP }}
                >
                  {s.status === 'ok' ? `answering in ${s.responseMs}ms` : `${s.status}: HTTP ${s.httpStatus ?? 'silence'}`}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <div className="mt-14 grid grid-cols-[1.4fr_1fr] gap-20">
        {/* the docket */}
        <section>
          <h2
            className="text-[12px] uppercase"
            style={{ color: DIM, letterSpacing: '0.12em', fontFamily: 'var(--font-geist-mono)' }}
          >
            Matters before you
          </h2>
          <ol className="mt-4">
            {open.slice(0, 10).map((q, i) => (
              <li
                key={q.id}
                className="flex gap-5 py-[14px]"
                style={{ borderBottom: `1px solid ${RULE}` }}
              >
                <span
                  className="text-[13px] pt-1"
                  style={{ fontFamily: 'var(--font-geist-mono)', color: q.kind === 'incident' ? STAMP : DIM }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div className={fraunces.className} style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.25 }}>
                    {q.kind === 'incident' && (
                      <span style={{ color: STAMP }}>URGENT · </span>
                    )}
                    {q.title}
                  </div>
                  <div className="mt-1 text-[13px]" style={{ color: DIM }}>
                    {q.kind === 'owner-action' ? 'yours alone' : q.kind === 'incident' ? 'system incident' : 'delegable to claude'}
                    {q.projectId ? ` · ${q.projectId.replace('project-', '')}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* the wires */}
        <section>
          <h2
            className="text-[12px] uppercase"
            style={{ color: DIM, letterSpacing: '0.12em', fontFamily: 'var(--font-geist-mono)' }}
          >
            From the wires
          </h2>
          <p className="mt-4 text-[15px]" style={{ lineHeight: 1.7 }}>
            {incidents.length === 0 && failing === 0
              ? 'The automation ran without incident overnight.'
              : `${failing} workflow${failing === 1 ? '' : 's'} reported failures.`}{' '}
            <span style={{ color: DIM }}>
              Last word from each desk:{' '}
              {n8n?.workflows
                .slice(0, 6)
                .map(
                  (w) =>
                    `${w.name.replace(/AI LinkedIn Autopilot - /, '').toLowerCase()} (${w.lastExecution ? new Date(w.lastExecution.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'silent'})`
                )
                .join(', ')}
              .
            </span>
          </p>

          <h2
            className="mt-10 text-[12px] uppercase"
            style={{ color: DIM, letterSpacing: '0.12em', fontFamily: 'var(--font-geist-mono)' }}
          >
            Unfiled work
          </h2>
          <ul className="mt-4">
            {flagged.map((p) => (
              <li
                key={p.id}
                className="flex items-baseline py-2 text-[15px]"
                style={{ borderBottom: `1px solid ${RULE}` }}
              >
                <span>{p.label}</span>
                <span
                  className="ml-auto text-[12px]"
                  style={{ fontFamily: 'var(--font-geist-mono)', color: DIM }}
                >
                  {p.git!.dirty > 0 ? `${p.git!.dirty} unfiled` : ''}
                  {p.git!.ahead > 0 ? ` ${p.git!.ahead} unsent` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
