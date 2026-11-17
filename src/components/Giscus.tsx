import { useEffect, useRef } from 'react'
import { savedTheme, THEME_EVENT, type Theme } from '../lib/theme'

// giscus는 HTTPS 주소의 CSS만 받으므로 배포된 파일을 가리킨다.
// 테마를 직접 고르지 않았으면 시스템 설정을 따르는 파일을, 골랐으면 그 테마로 고정된 파일을 쓴다.
const themeUrl = (theme: Theme | null) => `https://2rangs.github.io/giscus-theme${theme ? `-${theme}` : ''}.css`

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
      theme: themeUrl(savedTheme()),
      lang: 'ko',
      loading: 'lazy',
    }
    for (const [name, value] of Object.entries(options)) script.setAttribute(`data-${name}`, value)
    element.replaceChildren(script)

    // 머리말에서 테마를 바꾸면 이미 열린 댓글 창에도 알려 준다.
    const onTheme = (event: Event) => {
      const frame = element.querySelector<HTMLIFrameElement>('iframe.giscus-frame')
      frame?.contentWindow?.postMessage({ giscus: { setConfig: { theme: themeUrl((event as CustomEvent<Theme>).detail) } } }, 'https://giscus.app')
    }
    window.addEventListener(THEME_EVENT, onTheme)
    return () => {
      window.removeEventListener(THEME_EVENT, onTheme)
      element.replaceChildren()
    }
  }, [term])

  return (
    <section className="comments-area" aria-label="댓글">
      <h2>댓글</h2>
      <div ref={holder} style={{ marginTop: 16 }} />
    </section>
  )
}
