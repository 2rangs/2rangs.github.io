import { loadBundledPosts, type BundledPost } from './bundled'
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
  // 연재 이름. 같은 이름의 글끼리 묶어 글 화면에 순서를 보여 준다.
  series?: string
  // 대표 이미지(썸네일). 목록과 글 머리, 링크 미리보기에 쓰인다.
  cover?: string
}
export type Post = PostSummary & { markdown: string; commentTerm: string }

const LIST_COLUMNS = 'id,slug,title,summary,tags,published_at,updated_at,reading_minutes,series,cover_url'
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
    series: row.series || undefined,
    cover: row.cover_url || undefined,
  }
}

const byDate = (a: PostSummary, b: PostSummary) => (a.draft !== b.draft ? (a.draft ? -1 : 1) : a.date < b.date ? 1 : -1)
const toSummary = ({ markdown: _markdown, commentTerm: _term, legacyId: _legacyId, ...rest }: BundledPost): PostSummary => rest

async function listDbPosts(): Promise<PostSummary[]> {
  let { data, error } = await supabase.from('blog_posts').select(LIST_COLUMNS).order('published_at', { ascending: false, nullsFirst: true })
  // 스키마를 고치기 전(updated_at, reading_minutes가 없는 상태)에도 동작하도록 한 번 더 시도한다.
  if (error) ({ data, error } = await supabase.from('blog_posts').select('id,slug,title,summary,tags,published_at').order('published_at', { ascending: false, nullsFirst: true }) as any)
  if (error) throw error
  return (data ?? []).map(summary)
}

// DB 글과 사이트에 같이 배포된 글을 합친다. 주소가 같으면 DB 글을 쓴다.
export async function listPosts(includeDrafts = false): Promise<PostSummary[]> {
  let fromDb: PostSummary[] = []
  try {
    fromDb = await listDbPosts()
  } catch (reason) {
    console.warn('DB에서 글 목록을 받지 못해 사이트에 포함된 글만 보여 줍니다.', reason)
  }
  const bundledPosts = await loadBundledPosts()
  const keys = new Set(fromDb.map((post) => post.key))
  // DB에 연재 칸이 아직 없으면 같이 배포된 글의 값을 쓴다.
  for (const post of fromDb) post.series ??= bundledPosts.find((item) => item.key === post.key)?.series
  return [...fromDb, ...bundledPosts.filter((post) => !keys.has(post.key)).map(toSummary)]
    .filter((post) => includeDrafts || !post.draft)
    .sort(byDate)
}

async function bundled(key: string): Promise<Post | null> {
  // 예전 주소(/blog/legacy-8/)는 옮겨 온 글을 찾아 준다.
  const legacy = LEGACY.exec(key)
  const found = (await loadBundledPosts()).find((post) => (legacy ? post.legacyId === Number(legacy[1]) : post.key === key))
  if (!found) return null
  const { legacyId: _legacyId, ...post } = found
  return post
}

export async function getPost(key: string): Promise<Post | null> {
  const legacy = LEGACY.exec(key)
  const fallback = await bundled(key)
  try {
    const query = supabase.from('blog_posts').select('*')
    // legacy_id 칸이 아직 없을 수 있으니, 예전 주소는 배포된 글에서 주소를 먼저 찾아 DB를 조회한다.
    const slug = legacy ? fallback?.key : key
    if (!slug) return fallback
    const { data, error } = await query.eq('slug', slug).maybeSingle()
    if (error) throw error
    if (!data) return fallback
    const row: any = data
    return { ...summary(row), markdown: row.body_markdown ?? '', commentTerm: row.comment_term || fallback?.commentTerm || `blog-post-${row.id}`, series: row.series || fallback?.series }
  } catch (reason) {
    if (fallback) return fallback
    throw reason
  }
}

export type Draft = { id?: number | string; published?: boolean; slug: string; title: string; summary: string; tags: string[]; body_markdown: string; cover_url?: string }

// publish가 true면 발행한다. 이미 발행된 글은 발행일을 그대로 둔다.
export async function savePost(draft: Draft, publish: boolean) {
  const row: Record<string, unknown> = { slug: draft.slug, title: draft.title, summary: draft.summary, tags: draft.tags, body_markdown: draft.body_markdown }
  // cover_url 칸은 DB 정리 SQL로 생긴다. 대표 이미지를 건드린 적이 없으면 보내지 않아 SQL 전에도 저장된다.
  if (draft.cover_url !== undefined) row.cover_url = draft.cover_url || null
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
