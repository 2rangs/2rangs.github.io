import { useEffect, useMemo, useState } from 'react'
import { Article } from '../components/Article'
import { DemoFrame } from '../components/DemoFrame'
import { Layout } from '../components/Layout'
import { Markdown } from '../components/Markdown'
import { ProjectCard } from '../components/ProjectCard'
import { githubRepo, Readme } from '../components/Readme'
import { projects, type Project } from '../lib/content'
import { problems } from '../lib/problems'
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
    .map((item) => ({ item, score: (project.links.includes(item.slug) || item.links.includes(project.slug) ? 10 : 0) + (item.kind === project.kind ? 2 : 0) + item.tags.filter((tag) => project.tags.includes(tag)).length }))
    .sort((a, b) => b.score - a.score || a.item.order - b.item.order)
    .slice(0, count)
    .map(({ item }) => item)
}

export function ProjectDetail({ slug }: { slug: string }) {
  const project = projects.find((item) => item.slug === slug)
  if (!project) return <NotFound />
  const more = related(project)
  const repo = githubRepo(project.link)
  const linked = projects.filter((item) => item.slug !== project.slug && (project.links.includes(item.slug) || item.links.includes(project.slug)))
  return (
    <Layout section="projects">
      <article className="shell">
        <header className="page-head project-head">
          <nav className="crumbs" aria-label="이동 경로">
            <a href={paths.projects}>포트폴리오</a>
            <a href={`${paths.projects}?kind=${project.kind}`}>{project.kind === 'work' ? '실무' : '개인 프로젝트'}</a>
          </nav>
          <h1>{project.title}</h1>
          {project.summary && <p className="page-lead">{project.summary}</p>}
          <dl className="facts">
            {project.role && <div><dt>역할</dt><dd>{project.role}</dd></div>}
            <div><dt>구분</dt><dd>{project.kind === 'work' ? '실무' : '개인 프로젝트'}</dd></div>
            <div><dt>기술</dt><dd><ul className="stack">{project.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul></dd></div>
            {linked.length > 0 && <div><dt>연결된 프로젝트</dt><dd>{linked.map((item, index) => <span key={item.slug}>{index > 0 && ', '}<a href={paths.project(item.slug)}>{item.title}</a></span>)}</dd></div>}
          </dl>
          {(project.demo || project.link) && (
            <div className="actions project-actions">
              {project.demo && <a className="button primary" href={project.demo} target="_blank" rel="noreferrer">사이트 열기<span aria-hidden="true"> ↗</span></a>}
              {project.link && <a className="button ghost" href={project.link} target="_blank" rel="noreferrer">{repo ? 'GitHub 저장소' : '저장소'}<span aria-hidden="true"> ↗</span></a>}
            </div>
          )}
        </header>
        {project.demo ? (
          <DemoFrame src={project.demo} title={project.title} cover={project.cover} />
        ) : project.cover && (
          <figure className="project-cover">
            <img src={`/${project.cover}`} alt="" width="1200" height="630" decoding="async" />
          </figure>
        )}
        <Article contentKey={project.slug}><Markdown>{project.body}</Markdown></Article>
        {repo && <Readme key={repo} repo={repo} />}
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

type Kind = '' | 'work' | 'personal' | 'problems'
const KINDS: [Kind, string][] = [['', '전체'], ['work', '실무'], ['personal', '개인'], ['problems', '문제별']]
const bySlug = new Map(projects.map((item) => [item.slug, item]))

function readUrl() {
  if (typeof location === 'undefined') return { kind: '' as Kind, tech: '', problem: '' }
  const params = new URLSearchParams(location.search)
  const kind = params.get('kind')
  return {
    kind: (kind === 'work' || kind === 'personal' || kind === 'problems' ? kind : '') as Kind,
    tech: params.get('tech') ?? '',
    problem: params.get('problem') ?? '',
  }
}

function writeUrl(kind: Kind, tech: string, problem = '') {
  const params = new URLSearchParams()
  if (kind) params.set('kind', kind)
  if (tech && kind !== 'problems') params.set('tech', tech)
  if (problem && kind === 'problems') params.set('problem', problem)
  const query = params.toString()
  history.replaceState(null, '', query ? `${paths.projects}?${query}` : paths.projects)
}

export function ProjectList() {
  const [kind, setKind] = useState<Kind>('')
  const [tech, setTech] = useState('')
  const [problem, setProblem] = useState('')
  useEffect(() => {
    const sync = () => {
      const next = readUrl()
      setKind(next.kind)
      setTech(next.tech)
      setProblem(next.problem)
    }
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  // 탭에 속한 프로젝트. 기술 필터와 그 개수는 이 안에서만 센다.
  const scoped = useMemo(() => projects.filter((item) => !kind || kind === 'problems' || item.kind === kind), [kind])
  const techs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const project of scoped) for (const tag of project.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  }, [scoped])
  // 고른 기술이 이 탭에 없으면 필터를 푼다.
  const activeTech = techs.some(([name]) => name === tech) ? tech : ''

  function pickKind(next: Kind) {
    setKind(next)
    const keep = projects.some((item) => (!next || item.kind === next) && item.tags.includes(tech)) ? tech : ''
    setTech(keep)
    writeUrl(next, keep, problem)
  }

  function pickProblem(id: string) {
    const next = problem === id ? '' : id
    setProblem(next)
    writeUrl(kind, '', next)
  }

  const activeProblem = problems.some((item) => item.id === problem) ? problem : ''

  function pickTech(name: string) {
    const next = activeTech === name ? '' : name
    setTech(next)
    writeUrl(kind, next)
  }

  const work = projects.filter((item) => item.kind === 'work').length
  const allTechs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const project of projects) for (const tag of project.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  }, [])

  return (
    <Layout section="projects">
      <div className="shell">
        <header className="page-head">
          <h1>포트폴리오</h1>
          <p className="page-lead">디자인 시스템부터 AI 탐지 결과를 다루는 관제·검수 화면까지, 맡았던 일과 그 안에서 내린 결정을 정리했습니다.</p>
          <p className="portfolio-summary">실무 {work}개 · 개인 프로젝트 {projects.length - work}개 · 주로 쓴 기술 {allTechs.filter((name) => /^[A-Za-z]/.test(name)).slice(0, 3).join(', ')}</p>
        </header>

        <div className="kind-tabs" role="tablist" aria-label="프로젝트 구분">
          {KINDS.map(([value, label]) => (
            <button
              type="button"
              role="tab"
              key={label}
              id={`tab-${value || 'all'}`}
              aria-selected={kind === value}
              aria-controls="project-panel"
              onClick={() => pickKind(value)}
            >
              {label} <span>{value === 'problems' ? problems.length : value ? projects.filter((item) => item.kind === value).length : projects.length}</span>
            </button>
          ))}
        </div>

        <div id="project-panel" role="tabpanel" aria-labelledby={`tab-${kind || 'all'}`}>
          {kind === 'problems' ? <ProblemView active={activeProblem} pick={pickProblem} /> : <>
          <div className="filter tech-filter" role="group" aria-label="기술과 주제로 거르기">
            <button type="button" aria-pressed={!activeTech} onClick={() => pickTech('')}>모든 기술 <span>{scoped.length}</span></button>
            {techs.map(([name, count]) => (
              <button type="button" key={name} aria-pressed={activeTech === name} onClick={() => pickTech(name)}>{name} <span>{count}</span></button>
            ))}
          </div>

          {GROUPS.filter(([value]) => !kind || value === kind).map(([value, title, lead]) => {
            const items = scoped.filter((item) => item.kind === value && (!activeTech || item.tags.includes(activeTech)))
            if (!items.length) return null
            return (
              <section className={kind ? 'block single' : 'block'} key={value} aria-labelledby={`group-${value}-title`} id={`group-${value}`}>
                <div className="block-head">
                  <h2 id={`group-${value}-title`} className={kind ? 'visually-hidden' : undefined}>{title}</h2>
                  <span className="muted">{lead}</span>
                </div>
                <div className={value === 'work' ? 'cards project-grid featured' : 'cards project-grid'}>
                  {items.map((item) => <ProjectCard key={item.slug} project={item} />)}
                </div>
              </section>
            )
          })}
          </>}
        </div>
      </div>
    </Layout>
  )
}

// 문제별 보기: 같은 문제를 여러 프로젝트에서 어떻게 풀었는지 한 줄씩 나란히 보여 준다.
function ProblemView({ active, pick }: { active: string; pick: (id: string) => void }) {
  const shown = problems.filter((item) => !active || item.id === active)
  return (
    <>
      <p className="problem-intro">같은 문제를 실무와 개인 프로젝트에서 어떻게 다시 풀었는지 묶어 봤습니다.</p>
      <div className="filter tech-filter" role="group" aria-label="문제로 거르기">
        <button type="button" aria-pressed={!active} onClick={() => pick('')}>모든 문제 <span>{problems.length}</span></button>
        {problems.map((item) => (
          <button type="button" key={item.id} aria-pressed={active === item.id} onClick={() => pick(item.id)}>{item.title} <span>{item.entries.length}</span></button>
        ))}
      </div>
      {shown.map((item) => (
        <section className="block problem" key={item.id} id={`problem-${item.id}`} aria-labelledby={`problem-${item.id}-title`}>
          <div className="problem-head">
            <span className="problem-index" aria-hidden="true">{String(problems.indexOf(item) + 1).padStart(2, '0')}</span>
            <div>
              <h2 id={`problem-${item.id}-title`}>{item.title}</h2>
              <p className="muted">{item.lead}</p>
            </div>
          </div>
          <ol className="problem-list">
            {item.entries.map(({ slug, note }) => {
              const project = bySlug.get(slug)
              if (!project) return null
              return (
                <li key={slug}>
                  <a href={paths.project(slug)}>
                    <span className="problem-project">
                      <span className="problem-kind">{project.kind === 'work' ? '실무' : '개인'}</span>
                      <strong>{project.title}</strong>
                    </span>
                    <span className="problem-note">{note}</span>
                  </a>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </>
  )
}
