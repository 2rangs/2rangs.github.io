import { Layout } from '../components/Layout'
import { Markdown } from '../components/Markdown'
import { ProjectCard } from '../components/ProjectCard'
import { projects } from '../lib/content'

const GROUPS = [
  ['work', '실무'],
  ['personal', '개인 프로젝트'],
] as const

export function Projects() {
  const slug = new URLSearchParams(location.search).get('p')
  const project = slug ? projects.find((item) => item.slug === slug) : undefined

  if (slug && !project) {
    return (
      <Layout page="projects">
        <div className="narrow page-head">
          <a className="back" href="./">← 포트폴리오</a>
          <h1>프로젝트를 찾을 수 없습니다</h1>
        </div>
      </Layout>
    )
  }

  if (project) {
    document.title = `${project.title} | 김이랑`
    return (
      <Layout page="projects">
        <article className="narrow">
          <header className="page-head">
            <a className="back" href="./">← 포트폴리오</a>
            <h1>{project.title}</h1>
            <div className="meta">
              <span className="tag">{project.role}</span>
              {project.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            {project.summary && <p className="section-lead">{project.summary}</p>}
            {project.link && <p style={{ marginTop: 16 }}><a className="button ghost" href={project.link}>저장소 보기</a></p>}
          </header>
          {project.cover && <img style={{ marginTop: 28, borderRadius: 16 }} src={`../${project.cover}`} alt="" />}
          <Markdown>{project.body}</Markdown>
        </article>
      </Layout>
    )
  }

  return (
    <Layout page="projects">
      <div className="shell">
        <header className="page-head">
          <p className="label">Portfolio</p>
          <h1>포트폴리오</h1>
          <p className="section-lead">실무에서 맡은 일과 개인 프로젝트입니다. 실무 프로젝트명은 가칭입니다.</p>
        </header>
        {GROUPS.map(([kind, title]) => {
          const items = projects.filter((item) => item.kind === kind)
          if (!items.length) return null
          return (
            <section key={kind} aria-label={title}>
              <h2 className="group-title">{title}</h2>
              <div className="cards" style={{ marginTop: 12 }}>
                {items.map((item) => <ProjectCard key={item.slug} project={item} root="../" />)}
              </div>
            </section>
          )
        })}
      </div>
    </Layout>
  )
}
