import { useEffect, useRef, useState, type ReactNode } from 'react'

type Heading = { id: string; text: string; level: number }

// 본문 옆에 목차를 붙인다. 목차는 본문 안의 h2, h3에서 만든다.
export function Article({ contentKey, children }: { contentKey: string; children: ReactNode }) {
  const body = useRef<HTMLDivElement>(null)
  const [headings, setHeadings] = useState<Heading[]>([])

  useEffect(() => {
    const found = Array.from(body.current?.querySelectorAll<HTMLElement>('.prose h2, .prose h3') ?? [])
    setHeadings(found.map((element, index) => {
      element.id = `section-${index + 1}`
      return { id: element.id, text: element.textContent ?? '', level: element.tagName === 'H2' ? 2 : 3 }
    }))
  }, [contentKey])

  return (
    <div className="article-grid">
      <div ref={body} className="article-body">{children}</div>
      {headings.length > 1 && (
        <nav className="toc" aria-label="목차">
          <p className="toc-title">목차</p>
          <ul>
            {headings.map((heading) => (
              <li key={heading.id} data-level={heading.level}><a href={`#${heading.id}`}>{heading.text}</a></li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
