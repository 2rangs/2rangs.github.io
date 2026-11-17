import { useEffect, useRef, useState, type ReactNode } from 'react'

type Heading = { id: string; text: string; level: number }

// 고정 머리말 아래에서 "지금 읽는 위치"로 볼 기준선.
const READ_LINE = 110

function TocList({ headings, active, onPick }: { headings: Heading[]; active: string; onPick?: () => void }) {
  return (
    <ul>
      {headings.map((heading) => (
        <li key={heading.id} data-level={heading.level}>
          <a href={`#${heading.id}`} aria-current={active === heading.id ? 'location' : undefined} onClick={onPick}>{heading.text}</a>
        </li>
      ))}
    </ul>
  )
}

// 본문 옆에 목차를 붙인다. 목차는 본문 안의 h2, h3에서 만들고,
// 스크롤 위치에 따라 지금 읽는 항목과 읽은 비율을 표시한다.
export function Article({ contentKey, children }: { contentKey: string; children: ReactNode }) {
  const body = useRef<HTMLDivElement>(null)
  const mobileToc = useRef<HTMLDetailsElement>(null)
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const found = Array.from(body.current?.querySelectorAll<HTMLElement>('.prose h2, .prose h3') ?? [])
    setHeadings(found.map((element, index) => {
      element.id = `section-${index + 1}`
      return { id: element.id, text: element.textContent ?? '', level: element.tagName === 'H2' ? 2 : 3 }
    }))
  }, [contentKey])

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      // 기준선을 지나간 마지막 제목이 지금 읽는 항목이다.
      let current = ''
      for (const heading of headings) {
        const element = document.getElementById(heading.id)
        if (!element || element.getBoundingClientRect().top > READ_LINE) break
        current = heading.id
      }
      setActive(current)
      const rect = body.current?.getBoundingClientRect()
      if (rect) {
        const total = Math.max(1, rect.height - window.innerHeight + READ_LINE)
        setProgress(Math.min(1, Math.max(0, (READ_LINE - rect.top) / total)))
      }
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure) }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [headings])

  const hasToc = headings.length > 1
  return (
    <>
      <div className="read-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      {hasToc && (
        <details className="toc-mobile" ref={mobileToc}>
          <summary>목차</summary>
          <TocList headings={headings} active={active} onPick={() => { if (mobileToc.current) mobileToc.current.open = false }} />
        </details>
      )}
      <div className="article-grid">
        <div ref={body} className="article-body">{children}</div>
        {hasToc && (
          <nav className="toc" aria-label="목차">
            <p className="toc-title">목차</p>
            <TocList headings={headings} active={active} />
          </nav>
        )}
      </div>
    </>
  )
}
