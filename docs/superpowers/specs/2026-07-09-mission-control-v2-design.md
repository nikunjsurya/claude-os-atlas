# claude OS atlas V2: mission control

**Status:** Draft (pending reviewer pass)
**Date:** 2026-07-09
**Owner:** Surya
**Supersedes nothing.** V1 spec (`2026-04-27-claude-os-atlas-design.md`) remains the contract for the constellation map, which V2 keeps as a secondary view.
**Brainstorm note:** `Projects/Nikunj's Vault/Projects/Brainstorms/2026-07-09 mission-control-v2.md`

---

## 0. Legal & risk scan (step 0)

Verdict: **GREEN, no deep review triggered.** Localhost-only personal tool operating exclusively on Surya's own assets: screenshots of his own deployed sites, read-only polling of his self-hosted n8n, git status of his own repos, and spawning terminals on his own machine. No scraping of third-party content, no external API ToS exposure, no user data collection, no distribution. The one security-adjacent surface (an HTTP endpoint that spawns processes) is addressed in §7 Security.

## 1. Goal

Turn the atlas from a read-only map into the daily cockpit. One screen answers three questions the moment it loads:

1. **What is the state of everything?** Live screenshots + health of deployed sites, n8n workflow heartbeat, git state of every project.
2. **What is waiting on me?** A pending-work queue: curated owner actions plus auto-derived incidents (errored n8n runs, dead sites, dirty/unpushed repos).
3. **Let me start working on it, now.** Click an item → see status detail → "work on it" → an editable pre-drafted prompt → one button opens Warp in that project's directory with `claude` already running the prompt.

The V1 constellation stays, demoted to a `/map` tab. The dashboard becomes `/`.

## 2. Non-goals

- No headless / in-browser Claude execution. V2 launches a *terminal you own*; it does not run agents itself. (V3 candidate.)
- No auth, no deploy, no public URL, no mobile layout (min viewport 1280×800, same as V1).
- No writes to n8n (read-only API usage), no editing of memory/vault files from the UI.
- Queue "done/dismiss" state changes are allowed (writes only to the repo-local `data/queue.json`); nothing else on disk is mutated by the UI except screenshot cache and launch artifacts.
- No new graph features on the constellation.

## 3. Success criteria

1. `npm run dev` → `localhost:3000` renders the mission-control dashboard with **real data in all four zones** (sites, n8n, projects, queue) in under 4s on a warm disk.
2. Site cards show actual captured screenshots of aetherbloom.com, topsnip.co, and mindward-web.vercel.app, each with HTTP status + response time; a dead site visibly degrades to an error state.
3. Killing/failing an n8n workflow surfaces it in the incident rail within one poll cycle (≤60s), with the execution error message visible.
4. Every project with uncommitted or unpushed work is visibly flagged in the project grid.
5. Clicking a queue item opens a detail drawer with status context and an **editable** prompt; "Start in Warp" opens Warp in the right directory with `claude` running the edited prompt. Verified live at least once against Warp and once against the `wt` fallback.
6. The constellation still fully works at `/map`; all 44 existing tests plus ~30 new ones pass.
7. Surya has picked one of three rendered visual directions (taste gate, §8) and the shipped dashboard follows it.

## 4. Architecture

### 4.1 Stack deltas from V1

No re-platforming. Next.js 15 App Router + TS + Tailwind 4 + zustand + vitest, exactly as V1. New server-side dependencies: none beyond Node built-ins (`child_process`, `fs`): n8n polling uses `fetch`, screenshots shell out to installed Chrome/Edge, git via `git -C`. Keep it dependency-light on purpose.

**Note:** repo AGENTS.md warns this Next.js version differs from training data. Implementers must read the relevant guides in `node_modules/next/dist/docs/` before writing route handlers or layout code.

### 4.2 Route & component tree (new/changed only)

```
app/
├── page.tsx                        NEW HOME: mission control dashboard (server shell, client zones)
├── map/page.tsx                    V1 constellation relocated verbatim (AtlasRoot + friends)
└── api/
    ├── atlas/route.ts              unchanged (feeds /map)
    ├── pulse/
    │   ├── sites/route.ts          GET  → SiteCard[] (health live, screenshot meta from cache)
    │   ├── sites/refresh/route.ts  POST → recapture screenshots (async kick, returns 202)
    │   ├── n8n/route.ts            GET  → N8nPulse
    │   └── projects/route.ts       GET  → ProjectPulse[]
    ├── queue/
    │   ├── route.ts                GET (merged curated+derived) / POST (add curated item)
    │   └── [id]/route.ts           PATCH → {status: done|dismissed|open}
    └── launch/route.ts             POST → validate, write prompt file + Warp launch config, spawn

components/dashboard/
├── DashboardRoot.tsx               client root, zustand, polling timers
├── SiteCardZone.tsx                screenshot cards w/ status ribbon
├── N8nRail.tsx                     workflow list + incident rail (errors pinned top)
├── ProjectGrid.tsx                 compact grid, git badges (dirty/ahead/behind)
├── QueuePanel.tsx                  pending-work list, grouped by kind
├── DetailDrawer.tsx                slide-over: item status, context, markdown detail
├── PromptComposer.tsx              editable prompt textarea + terminal picker + Start button
└── PulseDot.tsx                    shared status dot (ok/warn/error/unknown)

lib/
├── collectors/
│   ├── sites.ts                    health check (HEAD w/ timing) + screenshot cache mgmt
│   ├── screenshot.ts               capture via installed Chrome (fallback Edge), never bundled Chromium
│   ├── n8n.ts                      GET workflows + recent executions, shape into N8nPulse
│   ├── n8nAuth.ts                  key resolution: env N8N_API_KEY → ~/.claude.json mcpServers["n8n-mcp"].env
│   ├── gitStatus.ts                porcelain+branch parse (pure fn) + runner w/ concurrency cap
│   └── cache.ts                    per-collector in-memory TTL cache (sites 60s, n8n 30s, projects 120s)
├── queue/
│   ├── store.ts                    read/write data/queue.json (atomic tmp+rename)
│   ├── derive.ts                   auto-items from collector snapshots (pure)
│   └── merge.ts                    curated ∪ derived, dedupe by stable derived ids (pure)
└── launch/
    ├── plan.ts                     (projectId, prompt, terminal) → LaunchPlan {files, argv} (pure, testable)
    ├── warpConfig.ts               LaunchPlan → launch-config YAML string (pure)
    └── spawn.ts                    writes files, spawns process; the ONLY impure module
```

### 4.3 Config & data files

- `data/queue.json`: curated queue, committed. Seeded from the 2026-07-08 sweep owner actions.
- `data/sites.json`: site card registry `[{id, label, url}]`, committed. Initial: aetherbloom, topsnip, mindward. Portfolio added when deployed.
- `data/projects-extra.json`: repos outside `~/Projects/` to include in the grid: `["C:\\Users\\surya\\topsnip-web"]`.
- `public/shots/<siteId>.png`: screenshot cache, gitignored.
- Excluded from project grid: `_archive`, `_parked`, `sessions`, `reference`, `Nikunj's Vault`, non-git folders.

## 5. Data contracts

```ts
export type PulseStatus = 'ok' | 'warn' | 'error' | 'unknown'

export interface SiteCard {
  id: string; label: string; url: string
  screenshotPath: string | null      // '/shots/aetherbloom.png'
  capturedAt: string | null          // ISO
  httpStatus: number | null
  responseMs: number | null
  status: PulseStatus                // ok=2xx/3xx; warn=4xx or shot >24h stale; error=5xx/timeout
}

export interface N8nWorkflowHealth {
  id: string; name: string; active: boolean
  lastExecution: { id: string; status: 'success'|'error'|'running'|'waiting'
                   startedAt: string; errorMessage?: string } | null
}
export interface N8nPulse {
  reachable: boolean
  workflows: N8nWorkflowHealth[]
  recentErrors: Array<{ workflowId: string; workflowName: string
                        executionId: string; startedAt: string; message: string }>
}

export interface ProjectPulse {
  id: string                          // V1 node id convention: 'project-<kebab>'
  label: string; path: string
  git: { branch: string; dirty: number; ahead: number; behind: number
         lastCommitAt: string | null } | null   // null = not a git repo (excluded from grid)
  status: PulseStatus                 // warn if dirty>0 or ahead>0; ok otherwise
}

export interface QueueItem {
  id: string                          // curated: 'q-<slug>'; derived: '<source>:<stableKey>'
  title: string
  projectId: string | null
  kind: 'owner-action' | 'claude-task' | 'incident'
  source: 'curated' | 'git' | 'n8n' | 'site'
  detail: string                      // markdown
  promptSeed: string                  // pre-draft for PromptComposer
  createdAt: string
  status: 'open' | 'done' | 'dismissed'
}

export interface LaunchRequest {
  projectId: string                   // must resolve via known-projects allowlist
  prompt: string                      // 1..20_000 chars
  terminal?: 'warp' | 'wt'            // default 'warp'
}
```

**n8n endpoints used (read-only):** `GET /api/v1/workflows?active=true` and `GET /api/v1/executions?limit=40` (filtered client-side per workflow; error executions additionally fetched with `status=error&limit=20`). Auth header `X-N8N-API-KEY`. Key never reaches the browser: all n8n calls are server-side; `N8nPulse` contains no secrets.

**Derived queue rules (`derive.ts`, pure):**
- n8n error execution → `incident`, id `n8n:<workflowId>` (latest error only, so one card per workflow).
- Site status `error` → `incident`, id `site:<siteId>`.
- Project `dirty>0 || ahead>0` → `claude-task` "commit/push stranded work", id `git:<projectId>`.
- Derived items whose condition has cleared disappear on next merge. A curated/derived id collision prefers curated. `done/dismissed` derived ids are remembered in `queue.json` under `suppressed[]` so dismissing sticks until the underlying stableKey changes.

## 6. Click-to-work launch flow

1. UI: DetailDrawer → PromptComposer seeds from `promptSeed`, user edits, picks terminal (default Warp), hits Start.
2. `POST /api/launch` validates: projectId resolves to a real allowlisted directory (the project-grid set + `projects-extra.json`); prompt length bounds; terminal enum.
3. `plan.ts` produces a `LaunchPlan`: prompt written to `data/launch/<timestamp>-<projectId>.md` (gitignored); the command **always receives the prompt via file read, never via string interpolation into a shell line built from user input**.
4. Warp path: write YAML to `%APPDATA%\warp\Warp\launch_configurations\atlas.yaml` (create dir if absent) with `cwd` = project path and a command that starts `claude` with the prompt file's content as a single argv (exact shell incantation is an implementation detail behind `plan.ts`, verified by the dry-run tests + one live launch). Then spawn `start warp://launch/atlas.yaml` (or config-name form, whichever the installed Warp accepts; determined empirically in Phase B and locked in a comment + test fixture).
5. `wt` fallback: `wt -d <projectPath> pwsh -NoExit -Command "claude (Get-Content -Raw '<promptFile>')"`. Same file-passing rule.
6. Response: `{launched: true, terminal, promptFile}`. UI toasts and marks the queue item `in-flight` visually (client-side only; no new status enum).

Failure behavior: spawn error → 502 with the raw error message surfaced in the drawer; the prompt file is kept so nothing typed is ever lost.

## 7. Security

- Dev server binds loopback only: `next dev -H 127.0.0.1` in `package.json`.
- `/api/launch` is the only process-spawning route. It never accepts a path or a command: only an allowlisted `projectId`, a prompt (written to file), and a terminal enum. `spawn.ts` uses argv arrays (`shell:false`) except the `start`-URI hop, which contains no user-controlled bytes.
- n8n API key stays server-side (see §5). Screenshot capture runs only against URLs from the committed `data/sites.json`, never from request input.
- CSRF surface accepted as-is for V1-style localhost single-user use; mitigated by loopback bind + no cookies + JSON-only bodies.

## 8. Visual direction (taste gate): process, not prescription

Deliberately not specified here. Phase C runs the taste loop agreed on 2026-07-08:

1. With the skeleton live on real data, produce **three rendered visual directions** of the same dashboard (not palette swaps, three genuinely different attitudes, e.g. instrument-cluster minimal / editorial almanac (aetherbloom kinship) / dense ops-console). Each is a real screen, screenshotted and saved to `Projects/sessions/2026-07-09-mission-control-v2/`.
2. `fable-lens`, `frontend-design`, and `dataviz` skills are mandatory inputs to Phase C work.
3. Surya picks one and says one sentence why; the pick + reason is saved as a taste memory; the losing directions are deleted, not maintained.
4. Constraints that hold regardless of direction: dark-first cockpit; readable at 1280×800; status colors must remain distinguishable (ok/warn/error) for scanning at a glance; screenshots are the visual heroes of the site zone; no more than two typefaces.

## 9. Edge cases & failure modes

| Case | Behavior |
| --- | --- |
| n8n unreachable | `N8nPulse.reachable=false`; rail shows "n8n down" as its own incident; no crash, no retry storm (TTL cache holds last good + `staleSince`). |
| n8n key missing/rotated | Same as unreachable but message names the fix (`~/.claude.json` key). |
| Chrome not found | Try Edge (`msedge.exe`, guaranteed on Win11). Both missing → cards render health-only with a "no capture engine" note. Never attempt bundled Chromium (Device Guard blocks it). |
| Screenshot capture fails/times out (30s cap) | Keep last good shot + `capturedAt`; card shows stale badge. |
| Site down | Card → error state; derived `site:` incident appears in queue. |
| Repo git call exceeds 4s | That project renders `unknown` status; logged; others unaffected (per-repo isolation, concurrency cap 6). |
| Warp not installed / URI launch fails | Automatic fallback to `wt`; if that also fails, 502 + drawer shows error + prompt file path. |
| Prompt contains quotes/newlines/unicode | Irrelevant by construction: prompt travels by file (§6.3). Covered by fixture tests. |
| `queue.json` malformed | Back up to `queue.json.bad-<ts>`, start with empty curated set + visible warning banner. |
| Two dashboard tabs open | Collector TTL cache makes polling cheap; queue writes atomic via tmp+rename; last writer wins (single human user). |
| Dev server not running | Nothing works, by design. `npm run dev` is the on-switch. (Auto-start on boot = V3 candidate, out of scope.) |

## 10. Testing strategy

Same philosophy as V1: pure logic gets unit tests, visuals get eyeballs, side effects get one live manual verification each.

| Area | Approach | ~Count |
| --- | --- | --- |
| `gitStatus` parse (porcelain v1 + branch header → counts) | pure fixtures incl. detached HEAD, renames, clean | 6 |
| `n8n.ts` shaping (fixture JSON → N8nPulse, error extraction) | mock fetch | 5 |
| `sites.ts` status mapping (2xx/4xx/5xx/timeout/stale-shot) | mock fetch + fake clock | 5 |
| `queue/derive.ts` + `merge.ts` (rules in §5, suppression, collisions) | pure | 8 |
| `launch/plan.ts` + `warpConfig.ts` (allowlist reject, path traversal reject, YAML shape, argv shape, prompt-file contract) | pure / dry-run | 7 |
| API routes: queue GET merge, PATCH, launch POST validation | integration w/ fixtures, spawn mocked | 5 |
| **New total** | | **~36** |

Existing 44 V1 tests must keep passing (constellation untouched except relocation; `app/map/page.tsx` re-export keeps AtlasRoot imports stable).

Not tested: actual Warp/wt spawn (one live verification each, §3.5), screenshot pixel output (eyeball), polling timers (trivial), components.

## 11. Build plan

**Phase A: collectors & contracts (no UI change).** types → n8nAuth+n8n → gitStatus → sites+screenshot → cache → queue store/derive/merge → API routes → tests green. Ends: `curl` of each route returns real machine data.

**Phase B: skeleton + launch (ugly on purpose).** Relocate constellation to `/map` → DashboardRoot + four zones with unstyled real data → DetailDrawer + PromptComposer → launch route + `plan/warpConfig/spawn` → **live launch verified in Warp and wt** → seed `data/queue.json` from sweep owner-actions. Ends: the whole loop works end-to-end, looks like a wireframe.

**Phase C: taste gate + polish.** Three rendered directions → Surya picks → apply direction across all zones → fable-lens pass → empty states, loading states, keyboard niceties (`/` focus queue, `Esc` closes drawer) → final test + visual sweep.

Each phase ends with a commit on `v2-mission-control`; merge to main only after Phase C acceptance.

## 12. Acceptance checklist

- [ ] Dashboard at `/` shows all four zones with real data; constellation intact at `/map`
- [ ] All three site cards show fresh screenshots + latency; kill-test one site → error state
- [ ] Force-fail an n8n workflow → incident rail entry with error text within 60s
- [ ] Dirty repo → flagged in grid AND appears as derived queue item; clean it → item disappears
- [ ] Queue item → drawer → edit prompt → Start in Warp → Warp opens in project dir, claude running edited prompt
- [ ] Same flow with `wt` fallback verified once
- [ ] `data/queue.json` seeded with sweep owner-actions; done/dismiss persists across reload
- [ ] ~80 tests pass (`npm test`); no console errors on load
- [ ] Direction picked by Surya applied everywhere; taste memory saved
