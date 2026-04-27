'use client'

// 30-day activity sparkline. Buckets the selected node's lastTouched plus
// every linked node's lastTouched into one tick per day, then draws a line
// chart over the resulting day-by-day count series.
//
// Per spec section 6.5: small SVG line chart in the side panel. Per the
// unit-16 brief: 30-day window, mtime-bucketed, line color = active green
// against panel-border baseline.

import { useMemo } from 'react'

interface Props {
  // ISO timestamps from the selected node + each linked node.
  // Order doesn't matter, only their day-buckets do.
  timestamps: string[]
  color: string
}

const DAYS = 30
const WIDTH = 320
const HEIGHT = 40
const PAD_X = 2
const PAD_Y = 4

export default function ActivitySparkline({ timestamps, color }: Props) {
  const buckets = useMemo(() => bucketByDay(timestamps, DAYS), [timestamps])

  const max = Math.max(1, ...buckets)
  const innerW = WIDTH - PAD_X * 2
  const innerH = HEIGHT - PAD_Y * 2
  const stepX = buckets.length > 1 ? innerW / (buckets.length - 1) : innerW

  const points = buckets
    .map((v, i) => {
      const x = PAD_X + i * stepX
      const y = PAD_Y + innerH - (v / max) * innerH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-10 w-full"
      preserveAspectRatio="none"
    >
      {/* Baseline in panel-border color */}
      <line
        x1="0"
        y1={HEIGHT - PAD_Y}
        x2={WIDTH}
        y2={HEIGHT - PAD_Y}
        stroke="#2A2D34"
        strokeWidth="1"
      />
      {/* Activity line in the active-status (green) per unit brief */}
      <polyline
        points={points}
        fill="none"
        stroke="#5AA77A"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Final tick marker uses the node's status color so the latest
          activity reads at a glance */}
      {buckets.length > 0 && (
        <circle
          cx={PAD_X + (buckets.length - 1) * stepX}
          cy={PAD_Y + innerH - (buckets[buckets.length - 1] / max) * innerH}
          r="2"
          fill={color}
        />
      )}
    </svg>
  )
}

// Pure helper. Returns an array of length `days`, oldest first, where each
// entry is the count of timestamps whose calendar day equals that bucket.
function bucketByDay(timestamps: string[], days: number): number[] {
  const out = new Array(days).fill(0) as number[]
  const today = startOfDay(new Date())
  for (const ts of timestamps) {
    if (!ts) continue
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) continue
    const day = startOfDay(d)
    const diffDays = Math.floor((today.getTime() - day.getTime()) / 86_400_000)
    if (diffDays < 0 || diffDays >= days) continue
    // bucket index: oldest day = 0, today = days - 1
    const idx = days - 1 - diffDays
    out[idx] += 1
  }
  return out
}

function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}
