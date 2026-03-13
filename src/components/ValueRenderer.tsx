import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { TracePanel } from '../lib/traceDocument'

function stringifyUnknown(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value, null, 2)
}

export function ValueRenderer({ panel }: { panel: TracePanel }) {
  if (panel.kind === 'markdown') {
    return (
      <div className="rendered-markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code(props) {
              const { className, children } = props
              const language = className?.replace('language-', '') || 'text'

              return (
                <SyntaxHighlighter language={language} style={oneLight} PreTag="div">
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              )
            },
          }}
        >
          {stringifyUnknown(panel.content)}
        </ReactMarkdown>
      </div>
    )
  }

  if (panel.kind === 'json') {
    const jsonText = JSON.stringify(panel.content, null, 2)

    return (
      <>
        <span className="sr-only">{jsonText}</span>
        <SyntaxHighlighter
          language="json"
          style={oneLight}
          customStyle={{ margin: 0, borderRadius: 18, padding: '1rem' }}
        >
          {jsonText}
        </SyntaxHighlighter>
      </>
    )
  }

  if (panel.kind === 'code') {
    const codeText = stringifyUnknown(panel.content)

    return (
      <>
        <span className="sr-only">{codeText}</span>
        <SyntaxHighlighter
          language={panel.language ?? 'text'}
          style={oneLight}
          customStyle={{ margin: 0, borderRadius: 18, padding: '1rem' }}
        >
          {codeText}
        </SyntaxHighlighter>
      </>
    )
  }

  return <pre className="rendered-text">{stringifyUnknown(panel.content)}</pre>
}
