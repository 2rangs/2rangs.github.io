// 주소와 화면을 잇는다. 글과 프로젝트는 각자 고유한 경로를 가진다.
export type Route =
  | { page: 'home' }
  | { page: 'projects' }
  | { page: 'project'; slug: string }
  | { page: 'blog' }
  | { page: 'post'; key: string }
  | { page: 'write' }
  | { page: 'notfound' }

export const paths = {
  home: '/',
  projects: '/projects/',
  project: (slug: string) => `/projects/${encodeURIComponent(slug)}/`,
  blog: '/blog/',
  post: (key: string) => `/blog/${encodeURIComponent(key)}/`,
  write: '/write/',
}

export function parseRoute(pathname: string): Route {
  let parts: string[]
  try {
    parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  } catch {
    return { page: 'notfound' }
  }
  if (parts.at(-1) === 'index.html') parts.pop()
  if (!parts.length) return { page: 'home' }
  const [head, param, ...rest] = parts
  if (rest.length) return { page: 'notfound' }
  if (head === 'projects') return param ? { page: 'project', slug: param } : { page: 'projects' }
  if (head === 'blog') return param ? { page: 'post', key: param } : { page: 'blog' }
  if (head === 'write' && !param) return { page: 'write' }
  return { page: 'notfound' }
}
