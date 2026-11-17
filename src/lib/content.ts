// content/projects/*.md 를 읽어 포트폴리오 목록을 만든다. 파일 이름이 주소(slug)가 된다.
export type Project = {
  slug: string
  title: string
  role: string
  kind: string
  order: number
  tags: string[]
  summary: string
  link?: string
  cover?: string
  body: string
}

export function parseFrontmatter(raw: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (!match) return { data: {} as Record<string, any>, body: raw }
  const data: Record<string, any> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at < 0) continue
    const key = line.slice(0, at).trim()
    const value = line.slice(at + 1).trim()
    data[key] = value.startsWith('[') && value.endsWith(']')
      ? value.slice(1, -1).split(',').map((item) => item.trim()).filter(Boolean)
      : value
  }
  return { data, body: match[2].trim() }
}

const files = import.meta.glob('../../content/projects/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export const projects: Project[] = Object.entries(files)
  .map(([path, raw]) => {
    const slug = path.split('/').pop()!.replace(/\.md$/, '')
    const { data, body } = parseFrontmatter(raw)
    return {
      slug,
      title: data.title ?? slug,
      role: data.role ?? '',
      kind: data.kind ?? 'work',
      order: Number(data.order ?? 999),
      tags: Array.isArray(data.tags) ? data.tags : [],
      summary: data.summary ?? '',
      link: data.link,
      cover: data.cover,
      body,
    }
  })
  .filter((project) => !project.slug.startsWith('_'))
  .sort((a, b) => a.order - b.order)
