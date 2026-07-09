// Shared status dot. Colors follow the V1 palette tokens.

import type { PulseStatus } from '@/lib/types'

const COLORS: Record<PulseStatus, string> = {
  ok: '#5AA77A',
  warn: '#E07B4E',
  error: '#D9534F',
  unknown: '#6B7280',
}

export default function PulseDot({ status }: { status: PulseStatus }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: COLORS[status] }}
      title={status}
    />
  )
}
