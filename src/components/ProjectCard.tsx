import type { Project } from '../lib/content'

export function ProjectCard({ project, root }: { project: Project; root: string }) {
  return (
    <a className="card" href={`${root}projects/?p=${project.slug}`}>
      {project.cover && <img className="card-cover" src={root + project.cover} alt="" loading="lazy" />}
      <span className="card-role">{project.role}</span>
      <h3>{project.title}</h3>
      <p>{project.summary}</p>
      <ul className="tags" aria-label="사용 기술">
        {project.tags.map((tag) => <li key={tag}>{tag}</li>)}
      </ul>
    </a>
  )
}
