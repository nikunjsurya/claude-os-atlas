# claude OS atlas V2: mission control

**Status:** Approved (reviewer pass 3)
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
- No auth, no NEW public surface (the existing snapshot build stays constellation-only, §4.4), no mobile layout (min viewport 1280×800, same as V1).
- No writes to n8n (read-only API usage), no editing of memory/vault files from the UI.
- Queue "done/dismiss" state changes are allowed (writes only to the gitignored `data/queue-state.json`); nothing else on disk is mutated by the UI except screenshot cache and launch artifacts.
- Public mode stays read-only constellation. `NEXT_PUBLIC_ATLAS_MODE === 'public'` builds render the sanitized snapshot exactly as V1 does today, and none of the V2 surfaces exist there (see §4.4).
- No new graph features on the constellation.

## 3. Success criteria

1. `npm run dev` → `localhost:3000` renders the mission-control dashboard with **real data in all four zones** (sites, n8n, projects, queue) in under 4s on a warm disk.
2. Site cards show actual captured screenshots of aetherbloom.com, topsnip.co, and mindward-web.vercel.app, each with HTTP status + response time; a dead site visibly degrades to an error state.
3. Killing/failing an n8n workflow surfaces it in the incident rail within one poll cycle (≤60s), with the execution error message visible.
4. Every project with uncommitted or unpushed work is visibly flagged in the project grid.
5. Clicking a queue item opens a detail drawer with status context and an **editable** prompt; "Start in Warp" opens Warp in the right directory with `claude` running the edited prompt. Verified live at least once against Warp and once against the `wt` fallback.
6. The constellation still fully works at `/map`; all existing tests (49 at time of writing) plus the new suite (~42) pass.
7. Surya has picked one of three rendered visual directions (taste gate, §8) and the shipped dashboard follows it.

## 4. Architecture

### 4.1 Stack deltas from V1

No re-platforming. Next.js 15 App Router + TS + Tailwind 4 + zustand + vitest, exactly as V1. New server-side dependencies: none beyond Node built-ins (`child_process`, `fs`): n8n polling uses `fetch`, screenshots shell out to installed Chrome/Edge, git via `git -C`. Keep it dependency-light on purpose.

**Note:** repo AGENTS.md warns this Next.js version differs from training data. Implementers must read the relevant guides in `node_modules/next/dist/docs/` before writing route handlers or layout code.

### 4.2 Route & component tree (new/changed only)

```
app/
├── page.tsx                        local mode: mission control dashboard; public mode: V1 constellation (unchanged)
├── map/page.tsx                    constellation, extracted into a shared component used by both routes
└── api/
    ├── atlas/route.ts              unchanged (feeds /map)
    ├── pulse/
    │   ├── sites/route.ts          GET  → SiteCard[] (health live, screenshot meta from cache)
    │   ├── sites/refresh/route.ts  POST → recapture screenshots (async kick, returns 202)
    │   ├── n8n/route.ts            GET  → N8nPulse
    │   └── projects/route.ts       GET  → ProjectPulse[]
    ├── queue/
    │   ├── route.ts                GET only (merged curated+derived); curated items are hand-edited in data/queue.json, no POST endpoint
    │   └── [id]/route.ts           PATCH → {status: done|dismissed|open}, writes queue-state.json
    └── launch/route.ts             POST → validate, write prompt file + Warp launch config, spawn

components/dashboard/
├── DashboardRoot.tsx               client root, zustand; poll cadence: n8n 30s, sites+queue 60s, projects 120s, plus refetch on tab focus and after mutations
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
│   ├── store.ts                    reads data/queue.json (curated, committed); reads/writes data/queue-state.json (runtime, gitignored, atomic tmp+rename)
│   ├── derive.ts                   auto-items from collector snapshots (pure)
│   └── merge.ts                    curated ∪ derived, dedupe by stable derived ids (pure)
└── launch/
    ├── plan.ts                     (projectId, prompt, terminal) → LaunchPlan {files, argv} (pure, testable)
    ├── warpConfig.ts               LaunchPlan → launch-config YAML string (pure)
    └── spawn.ts                    writes files, spawns process; the only impure lib/ module

scripts/
└── launch-claude.mjs               launch shim: reads prompt file, spawns claude with content
                                    as one argv (shell:false, stdio inherit); impure by design
```

### 4.3 Config & data files

- `data/queue.json`: curated queue, committed. Seeded from the 2026-07-08 sweep owner actions (source: `Projects/sessions/2026-07-08-optimization-sweep/SUMMARY.md`).
- `data/queue-state.json`: runtime state (status overrides + `suppressed[]`), gitignored. Keeps the atlas repo clean so the dashboard never flags itself over its own runtime writes.
- `data/sites.json`: site card registry `[{id, label, url}]`, committed. Initial: aetherbloom, topsnip, mindward. Portfolio added when deployed.
- `data/projects-extra.json`: repos outside `~/Projects/` to include in the grid: `["C:\\Users\\surya\\topsnip-web"]`.
- `public/shots/<siteId>.png`: screenshot cache, gitignored.
- Excluded from project grid: `_archive`, `_parked`, `sessions`, `reference`, `Nikunj's Vault`, non-git folders.

### 4.4 Public mode (Vercel snapshot build)

The repo already ships a public mode (`NEXT_PUBLIC_ATLAS_MODE === 'public'`: sanitized `data/atlas-snapshot.json` via `lib/publicMode.ts`, built by `npm run snapshot`). V2 changes nothing about it and must not leak into it:

- Public `/` keeps rendering the sanitized constellation exactly as today. The dashboard is local-only by construction.
- Every V2 route (`/api/pulse/*`, `/api/queue*`, `/api/launch`, `/api/session-token`) returns 404 in public mode via one shared guard helper, unit-tested. A public deploy must never expose a process-spawning endpoint.
- `/map` exists in both modes and renders the same extracted constellation component.

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
         lastCommitAt: string | null } | null   // null = the git call failed/timed out (status 'unknown'); non-git folders never appear at all
  status: PulseStatus                 // warn if dirty>0 or ahead>0; unknown iff git === null; ok otherwise ('error' reserved, never emitted in V2)
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

**n8n endpoints used (read-only):** `GET /api/v1/workflows?active=true` and `GET /api/v1/executions?limit=40` (filtered per workflow inside the collector, server-side; error executions additionally fetched with `status=error&limit=20`). Auth header `X-N8N-API-KEY`. Key never reaches the browser: all n8n calls are server-side; `N8nPulse` contains no secrets.

**Derived queue rules (`derive.ts`, pure):**
- n8n workflow whose LATEST execution errored (`lastExecution.status === 'error'`) → `incident`, id `n8n:<workflowId>`, one card per workflow. A newer successful run clears the incident (and prunes its suppression); the rail's `recentErrors` follows the same latest-run rule.
- Site status `error` → `incident`, id `site:<siteId>`.
- Project `dirty>0 || ahead>0` → `claude-task` "commit/push stranded work", id `git:<projectId>`.
- Derived items whose condition has cleared disappear on next merge. A curated/derived id collision prefers curated.
- Dismissing a derived item writes `{id, stateKey}` to `suppressed[]` in `queue-state.json`. A derived item is hidden iff both id AND stateKey match. stateKeys: n8n → the error `executionId` (a new, distinct error execution resurfaces); site → `<httpStatus>:<UTC day>` (a still-dead site resurfaces the next day); git → branch name (condition-clearing covers the rest: repo going clean prunes the entry, going dirty again resurfaces it).
- `suppressed[]` entries whose id is absent from the current derivation are pruned on merge, so a suppression can never outlive the incident it silenced.

**Screenshot lifecycle:** `GET /api/pulse/sites` never blocks on capture. It kicks a background capture (single-flight per site) for any site whose shot is missing or older than 6h, and returns the current cache immediately; the 60s client poll picks up fresh shots as they land, which also covers first population on a fresh checkout. Shots older than 24h mark the card `warn` (stale badge). `POST /api/pulse/sites/refresh` is the manual force-recapture.

## 6. Click-to-work launch flow

1. UI: DetailDrawer → PromptComposer seeds from `promptSeed`, user edits, picks terminal (default Warp), hits Start.
2. `POST /api/launch` validates: projectId resolves to a real allowlisted directory (the project-grid set + `projects-extra.json`); prompt length bounds; terminal enum.
3. `plan.ts` produces a `LaunchPlan`: prompt written to `data/launch/<timestamp>-<projectId>.md` (gitignored); the command **always receives the prompt via file read, never via string interpolation into a shell line built from user input**.
4. Warp path: write YAML to the Warp launch-config location (believed `%APPDATA%\warp\Warp\launch_configurations\atlas.yaml`; the directory, the accepted `warp://launch/...` form, AND the shell Warp runs commands under are all determined empirically in ONE Phase B step, then locked in a code comment + test fixture; create dir if absent) with `cwd` = project path and the command `node <repoPath>\scripts\launch-claude.mjs <promptFile>`. The shim reads the prompt file and spawns `claude` with the content as a single argv via Node `child_process` (`shell:false`), inheriting stdio so the session stays interactive. Node owns Windows argv escaping, so embedded quotes/newlines/unicode survive intact, and the visible command line contains only space-free absolute paths written with FORWARD slashes (valid for Node on Windows in every shell, and immune to POSIX-shell backslash eating if Warp's shell turns out to be Git Bash/WSL). Gotcha the shim must handle: an npm-global `claude` resolves to a `.cmd` shim, and Node `child_process` with `shell:false` refuses to spawn `.cmd`/`.bat` (EINVAL, post-CVE-2024-27980); the shim must resolve claude's real target (native `claude.exe`, or `node <cli.js>`) rather than fall back to `shell:true`, which would reintroduce cmd.exe marshalling.
5. `wt` fallback: `wt -d <projectPath> node <repoPath>\scripts\launch-claude.mjs <promptFile>`. Same shim, same guarantees, no PowerShell in the loop: Windows PowerShell 5.1's native-arg quote mangling is exactly why the shim exists, and `pwsh` must never be assumed present.
6. Response: `{launched: true, terminal, promptFile}`. UI toasts and marks the queue item `in-flight` visually (client-side only; no new status enum).

Failure behavior: spawn error → 502 with the raw error message surfaced in the drawer; the prompt file is kept so nothing typed is ever lost.

## 7. Security

- Dev server binds loopback only: `next dev -H 127.0.0.1` in `package.json`.
- **Mutating-route guard (blocking requirement).** Loopback binding does NOT stop drive-by requests: any web page the browser visits can fire a no-preflight POST at `127.0.0.1:3000` (text/plain body, no cookies needed), and DNS rebinding is a second path. A forged `/api/launch` would open a full-autonomy `claude` session on an attacker-authored prompt: that is remote code execution. Every mutating route (`/api/launch`, `/api/pulse/sites/refresh`, `PATCH /api/queue/[id]`) therefore passes one shared guard enforcing ALL of: (1) `Host` is `127.0.0.1` or `localhost`; (2) `Origin`, when present, is the same localhost origin; (3) `Content-Type` is exactly `application/json`; (4) a per-boot random token, generated server-side at startup, fetched by the UI from same-origin `GET /api/session-token` (unreadable cross-origin under the same-origin policy) and echoed in an `X-Atlas-Token` header. The guard is unit-tested: each leg rejected independently.
- `/api/launch` is the only route that spawns a process influenced by request input (`sites/refresh` spawns Chrome and `pulse/projects` spawns git, but only against committed config). It never accepts a path or a command: only an allowlisted `projectId`, a prompt (written to file), and a terminal enum. `spawn.ts` uses argv arrays (`shell:false`) except the `start`-URI hop, which contains no user-controlled bytes.
- n8n API key stays server-side (see §5). Screenshot capture runs only against URLs from the committed `data/sites.json`, never from request input.
- All V2 routes return 404 in public mode (§4.4).
- `GET /api/pulse/sites` sits outside the mutating guard yet kicks background captures. Accepted deliberately: the side effect is bounded by design (single-flight per site, 6h staleness gate, URLs only from committed `data/sites.json`), so a drive-by GET can at worst refresh a screenshot that was already due.

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
| Prompt contains quotes/newlines/unicode | Prompt travels by file (§6 step 3) and becomes a single argv inside the Node shim, never marshalled by PowerShell 5.1 (whose native-arg passing mangles embedded quotes). Shim has an argv-fidelity test via a child echo script; Phase B live verification MUST use a torture prompt (embedded double quotes, newlines, unicode). The 20k prompt cap keeps realistic prompts well under the 32k Windows limit even with escaping overhead (worst-case adversarial doubling is accepted for a single-user tool). |
| `queue.json` / `queue-state.json` malformed | Back up to `<name>.bad-<ts>`, continue with empty curated set / fresh runtime state + visible warning banner. |
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
| Mutating-route guard (§7): each leg rejected independently + public-mode 404 | integration, spawn mocked | 5 |
| Launch shim argv fidelity (child echo process: quotes/newlines/unicode) | integration | 1 |
| **New total** | | **~42** |

All existing tests must keep passing (49 at time of writing; the V1 spec's "44" drifted upward during implementation). The constellation page is extracted into one shared component: `app/map/page.tsx` renders it in both modes, and public-mode `/` keeps rendering it exactly as today. Extraction, not duplication.

Not tested: actual Warp/wt spawn (one live verification each, §3.5), screenshot pixel output (eyeball), polling timers (trivial), components.

## 11. Build plan

**Phase A: collectors & contracts (no UI change).** types → n8nAuth+n8n → gitStatus → sites+screenshot → cache → queue store/derive/merge → mutating-route guard + public-mode 404 helper → API routes → tests green. Ends: `curl` of each route returns real machine data.

**Phase B: skeleton + launch (ugly on purpose).** Extract the constellation page into a shared component rendered at `/map` (and by public-mode `/`) → DashboardRoot + four zones with unstyled real data → DetailDrawer + PromptComposer → launch route + `plan/warpConfig/spawn` + `scripts/launch-claude.mjs` shim → **live launch verified in Warp and wt with a torture prompt (quotes + newlines + unicode)** → seed `data/queue.json` from sweep owner-actions. Ends: the whole loop works end-to-end, looks like a wireframe.

**Phase C: taste gate + polish.** Three rendered directions → Surya picks → apply direction across all zones → fable-lens pass → empty states, loading states, keyboard niceties (`/` focus queue, `Esc` closes drawer) → final test + visual sweep.

Each phase ends with a commit on `v2-mission-control`; merge to main only after Phase C acceptance.

## 12. Acceptance checklist

- [ ] Dashboard at `/` shows all four zones with real data; constellation intact at `/map`
- [ ] All three site cards show fresh screenshots + latency; kill-test one site → error state
- [ ] Force-fail an n8n workflow → incident rail entry with error text within 60s
- [ ] Dirty repo → flagged in grid AND appears as derived queue item; clean it → item disappears
- [ ] Queue item → drawer → edit prompt → Start in Warp → Warp opens in project dir, claude running edited prompt (with the §11 torture prompt)
- [ ] Same flow with `wt` fallback verified once (with the §11 torture prompt)
- [ ] `data/queue.json` seeded with sweep owner-actions; done/dismiss persists across reload
- [ ] Full suite passes (`npm test`): all pre-existing tests plus ~42 new; no console errors on load
- [ ] Guard verified: cross-origin/tokenless POST to `/api/launch` rejected (tested); public-mode build 404s every V2 route
- [ ] Direction picked by Surya applied everywhere; taste memory saved
