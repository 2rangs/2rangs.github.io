import { useEffect, useState, type ReactNode } from 'react'
import { paths } from '../lib/routes'
import { SITE } from '../lib/site'

export type Section = 'home' | 'projects' | 'blog' | 'write' | 'none'

// Supabase에 주인 계정(OWNER_ID, GitHub 2rangs가 연결됨)으로 로그인해 있으면 글쓰기·수정 버튼을 보여 준다.
// 버튼을 보여 주는 것일 뿐 권한은 아니다. 실제 저장은 Supabase 행 수준 보안(RLS)이 OWNER_ID만 허용한다.
const SESSION_KEY = 'sb-wbtbmarooytomtynuvoe-auth-token'
export const OWNER_ID = '92193eba-8130-497f-94ff-04531af65136'
export const OWNER_GITHUB = '2rangs'

function readOwner() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
    return session?.user?.id === OWNER_ID
  } catch {
    return false
  }
}

export function useIsOwner() {
  const [owner, setOwner] = useState(false)
  useEffect(() => {
    const update = () => {
      const value = readOwner()
      setOwner(value)
      // index.html의 머리 스크립트가 먼저 붙인 표시를 로그인·로그아웃에 맞춰 고친다. .owner-only는 이 표시로 보이고 숨는다.
      document.documentElement.toggleAttribute('data-owner', value)
    }
    update()
    // 다른 탭에서 로그인·로그아웃해도 바로 반영한다.
    window.addEventListener('storage', update)
    return () => {
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
  useIsOwner()
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
            {/* 빌드 때 그린 HTML에도 늘 넣어 두고 CSS로 숨긴다. 로그인 확인을 기다렸다가 넣으면 메뉴가 늦게 밀린다. */}
            <a className="owner-only" href={paths.write} aria-current={current('write')}>글쓰기</a>
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
