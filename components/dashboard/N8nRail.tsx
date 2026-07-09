// n8n heartbeat rail: errored workflows pinned on top as incidents, then
// every active workflow with its latest run.

'use client'

import type { N8nPulse } from '@/lib/types'
import PulseDot from './PulseDot'

export default function N8nRail({ pulse }: { pulse: N8nPulse | null }) {
  if (!pulse) return <div className="text-sm text-[#6B7280]">loading n8n…</div>
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
        n8n flows
      </h2>
      {!pulse.reachable && (
        <div className="mb-2 rounded border border-[#D9534F] bg-[#2a1416] px-3 py-2 text-sm text-[#E6E8EE]">
          n8n unreachable at localhost:5678
        </div>
      )}
      {pulse.recentErrors.map((err) => (
        <div
          key={err.workflowId}
          className="mb-2 rounded border border-[#D9534F] bg-[#2a1416] px-3 py-2 text-sm text-[#E6E8EE]"
        >
          <div className="font-medium">{err.workflowName}</div>
          <div className="mt-1 text-xs text-[#c99]">{err.message}</div>
        </div>
      ))}
      <ul className="space-y-1">
        {pulse.workflows.map((wf) => (
          <li
            key={wf.id}
            className="flex items-center gap-2 rounded px-2 py-1 text-sm text-[#E6E8EE]"
          >
            <PulseDot
              status={
                wf.lastExecution === null
                  ? 'unknown'
                  : wf.lastExecution.status === 'error'
                    ? 'error'
                    : wf.lastExecution.status === 'success'
                      ? 'ok'
                      : 'warn'
              }
            />
            <span className="truncate">{wf.name}</span>
            <span className="ml-auto shrink-0 text-xs text-[#6B7280]">
              {wf.lastExecution
                ? new Date(wf.lastExecution.startedAt).toLocaleTimeString()
                : 'no runs'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
