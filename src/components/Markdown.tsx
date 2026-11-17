import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// 예전 글에는 본문에 직접 넣은 이미지(data:image/...)가 있어서 그 주소만 추가로 허용한다.
const urlTransform = (url: string) => (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(url) ? url : defaultUrlTransform(url))

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlTransform}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target={props.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer" />,
          img: ({ node: _node, ...props }) => <img {...props} loading="lazy" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
