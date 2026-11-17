import { useEffect, useRef } from 'react'
import { rememberGiscusViewer } from './Layout'

// giscus는 HTTPS 주소의 CSS만 받으므로 배포된 파일을 가리킨다. 사이트는 어두운 테마만 쓴다.
const THEME_URL = 'https://2rangs.github.io/giscus-theme-dark.css'

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
      // 댓글창이 로그인한 사람(viewer)을 알려 주게 한다. 주인(2rangs)이면 글쓰기·수정 버튼을 보여 준다.
      'emit-metadata': '1',
      'input-position': 'bottom',
      theme: THEME_URL,
      lang: 'ko',
      loading: 'lazy',
    }
    for (const [name, value] of Object.entries(options)) script.setAttribute(`data-${name}`, value)
    element.replaceChildren(script)
    return () => element.replaceChildren()
  }, [term])

  // giscus.app에서 온 메시지만 믿는다. viewer가 없으면(로그아웃) 기억해 둔 주인 표시도 지운다.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://giscus.app') return
      const data = (event.data as { giscus?: { viewer?: { login?: string } | null } } | undefined)?.giscus
      if (!data || !('viewer' in data)) return
      rememberGiscusViewer(data.viewer?.login ?? null)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <section className="comments-area" aria-label="댓글">
      <h2>댓글</h2>
      <div ref={holder} style={{ marginTop: 16 }} />
    </section>
  )
}
