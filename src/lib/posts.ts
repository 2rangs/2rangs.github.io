import { supabase } from './supabase'
import { tiptapToMarkdown } from './tiptap'

// 새 글은 blog_posts(마크다운), 예전 글은 posts(TipTap JSON)에 있다. 목록에서는 둘을 합쳐 보여준다.
// blog_posts의 published_at이 비어 있으면 초안이다. 초안은 로그인한 글쓴이에게만 보인다.
export type PostSummary = { key: string; id: number | string; legacy: boolean; draft: boolean; title: string; summary: string; tags: string[]; date: string }
export type Post = PostSummary & { markdown: string }

const LEGACY = 'legacy-'

export async function listPosts(includeDrafts = false): Promise<PostSummary[]> {
  const [fresh, legacy] = await Promise.all([
    supabase.from('blog_posts').select('id,slug,title,summary,tags,published_at').order('published_at', { ascending: false, nullsFirst: true }),
    supabase.from('posts').select('id,title,summary,created_at,category:categories(name)').order('created_at', { ascending: false }),
  ])
  if (fresh.error && legacy.error) throw fresh.error
  const a: PostSummary[] = (fresh.data ?? []).filter((row: any) => includeDrafts || row.published_at).map((row: any) => ({
    key: row.slug, id: row.id, legacy: false, draft: !row.published_at, title: row.title, summary: row.summary ?? '', tags: row.tags ?? [], date: row.published_at ?? '',
  }))
  const b: PostSummary[] = (legacy.data ?? []).map((row: any) => ({
    key: LEGACY + row.id, id: row.id, legacy: true, draft: false, title: row.title, summary: row.summary ?? '', tags: row.category?.name ? [row.category.name] : [], date: row.created_at,
  }))
  return [...a, ...b].sort((x, y) => (x.draft !== y.draft ? (x.draft ? -1 : 1) : x.date < y.date ? 1 : -1))
}

export async function getPost(key: string): Promise<Post | null> {
  if (key.startsWith(LEGACY)) {
    const id = Number(key.slice(LEGACY.length))
    const { data, error } = await supabase.from('posts').select('id,title,summary,content,created_at,category:categories(name)').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return null
    const row: any = data
    return { key, id: row.id, legacy: true, draft: false, title: row.title, summary: row.summary ?? '', tags: row.category?.name ? [row.category.name] : [], date: row.created_at, markdown: tiptapToMarkdown(row.content) }
  }
  const { data, error } = await supabase.from('blog_posts').select('id,slug,title,summary,body_markdown,tags,published_at').eq('slug', key).maybeSingle()
  if (error) throw error
  if (!data) return null
  const row: any = data
  return { key: row.slug, id: row.id, legacy: false, draft: !row.published_at, title: row.title, summary: row.summary ?? '', tags: row.tags ?? [], date: row.published_at ?? '', markdown: row.body_markdown ?? '' }
}

export type Draft = { id?: number | string; published?: boolean; slug: string; title: string; summary: string; tags: string[]; body_markdown: string }

// publish가 true면 발행한다. 이미 발행된 글은 발행일을 그대로 둔다.
export async function savePost(draft: Draft, publish: boolean) {
  const row: Record<string, unknown> = { slug: draft.slug, title: draft.title, summary: draft.summary, tags: draft.tags, body_markdown: draft.body_markdown }
  if (publish && !draft.published) row.published_at = new Date().toISOString()
  const query = draft.id
    ? supabase.from('blog_posts').update(row).eq('id', draft.id).select('id,slug')
    : supabase.from('blog_posts').insert(row).select('id,slug')
  const { data, error } = await query
  if (error) throw error
  if (!data?.length) throw new Error('저장되지 않았습니다. Supabase의 blog_posts 쓰기 권한(RLS 정책)을 확인해 주세요.')
  return data[0] as { id: number | string; slug: string }
}

export async function deletePost(id: number | string) {
  const { data, error } = await supabase.from('blog_posts').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('삭제되지 않았습니다. Supabase의 blog_posts 삭제 권한(RLS 정책)을 확인해 주세요.')
}

export const formatDate = (value: string) =>
  !value ? '초안' : new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeZone: 'Asia/Seoul' }).format(new Date(value))
