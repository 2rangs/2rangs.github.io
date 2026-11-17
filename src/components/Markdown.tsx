import { useRef, useState, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// 예전 글에는 본문에 직접 넣은 이미지(data:image/...)가 있어서 그 주소만 추가로 허용한다.
const urlTransform = (url: string) => (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(url) ? url : defaultUrlTransform(url))

// 코드 블록 위에 언어 이름과 복사 버튼을 붙인다.
function CodeBlock(props: ComponentPropsWithoutRef<'pre'>) {
  const pre = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const child = props.children as { props?: { className?: string } } | undefined
  const language = /language-([\w-]+)/.exec(child?.props?.className ?? '')?.[1]

  async function copy() {
    try {
      await navigator.clipboard.writeText(pre.current?.textContent ?? '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="code-block">
      <div className="code-bar">
        <span>{language ?? 'code'}</span>
        <button type="button" onClick={copy}>{copied ? '복사됨' : '복사'}</button>
      </div>
      <pre ref={pre}>{props.children}</pre>
    </div>
  )
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlTransform}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target={props.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer" />,
          img: ({ node: _node, ...props }) => <img {...props} loading="lazy" />,
          pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
