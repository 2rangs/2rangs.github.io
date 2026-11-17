import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './site.css'

// 각 HTML 파일의 <html data-page="..."> 값으로 어떤 화면을 그릴지 정한다.
// 화면마다 따로 불러와서, 홈에서는 블로그·에디터 코드를 내려받지 않는다.
const pages = {
  home: () => import('./pages/Home').then((module) => module.Home),
  projects: () => import('./pages/Projects').then((module) => module.Projects),
  blog: () => import('./pages/Blog').then((module) => module.Blog),
  write: () => import('./pages/Write').then((module) => module.Write),
}

const load = pages[document.documentElement.dataset.page as keyof typeof pages] ?? pages.home

load().then((Page) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Page />
    </StrictMode>,
  )
})
