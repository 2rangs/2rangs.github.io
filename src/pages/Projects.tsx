import { useEffect, useMemo, useState } from 'react'
import { Article } from '../components/Article'
import { Layout } from '../components/Layout'
import { Markdown } from '../components/Markdown'
import { ProjectCard } from '../components/ProjectCard'
import { projects, type Project } from '../lib/content'
import { paths } from '../lib/routes'
import { NotFound } from './NotFound'

const GROUPS = [
  ['work', '실무', '회사에서 맡은 프로젝트입니다. 프로젝트명은 가칭입니다.'],
  ['personal', '개인 프로젝트', '관심사를 직접 만들어 본 것들입니다. 저장소가 공개되어 있습니다.'],
] as const

// 같은 구분(실무·개인)에서 기술이 많이 겹치는 프로젝트부터 고른다.
function related(project: Project, count = 3) {
  return projects
    .filter((item) => item.slug !== project.slug)
    .map((item) => ({ item, score: (item.kind === project.kind ? 2 : 0) + item.tags.filter((tag) => project.tags.includes(tag)).length }))
    .sort((a, b) => b.score - a.score || a.item.order - b.item.order)
    .slice(0, count)
    .map(({ item }) => item)
}

export function ProjectDetail({ slug }: { slug: string }) {
  const project = projects.find((item) => item.slug === slug)
  if (!project) return <NotFound />
  const more = related(project)
  return (
    <Layout section="projects">
      <article className="shell">
        <header className="page-head project-head">
          <nav className="crumbs" aria-label="이동 경로">
            <a href={paths.projects}>포트폴리오</a>
            <a href={`${paths.projects}#group-${project.kind}`}>{project.kind === 'work' ? '실무' : '개인 프로젝트'}</a>
          </nav>
          <h1>{project.title}</h1>
          {project.summary && <p className="page-lead">{project.summary}</p>}
          <dl className="facts">
            <div><dt>역할</dt><dd>{project.role}</dd></div>
            <div><dt>구분</dt><dd>{project.kind === 'work' ? '실무' : '개인 프로젝트'}</dd></div>
            <div><dt>기술</dt><dd><ul className="stack">{project.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul></dd></div>
            {project.link && <div><dt>저장소</dt><dd><a href={project.link}>{project.link.replace('https://', '')}</a></dd></div>}
          </dl>
        </header>
        {project.cover && (
          <figure className="project-cover">
            <img src={`/${project.cover}`} alt="" width="1200" height="630" decoding="async" />
          </figure>
        )}
        <Article contentKey={project.slug}><Markdown>{project.body}</Markdown></Article>
        {more.length > 0 && (
          <section className="more-projects" aria-labelledby="more-projects-title">
            <h2 id="more-projects-title">다른 프로젝트</h2>
            <div className="cards">{more.map((item) => <ProjectCard key={item.slug} project={item} />)}</div>
          </section>
        )}
      </article>
    </Layout>
  )
}

const techFromUrl = () => (typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('tech') ?? '')

export function ProjectList() {
  const [tech, setTech] = useState('')
  useEffect(() => {
    setTech(techFromUrl())
    const onPop = () => setTech(techFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function pick(name: string) {
    const next = tech === name ? '' : name
    setTech(next)
    history.replaceState(null, '', next ? `${paths.projects}?tech=${encodeURIComponent(next)}` : paths.projects)
  }

  const techs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const project of projects) for (const tag of project.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  }, [])
  const work = projects.filter((item) => item.kind === 'work').length

  return (
    <Layout section="projects">
      <div className="shell">
        <header className="page-head">
          <h1>포트폴리오</h1>
          <p className="page-lead">디자인 시스템부터 AI 탐지 결과를 다루는 관제·검수 화면까지, 맡았던 일과 그 안에서 내린 결정을 정리했습니다.</p>
          <p className="portfolio-summary">실무 {work}개 · 개인 프로젝트 {projects.length - work}개 · 가장 많이 쓴 기술 {techs.slice(0, 3).map(([name]) => name).join(', ')}</p>
        </header>

        <div className="filter tech-filter" role="group" aria-label="기술로 거르기">
          <button type="button" aria-pressed={!tech} onClick={() => pick('')}>전체 <span>{projects.length}</span></button>
          {techs.map(([name, count]) => (
            <button type="button" key={name} aria-pressed={tech === name} onClick={() => pick(name)}>{name} <span>{count}</span></button>
          ))}
        </div>

        {GROUPS.map(([kind, title, lead]) => {
          const items = projects.filter((item) => item.kind === kind && (!tech || item.tags.includes(tech)))
          if (!items.length) return null
          return (
            <section className="block" key={kind} aria-labelledby={`group-${kind}-title`} id={`group-${kind}`}>
              <div className="block-head">
                <h2 id={`group-${kind}-title`}>{title}</h2>
                <span className="muted">{lead}</span>
              </div>
              <div className={kind === 'work' ? 'cards project-grid featured' : 'cards project-grid'}>
                {items.map((item) => <ProjectCard key={item.slug} project={item} />)}
              </div>
            </section>
          )
        })}
      </div>
    </Layout>
  )
}
