// Flows: a field of faint marks. A healthy workflow is a dot and a short
// name; a failing one turns amber with its full name and error. n8n down
// is itself a caution light.

'use client'

import type { N8nPulse } from '@/lib/types'

export default function N8nRail({ pulse }: { pulse: N8nPulse | null }) {
  if (!pulse) {
    return <div className="font-mono text-xs text-deck-dim">listening for flows…</div>
  }
  return (
    <section>
      <h2 className="pb-3 text-[11px] uppercase tracking-[0.12em] text-deck-dim">
        Flows
      </h2>
      {!pulse.reachable && (
        <div className="pb-2 font-mono text-xs text-deck-amber">
          ▲ n8n unreachable at localhost:5678
        </div>
      )}
      {pulse.recentErrors.map((err) => (
        <div key={err.workflowId} className="pb-2 font-mono text-xs text-deck-amber">
          ▲ {err.workflowName}
          <span className="block pl-4 text-deck-dim">{err.message}</span>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {pulse.workflows
          .filter((wf) => wf.lastExecution?.status !== 'error')
          .map((wf) => (
            <span key={wf.id} className="font-mono text-xs text-deck-faint" title={wf.name}>
              · {wf.name.replace(/AI LinkedIn Autopilot - /i, '').slice(0, 28)}
            </span>
          ))}
      </div>
    </section>
  )
}
