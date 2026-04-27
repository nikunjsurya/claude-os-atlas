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
