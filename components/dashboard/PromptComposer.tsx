// Editable prompt + terminal picker + Start. The launch button is the one
// place the deck spends amber on an action: it is the reason the screen
// exists.

'use client'

import { useState } from 'react'

export default function PromptComposer({
  seed,
  projectId,
  token,
}: {
  seed: string
  projectId: string | null
  token: string | null
}) {
  const [prompt, setPrompt] = useState(seed)
  const [terminal, setTerminal] = useState<'warp' | 'wt'>('warp')
  const [state, setState] = useState<'idle' | 'launching' | 'launched' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const canLaunch = projectId !== null && token !== null && prompt.trim().length > 0

  async function launch() {
    if (!canLaunch) return
    setState('launching')
    try {
      const res = await fetch('/api/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Atlas-Token': token!,
        },
        body: JSON.stringify({ projectId, prompt, terminal }),
      })
      const body = (await res.json()) as { error?: string; terminal?: string }
      if (!res.ok) {
        setState('error')
        setMessage(body.error ?? `launch failed (${res.status})`)
        return
      }
      setState('launched')
      setMessage(`claude is starting in ${body.terminal}`)
    } catch (err) {
      setState('error')
      setMessage((err as Error).message)
    }
  }

  return (
    <div>
      <h4 className="text-[11px] uppercase tracking-[0.12em] text-deck-dim">
        Work on it
      </h4>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={8}
        className="mt-2 w-full rounded-[3px] border border-deck-hair bg-deck-bg p-2.5 text-sm text-deck-ink focus:border-deck-dim focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <select
          value={terminal}
          onChange={(e) => setTerminal(e.target.value as 'warp' | 'wt')}
          className="rounded-[3px] border border-deck-hair bg-deck-bg px-2 py-1.5 font-mono text-xs text-deck-dim"
        >
          <option value="warp">warp</option>
          <option value="wt">windows terminal</option>
        </select>
        <button
          type="button"
          disabled={!canLaunch || state === 'launching'}
          onClick={launch}
          className="rounded-[3px] bg-deck-amber px-4 py-1.5 text-sm font-medium text-deck-bg disabled:opacity-30"
        >
          {state === 'launching' ? 'starting…' : 'Start Claude session'}
        </button>
      </div>
      {projectId === null && (
        <div className="mt-2 font-mono text-[11px] text-deck-dim">
          no project directory on this item; launch disabled
        </div>
      )}
      {message && (
        <div
          className={`mt-2 font-mono text-xs ${state === 'error' ? 'text-deck-amber' : 'text-deck-dim'}`}
        >
          {state === 'error' ? '▲ ' : ''}
          {message}
        </div>
      )}
    </div>
  )
}
