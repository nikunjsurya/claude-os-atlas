'use client'

// Markdown body renderer for the side panel. Stub for unit 13; full
// react-markdown wiring happens in unit 14.

interface Props {
  markdown: string
}

export default function NodeBody({ markdown }: Props) {
  return (
    <pre className="text-[12px] text-[#9ca3af] whitespace-pre-wrap font-mono">
      {markdown.slice(0, 500)}
    </pre>
  )
}
