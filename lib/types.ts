// Schema for the claude-os-atlas data layer.
// Spec: docs/superpowers/specs/2026-04-27-claude-os-atlas-design.md section 5.2.

export type Cluster = 'content' | 'software' | 'voice' | 'infra' | 'meta'
export type Status = 'active' | 'parked' | 'shipped' | 'reference'
export type NodeKind =
  | 'project'
  | 'skill'
  | 'agent'
  | 'reference'
  | 'feedback'
  | 'instruction'

export type SourceType = 'memory' | 'folder' | 'skill' | 'agent' | 'claudemd'

export interface AtlasNode {
  id: string
  label: string
  kind: NodeKind
  cluster: Cluster
  status: Status
  size: number
  description: string
  bodyMarkdown: string
  lastTouched: string
  source: {
    path: string
    type: SourceType
  }
  links: {
    vault?: string
    repo?: string
    memoryFile?: string
  }
}

export type EdgeKind = 'wikilink' | 'folder-relation' | 'inferred-tag'

export interface AtlasEdge {
  source: string
  target: string
  kind: EdgeKind
  weight: number
}

export interface AtlasGraph {
  directed: false
}

export interface ClusterDescriptor {
  id: Cluster
  label: string
  color: string
}

export interface AtlasStats {
  nodes: number
  edges: number
  active: number
  parked: number
  shipped: number
  skills: number
}

export interface AtlasResponse {
  nodes: AtlasNode[]
  edges: AtlasEdge[]
  clusters: ClusterDescriptor[]
  stats: AtlasStats
  generatedAt: string
  warnings?: string[]
}

// What each parser returns. Cluster, status, and size are filled later by
// classify.ts and the API route. Parsers leave those at deterministic
// placeholders so merge can run without caring about classification.
export interface ParsedNode
  extends Omit<AtlasNode, 'cluster' | 'status' | 'size'> {
  cluster?: Cluster
  status?: Status
  size?: number
}

export interface ParserResult {
  nodes: ParsedNode[]
  edges: AtlasEdge[]
  warnings?: string[]
}

// V2 mission control types.
// Spec: docs/superpowers/specs/2026-07-09-mission-control-v2-design.md section 5.

export type PulseStatus = 'ok' | 'warn' | 'error' | 'unknown'

export interface SiteConfig {
  id: string
  label: string
  url: string
}

export interface SiteCard extends SiteConfig {
  screenshotPath: string | null
  capturedAt: string | null
  httpStatus: number | null
  responseMs: number | null
  status: PulseStatus
}

export interface N8nExecutionSummary {
  id: string
  status: 'success' | 'error' | 'running' | 'waiting'
  startedAt: string
  errorMessage?: string
}

export interface N8nWorkflowHealth {
  id: string
  name: string
  active: boolean
  lastExecution: N8nExecutionSummary | null
}

export interface N8nError {
  workflowId: string
  workflowName: string
  executionId: string
  startedAt: string
  message: string
}

export interface N8nPulse {
  reachable: boolean
  workflows: N8nWorkflowHealth[]
  recentErrors: N8nError[]
}

export interface GitSummary {
  branch: string
  dirty: number
  ahead: number
  behind: number
  lastCommitAt: string | null
}

// git === null means the git call failed or timed out (status 'unknown');
// non-git folders never appear at all. status: warn if dirty>0 or ahead>0;
// unknown iff git is null; ok otherwise. 'error' reserved, never emitted in V2.
export interface ProjectPulse {
  id: string
  label: string
  path: string
  git: GitSummary | null
  status: PulseStatus
}

export type QueueKind = 'owner-action' | 'claude-task' | 'incident'
export type QueueSource = 'curated' | 'git' | 'n8n' | 'site'
export type QueueStatus = 'open' | 'done' | 'dismissed'

export interface QueueItem {
  id: string
  title: string
  projectId: string | null
  kind: QueueKind
  source: QueueSource
  detail: string
  promptSeed: string
  createdAt: string
  status: QueueStatus
}

// Derived items carry a stateKey so a dismissal can be scoped to the
// occurrence that was dismissed (spec section 5, suppression rules).
export interface DerivedQueueItem extends QueueItem {
  stateKey: string
}

export interface QueueSuppression {
  id: string
  stateKey: string
}

export interface QueueState {
  statusOverrides: Record<string, QueueStatus>
  suppressed: QueueSuppression[]
}

export interface LaunchRequest {
  projectId: string
  prompt: string
  terminal?: 'warp' | 'wt'
}
