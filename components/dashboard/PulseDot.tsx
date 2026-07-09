// Deck light. One accent rule: amber for anything needing a hand,
// dim green for healthy, faint for unknown. No red; amber IS the alarm.

import type { PulseStatus } from '@/lib/types'

const COLORS: Record<PulseStatus, string> = {
  ok: 'var(--deck-ok)',
  warn: 'var(--deck-amber)',
  error: 'var(--deck-amber)',
  unknown: 'var(--deck-faint)',
}

export default function PulseDot({ status }: { status: PulseStatus }) {
  return (
    <span
      className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
      style={{ backgroundColor: COLORS[status] }}
      title={status}
    />
  )
}
