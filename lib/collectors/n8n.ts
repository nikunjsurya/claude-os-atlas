// n8n heartbeat collector. shapeN8nPulse is pure; fetchN8nPulse is the
// impure wrapper that talks to the localhost n8n REST API (read-only).
// The rail and the queue share the same latest-run-errored rule.
// Spec: 2026-07-09-mission-control-v2-design.md section 5.

import type { N8nPulse, N8nWorkflowHealth } from '@/lib/types'
import type { N8nAuth } from './n8nAuth'

export interface N8nWorkflowJson {
  id: string
  name: string
  active: boolean
}

export interface N8nExecutionJson {
  id: string
  workflowId: string
  status: 'success' | 'error' | 'running' | 'waiting'
  startedAt: string
}

export function shapeN8nPulse(
  workflows: N8nWorkflowJson[],
  executions: N8nExecutionJson[],
  errorMessagesByExecutionId: Record<string, string>
): N8nPulse {
  const byWorkflow = new Map<string, N8nExecutionJson[]>()
  for (const e of executions) {
    const list = byWorkflow.get(e.workflowId) ?? []
    list.push(e)
    byWorkflow.set(e.workflowId, list)
  }

  const shaped: N8nWorkflowHealth[] = workflows.map((w) => {
    const latest = (byWorkflow.get(w.id) ?? [])
      .slice()
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
    if (!latest) return { id: w.id, name: w.name, active: w.active, lastExecution: null }
    const errorMessage =
      latest.status === 'error'
        ? errorMessagesByExecutionId[latest.id] ?? `execution ${latest.id} failed`
        : undefined
    return {
      id: w.id,
      name: w.name,
      active: w.active,
      lastExecution: {
        id: latest.id,
        status: latest.status,
        startedAt: latest.startedAt,
        ...(errorMessage !== undefined ? { errorMessage } : {}),
      },
    }
  })

  const recentErrors = shaped
    .filter((w) => w.lastExecution?.status === 'error')
    .map((w) => ({
      workflowId: w.id,
      workflowName: w.name,
      executionId: w.lastExecution!.id,
      startedAt: w.lastExecution!.startedAt,
      message: w.lastExecution!.errorMessage ?? `execution ${w.lastExecution!.id} failed`,
    }))

  return { reachable: true, workflows: shaped, recentErrors }
}

export function unreachablePulse(): N8nPulse {
  return { reachable: false, workflows: [], recentErrors: [] }
}

interface N8nListResponse<T> {
  data?: T[]
}

async function getJson<T>(
  fetchImpl: typeof fetch,
  auth: N8nAuth,
  pathAndQuery: string
): Promise<T> {
  const res = await fetchImpl(`${auth.baseUrl}${pathAndQuery}`, {
    headers: { 'X-N8N-API-KEY': auth.apiKey ?? '' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`n8n ${pathAndQuery} returned ${res.status}`)
  return (await res.json()) as T
}

// Best-effort error message for one execution. Bounded by the caller to
// latest-errored workflows only, and protected by the 30s TTL cache above.
async function fetchErrorMessage(
  fetchImpl: typeof fetch,
  auth: N8nAuth,
  executionId: string
): Promise<string | null> {
  try {
    const detail = await getJson<{
      data?: { resultData?: { error?: { message?: string } } }
    }>(fetchImpl, auth, `/executions/${executionId}?includeData=true`)
    return detail?.data?.resultData?.error?.message ?? null
  } catch {
    return null
  }
}

export async function fetchN8nPulse(
  auth: N8nAuth,
  fetchImpl: typeof fetch = fetch
): Promise<N8nPulse> {
  if (!auth.apiKey) return unreachablePulse()
  try {
    const [workflowsRes, executionsRes] = await Promise.all([
      getJson<N8nListResponse<N8nWorkflowJson>>(fetchImpl, auth, '/workflows?active=true'),
      getJson<N8nListResponse<N8nExecutionJson>>(fetchImpl, auth, '/executions?limit=40'),
    ])
    const workflows = workflowsRes.data ?? []
    const executions = executionsRes.data ?? []

    const errorMessages: Record<string, string> = {}
    const provisional = shapeN8nPulse(workflows, executions, {})
    for (const err of provisional.recentErrors) {
      const message = await fetchErrorMessage(fetchImpl, auth, err.executionId)
      if (message) errorMessages[err.executionId] = message
    }
    return shapeN8nPulse(workflows, executions, errorMessages)
  } catch {
    return unreachablePulse()
  }
}
