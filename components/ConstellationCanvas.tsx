'use client'

// Owns the react-force-graph-2d instance. Per spec 4.2, the only file that
// imports it. Custom node renderer with status colors, pulse on active,
// dimmed parked, halo on selected. Click selects via the store.
//
// Dynamic import with ssr:false because the lib touches `window` on import.

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AtlasNode, AtlasEdge, AtlasResponse } from '@/lib/types'
import { useAtlasStore } from '@/lib/store'

// react-force-graph-2d is canvas-only and touches `window` on import. The
// dynamic loader strips its generic type, so we widen to a permissive
// component type here and cast our callbacks. The lib's own types are too
// strict around the node-shape generic for our workflow.
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

const CLUSTER_COLORS: Record<AtlasNode['cluster'], string> = {
  content: '#E07B4E',
  software: '#5BA3B5',
  voice: '#9F7AEA',
  infra: '#5AA77A',
  meta: '#6B7280',
}

const CLUSTER_LABELS: Record<AtlasNode['cluster'], string> = {
  content: 'CONTENT',
  software: 'SOFTWARE',
  voice: 'VOICE',
  infra: 'INFRA',
  meta: 'META',
}

interface Props {
  data: AtlasResponse
}

interface GraphNode extends AtlasNode {
  x?: number
  y?: number
}

export default function ConstellationCanvas({ data }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const selectedId = useAtlasStore((s) => s.selectedId)
  const setSelected = useAtlasStore((s) => s.setSelected)
  const activeFilter = useAtlasStore((s) => s.activeFilter)

  // Resize observer keeps the canvas matching its container.
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

  // Filter chips hide whole groups. 'reference' chip covers reference,
  // feedback, and instruction kinds.
  const visibleNodes = useMemo(() => {
    if (activeFilter === 'all') return data.nodes
    if (activeFilter === 'reference') {
      return data.nodes.filter(
        (n) => n.kind === 'reference' || n.kind === 'feedback' || n.kind === 'instruction'
      )
    }
    return data.nodes.filter((n) => n.kind === activeFilter)
  }, [data.nodes, activeFilter])

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes])

  const visibleEdges = useMemo(
    () => data.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [data.edges, visibleIds]
  )

  const graphData = useMemo(
    () => ({
      nodes: visibleNodes.map((n) => ({ ...n })),
      links: visibleEdges.map((e: AtlasEdge) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
      })),
    }),
    [visibleNodes, visibleEdges]
  )

  return (
    <div ref={containerRef} className="absolute inset-0">
      {size.width > 0 && size.height > 0 && (
        <ForceGraph2D
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor="#0E1014"
          nodeId="id"
          enableNodeDrag={false}
          cooldownTime={4000}
          d3AlphaDecay={0.04}
          linkColor={() => 'rgba(120, 130, 145, 0.18)'}
          linkWidth={(l: { weight?: number }) => 0.6 + (l.weight ?? 0.3) * 0.6}
          onRenderFramePre={(ctx: CanvasRenderingContext2D) => {
            // Cluster halos. Compute centroid + spread per cluster from
            // current node positions. Paint translucent ellipse + label.
            const groups = new Map<AtlasNode['cluster'], GraphNode[]>()
            for (const n of graphData.nodes as GraphNode[]) {
              if (typeof n.x !== 'number' || typeof n.y !== 'number') continue
              const arr = groups.get(n.cluster) ?? []
              arr.push(n)
              groups.set(n.cluster, arr)
            }
            for (const [cluster, members] of groups) {
              if (members.length < 2) continue
              let sx = 0, sy = 0
              for (const m of members) {
                sx += m.x as number
                sy += m.y as number
              }
              const cx = sx / members.length
              const cy = sy / members.length
              let maxDx = 0, maxDy = 0
              for (const m of members) {
                maxDx = Math.max(maxDx, Math.abs((m.x as number) - cx))
                maxDy = Math.max(maxDy, Math.abs((m.y as number) - cy))
              }
              const rx = maxDx + 32
              const ry = maxDy + 32
              const color = CLUSTER_COLORS[cluster]

              // Solid translucent fill (8%).
              ctx.beginPath()
              ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI)
              ctx.fillStyle = withAlpha(color, 0.08)
              ctx.fill()

              // Radial gradient overlay (~20%) to fake the hachure texture.
              const grad = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.4, cx, cy, Math.max(rx, ry))
              grad.addColorStop(0, withAlpha(color, 0.18))
              grad.addColorStop(1, withAlpha(color, 0))
              ctx.beginPath()
              ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI)
              ctx.fillStyle = grad
              ctx.fill()

              // Label above the cluster.
              ctx.font = '11px var(--font-geist-sans), system-ui, sans-serif'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'bottom'
              ctx.fillStyle = withAlpha(color, 0.9)
              ctx.fillText(CLUSTER_LABELS[cluster], cx, cy - ry - 6)
            }
          }}
          onNodeClick={(node: { id?: string | number }) => {
            if (typeof node.id === 'string') setSelected(node.id)
          }}
          onBackgroundClick={() => setSelected(null)}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
            if (typeof node.x !== 'number' || typeof node.y !== 'number') return
            const r = (node.size ?? 14) / 4
            const color = STATUS_COLORS[node.status] ?? '#6B7280'
            const isSelected = node.id === selectedId
            const dimmed = node.status === 'parked' && !isSelected

            // Pulse for active nodes (per spec 6.3).
            if (node.status === 'active') {
              const t = (Date.now() % 3000) / 3000
              const pulse = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI)
              const haloAlpha = 0.15 + 0.10 * pulse
              const haloR = r + 4 + 2 * pulse
              ctx.beginPath()
              ctx.arc(node.x, node.y, haloR, 0, 2 * Math.PI, false)
              ctx.fillStyle = withAlpha(color, haloAlpha)
              ctx.fill()
            }

            // Selected outer halo (1.5x size, 18% opacity).
            if (isSelected) {
              ctx.beginPath()
              ctx.arc(node.x, node.y, r * 1.5, 0, 2 * Math.PI, false)
              ctx.fillStyle = withAlpha(color, 0.18)
              ctx.fill()
            }

            // Main filled circle.
            ctx.globalAlpha = dimmed ? 0.45 : 1
            ctx.beginPath()
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
            ctx.fillStyle = color
            ctx.fill()
            ctx.lineWidth = isSelected ? 2 : 1.5
            ctx.strokeStyle = '#0E1014'
            ctx.stroke()
            ctx.globalAlpha = 1

            // Label below the node.
            const label = node.label
            const fontSize = 12 / globalScale
            ctx.font = `${fontSize}px var(--font-geist-sans), system-ui, sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.fillStyle = dimmed ? '#6B7280' : '#E6E8EE'
            ctx.fillText(label, node.x, node.y + r + 4 / globalScale)
          }}
          nodePointerAreaPaint={(node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
            if (typeof node.x !== 'number' || typeof node.y !== 'number') return
            const r = (node.size ?? 14) / 4
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI, false)
            ctx.fill()
          }}
        />
      )}
    </div>
  )
}

function withAlpha(hex: string, alpha: number): string {
  // Quick hex to rgba helper. Assumes 6-digit hex.
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
