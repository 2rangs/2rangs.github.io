import type { Project } from './content'
import type { Post } from './posts'
import { paths } from './routes'
import { SITE } from './site'

// 검색엔진과 링크 미리보기(카카오톡, 슬랙 등)가 읽는 정보.
export type Meta = {
  title: string
  description: string
  path: string
  image?: string
  type?: 'website' | 'article'
  publishedAt?: string
  tags?: string[]
  noindex?: boolean
}

export const absolute = (path: string) => SITE.url + path

// 마크다운 기호를 걷어내고 앞부분만 남긴다. 요약이 없는 글의 설명으로 쓴다.
export function excerpt(markdown: string, length = 150) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > length ? text.slice(0, length - 1) + '…' : text
}

export const homeMeta: Meta = { title: SITE.title, description: SITE.description, path: paths.home, image: '/og/default.png' }
export const projectsMeta: Meta = { title: `포트폴리오 | ${SITE.name}`, description: '실무에서 맡은 일과 개인 프로젝트.', path: paths.projects, image: '/og/default.png' }
export const blogMeta: Meta = { title: `블로그 | ${SITE.name}`, description: '프론트엔드 개발을 하며 배운 것을 적습니다.', path: paths.blog, image: '/og/default.png' }
export const writeMeta: Meta = { title: `글쓰기 | ${SITE.name}`, description: '블로그 글쓰기', path: paths.write, noindex: true }
export const notFoundMeta: Meta = { title: `페이지를 찾을 수 없습니다 | ${SITE.name}`, description: SITE.description, path: '/404.html', noindex: true }

export const projectMeta = (project: Project): Meta => ({
  title: `${project.title} | ${SITE.name}`,
  description: project.summary || excerpt(project.body),
  path: paths.project(project.slug),
  image: `/og/project-${project.slug}.png`,
  type: 'article',
  tags: project.tags,
})

export const postMeta = (post: Post): Meta => ({
  title: `${post.title} | ${SITE.name}`,
  description: excerpt(post.markdown) || post.summary,
  path: paths.post(post.key),
  image: `/og/post-${post.key}.png`,
  type: 'article',
  publishedAt: post.date || undefined,
  tags: post.tags,
})

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// 빌드 때 각 페이지의 <head>에 넣을 태그를 만든다.
export function headHtml(meta: Meta) {
  const url = absolute(meta.path)
  const image = meta.image ? absolute(meta.image) : undefined
  const tags = [
    `<title>${escape(meta.title)}</title>`,
    `<meta name="description" content="${escape(meta.description)}" />`,
    `<link rel="canonical" href="${escape(url)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex" />' : '',
    `<meta property="og:site_name" content="${escape(SITE.name)}" />`,
    `<meta property="og:locale" content="ko_KR" />`,
    `<meta property="og:type" content="${meta.type ?? 'website'}" />`,
    `<meta property="og:title" content="${escape(meta.title)}" />`,
    `<meta property="og:description" content="${escape(meta.description)}" />`,
    `<meta property="og:url" content="${escape(url)}" />`,
    image ? `<meta property="og:image" content="${escape(image)}" />` : '',
    image ? '<meta property="og:image:width" content="1200" />' : '',
    image ? '<meta property="og:image:height" content="630" />' : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escape(meta.title)}" />`,
    `<meta name="twitter:description" content="${escape(meta.description)}" />`,
    image ? `<meta name="twitter:image" content="${escape(image)}" />` : '',
    meta.publishedAt ? `<meta property="article:published_time" content="${escape(meta.publishedAt)}" />` : '',
    ...(meta.tags ?? []).map((tag) => `<meta property="article:tag" content="${escape(tag)}" />`),
    SITE.verification.google ? `<meta name="google-site-verification" content="${escape(SITE.verification.google)}" />` : '',
    SITE.verification.naver ? `<meta name="naver-site-verification" content="${escape(SITE.verification.naver)}" />` : '',
  ]
  const structured = meta.type === 'article'
    ? { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: meta.title, description: meta.description, url, image, datePublished: meta.publishedAt, keywords: meta.tags?.join(', '), author: { '@type': 'Person', name: SITE.name, url: SITE.url } }
    : { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, description: meta.description, url }
  tags.push(`<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>`)
  return tags.filter(Boolean).join('\n    ')
}

// 빌드 이후에 발행된 글처럼 미리 만든 페이지가 없을 때, 브라우저에서 제목과 설명을 맞춘다.
export function applyMeta(meta: Meta) {
  document.title = meta.title
  const set = (selector: string, create: () => HTMLElement, attribute: string, value: string) => {
    let element = document.head.querySelector<HTMLElement>(selector)
    if (!element) {
      element = create()
      document.head.appendChild(element)
    }
    element.setAttribute(attribute, value)
  }
  const named = (name: string, value: string) => set(`meta[name="${name}"]`, () => Object.assign(document.createElement('meta'), { name }), 'content', value)
  const property = (name: string, value: string) => set(`meta[property="${name}"]`, () => { const element = document.createElement('meta'); element.setAttribute('property', name); return element }, 'content', value)
  named('description', meta.description)
  set('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', absolute(meta.path))
  property('og:title', meta.title)
  property('og:description', meta.description)
  property('og:url', absolute(meta.path))
  if (meta.noindex) named('robots', 'noindex')
}
