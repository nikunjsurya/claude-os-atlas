# claude OS — atlas: design spec

**Status:** Approved (reviewer pass 2)
**Date:** 2026-04-27
**Owner:** Surya
**Mockup:** `Projects/sessions/2026-04-27-claude-os-atlas/mockup-a-constellation.excalidraw`
**Brainstorm note:** `Projects/Nikunj's Vault/Projects/Brainstorms/2026-04-27 claude-os-atlas.md`

---

## 1. Goal

Build a beautiful, explorable visual atlas of every project, skill, agent, reference, and instruction in Surya's Claude + AI ecosystem. Click a node to read what it is, what it does, and how it relates to the rest. The graph is auto-derived from real folders and the memory index, never hand-curated, never stale.

V1 is read-only and localhost-only, optimized as a portfolio artifact and a personal orientation tool. V2 (separate spec, not in scope here) layers mission-control execution on top.

## 2. Non-goals

- Not a SaaS. No auth, no multi-tenancy, no users beyond Surya.
- Not a CMS. No editing of memory or project files from the UI.
- Not a deployment target for V1. Localhost only. No public URL.
- Not a knowledge graph engine. We're rendering relationships that already exist in `MEMORY.md` wikilinks and folder structure, not inferring new ones.
- No mission-control execute layer in V1. Hooks are designed-in but not wired.
- No privacy / sanitization filter in V1. Deferred until the "ship publicly" decision.

## 3. Success criteria

The build is done when all of these are true:

1. `npm run dev` opens `localhost:3000` and renders a force-directed constellation that visibly looks like the mockup (dark canvas, 4 cluster halos, ~80 nodes, edges between related work).
2. Every node click opens the right side panel populated with that node's actual metadata and full markdown body.
3. The graph reflects the real state of `~/MEMORY.md`, `~/.claude/`, `~/Projects/`, and `~/_templates/` at request time, with no manual data files.
4. Filter chips (All / Projects / Skills / Agents / References) hide the right node groups.
5. Bottom stats bar shows live counts derived from the same data.
6. All parser unit tests pass. Classifier tests pass. API integration test passes.
7. First-load on a clean machine takes under 3 seconds from `npm install` finishing to graph rendering.

## 4. Architecture

### 4.1 Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime | Node.js >= 20.0 | Required by Next.js 15. |
| Framework | Next.js 15 (App Router) + TypeScript | Surya's daily driver (TopSnip). Built-in API routes give us a clean filesystem-to-JSON boundary and leave room for V2 mission control without re-platforming. |
| Styling | Tailwind 4 | Tight design tokens, matches the dark constellation palette cleanly. |
| Graph | `react-force-graph-2d` | Canvas-rendered, handles hundreds of nodes smoothly, built-in hover/click hooks, supports node-rendering callbacks for halos and pulses. |
| State | `zustand` | Selected node + active filters. Tiny. No boilerplate. |
| Markdown | `react-markdown` + `remark-gfm` | Render side-panel body content. |
| Tests | Vitest | Fast, native ESM, plays well with Next.js. |

No backend. No database. No auth.

The Next.js app lives at the **repo root** (`Projects/claude-os-atlas/`). No nested `web/` or `app/` subdir for code. The `docs/` tree sits alongside the Next.js source tree, ignored by Next via `next.config.ts` `pageExtensions`.

### 4.2 Component tree

Every component is a single file with one purpose. They compose at `app/page.tsx`.

```
app/
├── page.tsx                       Composes the screen. Server component fetches /api/atlas, hands data to client root.
├── layout.tsx                     Loads fonts, sets global background.
├── globals.css                    Tailwind reset, palette CSS variables.
└── api/
    └── atlas/
        └── route.ts               GET → { nodes, edges, clusters, stats }. Orchestrates parsers + classifier + merger.

components/
├── BrowserChrome.tsx              Decorative top bar (traffic lights + URL pill). Aesthetic only.
├── HeaderBar.tsx                  "claude OS" title + tagline + filter chips.
├── FilterChips.tsx                Active filter state from zustand. Renders the chip row.
├── ConstellationCanvas.tsx        Owns the react-force-graph-2d instance. Custom node renderer. Click → setSelected.
├── ClusterHaloLayer.tsx           SVG overlay positioned from cluster centers. Renders translucent halos and labels.
├── NodeDetailPanel.tsx            Right side panel. Subscribes to selected node. Renders status pill, metadata rows, linked nodes, sparkline, action links.
├── ActivitySparkline.tsx          Tiny SVG line chart for the 30-day activity in the side panel.
└── StatsBar.tsx                   Bottom strip with derived counts (nodes / edges / active / parked / shipped / skills).

lib/
├── types.ts                       AtlasNode, AtlasEdge, Cluster, Status, NodeKind. Single source of truth.
├── store.ts                       Zustand store. selectedId, activeFilter, setSelected, setFilter.
├── parsers/
│   ├── parseMemoryIndex.ts        Reads ~/MEMORY.md. Extracts file/type/description rows. Returns nodes (one per memory entry) + edges (from wikilinks within memory body files).
│   ├── parseProjectsFolder.ts     Walks ~/Projects/. One node per top-level project folder. Status inferred from git activity, _index.md, and PARKED markers.
│   ├── parseSkills.ts             Walks ~/.claude/skills/ and plugin caches. One node per SKILL.md, name + description from frontmatter.
│   ├── parseAgents.ts             Walks ~/.claude/agents/ and ~/_templates/.claude/agents/. One node per agent definition.
│   └── parseClaudeMd.ts           Reads exactly two scopes: ~/.claude/CLAUDE.md (global) and ~/Projects/*/CLAUDE.md (one level deep, no recursion). One node per instruction file.
├── merge.ts                       Dedupe nodes by id (prefer disk over memory), dedupe edges, layer descriptions.
├── classify.ts                    Pure functions: assignCluster(node) and assignStatus(node). Heuristics defined in one place.
└── paths.ts                       Resolves home directory paths consistently. One module so tests can override roots.
```

Why this shape:

- Every parser is a pure function `(rootPath: string) => Promise<{ nodes, edges }>`. Testable in isolation with a fixture filesystem.
- Adding a new source = adding one parser file + one line in the API route. No ripple changes.
- `classify.ts` separates "what is this thing" (parsers) from "where does it live in the visual" (clusters/statuses). Re-skinning visuals doesn't touch parsing logic.
- `ConstellationCanvas` is the only file that imports `react-force-graph-2d`. Swappable.
- `store.ts` is the only file that imports zustand. Swappable.

## 5. Data flow & interfaces

### 5.1 Pipeline

```
[~/MEMORY.md, ~/.claude/, ~/Projects/, ~/_templates/, ~/.claude/CLAUDE.md]
                          ↓
   parsers/* (each pure: rootPath → Promise<{nodes, edges}>)
                          ↓
   merge.ts (dedupe by node id, prefer disk truth, union edges)
                          ↓
   classify.ts (assignCluster + assignStatus on every node)
                          ↓
   API route: GET /api/atlas → { nodes, edges, clusters, stats }
                          ↓
   page.tsx (server component, fetches at request time)
                          ↓
   <ConstellationCanvas /> (client component, owns d3-force layout)
                          ↓
   <NodeDetailPanel /> (client, subscribes to zustand store)
```

### 5.2 Type schema (lib/types.ts)

```ts
export type Cluster = 'content' | 'software' | 'voice' | 'infra' | 'meta'
export type Status  = 'active' | 'parked' | 'shipped' | 'reference'
export type NodeKind = 'project' | 'skill' | 'agent' | 'reference' | 'feedback' | 'instruction'

export interface AtlasNode {
  id: string                    // kebab-cased basename. e.g. 'project-topsnip', 'skill-excalidraw'
  label: string                 // human-readable name
  kind: NodeKind
  cluster: Cluster
  status: Status
  size: number                  // 14-32, see formula in 5.2.1
  description: string           // one-liner, from memory entry or frontmatter
  bodyMarkdown: string          // full markdown for side panel
  lastTouched: string           // ISO date, from fs.stat mtime (no git in V1)
  source: {
    path: string                // absolute path on disk
    type: 'memory' | 'folder' | 'skill' | 'agent' | 'claudemd'
  }
  links: {
    vault?: string              // path to vault note if linked
    repo?: string               // git remote if applicable
    memoryFile?: string         // memory entry filename
  }
}

export interface AtlasEdge {
  source: string                // node id
  target: string                // node id
  kind: 'wikilink' | 'folder-relation' | 'inferred-tag'
  weight: number                // 0.1 - 1.0, drives line opacity
}

export interface AtlasGraph {
  directed: false               // V1 graph is undirected. Wikilink direction is preserved in source data
                                // but the rendered graph and edge dedupe key both treat edges as undirected.
}

export interface AtlasResponse {
  nodes: AtlasNode[]
  edges: AtlasEdge[]
  clusters: Array<{ id: Cluster, label: string, color: string }>
  stats: { nodes: number, edges: number, active: number, parked: number, shipped: number, skills: number }
  generatedAt: string           // ISO
}
```

### 5.2.1 Node size formula

```
size = clamp(14 + (edgeCount * 1.5) + (status === 'active' ? 4 : 0), 14, 32)
```

`edgeCount` = number of edges incident to the node after merge + dedupe. Pure function of the final graph, computed once at API-route time after all parsers + classifier have run.

### 5.3 Node ID convention

Stable IDs across runs. Algorithm:

- Memory entry: `<type>-<slug>` from filename. `project_topsnip.md` → `project-topsnip`.
- Project folder: `project-<kebab(folder)>`.
- Skill: `skill-<kebab(skill-name)>`.
- Agent: `agent-<kebab(agent-name)>`.
- CLAUDE.md instruction: `instruction-<scope>` where scope is `global`, `<repo-name>`, etc.

When two parsers emit the same id (e.g., `project-topsnip` from both memory and the folder), the merger keeps disk metadata as truth and layers the memory description on top.

### 5.4 API contract

`GET /api/atlas` returns the `AtlasResponse` JSON above. No parameters. No caching headers (localhost, fresh on every request). On parser error, returns 200 with the partial result and a `warnings: string[]` field. Never returns 500 unless the route handler itself crashes.

### 5.5 Cluster assignment heuristics (classify.ts)

All matching is case-insensitive against `node.label + ' ' + node.description` (the search text). All keyword sets are closed lists declared as exported constants in `classify.ts` so they're trivially testable.

```
const CONTENT_KEYWORDS = [
  'channel', 'shorts', 'video', 'podcast', 'episode',
  'neither-bank', 'hindi-ai', 'faceless', 'forgotten-myths',
  'hidden-systems', 'render', 'publishing', 'remotion',
  'shorts-factory', 'longform', 'reel'
]

const VOICE_KEYWORDS = [
  'nikunj-agent', 'nikunj agent', 'elevenlabs', 'voice sample',
  'voice profile', 'voice clone', 'rapid-update', 'voice-check'
]

const INFRA_KEYWORDS = [
  'mcp', 'n8n', 'lightrag', 'paperclip', 'higgsfield',
  'vps', 'codex', 'plugin', 'cli-anything', 'remotion',
  'crawl4ai', 'yt-dlp'
]
```

Rule order (first match wins):

```
1. voice    → search text contains any VOICE_KEYWORDS token
2. infra    → kind in {'reference', 'feedback'} AND search text contains any INFRA_KEYWORDS token
3. content  → kind=='project' AND search text contains any CONTENT_KEYWORDS token
4. software → kind=='project' AND folder contains package.json
5. meta     → kind in {'skill', 'feedback', 'instruction', 'reference'}
6. fallback → 'meta', plus console.warn(`unclassified: ${id}`) AND push to AtlasResponse.warnings[]
```

Note: `remotion` appears intentionally in both `CONTENT_KEYWORDS` and `INFRA_KEYWORDS`. Kind-gating in the rule order resolves the overlap: infra rule only fires for non-projects, content rule only fires for projects.

### 5.6 Status assignment heuristics (classify.ts)

No git inspection in V1. Status comes from explicit textual signals in memory entries plus filesystem mtime. This keeps parsers fast and avoids shelling out.

```
1. parked    → search text matches /\bPARKED\b/i  OR  folder contains PARKED.md
2. shipped   → search text matches /\b(shipped|complete|production-ready)\b/i
3. active    → kind=='project' AND lastTouched within 14 days
4. reference → kind in {'reference', 'feedback', 'instruction'}
5. default   → 'active' for kind=='project', else 'reference'
```

`lastTouched` is derived from `fs.stat(folderPath).mtime` for folder-sourced nodes and from the memory entry file's mtime for memory-sourced nodes. No git log calls. This is intentional: `lastTouched` is "approximately when this thing was last edited," sufficient for the activity threshold.

### 5.7 Edge derivation

The graph is **undirected** in V1 (see `AtlasGraph.directed: false` in 5.2). Wikilinks are inherently directional but for visualization we treat them as undirected; direction is preserved in source data only.

- **wikilink edges:** parse `[Title](file.md)` and `[[Wikilink]]` style links inside memory entry body files. Each link → edge between source memory node and target node. `kind: 'wikilink'`, `weight: 1.0`.
- **folder-relation edges:** when a project folder's `README.md` or `_index.md` mentions the slug of another known project node (case-insensitive substring match against the set of known project ids), emit an edge. `kind: 'folder-relation'`, `weight: 0.6`. No file-content scanning beyond README + _index to keep this bounded.
- **inferred-tag edges:** declared via a closed set of "shared-entity tokens." For each token in the set, find all nodes whose `label` or `description` (NOT body) contains it (case-insensitive whole-word match). Emit an edge between every pair of those nodes for that token. `kind: 'inferred-tag'`, `weight: 0.3`.

```
const SHARED_ENTITY_TOKENS = [
  'ElevenLabs', 'Higgsfield', 'Nikunj', 'NotebookLM',
  'LightRAG', 'Paperclip', 'n8n', 'Pexels',
  'Vercel', 'Excalidraw', 'Codex', 'Wispr Flow'
]
```

If a token would emit > 8 edges (i.e., > 8 nodes mention it), cap the edges to the top-8 strongest by status precedence (active > shipped > parked > reference) to prevent visual hairballs.

Edge dedupe key (graph treated as undirected): `${min(source,target)}__${max(source,target)}__${kind}`. When the same node-pair has edges of multiple kinds, keep the highest-weight one and drop the rest.

## 6. Visual specification

Reference: `mockup-a-constellation.excalidraw` in the session folder.

### 6.1 Palette

| Token | Hex |
| --- | --- |
| Canvas background | `#0E1014` |
| Panel background | `#15171D` |
| Panel border | `#2A2D34` |
| Ink primary | `#E6E8EE` |
| Ink dim | `#6B7280` |
| Status: active (green) | `#5AA77A` |
| Status: shipped (blue) | `#5BA3B5` |
| Status: parked (gray) | `#6B7280` |
| Status: reference (purple) | `#9F7AEA` |
| Cluster: content (orange) | `#E07B4E` |
| Cluster: software (blue) | `#5BA3B5` |
| Cluster: voice (purple) | `#9F7AEA` |
| Cluster: infra (green) | `#5AA77A` |
| Cluster: meta (gray) | `#6B7280` |

### 6.2 Layout

- Top: 38px decorative browser chrome.
- 60-100px header band: title left, filter chips right.
- Main area: graph canvas takes left ~75% width, right side panel takes 380px fixed width.
- Bottom: 50px stats bar.
- Min viewport: 1280x800. Below that, side panel collapses to a slide-over.

### 6.3 Node rendering

- Each node is a filled circle, color = status.
- Active nodes get a 25%-opacity halo ring of the same color, animated with a slow pulse (3s cycle).
- Parked nodes render at 45% opacity.
- Selected node gets an 18%-opacity outer halo at 1.5x size and a 2px stroke instead of 1.5px.
- Label below the node, 12px, ink primary (or ink dim if parked).

**Pulse implementation:** `react-force-graph-2d` calls `nodeCanvasObject(node, ctx, globalScale)` every animation frame. The pulse is a per-frame computation inside that callback:

```ts
// inside nodeCanvasObject for active nodes
const t = (Date.now() % 3000) / 3000           // 0..1 over 3s
const pulse = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI)   // 0..1 sine wave
const haloAlpha = 0.15 + 0.10 * pulse          // 0.15..0.25
const haloRadius = node.size + 4 + 2 * pulse
```

CSS animations do not work on canvas; this per-frame redraw is the only way.

### 6.4 Cluster halos

- Translucent ellipses behind nodes, color = cluster.
- 8% opacity solid + 20% opacity hachure overlay for texture.
- Cluster label floats above, 11px, color = cluster, all caps.

### 6.5 Side panel

When a node is selected:
- Status pill at top, status color background, dark text.
- Node label (26px) and one-line description (13px dim italic) below.
- Divider, then metadata rows: type, status with date, last touch, memory ref, repo. Two columns: 110px label + value.
- "LINKED" section: list of connected nodes with colored dots, click to select.
- Sparkline of last 30 days of filesystem activity (mtime-based bucketing).
- Two action buttons: "Open in vault" (orange), "View memory file" (gray).

When nothing selected: panel shows a "Pick a node" hint state with the cluster legend.

## 7. Edge cases & failure modes

| Case | Behavior |
| --- | --- |
| Folder doesn't exist | Parser returns `{nodes:[], edges:[]}`, logs `console.warn('parser X: root not found')`. No throw. |
| MEMORY.md is missing | API returns empty graph + warning. UI renders empty-state hint. |
| Two sources emit same node id | Merger keeps disk metadata as truth, takes description from memory if disk lacks one. Edges union. |
| Edge points at unknown node id | Edge dropped, logged once per missing target. |
| Node not classifiable | Bucket as `meta`, console warn. |
| Graph has > 500 nodes | Default filter applies "lastTouched within 6 months". Filter chip exposes a "show all" toggle. |
| Graph has 0 nodes | UI shows "no atlas data found" with the resolved filesystem paths, so the user can fix. |
| Malformed markdown in memory entry | Parser still emits the node with an empty body, logs warning. |
| Renderer crash | React error boundary in `ConstellationCanvas` shows fallback message and the raw API JSON in a `<details>` block for debugging. |
| Port 3000 in use | Standard Next.js fallback to 3001 + console message. No custom handling. |
| Filesystem is slow on first load | Parsers run in parallel via `Promise.all`. Target: < 1.5s for full parser pass on a warm disk (this is parser time only, not the end-to-end first-render budget in success criterion 7). |

## 8. Testing strategy

Pragmatic V1, not over-engineered. All tests pure or filesystem-fixture-based.

### 8.1 Test surface

| Area | Approach | Test count |
| --- | --- | --- |
| `paths.ts` | Unit tests on root resolution + override behavior | 2 |
| Each parser | Vitest unit tests against `lib/parsers/__fixtures__/<parser>/` | 5 per parser × 5 parsers = 25 |
| `merge.ts` | Unit tests on dedupe + merge precedence (incl. id-collision fixture) | 4 |
| `classify.ts` | Unit tests on `assignCluster()` and `assignStatus()` (closed keyword sets make these straightforward) | 10 |
| API route | Integration test pointing at `__fixtures__/`, asserts `AtlasResponse` shape and counts | 3 |
| Components | **Skipped for V1.** Visual is the spec. Manual eyeballing on localhost is the test. Add Playwright later if it goes public. |
| E2E | **Skipped for V1.** |

**Total: 44 tests.** Acceptance threshold: all 44 pass.

### 8.2 Test conventions

- One fixture folder per parser: `lib/parsers/__fixtures__/parseMemoryIndex/MEMORY.md` etc. Real-looking but minimal.
- All fixtures are plain text files committed to the repo.
- `paths.ts` accepts a `root` override so tests can point parsers at fixtures.
- `vitest.config.ts` runs in node env. No jsdom needed.

### 8.3 What we do NOT test

- The graph layout algorithm itself (it's d3-force, trusted).
- Visual rendering (eyeball test).
- React components (small, declarative, no logic).
- Hooks beyond zustand store actions.

## 9. Build plan (units)

Bite-sized units the implementing agent should ship in order. Each unit ends in a passing test or a verifiable visual artifact.

1. **Init Next.js project at the repo root** — From inside `Projects/claude-os-atlas/`, scaffold Next.js into the existing folder using `npm create next-app@latest . --ts --tailwind --app --no-eslint --import-alias "@/*"`. The CLI will prompt to add files to the non-empty directory; accept. Verify `package.json`, `app/`, and `next.config.ts` land at repo root and the existing `docs/` and `.gitignore` are preserved. Run `npm run dev` and confirm the default page renders at `localhost:3000`.
2. **lib/types.ts** — Define all schema types. No tests yet.
3. **lib/paths.ts** — Resolve home dir + project roots. Unit test that defaults match `~/`.
4. **parseMemoryIndex** — Parser + 5 unit tests against fixture.
5. **parseProjectsFolder** — Parser + 5 unit tests.
6. **parseSkills** — Parser + 5 unit tests.
7. **parseAgents** — Parser + 5 unit tests.
8. **parseClaudeMd** — Parser + 5 unit tests.
9. **merge.ts + classify.ts** — Pure logic + 14 tests.
10. **API route /api/atlas** — Integration test against fixtures.
11. **app/page.tsx + ConstellationCanvas (skeleton)** — Renders nodes as circles, no styling. Verify it draws something.
12. **Cluster halos + node styling per status** — Match the mockup palette.
13. **NodeDetailPanel + zustand store** — Click a node, see its data. No markdown rendering yet.
14. **Markdown body rendering + linked nodes list** — Side panel feels complete.
15. **HeaderBar + FilterChips + StatsBar + BrowserChrome** — Frame the screen.
16. **ActivitySparkline** — Last visual flourish.
17. **Polish pass** — Spacing, font sizes, hover states. Compare to mockup.

Each unit is independently shippable. Coder + tester pair cycles through them.

## 10. Open questions (deferred)

- **Privacy filter** for public-share use. Out of scope for V1 (localhost only). Spec'd separately when the user decides to go public.
- **V2 mission control** (run skills, see routines, headless Claude Code execution). Designed to slot in via API routes that this V1 already provides; spec'd separately when V1 ships.
- **Vault integration** (clicking "Open in vault" button). For V1, links use `obsidian://` protocol URLs and assume vault is open. No deep linking work in V1.
- **Persistence** of selected filters across reload. Out of scope for V1 — defaults are good enough.

## 11. Acceptance checklist

Implementation is done when, on a clean machine:

- [ ] `cd Projects/claude-os-atlas && npm install && npm run dev` opens `localhost:3000` to the constellation
- [ ] At least 50 nodes render across all 4 cluster halos
- [ ] At least 30 edges render between nodes
- [ ] Clicking any node selects it: status pill, label, metadata, linked nodes, body all populate
- [ ] Filter chips correctly hide/show node groups
- [ ] Stats bar matches actual counts in the response payload
- [ ] All 44 unit tests pass via `npm test`
- [ ] No console errors on first load
- [ ] Looks recognizably like `mockup-a-constellation.excalidraw`
