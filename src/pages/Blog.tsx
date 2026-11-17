import { useEffect, useMemo, useState } from 'react'
import { Giscus, legacyTerm } from '../components/Giscus'
import { Layout } from '../components/Layout'
import { Markdown } from '../components/Markdown'
import { formatDate, getPost, listPosts, type Post, type PostSummary } from '../lib/posts'

function PostView({ slug }: { slug: string }) {
  const [post, setPost] = useState<Post | null | undefined>(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    getPost(slug).then(setPost).catch((reason) => setError(String(reason?.message ?? reason)))
  }, [slug])

  useEffect(() => {
    if (post) document.title = `${post.title} | 김이랑`
  }, [post])

  return (
    <article className="narrow">
      <header className="page-head">
        <a className="back" href="./">← 블로그</a>
        {error && <p className="notice error" style={{ marginTop: 16 }}>글을 불러오지 못했습니다. {error}</p>}
        {!error && post === undefined && <p className="muted" style={{ marginTop: 16 }}>불러오는 중…</p>}
        {post === null && <h1>글을 찾을 수 없습니다</h1>}
        {post && (
          <>
            <h1>{post.title}</h1>
            <div className="meta">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              {post.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
            </div>
          </>
        )}
      </header>
      {post && <Markdown>{post.markdown}</Markdown>}
      {post && <Giscus term={post.legacy ? legacyTerm(post.title) : `blog-post-${post.id}`} />}
    </article>
  )
}

function PostList() {
  const [posts, setPosts] = useState<PostSummary[] | undefined>(undefined)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')

  useEffect(() => {
    listPosts().then(setPosts).catch((reason) => setError(String(reason?.message ?? reason)))
  }, [])

  const tags = useMemo(() => [...new Set((posts ?? []).flatMap((post) => post.tags))].sort((a, b) => a.localeCompare(b, 'ko')), [posts])
  const shown = useMemo(() => {
    const word = query.trim().toLowerCase()
    return (posts ?? []).filter((post) =>
      (!tag || post.tags.includes(tag)) &&
      (!word || [post.title, post.summary, ...post.tags].join(' ').toLowerCase().includes(word)))
  }, [posts, query, tag])

  return (
    <div className="narrow">
      <header className="page-head head-row">
        <div>
          <p className="label">Blog</p>
          <h1>블로그</h1>
        </div>
        <a className="button ghost" href="../write/">글쓰기</a>
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
            <a href={`./?p=${encodeURIComponent(post.key)}`}>
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
  )
}

export function Blog() {
  const slug = new URLSearchParams(location.search).get('p')
  return <Layout page="blog">{slug ? <PostView slug={slug} /> : <PostList />}</Layout>
}
