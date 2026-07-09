import { describe, expect, it } from 'vitest'
import { shapeN8nPulse, unreachablePulse } from './n8n'
import type { N8nExecutionJson, N8nWorkflowJson } from './n8n'

const workflows: N8nWorkflowJson[] = [
  { id: 'wf1', name: 'LinkedIn Autopilot', active: true },
  { id: 'wf2', name: 'Staleness Watchdog', active: true },
]

function exec(over: Partial<N8nExecutionJson> & { id: string }): N8nExecutionJson {
  return {
    workflowId: 'wf1',
    status: 'success',
    startedAt: '2026-07-09T06:00:00.000Z',
    ...over,
  }
}

describe('shapeN8nPulse', () => {
  it('attaches the newest execution per workflow as lastExecution', () => {
    const pulse = shapeN8nPulse(
      workflows,
      [
        exec({ id: 'e1', startedAt: '2026-07-09T05:00:00.000Z' }),
        exec({ id: 'e2', startedAt: '2026-07-09T06:30:00.000Z' }),
      ],
      {}
    )
    const wf1 = pulse.workflows.find((w) => w.id === 'wf1')
    expect(wf1?.lastExecution?.id).toBe('e2')
  })

  it('leaves lastExecution null for workflows with no executions', () => {
    const pulse = shapeN8nPulse(workflows, [], {})
    expect(pulse.workflows.find((w) => w.id === 'wf2')?.lastExecution).toBeNull()
  })

  it('surfaces one recentError per workflow, from its newest error execution', () => {
    const pulse = shapeN8nPulse(
      workflows,
      [
        exec({ id: 'e1', status: 'error', startedAt: '2026-07-09T04:00:00.000Z' }),
        exec({ id: 'e2', status: 'error', startedAt: '2026-07-09T05:00:00.000Z' }),
        exec({ id: 'e3', workflowId: 'wf2', status: 'success' }),
      ],
      { e2: 'Render Visual timed out after 120s' }
    )
    expect(pulse.recentErrors).toHaveLength(1)
    expect(pulse.recentErrors[0]).toMatchObject({
      workflowId: 'wf1',
      workflowName: 'LinkedIn Autopilot',
      executionId: 'e2',
      message: 'Render Visual timed out after 120s',
    })
  })

  it('falls back to a generic message when no error detail is available', () => {
    const pulse = shapeN8nPulse(
      workflows,
      [exec({ id: 'e9', status: 'error' })],
      {}
    )
    expect(pulse.recentErrors[0].message).toMatch(/execution e9 failed/i)
  })

  it('marks the pulse reachable and includes every workflow', () => {
    const pulse = shapeN8nPulse(workflows, [], {})
    expect(pulse.reachable).toBe(true)
    expect(pulse.workflows).toHaveLength(2)
  })
})

describe('unreachablePulse', () => {
  it('returns an unreachable pulse with empty collections', () => {
    expect(unreachablePulse()).toEqual({
      reachable: false,
      workflows: [],
      recentErrors: [],
    })
  })
})
