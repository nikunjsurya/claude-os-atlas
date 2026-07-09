// The system map on the deck: the same Obsidian-parameter constellation
// as /map, reskinned to flight-deck law. Everything is a faint star;
// the only lit nodes are the ones carrying work (amber, gently pulsing,
// matching the queue). Click a lit project to open its drawer; click
// anything else to go to the full map. Ambient, but an instrument:
// it shows WHERE in the system's shape the pending work sits.

'use client'

import dynamic from 'next/dynamic'
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

  // Obsidian's distances are tuned for a full screen; in a 300px window
  // the settling graph starts mostly out of frame. Re-frame repeatedly
  // while the simulation cools instead of waiting for engine stop.
  useEffect(() => {
    if (graphData.nodes.length === 0) return
    const timers = [600, 1600, 3200, 6000, 9000].map((ms) =>
      setTimeout(() => fgRef.current?.zoomToFit?.(300, 24), ms)
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
            fgRef.current?.zoomToFit?.(400, 24)
          }}
          onRenderFramePre={(ctx: CanvasRenderingContext2D) => {
            // Ambient center light: a soft breath, not a lightning storm.
            if (!ambientRef.current) return
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
            if (count === 0) return
            cx /= count
            cy /= count
            const breath = reducedMotionRef.current
              ? 0.5
              : 0.5 + 0.5 * Math.sin(((Date.now() % 7000) / 7000) * 2 * Math.PI)
            const radius = 230
            const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
            glow.addColorStop(0, `rgba(96, 118, 150, ${0.06 + 0.05 * breath})`)
            glow.addColorStop(1, 'rgba(96, 118, 150, 0)')
            ctx.fillStyle = glow
            ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
          }}
          linkColor={() => 'rgba(150, 160, 175, 0.07)'}
          linkWidth={() => 0.5}
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
            else window.location.href = '/map'
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
              ctx.fillStyle = `rgba(${AMBER.r}, ${AMBER.g}, ${AMBER.b}, ${0.10 + 0.08 * pulse})`
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
            ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${hovered ? 1 : hot ? 0.95 : 0.8})`
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
