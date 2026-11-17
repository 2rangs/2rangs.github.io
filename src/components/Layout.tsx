import { useEffect, useState, type ReactNode } from 'react'
import { paths } from '../lib/routes'
import { SITE } from '../lib/site'
import { currentTheme, setTheme, type Theme } from '../lib/theme'

export type Section = 'home' | 'projects' | 'blog' | 'write' | 'none'

// Supabase가 로그인 정보를 저장하는 자리. 있으면 글쓴이로 보고 글쓰기 링크를 보여 준다.
const SESSION_KEY = 'sb-wbtbmarooytomtynuvoe-auth-token'

export function useIsOwner() {
  const [owner, setOwner] = useState(false)
  useEffect(() => {
    try {
      setOwner(Boolean(localStorage.getItem(SESSION_KEY)))
    } catch {
      setOwner(false)
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

// 밝은 테마와 어두운 테마를 바꾸는 버튼. 빌드 때는 테마를 알 수 없어 그린 뒤에 맞춘다.
function ThemeToggle() {
  const [theme, setCurrent] = useState<Theme | null>(null)
  useEffect(() => setCurrent(currentTheme()), [])
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={next === 'dark' ? '어두운 테마로 바꾸기' : '밝은 테마로 바꾸기'}
      title={next === 'dark' ? '어두운 테마' : '밝은 테마'}
      onClick={() => { setTheme(next); setCurrent(next) }}
    >
      {theme === 'dark'
        ? <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10 1.8v2.2M10 16v2.2M1.8 10H4M16 10h2.2M4.2 4.2l1.5 1.5M14.3 14.3l1.5 1.5M4.2 15.8l1.5-1.5M14.3 5.7l1.5-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        : <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M16.5 12.3A7 7 0 0 1 7.7 3.5a7 7 0 1 0 8.8 8.8Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>}
    </button>
  )
}

export function Flower({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="-24 -24 48 48" aria-hidden="true">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse key={angle} cx="0" cy="-12" rx="7.5" ry="12" fill="currentColor" transform={`rotate(${angle})`} />
      ))}
      <circle r="5" fill="var(--bg)" />
    </svg>
  )
}

const NAV: [Section, string, string][] = [
  ['home', '소개', paths.home],
  ['blog', '블로그', paths.blog],
  ['projects', '포트폴리오', paths.projects],
]

export function Layout({ section, children }: { section: Section; children: ReactNode }) {
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
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        <div className="shell footer-inner">
          <div className="footer-about">
            <a className="brand" href={paths.home}><Flower /><span>{SITE.name}</span></a>
            <p>디자인 시스템과 지도·데이터 시각화를 만드는 프론트엔드 개발자의 기록.</p>
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
      <ToTop />
    </>
  )
}
