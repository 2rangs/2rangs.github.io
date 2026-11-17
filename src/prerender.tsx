import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown } from './components/Markdown'
import { projects } from './lib/content'
import { getPost, listPosts, type Post, type PostSummary } from './lib/posts'
import { paths } from './lib/routes'
import { blogMeta, homeMeta, notFoundMeta, postMeta, privacyMeta, projectMeta, projectsMeta, writeMeta, type Meta } from './lib/seo'
import { About, Privacy } from './pages/About'
import { PostList, PostView } from './pages/Blog'
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
  priority?: number
  // RSS에 넣을 본문 HTML
  feedHtml?: string
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
  const latest = summaries[0]?.updated || summaries[0]?.date
  const recent = summaries.slice(0, 5)

  const pages: Page[] = [
    { path: paths.home, meta: homeMeta, html: render(<About initial={recent} />), data: { posts: recent }, card: { file: 'default', kicker: 'FRONTEND ENGINEER', title: '김이랑' }, updatedAt: latest, priority: 1 },
    { path: paths.blog, meta: blogMeta, html: render(<PostList initial={summaries} />), data: { posts: summaries }, updatedAt: latest, priority: 0.9 },
    ...posts.map((post) => ({
      path: paths.post(post.key),
      meta: postMeta(post),
      html: render(<PostView postKey={post.key} initial={post} list={summaries} />),
      data: { post, list: summaries },
      card: { file: `post-${post.key}`, kicker: (post.tags[0] ?? 'BLOG').toUpperCase(), title: post.title },
      updatedAt: post.updated || post.date,
      priority: 0.8,
      feedHtml: render(<Markdown>{post.markdown}</Markdown>),
    })),
    { path: paths.projects, meta: projectsMeta, html: render(<ProjectList />), priority: 0.7 },
    ...projects.map((project) => ({
      path: paths.project(project.slug),
      meta: projectMeta(project),
      html: render(<ProjectDetail slug={project.slug} />),
      card: { file: `project-${project.slug}`, kicker: 'PORTFOLIO', title: project.title },
      priority: 0.6,
    })),
    { path: paths.privacy, meta: privacyMeta, html: render(<Privacy />), priority: 0.2 },
    { path: paths.write, meta: writeMeta, html: '' },
  ]

  return { pages, posts, notFound: { meta: notFoundMeta, html: render(<NotFound />) } }
}
