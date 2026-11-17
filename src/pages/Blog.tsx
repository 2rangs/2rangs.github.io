import { useEffect, useMemo, useState } from 'react'
import { Article } from '../components/Article'
import { Giscus, legacyTerm } from '../components/Giscus'
import { Layout, useIsOwner } from '../components/Layout'
import { Markdown } from '../components/Markdown'
import { formatDate, getPost, listPosts, type Post, type PostSummary } from '../lib/posts'
import { paths } from '../lib/routes'
import { applyMeta, notFoundMeta, postMeta } from '../lib/seo'
import { NotFound } from './NotFound'

// 한국어 기준 분당 약 500자로 읽는 시간을 어림한다.
const readingMinutes = (markdown: string) => Math.max(1, Math.round(markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, '').length / 500))

// initial은 빌드 때 미리 넣어 둔 글이다. 화면을 바로 그린 뒤 Supabase에서 최신 내용을 다시 받는다.
export function PostView({ postKey, initial }: { postKey: string; initial?: Post }) {
  const [post, setPost] = useState<Post | null | undefined>(initial)
  const [error, setError] = useState('')
  const owner = useIsOwner()
  // 날짜순 목록에서 앞뒤 글을 찾아 글 아래에 이어 읽기 링크를 둔다.
  const [neighbors, setNeighbors] = useState<{ newer?: PostSummary; older?: PostSummary }>({})

  useEffect(() => {
    listPosts().then((list) => {
      const index = list.findIndex((item) => item.key === postKey)
      if (index >= 0) setNeighbors({ newer: list[index - 1], older: list[index + 1] })
    }).catch(() => setNeighbors({}))
  }, [postKey])

  useEffect(() => {
    getPost(postKey)
      .then((fresh) => { if (fresh || !initial) setPost(fresh) })
      .catch((reason) => { if (!initial) setError(String(reason?.message ?? reason)) })
  }, [postKey, initial])

  useEffect(() => {
    if (post) applyMeta(postMeta(post))
    if (post === null) applyMeta(notFoundMeta)
  }, [post])

  if (post === null) return <NotFound />

  return (
    <Layout section="blog">
      <article className="shell">
        <header className="page-head">
          <a className="back" href={paths.blog}>← 블로그</a>
          {error && <p className="notice error" style={{ marginTop: 16 }}>글을 불러오지 못했습니다. {error}</p>}
          {!error && post === undefined && <p className="muted" style={{ marginTop: 16 }}>불러오는 중…</p>}
          {post && (
            <>
              <h1>{post.title}</h1>
              <div className="meta">
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span>읽는 데 {readingMinutes(post.markdown)}분</span>
                {post.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
                {owner && !post.legacy && <a className="back" href={`${paths.write}?edit=${encodeURIComponent(post.key)}`}>수정</a>}
              </div>
            </>
          )}
        </header>
        {post && <Article contentKey={post.key}><Markdown>{post.markdown}</Markdown></Article>}
        {post && (neighbors.older || neighbors.newer) && (
          <nav className="post-nav" aria-label="이전 글과 다음 글">
            {neighbors.older && <a className="prev" href={paths.post(neighbors.older.key)}><span>← 이전 글</span><strong>{neighbors.older.title}</strong></a>}
            {neighbors.newer && <a className="next" href={paths.post(neighbors.newer.key)}><span>다음 글 →</span><strong>{neighbors.newer.title}</strong></a>}
          </nav>
        )}
        {post && <Giscus term={post.legacy ? legacyTerm(post.title) : `blog-post-${post.id}`} />}
      </article>
    </Layout>
  )
}

export function PostList({ initial }: { initial?: PostSummary[] }) {
  const [posts, setPosts] = useState<PostSummary[] | undefined>(initial)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const owner = useIsOwner()

  useEffect(() => {
    listPosts().then(setPosts).catch((reason) => { if (!initial) setError(String(reason?.message ?? reason)) })
  }, [initial])

  const tags = useMemo(() => [...new Set((posts ?? []).flatMap((post) => post.tags))].sort((a, b) => a.localeCompare(b, 'ko')), [posts])
  const shown = useMemo(() => {
    const word = query.trim().toLowerCase()
    return (posts ?? []).filter((post) =>
      (!tag || post.tags.includes(tag)) &&
      (!word || [post.title, post.summary, ...post.tags].join(' ').toLowerCase().includes(word)))
  }, [posts, query, tag])

  return (
    <Layout section="blog">
      <div className="shell">
        <header className="page-head head-row">
          <div>
            <p className="label">Blog</p>
            <h1>블로그</h1>
          </div>
          {owner && <a className="button ghost" href={paths.write}>글쓰기</a>}
        </header>
        <input className="search" type="search" placeholder="제목, 요약, 태그로 검색" aria-label="글 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
        {tags.length > 0 && (
          <div className="filter" role="group" aria-label="태그로 거르기">
            <button type="button" aria-pressed={!tag} onClick={() => setTag('')}>전체</button>
            {tags.map((name) => (
              <button type="button" key={name} aria-pressed={tag === name} onClick={() => setTag(tag === name ? '' : name)}>{name}</button>
            ))}
          </div>
        )}
        {error && <p className="notice error" style={{ marginTop: 20 }}>글 목록을 불러오지 못했습니다. {error}</p>}
        {!error && posts === undefined && <p className="muted" style={{ marginTop: 20 }}>불러오는 중…</p>}
        {posts && shown.length === 0 && <p className="notice" style={{ marginTop: 20 }}>{posts.length ? '조건에 맞는 글이 없습니다.' : '아직 발행된 글이 없습니다.'}</p>}
        <ul className="post-list">
          {shown.map((post) => (
            <li key={post.key}>
              <a href={paths.post(post.key)}>
                <h2>{post.title}</h2>
                {post.summary && <p>{post.summary}</p>}
                <div className="post-meta">
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                  {post.tags.map((name) => <span className="tag" key={name}>{name}</span>)}
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}
