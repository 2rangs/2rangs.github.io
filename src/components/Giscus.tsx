import { useEffect, useRef } from 'react'

// 댓글은 giscus로 GitHub Discussions(2rangs/2rang25의 Comments 분류)에 저장된다.
// term 이 같으면 같은 댓글 스레드가 열린다.
export function Giscus({ term }: { term: string }) {
  const holder = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = holder.current
    if (!element) return
    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.async = true
    script.crossOrigin = 'anonymous'
    const options: Record<string, string> = {
      repo: '2rangs/2rang25',
      'repo-id': 'R_kgDOLZGXSg',
      category: 'Comments',
      'category-id': 'DIC_kwDOLZGXSs4Ck1Vx',
      mapping: 'specific',
      term,
      strict: '1',
      'reactions-enabled': '0',
      'emit-metadata': '0',
      'input-position': 'bottom',
      // 사이트와 같은 무채색 테마. giscus는 HTTPS 주소의 CSS만 받으므로 배포된 파일을 가리킨다.
      theme: 'https://2rangs.github.io/giscus-theme.css',
      lang: 'ko',
      loading: 'lazy',
    }
    for (const [name, value] of Object.entries(options)) script.setAttribute(`data-${name}`, value)
    element.replaceChildren(script)
    return () => element.replaceChildren()
  }, [term])

  return (
    <section className="comments-area" aria-label="댓글">
      <h2>댓글</h2>
      <div ref={holder} style={{ marginTop: 16 }} />
    </section>
  )
}
