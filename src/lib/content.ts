// content/projects/*.md 를 읽어 포트폴리오 목록을 만든다. 파일 이름이 주소(slug)가 된다.
export type Project = {
  slug: string
  title: string
  role: string
  /** 기간 (예: 2025.01 ~ 진행 중) */
  period?: string
  kind: string
  order: number
  tags: string[]
  summary: string
  /** 카드에 크게 보일, 이 프로젝트에서 가장 중요한 결정 한 줄 */
  highlight?: string
  link?: string
  /** 실제로 써 볼 수 있는 사이트 주소 (예: /portfolio/pokestra/) */
  demo?: string
  cover?: string
  /** 같이 보면 좋은 프로젝트 slug 목록 (예: 엔진과 그 엔진을 쓰는 앱) */
  links: string[]
  /** 저장소에 있는 README 언어 (예: [ko, en]). 기본은 영어 README만 */
  readme: ('ko' | 'en')[]
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
      period: data.period,
      kind: data.kind ?? 'work',
      order: Number(data.order ?? 999),
      tags: Array.isArray(data.tags) ? data.tags : [],
      summary: data.summary ?? '',
      highlight: data.highlight,
      link: data.link,
      demo: data.demo,
      cover: data.cover,
      links: Array.isArray(data.links) ? data.links : [],
      readme: Array.isArray(data.readme) ? data.readme.filter((lang: string) => lang === 'ko' || lang === 'en') : ['en'],
      body,
    }
  })
  .filter((project) => !project.slug.startsWith('_'))
  .sort((a, b) => a.order - b.order)
