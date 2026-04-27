'use client'

// Markdown body renderer for the side panel. Uses react-markdown + remark-gfm
// for tables, strikethrough, task lists. Styled to read well against the
// dark panel: dim text, slightly muted headings, subtle code blocks.

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  markdown: string
}

export default function NodeBody({ markdown }: Props) {
  return (
    <div className="text-[13px] leading-relaxed text-[#9ca3af]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h3 className="mt-4 mb-2 text-[15px] font-semibold text-[#E6E8EE]" {...props} />
          ),
          h2: (props) => (
            <h4 className="mt-4 mb-2 text-[14px] font-semibold text-[#E6E8EE]" {...props} />
          ),
          h3: (props) => (
            <h5 className="mt-3 mb-1.5 text-[13px] font-semibold text-[#E6E8EE]" {...props} />
          ),
          p: (props) => <p className="my-2" {...props} />,
          ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
          ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
          li: (props) => <li className="text-[13px]" {...props} />,
          a: (props) => (
            <a
              className="text-[#E07B4E] underline decoration-[#E07B4E]/40 underline-offset-2 hover:decoration-[#E07B4E]"
              target="_blank"
              rel="noreferrer"
              {...props}
            />
          ),
          code: (props) => {
            const { children, className } = props as { children?: React.ReactNode; className?: string }
            const isBlock = (className ?? '').startsWith('language-')
            if (isBlock) {
              return (
                <code className="block whitespace-pre-wrap rounded bg-[#0E1014] p-3 font-mono text-[12px] text-[#E6E8EE]">
                  {children}
                </code>
              )
            }
            return (
              <code className="rounded bg-[#0E1014] px-1 py-0.5 font-mono text-[12px] text-[#E6E8EE]">
                {children}
              </code>
            )
          },
          pre: (props) => <pre className="my-2 overflow-x-auto" {...props} />,
          blockquote: (props) => (
            <blockquote
              className="my-2 border-l-2 border-[#2A2D34] pl-3 text-[#6B7280] italic"
              {...props}
            />
          ),
          table: (props) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-[12px]" {...props} />
            </div>
          ),
          th: (props) => (
            <th
              className="border-b border-[#2A2D34] px-2 py-1 text-left font-semibold text-[#E6E8EE]"
              {...props}
            />
          ),
          td: (props) => <td className="border-b border-[#2A2D34]/40 px-2 py-1" {...props} />,
          hr: () => <hr className="my-3 border-[#2A2D34]" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
