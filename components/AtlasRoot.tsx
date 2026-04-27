'use client'

// Client root that composes the canvas + side panel. Receives atlas data
// from the server component (page.tsx) so the constellation renders on
// first paint without a client-side fetch.

import type { AtlasResponse } from '@/lib/types'
import ConstellationCanvas from './ConstellationCanvas'
import NodeDetailPanel from './NodeDetailPanel'

interface Props {
  data: AtlasResponse
}

export default function AtlasRoot({ data }: Props) {
  return (
    <div className="relative flex flex-1">
      <div className="relative flex-1">
        <ConstellationCanvas data={data} />
      </div>
      <NodeDetailPanel data={data} />
    </div>
  )
}
