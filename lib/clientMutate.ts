// Client-side mutation helper: every guarded POST/PATCH goes through here.
// Fetches the per-boot X-Atlas-Token on demand, caches it, and on a 403
// refetches once and retries, so a dev-server restart heals itself instead
// of leaving the page's mutations dead until a manual refresh.

let cachedToken: string | null = null

async function fetchToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/session-token')
    if (!res.ok) return null
    const body = (await res.json()) as { token?: string }
    return body.token ?? null
  } catch {
    return null
  }
}

export async function mutateJson(
  url: string,
  body: unknown,
  method: 'POST' | 'PATCH' = 'POST'
): Promise<Response | null> {
  try {
    cachedToken ??= await fetchToken()
    const send = (token: string) =>
      fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Atlas-Token': token,
        },
        body: JSON.stringify(body),
      })

    let res = await send(cachedToken ?? '')
    if (res.status === 403) {
      cachedToken = await fetchToken()
      res = await send(cachedToken ?? '')
    }
    return res
  } catch {
    return null
  }
}
