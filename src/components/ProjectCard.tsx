import type { Project } from '../lib/content'
import { paths } from '../lib/routes'

// 포트폴리오 한 항목. 맡은 역할을 왼쪽 열에 두고, 무엇을 만들었는지와 기술을 오른쪽에 둔다.
export function ProjectRow({ project }: { project: Project }) {
  return (
    <li className="project-row">
      <span className="project-role">{project.role}</span>
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
