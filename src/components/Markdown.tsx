import { useRef, useState, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import { createLowlight } from 'lowlight'
import remarkGfm from 'remark-gfm'

// 예전 글에는 본문에 직접 넣은 이미지(data:image/...)가 있어서 그 주소만 추가로 허용한다.
const urlTransform = (url: string) => (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(url) ? url : defaultUrlTransform(url))

type HastNode = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: HastNode[] }

const textOf = (node: HastNode): string => (node.type === 'text' ? node.value ?? '' : (node.children ?? []).map(textOf).join(''))

// 제목에 읽을 수 있는 id와 링크(#)를 붙인다. 빌드 때 미리 그린 HTML에도 들어가서 목차와 공유 링크가 그대로 동작한다.
export const slugify = (text: string) =>
  text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'section'

function rehypeHeadingAnchors() {
  return (tree: HastNode) => {
    const used = new Map<string, number>()
    const walk = (node: HastNode) => {
      if (node.type === 'element' && (node.tagName === 'h2' || node.tagName === 'h3')) {
        const base = slugify(textOf(node))
        const count = used.get(base) ?? 0
        used.set(base, count + 1)
        const id = count ? `${base}-${count}` : base
        node.properties = { ...node.properties, id }
        node.children = [
          ...(node.children ?? []),
          { type: 'element', tagName: 'a', properties: { className: ['anchor'], href: `#${id}`, ariaLabel: '이 제목으로 바로 가는 링크' }, children: [{ type: 'text', value: '#' }] },
        ]
        return
      }
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}

// 글 끝의 '참고' 절에 링크가 길게 늘어서면 본문보다 길어진다. 제목은 그대로 두고(목차에 남도록)
// 그 아래 내용만 접어 둔다. 링크가 몇 개 안 되면 접지 않는다.
const REFERENCE_TITLE = /^(참고|참고\s*자료|참고한\s*자료|출처|references?|further reading)$/i
const FOLD_FROM = 6

function rehypeFoldReferences() {
  const countItems = (nodes: HastNode[]): number =>
    nodes.reduce((sum, node) => sum + (node.type === 'element' && node.tagName === 'li' ? 1 : 0) + countItems(node.children ?? []), 0)
  return (tree: HastNode) => {
    const kids = tree.children ?? []
    for (let i = 0; i < kids.length; i++) {
      const node = kids[i]
      if (node.type !== 'element' || node.tagName !== 'h2' || !REFERENCE_TITLE.test(textOf(node).trim())) continue
      let end = i + 1
      while (end < kids.length && !(kids[end].type === 'element' && kids[end].tagName === 'h2')) end++
      const body = kids.slice(i + 1, end)
      const count = countItems(body)
      if (count < FOLD_FROM) continue
      kids.splice(i + 1, end - i - 1, {
        type: 'element', tagName: 'details', properties: { className: ['references'] },
        children: [{ type: 'element', tagName: 'summary', properties: {}, children: [{ type: 'text', value: `자료 ${count}개 펼쳐 보기` }] }, ...body],
      })
    }
  }
}

// 코드 강조. 글에 실제로 쓰는 언어만 넣어 코드 크기를 줄인다. 다른 언어는 강조 없이 보인다.
const lowlight = createLowlight({ bash, css, javascript, json, typescript, xml, yaml })
lowlight.registerAlias({ xml: ['html', 'vue'], bash: ['sh', 'shell'], javascript: ['js', 'jsx'], typescript: ['ts', 'tsx'] })

function rehypeCodeHighlight() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (node.type === 'element' && node.tagName === 'pre') {
        const code = node.children?.find((child) => child.type === 'element' && child.tagName === 'code')
        const classes = (code?.properties?.className as string[] | undefined) ?? []
        const language = classes.find((name) => name.startsWith('language-'))?.slice('language-'.length)
        if (code && language && lowlight.registered(language)) {
          code.children = lowlight.highlight(language, textOf(code)).children as HastNode[]
          code.properties = { ...code.properties, className: [...classes, 'hljs'] }
        }
        return
      }
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}

const LANGUAGE_NAMES: Record<string, string> = { js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX', css: 'CSS', html: 'HTML', vue: 'Vue', bash: 'Shell', sh: 'Shell', json: 'JSON', yaml: 'YAML', text: '텍스트' }

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
        <span>{language ? LANGUAGE_NAMES[language] ?? language : '코드'}</span>
        <button type="button" onClick={copy} aria-live="polite">{copied ? '복사됨' : '복사'}</button>
      </div>
      <pre ref={pre}>{props.children}</pre>
    </div>
  )
}

// resolve: 외부 문서(예: GitHub README)의 상대 주소를 원래 위치로 바꿀 때 쓴다. key는 'href' 또는 'src'.
export function Markdown({ children, resolve }: { children: string; resolve?: (url: string, key: string) => string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeFoldReferences,
          rehypeCodeHighlight,
          rehypeHeadingAnchors,
        ]}
        urlTransform={resolve ? (url, key) => urlTransform(resolve(url, key)) : urlTransform}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target={props.href?.startsWith('http') ? '_blank' : undefined} rel={props.href?.startsWith('http') ? 'noreferrer' : undefined} />,
          img: ({ node: _node, ...props }) => <img {...props} loading="lazy" decoding="async" />,
          pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
