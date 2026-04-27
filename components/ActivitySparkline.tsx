'use client'

// 30-day sparkline. Stub for unit 13; expanded in unit 16.

interface Props {
  lastTouched: string
  color: string
}

export default function ActivitySparkline({ color }: Props) {
  return (
    <svg viewBox="0 0 320 40" className="w-full h-10">
      <line x1="0" y1="20" x2="320" y2="20" stroke={color} strokeWidth="1" opacity="0.4" />
    </svg>
  )
}
