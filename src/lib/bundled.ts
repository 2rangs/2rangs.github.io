import { parseFrontmatter } from './content'
import type { Post } from './posts'

// content/posts/*.md: 사이트와 함께 배포되는 글. 예전 블로그 글을 다듬어 옮겨 둔 것이다.
// DB(blog_posts)에 같은 주소의 글이 있으면 DB 쪽이 우선한다. DB가 비어 있거나 닿지 않아도 이 글들은 보인다.
// 본문이 커서 첫 화면 코드에 넣지 않고, 필요할 때 따로 받는다.
const files = import.meta.glob('../../content/posts/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>

const minutes = (markdown: string) =>
  Math.max(1, Math.round(markdown.length / 500))

export type BundledPost = Post & { legacyId?: number }

let cache: Promise<BundledPost[]> | undefined

export const loadBundledPosts = () => (cache ??= Promise.all(Object.values(files).map((load) => load())).then((raws) => raws
  .map((raw): BundledPost => {
    const { data, body } = parseFrontmatter(raw)
    return {
      key: data.slug,
      id: `static-${data.slug}`,
      draft: false,
      title: data.title,
      summary: data.summary ?? '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      date: data.date ?? '',
      updated: data.updated ?? '2026-11-17T00:00:00.000Z',
      minutes: minutes(body),
      markdown: body,
      commentTerm: data.comment_term || `blog-post-${data.slug}`,
      legacyId: data.legacy_id ? Number(data.legacy_id) : undefined,
    }
  })
  .filter((post) => post.key && post.title)
  .sort((a, b) => (a.date < b.date ? 1 : -1))))
