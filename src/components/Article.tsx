import { useEffect, useRef, useState, type ReactNode } from 'react'

// section: 이 제목이 속한 h2의 id (h2는 자기 자신)
type Heading = { id: string; text: string; level: number; section: string }

// 고정 머리말 아래에서 "지금 읽는 위치"로 볼 기준선.
const READ_LINE = 110

// collapse: 옆 목차는 지금 읽는 절의 h3만 펼친다. 제목이 많은 글에서 목차가 화면보다 길어지지 않게.
function TocList({ headings, active, onPick, collapse = false }: { headings: Heading[]; active: string; onPick?: () => void; collapse?: boolean }) {
  const openSection = headings.find((heading) => heading.id === active)?.section
  const shown = collapse ? headings.filter((heading) => heading.level === 2 || heading.section === openSection) : headings
  return (
    <ul>
      {shown.map((heading) => (
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
  const sideToc = useRef<HTMLElement>(null)
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const found = Array.from(body.current?.querySelectorAll<HTMLElement>('.prose h2, .prose h3') ?? [])
    // id는 Markdown이 제목 글자로 만들어 둔다. 제목 끝의 링크 기호(#)는 목차에서 뺀다.
    let section = ''
    setHeadings(found.map((element, index) => {
      if (!element.id) element.id = `section-${index + 1}`
      const text = Array.from(element.childNodes).filter((node) => !(node instanceof HTMLElement && node.classList.contains('anchor'))).map((node) => node.textContent).join('')
      const level = element.tagName === 'H2' ? 2 : 3
      if (level === 2) section = element.id
      return { id: element.id, text, level, section }
    }))
    // 주소에 #제목이 있으면 본문이 그려진 지금 그 위치로 옮긴다.
    if (location.hash) {
      try {
        document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView()
      } catch {
        // 잘못된 주소 조각은 무시한다.
      }
    }
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

  // 목차가 그래도 화면보다 길면, 지금 읽는 항목이 목차 상자 안에 보이도록 목차만 따라 내린다.
  useEffect(() => {
    const box = sideToc.current
    const link = box?.querySelector<HTMLElement>('a[aria-current]')
    if (!box || !link || box.scrollHeight <= box.clientHeight) return
    const boxRect = box.getBoundingClientRect()
    const linkRect = link.getBoundingClientRect()
    if (linkRect.top < boxRect.top + 40 || linkRect.bottom > boxRect.bottom - 40) {
      box.scrollTop += linkRect.top - boxRect.top - box.clientHeight / 3
    }
  }, [active])

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
          <nav className="toc" aria-label="목차" ref={sideToc}>
            <p className="toc-title">목차</p>
            <TocList headings={headings} active={active} collapse />
          </nav>
        )}
      </div>
    </>
  )
}
