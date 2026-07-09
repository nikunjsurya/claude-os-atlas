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
}: {
  projects: ProjectPulse[] | null
  queueItems: QueueItem[] | null
  onSelectProject: (project: ProjectPulse) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fgRef = useRef<ForceGraphRef>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [atlas, setAtlas] = useState<AtlasResponse | null>(null)
  const hoveredIdRef = useRef<string | null>(null)

  useEffect(() => {
    fetch('/api/atlas')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setAtlas(body as AtlasResponse | null))
      .catch(() => setAtlas(null))
  }, [])

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
    if (!atlas) return { nodes: [], links: [] }
    return {
      nodes: atlas.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        kind: n.kind,
        size: n.size,
      })),
      links: atlas.edges.map((e) => ({ source: e.source, target: e.target })),
    }
  }, [atlas])

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
          onEngineStop={() => fgRef.current?.zoomToFit?.(400, 24)}
          linkColor={() => 'rgba(150, 160, 175, 0.07)'}
          linkWidth={() => 0.5}
          onNodeHover={(node: { id?: string | number } | null) => {
            hoveredIdRef.current =
              node && typeof node.id === 'string' ? node.id : null
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
            const hovered = node.id === hoveredIdRef.current
            // Constant SCREEN-pixel sizes: zoomToFit shrinks the camera far
            // below 1, so graph-unit radii would vanish. Divide by scale.
            const rPx = hot ? 3.5 : node.kind === 'project' ? 2.8 : 2.2
            const r = rPx / globalScale

            if (hot) {
              // The caution light: slow 3s pulse, per D1's node law.
              const t = (Date.now() % 3000) / 3000
              const pulse = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI)
              ctx.beginPath()
              ctx.arc(node.x, node.y, r + (3 + 2 * pulse) / globalScale, 0, 2 * Math.PI)
              ctx.fillStyle = `rgba(${AMBER.r}, ${AMBER.g}, ${AMBER.b}, ${0.10 + 0.08 * pulse})`
              ctx.fill()
            }

            const c = hot ? AMBER : node.kind === 'project' ? DIM : FAINT
            ctx.beginPath()
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
            ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${hovered ? 1 : hot ? 0.95 : 0.8})`
            ctx.fill()

            // Hover reveals the name; the pulse is signal enough at rest.
            // NOTE: canvas ctx.font silently rejects var() strings, so a
            // concrete family list is required here.
            if (hovered) {
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
    </div>
  )
}
