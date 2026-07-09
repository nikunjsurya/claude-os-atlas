// Editable prompt + terminal picker + the Start button that POSTs
// /api/launch. The click-to-work half of mission control.

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
      <h4 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
        Work on it
      </h4>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={8}
        className="mt-2 w-full rounded border border-[#2A2D34] bg-[#0E1014] p-2 text-sm text-[#E6E8EE] focus:border-[#6B7280] focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <select
          value={terminal}
          onChange={(e) => setTerminal(e.target.value as 'warp' | 'wt')}
          className="rounded border border-[#2A2D34] bg-[#0E1014] px-2 py-1 text-sm text-[#E6E8EE]"
        >
          <option value="warp">Warp</option>
          <option value="wt">Windows Terminal</option>
        </select>
        <button
          type="button"
          disabled={!canLaunch || state === 'launching'}
          onClick={launch}
          className="rounded bg-[#E07B4E] px-4 py-1.5 text-sm font-medium text-[#0E1014] disabled:opacity-40"
        >
          {state === 'launching' ? 'starting…' : 'Start Claude session'}
        </button>
      </div>
      {projectId === null && (
        <div className="mt-2 text-xs text-[#6B7280]">
          this item has no project directory; launch is disabled
        </div>
      )}
      {message && (
        <div
          className={`mt-2 text-xs ${state === 'error' ? 'text-[#D9534F]' : 'text-[#5AA77A]'}`}
        >
          {message}
        </div>
      )}
    </div>
  )
}
