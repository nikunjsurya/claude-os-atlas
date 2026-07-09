// Phase C taste-gate mockups: /directions/1|2|3. Local-only, throwaway;
// deleted after Surya picks. Spec section 8.

import { notFound } from 'next/navigation'
import D1FlightDeck from '@/components/directions/D1FlightDeck'
import D2MorningDocket from '@/components/directions/D2MorningDocket'
import D3OpsFloor from '@/components/directions/D3OpsFloor'

export const dynamic = 'force-dynamic'

export default async function DirectionPage({
  params,
}: {
  params: Promise<{ n: string }>
}) {
  if (process.env.NEXT_PUBLIC_ATLAS_MODE === 'public') notFound()
  const { n } = await params
  if (n === '1') return <D1FlightDeck />
  if (n === '2') return <D2MorningDocket />
  if (n === '3') return <D3OpsFloor />
  notFound()
}
