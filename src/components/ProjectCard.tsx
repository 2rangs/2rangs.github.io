import type { Project } from '../lib/content'
import { paths } from '../lib/routes'

export function ProjectCard({ project }: { project: Project }) {
  return (
    <a className="card" href={paths.project(project.slug)}>
      {project.cover && <img className="card-cover" src={`/${project.cover}`} alt="" loading="lazy" />}
      <span className="card-role">{project.role}</span>
      <h3>{project.title}</h3>
      <p>{project.summary}</p>
      <ul className="tags" aria-label="사용 기술">
        {project.tags.map((tag) => <li key={tag}>{tag}</li>)}
      </ul>
    </a>
  )
}
