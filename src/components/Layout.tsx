import { useEffect, useState, type ReactNode } from 'react'
import { paths } from '../lib/routes'
import { SITE } from '../lib/site'

export type Section = 'home' | 'projects' | 'blog' | 'write' | 'none'

// 블로그 주인으로 보이면 글쓰기·수정 버튼을 보여 준다. 주인으로 보는 경우는 둘이다.
//  1. Supabase에 주인 계정(OWNER_ID, GitHub 2rangs가 연결됨)으로 로그인해 있다.
//  2. 댓글창(giscus)에 GitHub 2rangs로 로그인해 있다. giscus가 알려 준 로그인 이름을 기억해 둔다.
// 버튼을 보여 주는 것일 뿐 권한은 아니다. 실제 저장은 Supabase 행 수준 보안(RLS)이 OWNER_ID만 허용하고,
// 2번만으로는 글쓰기 화면에서 GitHub 로그인을 한 번 더 거친다(이미 승인했다면 바로 돌아온다).
const SESSION_KEY = 'sb-wbtbmarooytomtynuvoe-auth-token'
const GISCUS_VIEWER_KEY = 'giscus-viewer'
const OWNER_CHANGE = 'owner-change'
export const OWNER_ID = '92193eba-8130-497f-94ff-04531af65136'
export const OWNER_GITHUB = '2rangs'

function readOwner() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
    return session?.user?.id === OWNER_ID || localStorage.getItem(GISCUS_VIEWER_KEY) === OWNER_GITHUB
  } catch {
    return false
  }
}

// 댓글창이 알려 준 로그인 이름을 기억한다. 주인이 아니거나 로그아웃했으면 지운다.
export function rememberGiscusViewer(login: string | null | undefined) {
  try {
    if (login === OWNER_GITHUB) localStorage.setItem(GISCUS_VIEWER_KEY, login)
    else localStorage.removeItem(GISCUS_VIEWER_KEY)
  } catch {
    // 저장소를 못 쓰는 브라우저에서는 그냥 넘어간다.
  }
  window.dispatchEvent(new Event(OWNER_CHANGE))
}

export function giscusViewerIsOwner() {
  try {
    return localStorage.getItem(GISCUS_VIEWER_KEY) === OWNER_GITHUB
  } catch {
    return false
  }
}

export function useIsOwner() {
  const [owner, setOwner] = useState(false)
  useEffect(() => {
    const update = () => setOwner(readOwner())
    update()
    // 같은 화면에서 댓글창이 로그인 정보를 알려 주거나, 다른 탭에서 로그인·로그아웃해도 바로 반영한다.
    window.addEventListener(OWNER_CHANGE, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(OWNER_CHANGE, update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return owner
}

// 길게 내려간 뒤에만 보이는 맨 위로 버튼.
function ToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 900)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <button className="to-top" type="button" data-show={show} aria-label="맨 위로" tabIndex={show ? 0 : -1} onClick={() => window.scrollTo({ top: 0 })}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  )
}

// 사이트 마크: 물결 두 줄이 든 육각형(public/img/mark.svg, scripts/icons.mjs가 만든다).
// 마스크로 써서 글자색이나 은박 그라데이션을 입힌다. 이전 꽃 모양 로고를 대신한다.
export function Flower({ className = 'brand-mark' }: { className?: string }) {
  return <i className={`mark ${className}`} aria-hidden="true" />
}

const NAV: [Section, string, string][] = [
  ['home', '소개', paths.home],
  ['blog', '블로그', paths.blog],
  ['projects', '포트폴리오', paths.projects],
]

// footer: 첫 화면은 아래 명함 카드가 푸터를 대신하므로 끈다.
export function Layout({ section, footer = true, children }: { section: Section; footer?: boolean; children: ReactNode }) {
  const owner = useIsOwner()
  const current = (name: Section) => (section === name ? 'page' : undefined)
  return (
    <>
      <a className="skip-link" href="#main">본문으로 건너뛰기</a>
      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand" href={paths.home} aria-label={`${SITE.name} 홈`}>
            <Flower />
            <span>{SITE.name}</span>
          </a>
          <nav className="nav" aria-label="주 메뉴">
            {NAV.map(([name, label, href]) => <a key={name} href={href} aria-current={current(name)}>{label}</a>)}
            {owner && <a href={paths.write} aria-current={current('write')}>글쓰기</a>}
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      {footer && (
      <footer className="site-footer">
        <div className="shell footer-inner">
          <div className="footer-about">
            <a className="brand" href={paths.home}><Flower /><span>{SITE.name}</span></a>
            <p>디자인 시스템과 지도·데이터 시각화를 만드는 프론트엔드 개발자의 기록.</p>
            <span className="signature footer-sign" role="img" aria-label={`${SITE.name} 서명`} />
          </div>
          <nav className="footer-links" aria-label="사이트 정보">
            <div>
              <h2>둘러보기</h2>
              <a href={paths.blog}>블로그</a>
              <a href={paths.projects}>포트폴리오</a>
              <a href={paths.home}>소개</a>
            </div>
            <div>
              <h2>연락</h2>
              <a href={`mailto:${SITE.email}`}>이메일</a>
              <a href={SITE.github} rel="me">GitHub</a>
              <a href="/rss.xml">RSS 구독</a>
            </div>
          </nav>
        </div>
        <div className="shell footer-base">
          <span>© {SITE.since}–{new Date().getFullYear()} {SITE.name}. 글과 코드의 저작권은 작성자에게 있습니다.</span>
          <a href={paths.privacy}>개인정보처리방침</a>
        </div>
      </footer>
      )}
      <ToTop />
    </>
  )
}
