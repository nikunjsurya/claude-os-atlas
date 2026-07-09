// Auto-derived queue items from collector snapshots. Pure.
// Spec: 2026-07-09-mission-control-v2-design.md section 5, derived queue rules.

import type {
  DerivedQueueItem,
  N8nPulse,
  ProjectPulse,
  SiteCard,
} from '@/lib/types'

export interface DeriveInputs {
  n8n: N8nPulse | null
  sites: SiteCard[]
  projects: ProjectPulse[]
  now: Date
}

export function deriveQueueItems(inputs: DeriveInputs): DerivedQueueItem[] {
  const items: DerivedQueueItem[] = []
  const createdAt = inputs.now.toISOString()
  const utcDay = createdAt.slice(0, 10)

  if (inputs.n8n) {
    for (const w of inputs.n8n.workflows) {
      const last = w.lastExecution
      if (last?.status !== 'error') continue
      const errorLine = last.errorMessage ? `: ${last.errorMessage}` : ''
      items.push({
        id: `n8n:${w.id}`,
        stateKey: last.id,
        title: `n8n: ${w.name} is failing`,
        projectId: null,
        kind: 'incident',
        source: 'n8n',
        detail: `Latest execution \`${last.id}\` errored${errorLine}.`,
        promptSeed: `The n8n workflow "${w.name}" (id ${w.id}) is failing. Latest execution ${last.id} errored${errorLine}. Investigate via the n8n REST API on localhost:5678, find the root cause, and fix it. Do not mutate other live workflows.`,
        createdAt,
        status: 'open',
      })
    }
  }

  for (const site of inputs.sites) {
    if (site.status !== 'error') continue
    items.push({
      id: `site:${site.id}`,
      stateKey: `${site.httpStatus ?? 'down'}:${utcDay}`,
      title: `${site.label} is down`,
      projectId: null,
      kind: 'incident',
      source: 'site',
      detail: `${site.url} returned ${site.httpStatus ?? 'no response (timeout)'}.`,
      promptSeed: `${site.label} (${site.url}) is unreachable or erroring (HTTP ${site.httpStatus ?? 'timeout'}). Diagnose whether it is DNS, hosting, or an app error, and restore it.`,
      createdAt,
      status: 'open',
    })
  }

  for (const project of inputs.projects) {
    if (!project.git) continue
    if (project.git.dirty === 0 && project.git.ahead === 0) continue
    const { dirty, ahead, branch } = project.git
    items.push({
      id: `git:${project.id}`,
      stateKey: branch,
      title: `${project.label}: uncommitted/unpushed work`,
      projectId: project.id,
      kind: 'claude-task',
      source: 'git',
      detail: `${dirty} dirty file(s), ${ahead} unpushed commit(s) on \`${branch}\`.`,
      promptSeed: `The repo at ${project.path} has ${dirty} dirty file(s) and ${ahead} unpushed commit(s) on branch ${branch}. Review the changes, commit them with a sensible message (or explain why not), and push if a remote exists.`,
      createdAt,
      status: 'open',
    })
  }

  return items
}
