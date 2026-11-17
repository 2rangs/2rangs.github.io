import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './site.css'
import { parseRoute, paths } from './lib/routes'
import { aboutMeta, applyMeta, blogMeta, homeMeta, notFoundMeta, privacyMeta, projectMeta, projectsMeta, writeMeta } from './lib/seo'

const route = parseRoute(location.pathname)

// 빌드 때 페이지에 같이 넣어 둔 데이터. 다른 주소의 것이면 쓰지 않는다.
function embedded(): Record<string, any> | undefined {
  try {
    const data = JSON.parse(document.getElementById('__DATA__')?.textContent ?? 'null')
    return data?.path === location.pathname ? data : undefined
  } catch {
    return undefined
  }
}

// 화면마다 따로 불러와서, 읽는 화면에서는 에디터 코드를 내려받지 않는다.
async function load(): Promise<ReactNode> {
  const data = embedded()
  switch (route.page) {
    case 'home': {
      applyMeta(homeMeta)
      const { Home } = await import('./pages/Home')
      return <Home initial={data?.posts} />
    }
    case 'about': {
      applyMeta(aboutMeta)
      const { About } = await import('./pages/About')
      return <About />
    }
    case 'privacy': {
      applyMeta(privacyMeta)
      const { Privacy } = await import('./pages/About')
      return <Privacy />
    }
    case 'projects': {
      applyMeta(projectsMeta)
      const { ProjectList } = await import('./pages/Projects')
      return <ProjectList />
    }
    case 'project': {
      const [{ ProjectDetail }, { projects }] = await Promise.all([import('./pages/Projects'), import('./lib/content')])
      const project = projects.find((item) => item.slug === route.slug)
      applyMeta(project ? projectMeta(project) : notFoundMeta)
      return <ProjectDetail slug={route.slug} />
    }
    case 'blog': {
      applyMeta(blogMeta)
      const { PostList } = await import('./pages/Blog')
      return <PostList initial={data?.posts} />
    }
    case 'post': {
      const { PostView } = await import('./pages/Blog')
      return <PostView postKey={route.key} initial={data?.post} list={data?.list} />
    }
    case 'write': {
      applyMeta(writeMeta)
      const { Write } = await import('./pages/Write')
      return <Write />
    }
    default: {
      applyMeta(notFoundMeta)
      const { NotFound } = await import('./pages/NotFound')
      return <NotFound />
    }
  }
}

// 예전 주소(/blog/?p=글)로 들어오면 새 주소로 옮긴다.
const legacy = new URLSearchParams(location.search).get('p')
if (legacy && route.page === 'blog') location.replace(paths.post(legacy))
else if (legacy && route.page === 'projects') location.replace(paths.project(legacy))
else {
  load().then((node) => {
    createRoot(document.getElementById('root')!).render(<StrictMode>{node}</StrictMode>)
    // 주소에 #이 있으면 그려진 뒤에 그 위치로 옮긴다.
    if (location.hash) requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView())
  })
}
