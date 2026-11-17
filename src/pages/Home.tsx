import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { PostRow } from '../components/PostRow'
import { ProjectRow } from '../components/ProjectCard'
import { projects } from '../lib/content'
import { listPosts, type PostSummary } from '../lib/posts'
import { paths } from '../lib/routes'
import { SITE } from '../lib/site'

const RECENT = 5
const featured = projects.filter((project) => project.kind === 'work').slice(0, 3)

// initial은 빌드 때 넣어 둔 최근 글이다. 화면을 바로 그린 뒤 최신 목록으로 바꾼다.
export function Home({ initial }: { initial?: PostSummary[] }) {
  const [posts, setPosts] = useState<PostSummary[] | undefined>(initial)
  useEffect(() => {
    listPosts().then((list) => setPosts(list.slice(0, RECENT))).catch(() => undefined)
  }, [])

  return (
    <Layout section="home">
      <div className="shell">
        <section className="intro" aria-labelledby="intro-title">
          <h1 id="intro-title" className="intro-name">{SITE.name}</h1>
          <p className="intro-statement">
            프로젝트마다 어긋나던 화면을 <a href={paths.project('design-system')}>하나의 디자인 시스템</a>으로 묶고,
            AI가 찾아낸 것을 사람이 확인하는 <a href={paths.project('detection-review')}>관제·지도 화면</a>을 만듭니다.
            배운 것은 <a href={paths.blog}>블로그</a>에 정리합니다.
          </p>
          <ul className="intro-links" aria-label="연락처">
            <li><a href={paths.about}>소개 읽기</a></li>
            <li><a href={SITE.github} rel="me">GitHub</a></li>
            <li><a href={`mailto:${SITE.email}`}>{SITE.email}</a></li>
          </ul>
        </section>

        <section className="block" aria-labelledby="recent-title">
          <div className="block-head">
            <h2 id="recent-title">최근 글</h2>
            <a href={paths.blog}>글 전체 보기</a>
          </div>
          {posts === undefined && <p className="muted">글을 불러오는 중입니다.</p>}
          {posts?.length === 0 && <p className="muted">아직 발행한 글이 없습니다.</p>}
          {posts && posts.length > 0 && (
            <ul className="post-rows">
              {posts.slice(0, RECENT).map((post) => <PostRow key={post.key} post={post} showYear />)}
            </ul>
          )}
        </section>

        <section className="block" aria-labelledby="work-title">
          <div className="block-head">
            <h2 id="work-title">맡아 온 일</h2>
            <a href={paths.projects}>포트폴리오 전체 보기</a>
          </div>
          <ul className="project-rows">
            {featured.map((project) => <ProjectRow key={project.slug} project={project} />)}
          </ul>
        </section>
      </div>
    </Layout>
  )
}
