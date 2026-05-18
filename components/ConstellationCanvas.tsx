'use client'

// Obsidian-style graph view on react-force-graph-2d.
//
// Rules of the renderer (changed from V1):
// - No cluster halos. The graph IS the structure.
// - No always-on labels and no pulse animations. Both create noise.
// - Hover or select a node => that node + its direct neighbors stay full
//   opacity; everything else fades to ~0.15. Edges incident to the focus
//   node get brighter; the rest go almost invisible.
// - Labels are hidden when zoomed out, fade in as the user zooms in past
//   a threshold, and are always visible for the focused/selected node
//   plus its neighbors.
// - Node drag is enabled (drag releases back into the simulation).
// - Force settling is slower (lower alphaDecay, longer cooldownTime) so
//   the load-in feels graceful, not snappy.
//
// Dynamic import with ssr:false because the lib touches window on import.

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AtlasNode, AtlasEdge, AtlasResponse } from '@/lib/types'
import { useAtlasStore } from '@/lib/store'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
}) as unknown as React.ComponentType<Record<string, unknown>>

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

// Zoom level at which labels start fading in. Below this, no labels.
const LABEL_FADE_MIN = 1.4
// Zoom level at which labels reach full opacity.
const LABEL_FADE_MAX = 2.4

// Edge ID helpers — react-force-graph mutates link.source/target from id
// strings into node objects after the simulation starts, so we always
// resolve to an id string before comparing.
function idOf(endpoint: unknown): string {
  if (typeof endpoint === 'string') return endpoint
  if (endpoint && typeof endpoint === 'object' && 'id' in endpoint) {
    const id = (endpoint as { id?: unknown }).id
    if (typeof id === 'string') return id
  }
  return ''
}

export default function ConstellationCanvas({ data }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)

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

  // Filter chips hide whole kinds. The 'reference' chip covers reference,
  // feedback, and instruction nodes (they're all leaf annotations).
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

  // Adjacency: nodeId -> Set<neighborId>. Built once per filter change.
  // Used by both the hover-highlight pass and the focus-edge brightening.
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

  // Clear selection if a filter switch hid the selected node.
  useEffect(() => {
    if (selectedId && !visibleIds.has(selectedId)) {
      setSelected(null)
    }
  }, [selectedId, visibleIds, setSelected])

  // Clear hover when the filter changes underneath us.
  useEffect(() => {
    setHoveredId(null)
  }, [activeFilter])

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

  // The "focus" is whichever node the user is currently expressing intent
  // about: hover takes precedence over selection (transient over persistent).
  const focusId = hoveredId ?? selectedId
  const focusNeighbors = focusId ? neighborsOf.get(focusId) ?? null : null

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
    >
      {size.width > 0 && size.height > 0 && (
        <ForceGraph2D
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor="#0B0D11"
          nodeId="id"
          // Slower decay = the simulation continues converging longer, so
          // the initial layout looks like it's settling, not snapping.
          d3AlphaDecay={0.014}
          d3VelocityDecay={0.32}
          cooldownTime={8000}
          warmupTicks={20}
          enableNodeDrag={true}
          // Allow zoom + pan; defaults are fine.
          nodeRelSize={6}
          // -- LINKS ------------------------------------------------------
          linkColor={(l: { source: unknown; target: unknown }) => {
            if (!focusId) return 'rgba(150, 160, 175, 0.10)'
            const s = idOf(l.source)
            const t = idOf(l.target)
            const incident = s === focusId || t === focusId
            return incident
              ? 'rgba(200, 210, 225, 0.55)'
              : 'rgba(150, 160, 175, 0.04)'
          }}
          linkWidth={(l: { source: unknown; target: unknown; weight?: number }) => {
            if (!focusId) return 0.6
            const incident = idOf(l.source) === focusId || idOf(l.target) === focusId
            return incident ? 1.2 : 0.4
          }}
          // -- NODES ------------------------------------------------------
          onNodeClick={(node: { id?: string | number }) => {
            if (typeof node.id === 'string') setSelected(node.id)
          }}
          onNodeHover={(node: { id?: string | number } | null) => {
            setHoveredId(
              node && typeof node.id === 'string' ? node.id : null,
            )
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
            const isFocus = node.id === focusId
            const isNeighbor = !!focusNeighbors?.has(node.id)
            const isSelected = node.id === selectedId

            // Three opacity tiers, transitionless (canvas can't tween):
            // - 1.0 when focus or neighbor
            // - 0.95 when no focus at all (default scene)
            // - 0.14 when faded (focus exists but this isn't part of it)
            let alpha: number
            if (!focusId) alpha = 0.95
            else if (isFocus || isNeighbor) alpha = 1
            else alpha = 0.14

            // Selected halo: a soft outer ring at low alpha. No animation.
            if (isSelected) {
              ctx.beginPath()
              ctx.arc(node.x, node.y, baseR + 3.5, 0, 2 * Math.PI, false)
              ctx.fillStyle = withAlpha(color, 0.18 * alpha)
              ctx.fill()
            }

            // Hovered glow: slightly larger soft outer fill on top of the
            // base node. Cheap to draw because no blur is needed.
            if (isFocus && !isSelected) {
              ctx.beginPath()
              ctx.arc(node.x, node.y, baseR + 2.5, 0, 2 * Math.PI, false)
              ctx.fillStyle = withAlpha(color, 0.22)
              ctx.fill()
            }

            // Main filled disk. No stroke — Obsidian's nodes are flat.
            ctx.beginPath()
            ctx.arc(node.x, node.y, baseR, 0, 2 * Math.PI, false)
            ctx.fillStyle = withAlpha(color, alpha)
            ctx.fill()

            // Label: hidden at low zoom, fade in by zoom level, always
            // visible for focus + neighbors regardless of zoom.
            const showAlways = isFocus || isNeighbor || isSelected
            const zoomAlpha = showAlways
              ? 1
              : clamp((globalScale - LABEL_FADE_MIN) / (LABEL_FADE_MAX - LABEL_FADE_MIN), 0, 1)
            if (zoomAlpha > 0.02) {
              const fontSize = Math.max(11 / globalScale, 1.8)
              ctx.font = `${fontSize}px var(--font-geist-sans), system-ui, sans-serif`
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
            // Big, forgiving hit area. 14 px floor matches Obsidian's
            // feel — generous on tiny leaf nodes.
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
