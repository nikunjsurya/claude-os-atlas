// Home. Local mode: mission control dashboard. Public mode: the sanitized
// constellation, exactly as V1 (the dashboard is local-only by construction).
// Spec: 2026-07-09-mission-control-v2-design.md sections 1, 4.4.

import ConstellationPage from '@/components/ConstellationPage'
import DashboardRoot from '@/components/dashboard/DashboardRoot'

export const dynamic = 'force-dynamic'

const PUBLIC_MODE = process.env.NEXT_PUBLIC_ATLAS_MODE === 'public'

export default async function Page() {
  if (PUBLIC_MODE) return <ConstellationPage />
  return <DashboardRoot />
}
