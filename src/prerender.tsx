import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { projects } from './lib/content'
import { getPost, listPosts, type Post, type PostSummary } from './lib/posts'
import { paths } from './lib/routes'
import { blogMeta, homeMeta, notFoundMeta, postMeta, projectMeta, projectsMeta, writeMeta, type Meta } from './lib/seo'
import { PostList, PostView } from './pages/Blog'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'
import { ProjectDetail, ProjectList } from './pages/Projects'

// 빌드 때 scripts/prerender.mjs가 불러 쓴다. 검색엔진과 링크 미리보기가 자바스크립트 없이도
// 내용을 읽을 수 있도록, 주소마다 완성된 HTML과 <head> 정보를 만들어 돌려준다.
export type Page = {
  path: string
  meta: Meta
  html: string
  data?: Record<string, unknown>
  card?: { file: string; kicker: string; title: string }
  updatedAt?: string
}

const render = (node: ReactNode) => renderToStaticMarkup(node)

export async function buildPages() {
  let summaries: PostSummary[] = []
  const posts: Post[] = []
  try {
    summaries = await listPosts()
    for (const summary of summaries) {
      const post = await getPost(summary.key)
      if (post) posts.push(post)
    }
  } catch (reason) {
    // 글을 못 받아도 배포는 계속한다. 글 페이지는 브라우저에서 그려진다.
    console.warn('블로그 글을 가져오지 못했습니다:', reason)
    summaries = []
  }

  const pages: Page[] = [
    { path: paths.home, meta: homeMeta, html: render(<Home />), card: { file: 'default', kicker: 'FRONTEND ENGINEER', title: '김이랑' } },
    { path: paths.projects, meta: projectsMeta, html: render(<ProjectList />) },
    ...projects.map((project) => ({
      path: paths.project(project.slug),
      meta: projectMeta(project),
      html: render(<ProjectDetail slug={project.slug} />),
      card: { file: `project-${project.slug}`, kicker: 'PORTFOLIO', title: project.title },
    })),
    { path: paths.blog, meta: blogMeta, html: render(<PostList initial={summaries} />), data: { posts: summaries } },
    ...posts.map((post) => ({
      path: paths.post(post.key),
      meta: postMeta(post),
      html: render(<PostView postKey={post.key} initial={post} />),
      data: { post },
      card: { file: `post-${post.key}`, kicker: 'BLOG', title: post.title },
      updatedAt: post.date,
    })),
    { path: paths.write, meta: writeMeta, html: '' },
  ]

  return { pages, posts, notFound: { meta: notFoundMeta, html: render(<NotFound />) } }
}
