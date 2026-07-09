// DIRECTION 3: "Ops floor."
// Organizing idea: every signal on one screen, no scrolling, no prose; the
// floor terminal you never leave. Forbids: whitespace luxury, sentences,
// serif anything, images larger than tiles. Mono everywhere, grid lines do
// the layout, errored cells invert to red. Green means alive, red means
// act, amber means drift.

'use client'

import { useDirectionData } from './useDirectionData'

const BG = '#0A0C0F'
const CELL = '#0F1216'
const GRID = '#1D242E'
const INK = '#C6CFDA'
const DIM = '#566070'
const GREEN = '#3FBF7F'
const RED = '#E5484D'
const AMBER = '#D9A03F'

export default function D3OpsFloor() {
  const data = useDirectionData()
  if (!data) return <div className="min-h-screen" style={{ backgroundColor: BG }} />
  const { sites, n8n, projects, queue } = data
  const open = queue.filter((q) => q.status === 'open')

  const label = (text: string) => (
    <div
      className="px-2 py-1 text-[10px] uppercase"
      style={{ color: DIM, letterSpacing: '0.1em', borderBottom: `1px solid ${GRID}` }}
    >
      ▍{text}
    </div>
  )

  return (
    <div
      className="min-h-screen p-3 text-[12px]"
      style={{ backgroundColor: BG, color: INK, fontFamily: 'var(--font-geist-mono)' }}
    >
      <div className="grid grid-cols-[420px_1fr_1fr] gap-3">
        {/* col 1: sites + n8n strip */}
        <div className="space-y-3">
          <div style={{ border: `1px solid ${GRID}`, backgroundColor: CELL }}>
            {label(`SITES ${sites.filter((s) => s.status === 'ok').length}/${sites.length} UP`)}
            {sites.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 px-2 py-1.5"
                style={{ borderBottom: `1px solid ${GRID}` }}
              >
                <div className="h-[52px] w-[92px] shrink-0 overflow-hidden bg-black">
                  {s.screenshotPath && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.screenshotPath} alt="" className="h-full w-full object-cover object-top" />
                  )}
                </div>
                <div className="min-w-0">
                  <div style={{ color: s.status === 'ok' ? GREEN : RED }}>
                    {s.status === 'ok' ? '▮ UP' : '▮ DOWN'}{' '}
                    <span style={{ color: INK }}>{s.label.toUpperCase()}</span>
                  </div>
                  <div style={{ color: DIM }}>
                    {s.httpStatus ?? '---'} {s.responseMs}MS{' '}
                    {s.capturedAt ? `SHOT ${new Date(s.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'NO SHOT'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ border: `1px solid ${GRID}`, backgroundColor: CELL }}>
            {label(`FLOWS ${n8n?.workflows.length ?? 0} ACTIVE / ${n8n?.recentErrors.length ?? 0} ERR`)}
            <div className="grid grid-cols-2">
              {n8n?.workflows.map((wf) => {
                const err = wf.lastExecution?.status === 'error'
                return (
                  <div
                    key={wf.id}
                    className="truncate px-2 py-1"
                    style={{
                      borderBottom: `1px solid ${GRID}`,
                      borderRight: `1px solid ${GRID}`,
                      backgroundColor: err ? RED : undefined,
                      color: err ? '#fff' : DIM,
                    }}
                    title={wf.name}
                  >
                    <span style={{ color: err ? '#fff' : wf.lastExecution ? GREEN : DIM }}>
                      {err ? '✗' : '●'}
                    </span>{' '}
                    {wf.name.replace(/AI LinkedIn Autopilot - /i, '').toUpperCase().slice(0, 22)}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* col 2: queue table */}
        <div style={{ border: `1px solid ${GRID}`, backgroundColor: CELL }}>
          {label(`QUEUE ${open.length} OPEN`)}
          {open.map((q) => (
            <div
              key={q.id}
              className="flex gap-2 px-2 py-1.5"
              style={{ borderBottom: `1px solid ${GRID}` }}
            >
              <span
                className="shrink-0 w-[52px]"
                style={{
                  color: q.kind === 'incident' ? RED : q.kind === 'owner-action' ? AMBER : GREEN,
                }}
              >
                {q.kind === 'incident' ? 'INCDT' : q.kind === 'owner-action' ? 'OWNER' : 'CLAUD'}
              </span>
              <span className="truncate">{q.title}</span>
            </div>
          ))}
        </div>

        {/* col 3: repo table */}
        <div style={{ border: `1px solid ${GRID}`, backgroundColor: CELL }}>
          {label(`REPOS ${projects.length} TRACKED`)}
          <div
            className="grid grid-cols-[1fr_90px_40px_40px] px-2 py-1"
            style={{ color: DIM, borderBottom: `1px solid ${GRID}` }}
          >
            <span>REPO</span>
            <span>BRANCH</span>
            <span>±</span>
            <span>↑</span>
          </div>
          {projects.map((p) => {
            const hot = p.git && (p.git.dirty > 0 || p.git.ahead > 0)
            return (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_90px_40px_40px] px-2 py-[3px]"
                style={{ borderBottom: `1px solid ${GRID}`, color: hot ? INK : DIM }}
              >
                <span className="truncate">{p.label}</span>
                <span className="truncate" style={{ color: DIM }}>
                  {p.git?.branch ?? '?'}
                </span>
                <span style={{ color: p.git && p.git.dirty > 0 ? AMBER : DIM }}>
                  {p.git?.dirty ?? '-'}
                </span>
                <span style={{ color: p.git && p.git.ahead > 0 ? AMBER : DIM }}>
                  {p.git?.ahead ?? '-'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
