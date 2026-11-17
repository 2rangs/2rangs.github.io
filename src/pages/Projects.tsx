import { Article } from '../components/Article'
import { Layout } from '../components/Layout'
import { Markdown } from '../components/Markdown'
import { ProjectRow } from '../components/ProjectCard'
import { projects } from '../lib/content'
import { paths } from '../lib/routes'
import { NotFound } from './NotFound'

const GROUPS = [
  ['work', '실무', '회사에서 맡은 프로젝트입니다. 프로젝트명은 가칭입니다.'],
  ['personal', '개인 프로젝트', '관심사를 직접 만들어 본 것들입니다. 저장소가 공개되어 있습니다.'],
] as const

export function ProjectDetail({ slug }: { slug: string }) {
  const index = projects.findIndex((item) => item.slug === slug)
  const project = projects[index]
  if (!project) return <NotFound />
  const next = projects[(index + 1) % projects.length]
  return (
    <Layout section="projects">
      <article className="shell">
        <header className="page-head">
          <nav className="crumbs" aria-label="이동 경로"><a href={paths.projects}>포트폴리오</a></nav>
          <h1>{project.title}</h1>
          {project.summary && <p className="page-lead">{project.summary}</p>}
          <dl className="facts">
            <div><dt>역할</dt><dd>{project.role}</dd></div>
            <div><dt>구분</dt><dd>{project.kind === 'work' ? '실무' : '개인 프로젝트'}</dd></div>
            <div><dt>기술</dt><dd>{project.tags.join(', ')}</dd></div>
            {project.link && <div><dt>저장소</dt><dd><a href={project.link}>{project.link.replace('https://', '')}</a></dd></div>}
          </dl>
        </header>
        {project.cover && <img className="cover" src={`/${project.cover}`} alt="" />}
        <Article contentKey={project.slug}><Markdown>{project.body}</Markdown></Article>
        {next && next.slug !== project.slug && (
          <nav className="post-nav" aria-label="다음 프로젝트">
            <a className="next" href={paths.project(next.slug)}><span>다음 프로젝트</span><strong>{next.title}</strong></a>
          </nav>
        )}
      </article>
    </Layout>
  )
}

export function ProjectList() {
  return (
    <Layout section="projects">
      <div className="shell">
        <header className="page-head">
          <h1>포트폴리오</h1>
          <p className="page-lead">디자인 시스템부터 AI 탐지 결과를 다루는 관제·검수 화면까지, 맡았던 일과 그 안에서 내린 결정을 정리했습니다.</p>
        </header>
        {GROUPS.map(([kind, title, lead]) => {
          const items = projects.filter((item) => item.kind === kind)
          if (!items.length) return null
          return (
            <section className="block" key={kind} aria-labelledby={`group-${kind}`}>
              <div className="block-head">
                <h2 id={`group-${kind}`}>{title}</h2>
                <span className="muted">{lead}</span>
              </div>
              <ul className="project-rows">
                {items.map((item) => <ProjectRow key={item.slug} project={item} />)}
              </ul>
            </section>
          )
        })}
      </div>
    </Layout>
  )
}
