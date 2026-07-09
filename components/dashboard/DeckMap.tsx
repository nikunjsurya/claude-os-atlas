// The system map on the deck: the same Obsidian-parameter constellation
// as /map, reskinned to flight-deck law. Everything is a faint star;
// the only lit nodes are the ones carrying work (amber, gently pulsing,
// matching the queue). Click a lit project to open its drawer; click
// anything else to go to the full map. Ambient, but an instrument:
// it shows WHERE in the system's shape the pending work sits.

'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AtlasResponse, ProjectPulse, QueueItem } from '@/lib/types'

// next/dynamic does NOT forward refs; without this wrapper the imperative
// handle (d3Force, zoomToFit) is silently null and the graph runs on
// default d3 forces at default zoom. Pass the ref as a plain prop.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(
  async () => {
    const mod = await import('react-force-graph-2d')
    const FG = mod.default as React.ComponentType<Record<string, unknown>>
    function ForceGraphWithRef({
      fgRef,
      ...props
    }: Record<string, unknown> & { fgRef: React.Ref<unknown> }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return <FG ref={fgRef as any} {...props} />
    }
    return ForceGraphWithRef
  },
  { ssr: false }
) as unknown as React.ComponentType<Record<string, unknown>>

// Obsidian's force defaults, same numbers as ConstellationCanvas.
const OBSIDIAN_CENTER_STRENGTH = 0.48
const OBSIDIAN_REPEL_STRENGTH = 16.41
const OBSIDIAN_LINK_STRENGTH = 0.44
const OBSIDIAN_LINK_DISTANCE = 198

const AMBER = { r: 232, g: 163, b: 61 } // --deck-amber
const DIM = { r: 92, g: 100, b: 112 } // --deck-dim
const FAINT = { r: 57, g: 65, b: 77 } // --deck-faint

interface GraphNode {
  id: string
  label: string
  kind: string
  size?: number
  x?: number
  y?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ForceGraphRef = any

// Force-graph link endpoints become node objects after ingestion.
function idOf(endpoint: unknown): string {
  if (typeof endpoint === 'string') return endpoint
  if (endpoint && typeof endpoint === 'object' && 'id' in endpoint) {
    const id = (endpoint as { id?: unknown }).id
    if (typeof id === 'string') return id
  }
  return ''
}

function linkKey(l: { source: unknown; target: unknown }): string {
  return `${idOf(l.source)}|${idOf(l.target)}`
}

export default function DeckMap({
  projects,
  queueItems,
  onSelectProject,
  focusId,
  onFocus,
}: {
  projects: ProjectPulse[] | null
  queueItems: QueueItem[] | null
  onSelectProject: (project: ProjectPulse) => void
  focusId: string | null
  onFocus: (id: string | null) => void
}) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fgRef = useRef<ForceGraphRef>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [atlas, setAtlas] = useState<AtlasResponse | null>(null)
  const hoveredIdRef = useRef<string | null>(null)
  const focusIdRef = useRef<string | null>(null)
  focusIdRef.current = focusId
  // Launch ripples: projectId -> start timestamp. Drawn for ~1.6s.
  const ripplesRef = useRef<Map<string, number>>(new Map())
  const reducedMotionRef = useRef(false)
  // Ambient mode (opt-in, experimental): slow clockwise drift + a soft
  // breathing light at the constellation's center. Off by default; the
  // deck's law is stillness, and this is the one sanctioned exception.
  const [ambient, setAmbient] = useState(false)
  const ambientRef = useRef(false)
  ambientRef.current = ambient
  const engineStoppedRef = useRef(false)
  // Hover card: content id + screen position; visibility drives the
  // 150ms fade/rise so the card animates out instead of vanishing.
  const [tooltip, setTooltip] = useState<{ id: string; x: number; y: number } | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
  }, [])

  // A launched session answers with a ripple at its node: the map shows
  // WHERE work just started. Causality, not decoration.
  useEffect(() => {
    const onLaunched = (e: Event) => {
      const id = (e as CustomEvent<{ projectId?: string }>).detail?.projectId
      if (id && !reducedMotionRef.current) {
        ripplesRef.current.set(id, performance.now())
      }
    }
    window.addEventListener('atlas:launched', onLaunched)
    return () => window.removeEventListener('atlas:launched', onLaunched)
  }, [])

  useEffect(() => {
    fetch('/api/atlas')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setAtlas(body as AtlasResponse | null))
      .catch(() => setAtlas(null))
  }, [])

  // NOTE: the react-force-graph ref handle has NO graphData() method; the
  // library mutates the node objects we passed in, so graphData.nodes in
  // this scope IS the live simulation state. Optional chaining on a
  // nonexistent method silently no-ops; never reach for fg.graphData().

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver(() =>
      setSize({ width: el.clientWidth, height: el.clientHeight })
    )
    ro.observe(el)
    setSize({ width: el.clientWidth, height: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Nodes carrying work: open queue items' projects + warn repos.
  const hotIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of queueItems ?? []) {
      if (item.status === 'open' && item.projectId) ids.add(item.projectId)
    }
    for (const p of projects ?? []) {
      if (p.git && (p.git.dirty > 0 || p.git.ahead > 0)) ids.add(p.id)
    }
    return ids
  }, [queueItems, projects])

  const pulseById = useMemo(() => {
    const m = new Map<string, ProjectPulse>()
    for (const p of projects ?? []) m.set(p.id, p)
    return m
  }, [projects])

  const graphData = useMemo(() => {
    if (!atlas) return { nodes: [] as GraphNode[], links: [] }
    return {
      nodes: atlas.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        kind: n.kind,
        size: n.size,
      })) as GraphNode[],
      links: atlas.edges.map((e) => ({ source: e.source, target: e.target })),
    }
  }, [atlas])

  // Obsidian's addictive hover: the focus node and its neighbors hold
  // full presence while everything else melts back, lerped per frame
  // (tau ~90ms, same constant as ConstellationCanvas).
  const neighborsOf = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const l of graphData.links as Array<{ source: unknown; target: unknown }>) {
      const s = idOf(l.source)
      const t = idOf(l.target)
      if (!m.has(s)) m.set(s, new Set())
      if (!m.has(t)) m.set(t, new Set())
      m.get(s)!.add(t)
      m.get(t)!.add(s)
    }
    return m
  }, [graphData])

  const nodeById = useMemo(() => {
    const m = new Map<string, GraphNode>()
    for (const n of graphData.nodes) m.set(n.id, n)
    return m
  }, [graphData])

  const nodeAlphaRef = useRef<Map<string, number>>(new Map())
  const linkAlphaRef = useRef<Map<string, number>>(new Map())
  const lastFrameRef = useRef<number>(performance.now())

  // Synapse bolts (ambient): a jagged arc fires along a real edge near the
  // center every few seconds; the center light flashes with it.
  const boltRef = useRef<{
    sourceId: string
    targetId: string
    born: number
    jitter: number[]
  } | null>(null)
  const nextBoltAtRef = useRef(0)
  const glowBoostRef = useRef(0)

  // Dev/e2e hook: page-space screen position of a node, so demos and
  // future e2e tests can hover exact stars instead of guessing pixels.
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__deckMapNodeScreen = (
      id: string
    ) => {
      const n = graphData.nodes.find((x) => x.id === id)
      if (!n || typeof n.x !== 'number' || typeof n.y !== 'number') return null
      const local = fgRef.current?.graph2ScreenCoords?.(n.x, n.y)
      const canvas = containerRef.current?.querySelector('canvas')
      if (!local || !canvas) return null
      const rect = canvas.getBoundingClientRect()
      return { x: rect.left + local.x, y: rect.top + local.y }
    }
    return () => {
      delete (window as unknown as Record<string, unknown>).__deckMapNodeScreen
    }
  }, [graphData])

  // Apply Obsidian force params once the simulation exists (same retry
  // pattern as ConstellationCanvas).
  useEffect(() => {
    const fg = fgRef.current
    if (!fg || graphData.nodes.length === 0) return
    let cancelled = false
    const apply = () => {
      if (cancelled) return
      const center = fg.d3Force?.('center')
      const charge = fg.d3Force?.('charge')
      const link = fg.d3Force?.('link')
      if (!center && !charge && !link) {
        requestAnimationFrame(apply)
        return
      }
      charge?.strength(-OBSIDIAN_REPEL_STRENGTH * 10)
      link?.strength(OBSIDIAN_LINK_STRENGTH)
      link?.distance(OBSIDIAN_LINK_DISTANCE)
      center?.strength(OBSIDIAN_CENTER_STRENGTH)
      fg.d3ReheatSimulation?.()
    }
    apply()
    return () => {
      cancelled = true
    }
  }, [graphData])

  // Frame the CONNECTED web (plus hot orphans), not the whole node set:
  // ~half the atlas nodes are unlinked, and repulsion pushes them into a
  // wide ring that zoomToFit would frame, crushing the actual web into an
  // unreadable knot in the middle. Obsidian reads "connected" because its
  // camera lives on the web; ours does too. Orphans drift at the margins.
  const fitToWeb = () => {
    const el = containerRef.current
    const fg = fgRef.current
    if (!el || !fg) return
    const keep = graphData.nodes.filter(
      (n) =>
        typeof n.x === 'number' &&
        typeof n.y === 'number' &&
        ((neighborsOf.get(n.id)?.size ?? 0) > 0 || hotIds.has(n.id))
    )
    if (keep.length < 2) {
      fg.zoomToFit?.(300, 24)
      return
    }
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const n of keep) {
      minX = Math.min(minX, n.x!)
      maxX = Math.max(maxX, n.x!)
      minY = Math.min(minY, n.y!)
      maxY = Math.max(maxY, n.y!)
    }
    const pad = 60
    const zoom = Math.min(
      el.clientWidth / (maxX - minX + pad),
      el.clientHeight / (maxY - minY + pad),
      3
    )
    fg.centerAt?.((minX + maxX) / 2, (minY + maxY) / 2, 300)
    fg.zoom?.(zoom, 300)
  }
  const fitToWebRef = useRef(fitToWeb)
  fitToWebRef.current = fitToWeb

  // Re-frame repeatedly while the simulation cools instead of waiting
  // for engine stop (Obsidian distances start mostly out of frame here).
  useEffect(() => {
    if (graphData.nodes.length === 0) return
    const timers = [600, 1600, 3200, 6000, 9000].map((ms) =>
      setTimeout(() => fitToWebRef.current(), ms)
    )
    return () => timers.forEach(clearTimeout)
  }, [graphData])

  // Ambient drift: once the simulation has settled, rotate every node
  // around the constellation's centroid, one revolution every 2.5 minutes.
  // Pauses while a node is hovered (so tooltips hold still) and under
  // prefers-reduced-motion. Node coords stay truthful, so hit-testing,
  // edges, and ripples all follow the drift for free.
  useEffect(() => {
    if (!ambient || reducedMotionRef.current) return
    const ROTATION_PERIOD_MS = 150_000
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = now - last
      last = now
      if (engineStoppedRef.current && !hoveredIdRef.current) {
        const nodes = graphData.nodes
        let cx = 0
        let cy = 0
        let count = 0
        for (const node of nodes) {
          if (typeof node.x === 'number' && typeof node.y === 'number') {
            cx += node.x
            cy += node.y
            count++
          }
        }
        if (count > 0) {
          cx /= count
          cy /= count
          const dTheta = (2 * Math.PI * dt) / ROTATION_PERIOD_MS
          const cos = Math.cos(dTheta)
          const sin = Math.sin(dTheta)
          for (const node of nodes) {
            if (typeof node.x !== 'number' || typeof node.y !== 'number') continue
            const dx = node.x - cx
            const dy = node.y - cy
            node.x = cx + dx * cos - dy * sin
            node.y = cy + dx * sin + dy * cos
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ambient, graphData])

  // The container must ALWAYS mount: the ResizeObserver effect runs once
  // on mount, and an early-return loading branch would leave it observing
  // nothing (size stuck at 0, no canvas ever). Loading is an overlay.
  return (
    <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing">
      {graphData.nodes.length === 0 && (
        <div className="flex h-full items-center justify-center font-mono text-xs text-deck-dim">
          charting the system…
        </div>
      )}
      {size.width > 0 && size.height > 0 && graphData.nodes.length > 0 && (
        <ForceGraph2D
          fgRef={fgRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          nodeId="id"
          enableNodeDrag={true}
          autoPauseRedraw={false}
          d3AlphaDecay={0.012}
          d3VelocityDecay={0.32}
          cooldownTime={8000}
          warmupTicks={40}
          nodeRelSize={5}
          onEngineStop={() => {
            engineStoppedRef.current = true
            fitToWebRef.current()
          }}
          onRenderFramePre={(ctx: CanvasRenderingContext2D, globalScale: number) => {
            const now = performance.now()
            const dt = Math.min(now - lastFrameRef.current, 100)
            lastFrameRef.current = now
            const k = 1 - Math.exp(-dt / 90)

            // Obsidian neighbor fade: lerp every node/link alpha toward its
            // target given the current focus (hover here or another zone).
            const focus = hoveredIdRef.current ?? focusIdRef.current
            for (const node of graphData.nodes) {
              const target =
                !focus ||
                node.id === focus ||
                neighborsOf.get(focus)?.has(node.id)
                  ? 1
                  : 0.22
              const cur = nodeAlphaRef.current.get(node.id) ?? 1
              nodeAlphaRef.current.set(node.id, cur + (target - cur) * k)
            }
            for (const l of graphData.links as Array<{ source: unknown; target: unknown }>) {
              const incident =
                !!focus && (idOf(l.source) === focus || idOf(l.target) === focus)
              const target = !focus ? 0.22 : incident ? 0.55 : 0.05
              const key = linkKey(l)
              const cur = linkAlphaRef.current.get(key) ?? 0.22
              linkAlphaRef.current.set(key, cur + (target - cur) * k)
            }

            if (!ambientRef.current) return

            let cx = 0
            let cy = 0
            let count = 0
            for (const node of graphData.nodes) {
              if (typeof node.x === 'number' && typeof node.y === 'number') {
                cx += node.x
                cy += node.y
                count++
              }
            }
            if (count === 0) return
            cx /= count
            cy /= count

            // Center light: breathing base, flashing when a synapse fires.
            glowBoostRef.current = Math.max(0, glowBoostRef.current - dt / 600)
            const breath = reducedMotionRef.current
              ? 0.5
              : 0.5 + 0.5 * Math.sin(((Date.now() % 7000) / 7000) * 2 * Math.PI)
            const intensity = 0.1 + 0.07 * breath + 0.22 * glowBoostRef.current
            const radius = 230
            const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
            glow.addColorStop(0, `rgba(110, 132, 168, ${intensity})`)
            glow.addColorStop(1, 'rgba(110, 132, 168, 0)')
            ctx.fillStyle = glow
            ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)

            if (reducedMotionRef.current) return

            // Synapse lightning: every few seconds a jagged arc fires along
            // a real edge near the center. Real connections only.
            const links = graphData.links as Array<{ source: unknown; target: unknown }>
            if (now >= nextBoltAtRef.current && links.length > 0) {
              // Long edges only: the knot's short edges render a bolt at
              // ~15 screen px, which reads as noise, not lightning.
              let best: { sourceId: string; targetId: string } | null = null
              let bestLen = 0
              for (let i = 0; i < 14; i++) {
                const l = links[Math.floor(Math.random() * links.length)]
                const s = nodeById.get(idOf(l.source))
                const t = nodeById.get(idOf(l.target))
                if (!s || !t || typeof s.x !== 'number' || typeof t.x !== 'number') continue
                const len = Math.hypot(t.x - s.x, t.y! - s.y!)
                if (len > bestLen) {
                  bestLen = len
                  best = { sourceId: s.id, targetId: t.id }
                }
              }
              if (best) {
                boltRef.current = {
                  ...best,
                  born: now,
                  jitter: Array.from({ length: 3 }, () => (Math.random() - 0.5) * 26),
                }
                glowBoostRef.current = 1
              }
              nextBoltAtRef.current = now + 2200 + Math.random() * 2600
            }

            const bolt = boltRef.current
            if (bolt) {
              const age = now - bolt.born
              if (age > 280) {
                boltRef.current = null
              } else {
                const s = nodeById.get(bolt.sourceId)
                const t = nodeById.get(bolt.targetId)
                if (s && t && typeof s.x === 'number' && typeof t.x === 'number') {
                  // globalScale is NOT reliably passed to onRenderFramePre
                  // (unlike nodeCanvasObject); dividing by undefined made
                  // every bolt coordinate NaN, and canvas drops NaN paths
                  // silently. zoom() is the trustworthy scale source here.
                  const scale = Math.max(fgRef.current?.zoom?.() ?? 1, 0.05)
                  const progress = age / 280
                  const flicker =
                    0.85 * (1 - progress) * (0.65 + 0.35 * Math.sin(progress * 42))
                  const dx = t.x - s.x
                  const dy = t.y! - s.y!
                  const len = Math.hypot(dx, dy) || 1
                  const px = -dy / len
                  const py = dx / len
                  ctx.save()
                  ctx.strokeStyle = `rgba(186, 205, 234, ${flicker})`
                  ctx.lineWidth = 1.6 / scale
                  ctx.shadowColor = 'rgba(186, 205, 234, 0.9)'
                  ctx.shadowBlur = 14
                  ctx.beginPath()
                  ctx.moveTo(s.x, s.y!)
                  bolt.jitter.forEach((j, i) => {
                    const f = (i + 1) / (bolt.jitter.length + 1)
                    ctx.lineTo(
                      s.x! + dx * f + (px * j) / scale,
                      s.y! + dy * f + (py * j) / scale
                    )
                  })
                  ctx.lineTo(t.x, t.y!)
                  ctx.stroke()
                  // Endpoint sparks so the arc visibly connects two stars.
                  for (const end of [s, t]) {
                    ctx.beginPath()
                    ctx.arc(end.x!, end.y!, 3 / scale, 0, 2 * Math.PI)
                    ctx.fillStyle = `rgba(210, 224, 246, ${flicker})`
                    ctx.fill()
                  }
                  ctx.restore()
                }
              }
            }
          }}
          linkColor={(l: { source: unknown; target: unknown }) =>
            `rgba(150, 160, 175, ${linkAlphaRef.current.get(linkKey(l)) ?? 0.22})`
          }
          linkWidth={(l: { source: unknown; target: unknown }) => {
            // Screen-constant width: zoomToFit runs the camera well below 1,
            // where the old 0.5 graph-unit width rendered subpixel-invisible.
            const zoom = Math.max(fgRef.current?.zoom?.() ?? 1, 0.05)
            const focus = hoveredIdRef.current ?? focusIdRef.current
            const incident =
              !!focus && (idOf(l.source) === focus || idOf(l.target) === focus)
            return (incident ? 1.7 : 1) / zoom
          }}
          onNodeHover={(node: { id?: string | number } | null) => {
            const id = node && typeof node.id === 'string' ? node.id : null
            hoveredIdRef.current = id
            // Only project nodes participate in cross-highlighting.
            onFocus(id && pulseById.has(id) ? id : null)
            // Hover card: pin to the node's screen position; on leave keep
            // the content mounted and let visibility drive the fade-out.
            if (id && node) {
              const n = node as GraphNode
              const screen = fgRef.current?.graph2ScreenCoords?.(n.x ?? 0, n.y ?? 0)
              if (screen) {
                setTooltip({ id, x: screen.x, y: screen.y })
                setTooltipVisible(true)
              }
            } else {
              setTooltipVisible(false)
            }
          }}
          onNodeClick={(node: { id?: string | number }) => {
            if (typeof node.id !== 'string') return
            const pulse = pulseById.get(node.id)
            if (pulse) onSelectProject(pulse)
            else router.push('/map')
          }}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={(
            node: GraphNode,
            ctx: CanvasRenderingContext2D,
            globalScale: number
          ) => {
            if (typeof node.x !== 'number' || typeof node.y !== 'number') return
            const hot = hotIds.has(node.id)
            const hovered =
              node.id === hoveredIdRef.current || node.id === focusIdRef.current
            // Obsidian fade: everything outside the focus neighborhood melts.
            const fade = nodeAlphaRef.current.get(node.id) ?? 1
            // Constant SCREEN-pixel sizes: zoomToFit shrinks the camera far
            // below 1, so graph-unit radii would vanish. Divide by scale.
            const rPx = hot ? 3.5 : node.kind === 'project' ? 2.8 : 2.2
            const r = rPx / globalScale

            if (hot) {
              // The caution light: slow 3s pulse, per D1's node law.
              // Under prefers-reduced-motion the halo holds still.
              const pulse = reducedMotionRef.current
                ? 0.5
                : 0.5 + 0.5 * Math.sin(((Date.now() % 3000) / 3000) * 2 * Math.PI)
              ctx.beginPath()
              ctx.arc(node.x, node.y, r + (3 + 2 * pulse) / globalScale, 0, 2 * Math.PI)
              ctx.fillStyle = `rgba(${AMBER.r}, ${AMBER.g}, ${AMBER.b}, ${(0.10 + 0.08 * pulse) * fade})`
              ctx.fill()
            }

            // Launch ripple: one expanding ring, then gone.
            const rippleStart = ripplesRef.current.get(node.id)
            if (rippleStart !== undefined) {
              const t = (performance.now() - rippleStart) / 1600
              if (t >= 1) {
                ripplesRef.current.delete(node.id)
              } else {
                ctx.beginPath()
                ctx.arc(node.x, node.y, r + (4 + 34 * t) / globalScale, 0, 2 * Math.PI)
                ctx.strokeStyle = `rgba(${AMBER.r}, ${AMBER.g}, ${AMBER.b}, ${0.55 * (1 - t)})`
                ctx.lineWidth = 1.5 / globalScale
                ctx.stroke()
              }
            }

            const c = hot ? AMBER : node.kind === 'project' ? DIM : FAINT
            ctx.beginPath()
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
            ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${(hovered ? 1 : hot ? 0.95 : 0.8) * fade})`
            ctx.fill()

            // The hover card carries the name for mouse hovers; the canvas
            // label only serves cross-highlights arriving from OTHER zones.
            // NOTE: canvas ctx.font silently rejects var() strings, so a
            // concrete family list is required here.
            if (node.id === focusIdRef.current && node.id !== hoveredIdRef.current) {
              const fontSize = 11 / globalScale
              ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.fillStyle = hot
                ? `rgba(${AMBER.r}, ${AMBER.g}, ${AMBER.b}, 0.95)`
                : 'rgba(217, 222, 231, 0.9)'
              ctx.fillText(node.label, node.x, node.y + r + 3 / globalScale)
            }
          }}
          nodePointerAreaPaint={(
            node: GraphNode,
            color: string,
            ctx: CanvasRenderingContext2D
          ) => {
            if (typeof node.x !== 'number' || typeof node.y !== 'number') return
            ctx.fillStyle = color
            ctx.beginPath()
            // Generous hit area in screen pixels regardless of zoom.
            ctx.arc(node.x, node.y, 12 / Math.max(fgRef.current?.zoom?.() ?? 1, 0.05), 0, 2 * Math.PI)
            ctx.fill()
          }}
        />
      )}

      <button
        type="button"
        onClick={() => setAmbient((a) => !a)}
        className={`absolute right-2 top-2 z-10 font-mono text-[10px] tracking-[0.08em] ${
          ambient ? 'text-deck-dim' : 'text-deck-faint'
        } hover:text-deck-dim`}
        title="slow drift + center light"
      >
        {ambient ? '◉ ambient' : '○ ambient'}
      </button>

      {tooltip &&
        (() => {
          const pulse = pulseById.get(tooltip.id)
          const hot = hotIds.has(tooltip.id)
          const atlasNode = atlas?.nodes.find((n) => n.id === tooltip.id)
          const openItems = (queueItems ?? [])
            .filter((q) => q.status === 'open' && q.projectId === tooltip.id)
            .slice(0, 2)
          const eyebrow = hot
            ? 'text-deck-amber'
            : pulse
              ? 'text-deck-ok'
              : 'text-deck-faint'
          return (
            <div
              className={`pointer-events-none absolute z-10 w-60 rounded-[3px] border bg-deck-panel/95 p-2.5 backdrop-blur-sm transition-all duration-150 ease-out ${
                tooltipVisible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
              } ${hot ? 'border-deck-amber/60' : 'border-deck-hair'}`}
              style={{
                left: clampPx(tooltip.x + 14, 8, size.width - 256),
                top: clampPx(tooltip.y + 12, 8, size.height - 132),
              }}
            >
              <div className={`font-mono text-[10px] uppercase tracking-[0.1em] ${eyebrow}`}>
                {atlasNode?.kind ?? 'node'}
                {hot ? ' · needs a hand' : pulse ? ' · synced' : ''}
              </div>
              <div className="pt-0.5 text-sm font-medium text-deck-ink">
                {atlasNode?.label ?? tooltip.id}
              </div>
              {pulse?.git && (
                <div className="pt-1 font-mono text-[11px] text-deck-dim">
                  {pulse.git.branch}
                  {pulse.git.dirty > 0 ? ` · ±${pulse.git.dirty}` : ''}
                  {pulse.git.ahead > 0 ? ` · ↑${pulse.git.ahead}` : ''}
                </div>
              )}
              {openItems.map((q) => (
                <div key={q.id} className="pt-1 text-[11px] leading-snug text-deck-dim">
                  ▸ {q.title}
                </div>
              ))}
              {!pulse && atlasNode?.description && (
                <div className="line-clamp-2 pt-1 text-[11px] leading-snug text-deck-dim">
                  {atlasNode.description}
                </div>
              )}
              <div className="pt-1.5 font-mono text-[10px] text-deck-faint">
                {pulse ? 'click to work on it' : 'click for full map'}
              </div>
            </div>
          )
        })()}
    </div>
  )
}

function clampPx(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
