import { useEffect, useState, type ReactNode } from 'react'
import { paths } from '../lib/routes'
import { SITE } from '../lib/site'

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

function Flower() {
  return (
    <svg className="brand-mark" viewBox="-24 -24 48 48" aria-hidden="true">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse key={angle} cx="0" cy="-12" rx="7.5" ry="12" fill="var(--accent)" transform={`rotate(${angle})`} />
      ))}
      <circle r="5" fill="var(--bg)" />
    </svg>
  )
}

export function Layout({ section, children }: { section: Section; children: ReactNode }) {
  const owner = useIsOwner()
  const current = (name: Section) => (section === name ? 'page' : undefined)
  return (
    <>
      <a className="skip-link" href="#main">본문으로 건너뛰기</a>
      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand" href={paths.home}><Flower /><span>{SITE.name}</span></a>
          <nav className="nav" aria-label="주 메뉴">
            <a href={paths.projects} aria-current={current('projects')}>포트폴리오</a>
            <a href={paths.blog} aria-current={current('blog')}>블로그</a>
            {owner && <a href={paths.write} aria-current={current('write')}>글쓰기</a>}
            <a href={SITE.github}>GitHub</a>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="shell site-footer">
        <span>© {new Date().getFullYear()} {SITE.name}</span>
        <span>
          <a href={`mailto:${SITE.email}`}>Email</a> · <a href={SITE.github}>GitHub</a> · <a href="/rss.xml">RSS</a>
        </span>
      </footer>
    </>
  )
}
