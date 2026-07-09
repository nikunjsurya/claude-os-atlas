'use client'

// Obsidian-style graph view on react-force-graph-2d.
//
// Goal: behave like Obsidian's graph, not just look like it. Three
// concrete things that separate visual mimicry from behavioral match:
//
// 1. Smooth alpha lerp on hover/unhover. Obsidian fades neighbors-vs-
//    rest over ~250ms with an ease-out. We maintain per-node + per-edge
//    current-alpha state in refs and lerp toward target every frame.
//    When a tween is in flight, a requestAnimationFrame loop drives
//    forceGraph.refresh() so frames keep arriving after the simulation
//    has cooled. Tween epsilon stops the loop when settled.
//
// 2. Obsidian's d3 force defaults. We pull centerStrength=0.48,
//    repelStrength=16.41, linkStrength=0.44, linkDistance=198 from the
//    Obsidian source (per forum + deepwiki references). The numbers are
//    scaled into d3 manyBody units (-strength * ~10) where appropriate.
//
// 3. Drag behavior. enableNodeDrag={true} pins a node to the cursor
//    while held (the lib sets fx/fy), releases the pin on mouseup, and
//    reheats the simulation so neighbors settle around the new position.
//    Match Obsidian's default of "rejoin on release."
//
// Hover state lives in a ref + a single useState toggle (so React knows
// to re-trigger the RAF loop on change) rather than per-frame state, to
// avoid render churn while a tween is running.

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AtlasNode, AtlasEdge, AtlasResponse } from '@/lib/types'
import { useAtlasStore } from '@/lib/store'

// next/dynamic does NOT forward refs. Without this wrapper the imperative
// handle is silently null: the Obsidian force params never apply and the
// hover-tween RAF loop's refresh() is a no-op after the sim cools. The
// wrapper passes the ref through as a plain prop.
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

const STATUS_COLORS: Record<AtlasNode['status'], string> = {
  active: '#5AA77A',
  shipped: '#5BA3B5',
  parked: '#6B7280',
  reference: '#9F7AEA',
}

interface Props {
  data: AtlasResponse
}

interface GraphNode extends AtlasNode {
  x?: number
  y?: number
}

// Label zoom threshold (matches Obsidian's "text fade threshold" feel).
const LABEL_FADE_MIN = 1.4
const LABEL_FADE_MAX = 2.4

// Alpha targets. Obsidian dims unrelated nodes to roughly 0.2.
const ALPHA_BASE = 0.95 // no focus: most visible state
const ALPHA_FOCUS = 1.0
const ALPHA_DIM = 0.18

// Edge alpha targets.
const EDGE_ALPHA_BASE = 0.1
const EDGE_ALPHA_INCIDENT = 0.55
const EDGE_ALPHA_DIM = 0.04

// Tween tau in ms. lerpK = 1 - exp(-dt/TWEEN_TAU). At dt=16ms that's
// ~0.16 per frame, so a hover transition reaches 90% in ~135ms, about
// what Obsidian feels like.
const TWEEN_TAU = 90
const TWEEN_EPSILON = 0.004 // stop the RAF loop when all deltas are <= this

// Obsidian's d3 force parameters (per their settings panel defaults).
const OBSIDIAN_CENTER_STRENGTH = 0.48
const OBSIDIAN_REPEL_STRENGTH = 16.41
const OBSIDIAN_LINK_STRENGTH = 0.44
const OBSIDIAN_LINK_DISTANCE = 198

function idOf(endpoint: unknown): string {
  if (typeof endpoint === 'string') return endpoint
  if (endpoint && typeof endpoint === 'object' && 'id' in endpoint) {
    const id = (endpoint as { id?: unknown }).id
    if (typeof id === 'string') return id
  }
  return ''
}

function edgeKey(s: unknown, t: unknown): string {
  return `${idOf(s)}${idOf(t)}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ForceGraphRef = any

export default function ConstellationCanvas({ data }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fgRef = useRef<ForceGraphRef>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // Hover lives in a ref for the renderer (no setState every mousemove)
  // plus a state version that the RAF loop watches.
  const hoveredIdRef = useRef<string | null>(null)
  const [hoverTick, setHoverTick] = useState(0)

  const selectedId = useAtlasStore((s) => s.selectedId)
  const setSelected = useAtlasStore((s) => s.setSelected)
  const activeFilter = useAtlasStore((s) => s.activeFilter)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)
    setSize({ width: el.clientWidth, height: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const visibleNodes = useMemo(() => {
    if (activeFilter === 'all') return data.nodes
    if (activeFilter === 'reference') {
      return data.nodes.filter(
        (n) =>
          n.kind === 'reference' ||
          n.kind === 'feedback' ||
          n.kind === 'instruction',
      )
    }
    return data.nodes.filter((n) => n.kind === activeFilter)
  }, [data.nodes, activeFilter])

  const visibleIds = useMemo(
    () => new Set(visibleNodes.map((n) => n.id)),
    [visibleNodes],
  )

  const visibleEdges = useMemo(
    () =>
      data.edges.filter(
        (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
      ),
    [data.edges, visibleIds],
  )

  // Adjacency lookup, rebuilt only when the visible set changes.
  const neighborsOf = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const e of visibleEdges) {
      if (!m.has(e.source)) m.set(e.source, new Set())
      if (!m.has(e.target)) m.set(e.target, new Set())
      m.get(e.source)!.add(e.target)
      m.get(e.target)!.add(e.source)
    }
    return m
  }, [visibleEdges])

  useEffect(() => {
    if (selectedId && !visibleIds.has(selectedId)) {
      setSelected(null)
    }
  }, [selectedId, visibleIds, setSelected])

  // Filter changes invalidate hover too.
  useEffect(() => {
    hoveredIdRef.current = null
    setHoverTick((t) => t + 1)
  }, [activeFilter])

  // ESC clears selection, matches Obsidian's "click empty area to
  // deselect" pattern, plus a keyboard shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSelected])

  const graphData = useMemo(
    () => ({
      nodes: visibleNodes.map((n) => ({ ...n })),
      links: visibleEdges.map((e: AtlasEdge) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
      })),
    }),
    [visibleNodes, visibleEdges],
  )

  // Per-frame tween state. Keyed by id (nodes) and edgeKey (edges).
  const nodeAlphaRef = useRef<Map<string, number>>(new Map())
  const edgeAlphaRef = useRef<Map<string, number>>(new Map())
  const lastFrameTimeRef = useRef<number>(performance.now())

  // Reset alpha state when the data set changes so a fresh load starts
  // at the visible base alpha (no carryover ghost dims).
  useEffect(() => {
    nodeAlphaRef.current.clear()
    edgeAlphaRef.current.clear()
  }, [graphData])

  // Apply Obsidian's force parameters once the graph instance exists
  // and the graphData has been ingested. We retry briefly because the
  // simulation isn't always wired by the first ref tick.
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    let cancelled = false
    const apply = () => {
      if (cancelled) return
      const center = fg.d3Force?.('center')
      const charge = fg.d3Force?.('charge')
      const link = fg.d3Force?.('link')
      if (!center && !charge && !link) {
        // Forces aren't ready yet; try again next frame.
        requestAnimationFrame(apply)
        return
      }
      // d3 manyBody uses NEGATIVE strength for repulsion. Obsidian's
      // 16.41 maps roughly to -160 in d3 units.
      charge?.strength(-OBSIDIAN_REPEL_STRENGTH * 10)
      link?.strength(OBSIDIAN_LINK_STRENGTH)
      link?.distance(OBSIDIAN_LINK_DISTANCE)
      center?.strength(OBSIDIAN_CENTER_STRENGTH)
      // Reheat once so the new params actually take effect on the
      // already-cooling simulation.
      fg.d3ReheatSimulation?.()
    }
    apply()
    return () => {
      cancelled = true
    }
  }, [graphData])

  // Compute the target alpha for a node given the current focus state.
  const targetNodeAlpha = useCallback(
    (nodeId: string): number => {
      const focusId = hoveredIdRef.current ?? selectedId
      if (!focusId) return ALPHA_BASE
      if (nodeId === focusId) return ALPHA_FOCUS
      if (neighborsOf.get(focusId)?.has(nodeId)) return ALPHA_FOCUS
      return ALPHA_DIM
    },
    [selectedId, neighborsOf],
  )

  const targetEdgeAlpha = useCallback(
    (s: unknown, t: unknown): number => {
      const focusId = hoveredIdRef.current ?? selectedId
      if (!focusId) return EDGE_ALPHA_BASE
      const incident = idOf(s) === focusId || idOf(t) === focusId
      return incident ? EDGE_ALPHA_INCIDENT : EDGE_ALPHA_DIM
    },
    [selectedId],
  )

  // RAF loop. Runs while ANY alpha is more than TWEEN_EPSILON from its
  // target. When everything has settled, it stops on its own and waits
  // for the next hover/selection event to reignite it.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const now = performance.now()
      const dt = now - lastFrameTimeRef.current
      lastFrameTimeRef.current = now
      const k = 1 - Math.exp(-dt / TWEEN_TAU)

      let anyMoving = false

      for (const node of graphData.nodes) {
        const cur = nodeAlphaRef.current.get(node.id) ?? ALPHA_BASE
        const tgt = targetNodeAlpha(node.id)
        if (Math.abs(cur - tgt) > TWEEN_EPSILON) {
          nodeAlphaRef.current.set(node.id, cur + (tgt - cur) * k)
          anyMoving = true
        } else if (cur !== tgt) {
          nodeAlphaRef.current.set(node.id, tgt)
        }
      }

      for (const link of graphData.links) {
        const key = edgeKey(link.source, link.target)
        const cur = edgeAlphaRef.current.get(key) ?? EDGE_ALPHA_BASE
        const tgt = targetEdgeAlpha(link.source, link.target)
        if (Math.abs(cur - tgt) > TWEEN_EPSILON) {
          edgeAlphaRef.current.set(key, cur + (tgt - cur) * k)
          anyMoving = true
        } else if (cur !== tgt) {
          edgeAlphaRef.current.set(key, tgt)
        }
      }

      fgRef.current?._rerender?.() ?? fgRef.current?.refresh?.()

      if (anyMoving) {
        raf = requestAnimationFrame(tick)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // hoverTick + selectedId reignite the loop on any focus change.
  }, [graphData, hoverTick, selectedId, targetNodeAlpha, targetEdgeAlpha])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
    >
      {size.width > 0 && size.height > 0 && (
        <ForceGraph2D
          fgRef={fgRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor="#0B0D11"
          nodeId="id"
          enableNodeDrag={true}
          // Slower decay = layout looks like it's settling, not snapping.
          d3AlphaDecay={0.012}
          d3VelocityDecay={0.32}
          cooldownTime={10000}
          warmupTicks={25}
          nodeRelSize={6}
          // -- LINKS ------------------------------------------------------
          linkColor={(l: { source: unknown; target: unknown }) => {
            const key = edgeKey(l.source, l.target)
            const a = edgeAlphaRef.current.get(key) ?? EDGE_ALPHA_BASE
            // Brighter color when incident to focus, neutral grey otherwise.
            const focusId = hoveredIdRef.current ?? selectedId
            const incident =
              !!focusId &&
              (idOf(l.source) === focusId || idOf(l.target) === focusId)
            const base = incident ? '200, 210, 225' : '150, 160, 175'
            return `rgba(${base}, ${a})`
          }}
          linkWidth={(l: { source: unknown; target: unknown }) => {
            const focusId = hoveredIdRef.current ?? selectedId
            if (!focusId) return 0.6
            const incident =
              idOf(l.source) === focusId || idOf(l.target) === focusId
            return incident ? 1.4 : 0.5
          }}
          // -- NODES ------------------------------------------------------
          onNodeClick={(node: { id?: string | number }) => {
            if (typeof node.id === 'string') setSelected(node.id)
          }}
          onNodeHover={(node: { id?: string | number } | null) => {
            const next =
              node && typeof node.id === 'string' ? node.id : null
            if (next === hoveredIdRef.current) return
            hoveredIdRef.current = next
            setHoverTick((t) => t + 1)
          }}
          onBackgroundClick={() => setSelected(null)}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={(
            node: GraphNode,
            ctx: CanvasRenderingContext2D,
            globalScale: number,
          ) => {
            if (typeof node.x !== 'number' || typeof node.y !== 'number') return

            const baseR = Math.max((node.size ?? 14) / 4, 3.5)
            const color = STATUS_COLORS[node.status] ?? '#6B7280'
            const isSelected = node.id === selectedId
            const isHovered = node.id === hoveredIdRef.current
            const focusId = hoveredIdRef.current ?? selectedId
            const isFocus = node.id === focusId
            const isNeighbor = !!(
              focusId && neighborsOf.get(focusId)?.has(node.id)
            )

            const alpha = nodeAlphaRef.current.get(node.id) ?? ALPHA_BASE

            // Selected halo: a soft outer ring. Tracks alpha so it fades
            // along with the rest of the focus subgraph.
            if (isSelected) {
              ctx.beginPath()
              ctx.arc(node.x, node.y, baseR + 4, 0, 2 * Math.PI, false)
              ctx.fillStyle = withAlpha(color, 0.20 * alpha)
              ctx.fill()
            }

            // Hovered glow on top, but only if not also the selected node.
            if (isHovered && !isSelected) {
              ctx.beginPath()
              ctx.arc(node.x, node.y, baseR + 3, 0, 2 * Math.PI, false)
              ctx.fillStyle = withAlpha(color, 0.22)
              ctx.fill()
            }

            // Main filled disk.
            ctx.beginPath()
            ctx.arc(node.x, node.y, baseR, 0, 2 * Math.PI, false)
            ctx.fillStyle = withAlpha(color, alpha)
            ctx.fill()

            // Label: hidden at low zoom, fade in by zoom, always visible
            // for focus + neighbors regardless of zoom.
            const showAlways = isFocus || isNeighbor || isSelected
            const zoomAlpha = showAlways
              ? 1
              : clamp(
                  (globalScale - LABEL_FADE_MIN) /
                    (LABEL_FADE_MAX - LABEL_FADE_MIN),
                  0,
                  1,
                )
            if (zoomAlpha > 0.02) {
              const fontSize = Math.max(11 / globalScale, 1.8)
              // Canvas ctx.font silently rejects var() strings; concrete list.
              ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.fillStyle = `rgba(220, 224, 232, ${alpha * zoomAlpha * 0.92})`
              ctx.fillText(node.label, node.x, node.y + baseR + 3 / globalScale)
            }
          }}
          nodePointerAreaPaint={(
            node: GraphNode,
            color: string,
            ctx: CanvasRenderingContext2D,
          ) => {
            if (typeof node.x !== 'number' || typeof node.y !== 'number') return
            const baseR = Math.max((node.size ?? 14) / 4, 3.5)
            const hitR = Math.max(baseR + 7, 14)
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x, node.y, hitR, 0, 2 * Math.PI, false)
            ctx.fill()
          }}
        />
      )}
    </div>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
