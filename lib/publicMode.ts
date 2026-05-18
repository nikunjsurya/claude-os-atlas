// Public-mode allowlist + content scrubber. When the atlas is rendered
// for a public visitor (recruiters, etc), we ship only an explicit subset
// of nodes and run every body of markdown through a regex denylist that
// strips client names, hourly rates, filesystem paths, emails, and API
// keys. Default-deny on nodes; default-allow + scrub on text.
//
// The snapshot pipeline (scripts/build-snapshot.mjs) runs this against
// the live local filesystem and writes data/atlas-snapshot.json. The
// production build reads from that snapshot; it does NOT call
// buildAtlasResponse at runtime on Vercel.

import type { AtlasNode, AtlasEdge, AtlasResponse } from './types'

// Explicit allowlist of node IDs that are safe to ship publicly.
// IDs come from the parser kebab conventions:
//   - memory entries: project-topsnip (file: project_topsnip.md)
//   - skills:        skill-<kebab(name)>
//   - agents:        agent-<kebab(name)>
// Add a new ID here to surface it on the public atlas. Default is deny.
export const PUBLIC_ALLOWLIST: ReadonlySet<string> = new Set([
  // Shipped + active personal projects
  'project-topsnip',
  'project-claude-os-atlas',
  'project-ai-linkedin-autopilot',
  'project-ascension-system',
  'project-ai-reel-generator',
  'project-mindward',
  'project-adaptive-shorts-engine',
  'project-yt-research-pipeline',
  'project-software-agent-team',
  'project-shorts-factory',
  'project-shorts-autonomous-pipeline',
  'project-amzprep-freight-agent',
  'project-notebooklm-content-pipeline',
  'project-higgsfield-automation',
  'project-rapid-update-writer',
  'project-hindi-ai-channel',
  'project-v7-longform-engine',
  'project-qmd-wiki-rag',
  'project-wiki-compiler',
  'project-nifty50-trading',
  'project-notebooklm-cleaner',
  'project-neither-bank',
  'project-linkedin-visual-overhaul',
  'project-paperclip',

  // Skills the user authored
  'skill-brainstorm',
  'skill-excalidraw',
  'skill-rapid-update-writer',
  'skill-notebooklm',
  'skill-autoresearch',
  'skill-wiki-compiler',
  'skill-business-validation',
  'skill-legal-review',
  'skill-neither-bank-seo',
  'skill-seo',
])

// Strings that must never appear in any rendered body. Each gets replaced
// with [redacted]. Add patterns here, then re-run the snapshot script,
// then run assertSafe() before committing.
export const SCRUB_PATTERNS: readonly RegExp[] = [
  // Rate negotiations + dollar amounts attached to time
  /\$\d{1,4}(?:[-–—]\d{1,4})?\s*(?:USD)?\s*\/?\s*(?:hr|hour|hourly|h)\b/gi,
  /\$\d{2,4}(?:[-–—]\d{2,4})\s*USD?/gi,

  // Client / employer names (case-insensitive)
  /\bH\s*&\s*M\b/gi,
  /\bPsychable\b/gi,
  /\bUncommon Business\b/gi,
  /\bCSC AI\b/gi,

  // Filesystem paths (Windows + WSL/bash style)
  /[A-Z]:\\Users\\[A-Za-z0-9_.\-]+/g,
  /\/c\/Users\/[A-Za-z0-9_.\-]+/g,
  /\/Users\/[A-Za-z0-9_.\-]+/g,
  /~\/(?:\.claude|Projects)\/[\w./\-]*/g,

  // Emails
  /\b[\w._%+\-]+@[\w.\-]+\.[A-Za-z]{2,}\b/g,

  // Common API key shapes (defensive belt-and-braces)
  /\bsk-[A-Za-z0-9_\-]{20,}\b/g,
  /\bsk-proj-[A-Za-z0-9_\-]{20,}\b/g,
  /\bxoxb-[A-Za-z0-9\-]{20,}\b/g,
  /\bAIza[0-9A-Za-z_\-]{30,}\b/g,
]

// Phrases the user has tagged as private even when no regex matches.
// Lowercased substring match. Add freely; cheap to test.
export const SUBSTRING_DENYLIST: readonly string[] = [
  'work permit',
  'visa',
  'immigration',
  'career-ops',
  'job search',
  'job hunt',
  'salary',
  'compensation',
]

export function scrub(text: string): string {
  if (!text) return text
  let out = text
  for (const re of SCRUB_PATTERNS) {
    out = out.replace(re, '[redacted]')
  }
  return out
}

// Hard assertion run before committing the snapshot. If any banned
// substring slips through (regex miss, allowlist mistake), this throws
// and the snapshot does not get written.
export function assertSafe(text: string, where: string): void {
  const lower = text.toLowerCase()
  for (const phrase of SUBSTRING_DENYLIST) {
    if (lower.includes(phrase)) {
      throw new Error(
        `assertSafe: forbidden phrase "${phrase}" in ${where}. ` +
          `Tighten SCRUB_PATTERNS or drop the node from PUBLIC_ALLOWLIST.`,
      )
    }
  }
  for (const re of SCRUB_PATTERNS) {
    re.lastIndex = 0
    if (re.test(text)) {
      throw new Error(
        `assertSafe: SCRUB_PATTERNS still matches in ${where}. ` +
          `Run scrub() before serializing.`,
      )
    }
  }
}

// Build a public-safe AtlasResponse from the full one. Drops disallowed
// nodes, scrubs all rendered text, removes filesystem paths and external
// links, drops orphan edges, and recomputes stats. Pure function; the
// snapshot script calls this once at build time.
export function toPublicResponse(full: AtlasResponse): AtlasResponse {
  const allowedNodes: AtlasNode[] = []
  for (const n of full.nodes) {
    if (!PUBLIC_ALLOWLIST.has(n.id)) continue
    const description = scrub(n.description)
    const bodyMarkdown = scrub(n.bodyMarkdown)
    assertSafe(description, `node ${n.id} .description`)
    assertSafe(bodyMarkdown, `node ${n.id} .bodyMarkdown`)
    allowedNodes.push({
      ...n,
      description,
      bodyMarkdown,
      source: { path: '[private]', type: n.source.type },
      links: {},
    })
  }

  const ids = new Set(allowedNodes.map((n) => n.id))
  const allowedEdges: AtlasEdge[] = full.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target),
  )

  const stats = {
    nodes: allowedNodes.length,
    edges: allowedEdges.length,
    active: allowedNodes.filter((n) => n.status === 'active').length,
    parked: allowedNodes.filter((n) => n.status === 'parked').length,
    shipped: allowedNodes.filter((n) => n.status === 'shipped').length,
    skills: allowedNodes.filter((n) => n.kind === 'skill').length,
  }

  return {
    nodes: allowedNodes,
    edges: allowedEdges,
    clusters: full.clusters,
    stats,
    generatedAt: full.generatedAt,
  }
}
