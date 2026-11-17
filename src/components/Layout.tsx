import type { ReactNode } from 'react'

export type PageName = 'home' | 'projects' | 'blog' | 'write'

// 홈은 사이트 루트에, 나머지 페이지는 한 단계 아래 폴더에 있다.
export const rootPath = (page: PageName) => (page === 'home' ? './' : '../')

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

export function Layout({ page, children }: { page: PageName; children: ReactNode }) {
  const root = rootPath(page)
  const current = (name: PageName) => (page === name ? 'page' : undefined)
  return (
    <>
      <a className="skip-link" href="#main">본문으로 건너뛰기</a>
      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand" href={root}><Flower /><span>김이랑</span></a>
          <nav className="nav" aria-label="주 메뉴">
            <a href={`${root}projects/`} aria-current={current('projects')}>포트폴리오</a>
            <a href={`${root}blog/`} aria-current={current('blog')}>블로그</a>
            <a href="https://github.com/2rangs">GitHub</a>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="shell site-footer">
        <span>© {new Date().getFullYear()} 김이랑</span>
        <span>
          <a href="mailto:2_rang25@naver.com">Email</a> · <a href="https://github.com/2rangs">GitHub</a> · <a href={`${root}write/`}>글쓰기</a>
        </span>
      </footer>
    </>
  )
}
