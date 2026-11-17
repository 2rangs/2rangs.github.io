import { supabase } from './supabase'

// 글은 Supabase blog_posts 테이블에 마크다운으로 저장한다. published_at이 비어 있으면 초안이고,
// 초안은 로그인한 글쓴이에게만 보인다. 예전 블로그(posts 테이블)의 글은 legacy_id를 달고 옮겨 왔다.
export type PostSummary = {
  key: string
  id: number | string
  draft: boolean
  title: string
  summary: string
  tags: string[]
  date: string
  updated: string
  minutes: number
}
export type Post = PostSummary & { markdown: string; commentTerm: string }

const LIST_COLUMNS = 'id,slug,title,summary,tags,published_at,updated_at,reading_minutes'
const LEGACY = /^legacy-(\d+)$/

// 한국어 기준 분당 약 500자로 읽는 시간을 어림한다. DB에 값이 없을 때 쓴다.
export const readingMinutes = (markdown: string) =>
  Math.max(1, Math.round(markdown.replace(/```[\s\S]*?```/g, (code) => code.slice(0, code.length / 3)).replace(/!\[[^\]]*\]\([^)]*\)/g, '').length / 500))

function summary(row: any): PostSummary {
  return {
    key: row.slug,
    id: row.id,
    draft: !row.published_at,
    title: row.title,
    summary: row.summary ?? '',
    tags: row.tags ?? [],
    date: row.published_at ?? '',
    updated: row.updated_at ?? row.published_at ?? '',
    minutes: row.reading_minutes ?? (row.body_markdown ? readingMinutes(row.body_markdown) : 0),
  }
}

export async function listPosts(includeDrafts = false): Promise<PostSummary[]> {
  let { data, error } = await supabase.from('blog_posts').select(LIST_COLUMNS).order('published_at', { ascending: false, nullsFirst: true })
  // 스키마를 고치기 전(updated_at, reading_minutes가 없는 상태)에도 동작하도록 한 번 더 시도한다.
  if (error) ({ data, error } = await supabase.from('blog_posts').select('id,slug,title,summary,tags,published_at').order('published_at', { ascending: false, nullsFirst: true }) as any)
  if (error) throw error
  return (data ?? []).map(summary).filter((post) => includeDrafts || !post.draft)
}

export async function getPost(key: string): Promise<Post | null> {
  // 예전 주소(/blog/legacy-8/)는 옮겨 온 글을 찾아 준다.
  const legacy = LEGACY.exec(key)
  const query = supabase.from('blog_posts').select('*')
  const { data, error } = await (legacy ? query.eq('legacy_id', Number(legacy[1])) : query.eq('slug', key)).maybeSingle()
  if (error) throw error
  if (!data) return null
  const row: any = data
  return { ...summary(row), markdown: row.body_markdown ?? '', commentTerm: row.comment_term || `blog-post-${row.id}` }
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

const SEOUL = 'Asia/Seoul'
export const formatDate = (value: string) =>
  !value ? '초안' : new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeZone: SEOUL }).format(new Date(value))
// 목록용 짧은 날짜: 2025. 03. 14 → "03.14"
export const shortDate = (value: string) => {
  if (!value) return '초안'
  const parts = new Intl.DateTimeFormat('en-CA', { month: '2-digit', day: '2-digit', timeZone: SEOUL }).formatToParts(new Date(value))
  return `${parts.find((p) => p.type === 'month')?.value}.${parts.find((p) => p.type === 'day')?.value}`
}
export const yearOf = (value: string) => (value ? new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: SEOUL }).format(new Date(value)) : '초안')
