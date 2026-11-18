import type { Project } from '../lib/content'
import { paths } from '../lib/routes'

// 포트폴리오 한 항목. 맡은 역할을 왼쪽 열에 두고, 무엇을 만들었는지와 기술을 오른쪽에 둔다.
export function ProjectRow({ project }: { project: Project }) {
  return (
    <li className="project-row">
      <span className="project-role">{project.role || (project.kind === 'work' ? '실무' : '개인 프로젝트')}</span>
      <div className="project-main">
        <h3><a href={paths.project(project.slug)}>{project.title}</a></h3>
        <p>{project.summary}</p>
        <ul className="stack" aria-label="사용 기술">
          {project.tags.map((tag) => <li key={tag}>{tag}</li>)}
        </ul>
      </div>
    </li>
  )
}

// 첫 화면의 포트폴리오 카드. 대표 이미지가 있으면 위에 보여 준다.
export function ProjectCard({ project }: { project: Project }) {
  return (
    <a className="card" href={paths.project(project.slug)}>
      {project.cover && <img className="card-cover" src={`/${project.cover}`} alt="" loading="lazy" />}
      <span className="card-role">{project.kind === 'work' ? '실무' : '개인 프로젝트'}{project.role && ` · ${project.role}`}</span>
      <h3>{project.title}</h3>
      {project.highlight ? (
        <>
          <p className="card-highlight">{project.highlight}</p>
          <p className="card-summary">{project.summary}</p>
        </>
      ) : <p>{project.summary}</p>}
      <ul className="stack" aria-label="사용 기술">
        {project.tags.map((tag) => <li key={tag}>{tag}</li>)}
      </ul>
    </a>
  )
}
