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
  type?: 'website' | 'article' | 'profile'
  publishedAt?: string
  modifiedAt?: string
  tags?: string[]
  noindex?: boolean
  // 검색 결과의 이동 경로(BreadcrumbList). 홈은 자동으로 앞에 붙는다.
  crumbs?: { name: string; path: string }[]
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

const DEFAULT_IMAGE = '/og/default.png'

// 첫 화면은 소개 페이지다. 검색엔진에는 사이트(WebSite)이자 프로필(ProfilePage)로 알린다.
export const homeMeta: Meta = { title: SITE.title, description: SITE.description, path: paths.home, image: DEFAULT_IMAGE, type: 'profile' }
export const privacyMeta: Meta = {
  title: `개인정보처리방침 | ${SITE.name}`,
  description: `${SITE.name} 블로그가 수집하는 정보와 쿠키, 광고, 댓글 서비스의 이용에 관한 안내.`,
  path: paths.privacy,
  crumbs: [{ name: '개인정보처리방침', path: paths.privacy }],
}
export const projectsMeta: Meta = {
  title: `포트폴리오 | ${SITE.name}`,
  description: '디자인 시스템, AI 탐지 데이터 검수, 운영 관리자 등 실무에서 맡은 일과 개인 프로젝트.',
  path: paths.projects,
  image: DEFAULT_IMAGE,
  crumbs: [{ name: '포트폴리오', path: paths.projects }],
}
export const blogMeta: Meta = {
  title: `블로그 | ${SITE.name}`,
  description: 'JavaScript, TypeScript, CSS와 프론트엔드 아키텍처를 다루는 기술 블로그.',
  path: paths.blog,
  image: DEFAULT_IMAGE,
  crumbs: [{ name: '블로그', path: paths.blog }],
}
export const writeMeta: Meta = { title: `글쓰기 | ${SITE.name}`, description: '블로그 글쓰기', path: paths.write, noindex: true }
export const notFoundMeta: Meta = { title: `페이지를 찾을 수 없습니다 | ${SITE.name}`, description: SITE.description, path: '/404.html', noindex: true }

export const projectMeta = (project: Project): Meta => ({
  title: `${project.title} | ${SITE.name}`,
  description: project.summary || excerpt(project.body),
  path: paths.project(project.slug),
  image: `/og/project-${project.slug}.png`,
  tags: project.tags,
  crumbs: [{ name: '포트폴리오', path: paths.projects }, { name: project.title, path: paths.project(project.slug) }],
})

export const postMeta = (post: Post): Meta => ({
  title: `${post.title} | ${SITE.name}`,
  description: post.summary || excerpt(post.markdown),
  path: paths.post(post.key),
  image: `/og/post-${post.key}.png`,
  type: 'article',
  publishedAt: post.date || undefined,
  modifiedAt: post.updated || post.date || undefined,
  tags: post.tags,
  crumbs: [{ name: '블로그', path: paths.blog }, { name: post.title, path: paths.post(post.key) }],
})

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const person = { '@type': 'Person', name: SITE.name, url: SITE.url + '/', jobTitle: SITE.role, image: SITE.avatar, sameAs: [SITE.github] }

function structuredData(meta: Meta, url: string, image?: string) {
  const items: Record<string, unknown>[] = []
  if (meta.type === 'article') {
    items.push({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: meta.title.replace(` | ${SITE.name}`, ''),
      description: meta.description,
      url,
      mainEntityOfPage: url,
      image,
      datePublished: meta.publishedAt,
      dateModified: meta.modifiedAt ?? meta.publishedAt,
      keywords: meta.tags?.join(', '),
      inLanguage: 'ko-KR',
      author: person,
      publisher: person,
    })
  } else if (meta.path === paths.home) {
    items.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, alternateName: SITE.title, description: meta.description, url: SITE.url + '/', inLanguage: 'ko-KR', author: person })
    items.push({ '@context': 'https://schema.org', '@type': 'ProfilePage', url, mainEntity: person })
  }
  if (meta.crumbs?.length) {
    const trail = [{ name: '홈', path: paths.home }, ...meta.crumbs]
    items.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: trail.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: absolute(crumb.path) })),
    })
  }
  return items
}

// 빌드 때 각 페이지의 <head>에 넣을 태그를 만든다.
export function headHtml(meta: Meta) {
  const url = absolute(meta.path)
  const image = meta.image ? absolute(meta.image) : undefined
  const ogType = meta.type === 'article' ? 'article' : meta.type === 'profile' ? 'profile' : 'website'
  const tags = [
    `<title>${escape(meta.title)}</title>`,
    `<meta name="description" content="${escape(meta.description)}" />`,
    `<meta name="author" content="${escape(SITE.name)}" />`,
    `<link rel="canonical" href="${escape(url)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex" />' : '<meta name="robots" content="index, follow, max-image-preview:large" />',
    `<meta property="og:site_name" content="${escape(SITE.name)}" />`,
    `<meta property="og:locale" content="ko_KR" />`,
    `<meta property="og:type" content="${ogType}" />`,
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
    meta.modifiedAt ? `<meta property="article:modified_time" content="${escape(meta.modifiedAt)}" />` : '',
    meta.type === 'article' ? `<meta property="article:author" content="${escape(SITE.url + paths.about)}" />` : '',
    ...(meta.tags ?? []).map((tag) => `<meta property="article:tag" content="${escape(tag)}" />`),
    SITE.verification.google ? `<meta name="google-site-verification" content="${escape(SITE.verification.google)}" />` : '',
    SITE.verification.naver ? `<meta name="naver-site-verification" content="${escape(SITE.verification.naver)}" />` : '',
    // 애드센스: 게시자 ID가 있으면 소유 확인 메타 태그와 자동 광고 스크립트를 넣는다. 글쓰기 같은 noindex 화면에는 넣지 않는다.
    SITE.adsense ? `<meta name="google-adsense-account" content="${escape(SITE.adsense)}" />` : '',
    SITE.adsense && !meta.noindex ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${escape(SITE.adsense)}" crossorigin="anonymous"></script>` : '',
  ]
  for (const item of structuredData(meta, url, image)) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(item).replace(/</g, '\\u003c')}</script>`)
  }
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
