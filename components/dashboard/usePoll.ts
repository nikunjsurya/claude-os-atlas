// Tiny polling hook: fetch on mount, on interval, and on window focus.
// Cadence per zone comes from the caller (spec section 4.2).

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface Poll<T> {
  data: T | null
  refetch: () => void
}

export function usePoll<T>(url: string, intervalMs: number): Poll<T> {
  const [data, setData] = useState<T | null>(null)
  const alive = useRef(true)
  const lastBody = useRef<string | null>(null)

  const refetch = useCallback(() => {
    fetch(url)
      .then((res) => (res.ok ? res.text() : null))
      .then((body) => {
        if (!alive.current || body === null) return
        // Most polls return byte-identical payloads; skipping setState keeps
        // the whole deck from re-rendering on every tick for nothing.
        if (body === lastBody.current) return
        lastBody.current = body
        setData(JSON.parse(body) as T)
      })
      .catch(() => {
        // Keep last good data; zones render their own degraded states.
      })
  }, [url])

  useEffect(() => {
    alive.current = true
    refetch()
    const timer = setInterval(refetch, intervalMs)
    const onFocus = () => refetch()
    window.addEventListener('focus', onFocus)
    return () => {
      alive.current = false
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [refetch, intervalMs])

  return { data, refetch }
}
