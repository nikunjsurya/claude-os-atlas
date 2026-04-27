// Decorative 38px top bar. Aesthetic only, no functionality.
// Three traffic-light dots on the left, centered URL pill reading
// "claude-os.local / atlas". Sells the "this is an OS" vibe.

export default function BrowserChrome() {
  return (
    <div
      className="flex h-[38px] shrink-0 items-center border-b border-[#2A2D34] bg-[#15171D] px-3"
      aria-hidden
    >
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full bg-[#FF5F56]" />
        <span className="inline-block h-3 w-3 rounded-full bg-[#FFBD2E]" />
        <span className="inline-block h-3 w-3 rounded-full bg-[#27C93F]" />
      </div>
      <div className="flex flex-1 justify-center">
        <div className="rounded-md border border-[#2A2D34] bg-[#0E1014] px-4 py-1 font-mono text-[12px] tracking-wide text-[#6B7280]">
          claude-os.local / atlas
        </div>
      </div>
      <div className="w-[60px]" />
    </div>
  )
}
