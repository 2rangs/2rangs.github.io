import { useEffect, useMemo, useState } from 'react'
import { Article } from '../components/Article'
import { Giscus } from '../components/Giscus'
import { Layout, useIsOwner } from '../components/Layout'
import { Markdown } from '../components/Markdown'
import { PostRow } from '../components/PostRow'
import { formatDate, getPost, listPosts, yearOf, type Post, type PostSummary } from '../lib/posts'
import { paths } from '../lib/routes'
import { applyMeta, notFoundMeta, postMeta } from '../lib/seo'
import { SITE } from '../lib/site'
import { NotFound } from './NotFound'
import { coverImage } from '../lib/cover'

// 글 주소를 복사한다. 휴대폰처럼 공유 창이 있는 환경에서는 공유 창을 연다.
function ShareButton({ title }: { title: string }) {
  const [done, setDone] = useState(false)
  async function share() {
    const url = location.origin + location.pathname
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setDone(true)
      setTimeout(() => setDone(false), 1600)
    } catch {
      // 공유를 취소했거나 권한이 없으면 아무것도 하지 않는다.
    }
  }
  return (
    <button className="share-button" type="button" onClick={share} aria-live="polite">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6.5 9.5 9.5 6.5M7 4.5l1.3-1.3a2.5 2.5 0 0 1 3.5 3.5L10.5 8M9 11.5l-1.3 1.3a2.5 2.5 0 0 1-3.5-3.5L5.5 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      {done ? '복사됨' : '링크 복사'}
    </button>
  )
}

function AuthorCard() {
  return (
    <aside className="author" aria-label="글쓴이">
      <div>
        <p className="author-name"><a href={paths.about}>{SITE.name}</a></p>
        <p>디자인 시스템과 지도·데이터 시각화를 만드는 프론트엔드 개발자입니다. 틀린 내용이나 더 좋은 방법을 알려 주시면 고쳐 두겠습니다.</p>
        <p className="author-links"><a href={paths.about}>소개</a><a href={SITE.github} rel="me">GitHub</a><a href="/rss.xml">RSS</a></p>
      </div>
    </aside>
  )
}

// 연재 목록 안에서는 제목 앞의 연재 이름과 편 번호를 덜어 낸다. "Tailwind CSS 입문 (2) 다크 모드…" → "다크 모드…"
const withinSeries = (title: string, series: string) => {
  const rest = title.startsWith(series) ? title.slice(series.length).replace(/^\s*\(\d+\)\s*/, '').replace(/^[\s,·:-]+/, '') : title
  return rest || title
}

// 연재 글이면 같은 연재의 글을 발행 순서대로 보여 준다.
function SeriesBox({ post, list }: { post: Post; list: PostSummary[] }) {
  if (!post.series) return null
  const items = list.filter((item) => item.series === post.series).sort((a, b) => (a.date < b.date ? -1 : 1))
  if (items.length < 2) return null
  const index = items.findIndex((item) => item.key === post.key)
  return (
    <nav className="series" aria-label={`연재: ${post.series}`}>
      <p className="series-title"><span>연재</span>{post.series}<span className="series-count">{index + 1} / {items.length}</span></p>
      <ol>
        {items.map((item) => (
          <li key={item.key}>
            {item.key === post.key
              ? <strong aria-current="page">{withinSeries(item.title, post.series!)}</strong>
              : <a href={paths.post(item.key)}>{withinSeries(item.title, post.series!)}</a>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

// 같은 태그가 많이 겹치는 글부터, 그다음은 최신순으로 고른다.
function related(post: Post, list: PostSummary[], count = 3) {
  return list
    // 같은 연재 글은 위의 연재 상자에 이미 나오므로 뺀다.
    .filter((item) => item.key !== post.key && !(post.series && item.series === post.series))
    .map((item) => ({ item, score: item.tags.filter((tag) => post.tags.includes(tag)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (a.item.date < b.item.date ? 1 : -1))
    .slice(0, count)
    .map(({ item }) => item)
}

// initial은 빌드 때 미리 넣어 둔 글이다. 화면을 바로 그린 뒤 Supabase에서 최신 내용을 다시 받는다.
export function PostView({ postKey, initial, list: initialList }: { postKey: string; initial?: Post; list?: PostSummary[] }) {
  const [post, setPost] = useState<Post | null | undefined>(initial)
  const [error, setError] = useState('')
  const [list, setList] = useState<PostSummary[]>(initialList ?? [])
  useIsOwner()

  useEffect(() => {
    listPosts().then(setList).catch(() => undefined)
  }, [postKey])

  useEffect(() => {
    getPost(postKey)
      .then((fresh) => {
        if (fresh || !initial) setPost(fresh)
        // 예전 주소로 들어오면 새 주소로 바꿔 둔다.
        if (fresh && fresh.key !== postKey) history.replaceState(null, '', paths.post(fresh.key) + location.hash)
      })
      .catch((reason) => { if (!initial) setError(String(reason?.message ?? reason)) })
  }, [postKey, initial])

  useEffect(() => {
    if (post) applyMeta(postMeta(post))
    if (post === null) applyMeta(notFoundMeta)
  }, [post])

  if (post === null) return <NotFound />

  const index = post ? list.findIndex((item) => item.key === post.key) : -1
  const newer = index > 0 ? list[index - 1] : undefined
  const older = index >= 0 ? list[index + 1] : undefined
  const more = post ? related(post, list) : []

  return (
    <Layout section="blog">
      <article className="shell">
        <header className="page-head post-head">
          <nav className="crumbs" aria-label="이동 경로">
            <a href={paths.blog}>블로그</a>
            {post?.tags[0] && <a href={paths.tag(post.tags[0])}>{post.tags[0]}</a>}
          </nav>
          {error && <p className="notice error">글을 불러오지 못했습니다. {error}</p>}
          {!error && post === undefined && <p className="muted">글을 불러오는 중입니다.</p>}
          {post && (
            <>
              <h1>{post.title}</h1>
              {post.summary && <p className="page-lead">{post.summary}</p>}
              <div className="byline">
                <a href={paths.about}>{SITE.name}</a>
                <time dateTime={post.date || undefined}>{formatDate(post.date)}</time>
                <ShareButton title={post.title} />
                <a className="edit-link owner-only" href={`${paths.write}?edit=${encodeURIComponent(post.key)}`}>수정하기</a>
              </div>
            </>
          )}
        </header>
        {post?.cover && (
          <figure className="post-cover">
            <img {...coverImage(post.cover, '(max-width: 800px) 100vw, 800px')} alt="" width="1200" height="630" decoding="async" fetchPriority="high" />
          </figure>
        )}
        {post && <div className="post-series"><SeriesBox post={post} list={list} /></div>}
        {post && <Article contentKey={post.key} markdown={post.markdown}><Markdown>{post.markdown}</Markdown></Article>}
        {post && (
          <footer className="post-foot">
            {post.tags.length > 0 && (
              <ul className="post-tags" aria-label="태그">
                {post.tags.map((tag) => <li key={tag}><a className="tag" href={paths.tag(tag)}>{tag}</a></li>)}
              </ul>
            )}
            <AuthorCard />
            {more.length > 0 && (
              <section className="related" aria-labelledby="related-title">
                <h2 id="related-title">함께 읽을 글</h2>
                <ul>
                  {more.map((item) => (
                    <li key={item.key}><a href={paths.post(item.key)}>{item.title}</a><span>{formatDate(item.date)}</span></li>
                  ))}
                </ul>
              </section>
            )}
            {(older || newer) && (
              <nav className="post-nav" aria-label="이전 글과 다음 글">
                {older && <a className="prev" href={paths.post(older.key)}><span>이전 글</span><strong>{older.title}</strong></a>}
                {newer && <a className="next" href={paths.post(newer.key)}><span>다음 글</span><strong>{newer.title}</strong></a>}
              </nav>
            )}
            <Giscus term={post.commentTerm} />
          </footer>
        )}
      </article>
    </Layout>
  )
}

const fromUrl = (key: string) => (typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get(key) ?? '')

type SeriesInfo = { name: string; count: number; cover?: string; first: PostSummary; latest: PostSummary }

// 연재 카드: 표지, 이름, 편 수, 최근 글. 누르면 그 연재만 순서대로 보여 준다.
function SeriesCards({ series, active, onPick }: { series: SeriesInfo[]; active: string; onPick: (name: string) => void }) {
  return (
    <section className="series-cards" aria-labelledby="series-title">
      <h2 id="series-title" className="side-title">연재</h2>
      <ul>
        {series.map((item, index) => (
          <li key={item.name}>
            <a href={paths.series(item.name)} aria-current={active === item.name ? 'true' : undefined}
              onClick={(event) => { event.preventDefault(); onPick(item.name) }}>
              {item.cover ? <img {...coverImage(item.cover, '(max-width: 640px) 100vw, 360px')} alt="" loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : undefined} decoding="async" width="600" height="315" /> : <span className="series-blank" aria-hidden="true">{item.name.slice(0, 1)}</span>}
              <span className="series-name">{item.name}</span>
              <span className="series-meta">{item.count}편 · 최근 {formatDate(item.latest.date)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

// 목록은 한 번에 이만큼씩 보여 준다. 글이 늘어도 첫 화면이 가볍고, 나머지는 '더 보기'로 이어서 연다.
// 빌드 때 그리는 HTML에도 첫 묶음만 들어간다. 모든 글 주소는 sitemap.xml과 RSS가 따로 알려 준다.
const PAGE_SIZE = 20
// 태그는 자주 쓴 것부터 이만큼만 보이고, 나머지는 '더 보기'로 펼친다(좁은 화면에서는 가로로 넘겨 본다).
const TAG_LIMIT = 12

export function PostList({ initial }: { initial?: PostSummary[] }) {
  const [posts, setPosts] = useState<PostSummary[] | undefined>(initial)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [seriesName, setSeriesName] = useState('')
  // 몇 편까지 펼쳤는지는 지금 거르기 조건(검색어·태그·연재)에 묶어 둔다. 조건이 바뀌면 다시 첫 묶음부터 보인다.
  const [more, setMore] = useState<{ key: string; limit: number }>({ key: '', limit: PAGE_SIZE })
  const [allTags, setAllTags] = useState(false)
  const owner = useIsOwner()
  const filterKey = `${query.trim()}|${tag}|${seriesName}`
  const limit = more.key === filterKey ? more.limit : PAGE_SIZE

  // 글을 읽고 뒤로 돌아오면 펼쳐 둔 만큼 그대로 보이게 history에 적어 두고 되살린다.
  useEffect(() => {
    const saved = history.state?.blogMore
    if (saved && typeof saved.key === 'string' && typeof saved.limit === 'number') setMore(saved)
  }, [])

  function showMore() {
    const next = { key: filterKey, limit: limit + PAGE_SIZE }
    setMore(next)
    try { history.replaceState({ ...history.state, blogMore: next }, '') } catch { /* 저장 못 해도 목록은 펼쳐진다 */ }
  }

  useEffect(() => {
    const read = () => { setTag(fromUrl('tag')); setSeriesName(fromUrl('series')) }
    read()
    const onPop = read
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    listPosts(owner).then(setPosts).catch((reason) => { if (!initial) setError(String(reason?.message ?? reason)) })
  }, [initial, owner])

  function pick(name: string) {
    const next = tag === name ? '' : name
    setTag(next)
    setSeriesName('')
    history.pushState(null, '', next ? paths.tag(next) : paths.blog)
  }

  function pickSeries(name: string) {
    const next = seriesName === name ? '' : name
    setSeriesName(next)
    setTag('')
    history.pushState(null, '', next ? paths.series(next) : paths.blog)
    if (next) document.getElementById('post-list-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const series = useMemo(() => {
    const map = new Map<string, PostSummary[]>()
    for (const post of posts ?? []) if (post.series) map.set(post.series, [...(map.get(post.series) ?? []), post])
    return [...map].map(([name, items]): SeriesInfo => {
      const ordered = [...items].sort((a, b) => (a.date < b.date ? -1 : 1))
      return { name, count: items.length, cover: ordered.find((item) => item.cover)?.cover, first: ordered[0], latest: ordered.at(-1)! }
    }).filter((item) => item.count > 1).sort((a, b) => (a.latest.date < b.latest.date ? 1 : -1))
  }, [posts])

  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const post of posts ?? []) for (const name of post.tags) counts.set(name, (counts.get(name) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  }, [posts])

  const shown = useMemo(() => {
    const word = query.trim().toLowerCase()
    const list = (posts ?? []).filter((post) =>
      (!tag || post.tags.includes(tag)) &&
      (!seriesName || post.series === seriesName) &&
      (!word || [post.title, post.summary, ...post.tags].join(' ').toLowerCase().includes(word)))
    // 연재를 고르면 1편부터 읽도록 오래된 순서로 보여 준다.
    return seriesName ? [...list].sort((a, b) => (a.date < b.date ? -1 : 1)) : list
  }, [posts, query, tag, seriesName])

  // 연도 머리에는 걸러진 전체 글 수를 적고, 아래에는 지금 펼친 글만 그린다.
  const yearTotals = useMemo(() => {
    const counts = new Map<string, number>()
    for (const post of shown) counts.set(yearOf(post.date), (counts.get(yearOf(post.date)) ?? 0) + 1)
    return counts
  }, [shown])

  const years = useMemo(() => {
    const groups: [string, PostSummary[]][] = []
    for (const post of shown.slice(0, limit)) {
      const year = yearOf(post.date)
      const last = groups.at(-1)
      if (last && last[0] === year) last[1].push(post)
      else groups.push([year, [post]])
    }
    return groups
  }, [shown, limit])

  const remaining = Math.max(0, shown.length - limit)


  return (
    <Layout section="blog">
      <div className="shell">
        <header className="page-head head-row">
          <div>
            <h1>블로그</h1>
            <p className="page-lead">프론트엔드를 하며 배운 것을 정리합니다. {posts ? `글 ${posts.filter((post) => !post.draft).length}편.` : ''}</p>
          </div>
          <a className="button ghost owner-only" href={paths.write}>새 글 쓰기</a>
        </header>

        {series.length > 0 && <SeriesCards series={series} active={seriesName} onPick={pickSeries} />}

        <div className="blog-layout" id="post-list-top">
          <div>
            {(tag || seriesName) && (
              <p className="active-filter">
                <span>{seriesName ? `연재 · ${seriesName}` : `태그 · ${tag}`}</span>
                <strong>{shown.length}편</strong>
                <button type="button" onClick={() => (seriesName ? pickSeries(seriesName) : pick(tag))}>전체 글 보기</button>
              </p>
            )}
            {error && <p className="notice error">글 목록을 불러오지 못했습니다. {error}</p>}
            {!error && posts === undefined && <p className="muted">글을 불러오는 중입니다.</p>}
            {posts && shown.length === 0 && (
              <p className="notice">{posts.length ? '조건에 맞는 글이 없습니다. 검색어를 줄이거나 태그·연재 선택을 해제해 보세요.' : '아직 발행한 글이 없습니다.'}</p>
            )}
            {years.map(([year, items]) => (
              <section className="year" key={year} aria-labelledby={`year-${year}`}>
                <h2 id={`year-${year}`}>{year}<span>{yearTotals.get(year) ?? items.length}편</span></h2>
                <ul className="post-rows">
                  {items.map((post) => <PostRow key={post.key} post={post} />)}
                </ul>
              </section>
            ))}
            {remaining > 0 && (
              <div className="list-more">
                <p>{shown.length}편 중 {shown.length - remaining}편을 보고 있어요.</p>
                <button className="button ghost" type="button" onClick={showMore}>
                  {Math.min(PAGE_SIZE, remaining)}편 더 보기
                </button>
              </div>
            )}
          </div>

          <aside className="blog-side" aria-label="글 찾기">
            <label className="side-title" htmlFor="post-search">검색</label>
            <input id="post-search" className="search" type="search" placeholder="제목, 요약, 태그" value={query} onChange={(event) => setQuery(event.target.value)} />
            {tags.length > 0 && (
              <>
                <p className="side-title">태그</p>
                <div className="filter" role="group" aria-label="태그로 거르기" data-expanded={allTags}>
                  <button type="button" aria-pressed={!tag} onClick={() => pick('')}>전체 <span>{posts?.length ?? 0}</span></button>
                  {/* 자주 쓴 태그 밖의 것은 넓은 화면에서 접어 둔다(CSS). 고른 태그는 늘 보인다. */}
                  {tags.map(([name, count], index) => (
                    <button type="button" key={name} className={index >= TAG_LIMIT && name !== tag ? 'tag-extra' : undefined} aria-pressed={tag === name} onClick={() => pick(name)}>{name} <span>{count}</span></button>
                  ))}
                </div>
                {tags.length > TAG_LIMIT && (
                  <button className="tag-toggle" type="button" aria-expanded={allTags} onClick={() => setAllTags(!allTags)}>
                    {allTags ? '태그 접기' : `태그 ${tags.length - TAG_LIMIT}개 더 보기`}
                  </button>
                )}
              </>
            )}
            <p className="side-note"><a href="/rss.xml">RSS로 구독하기</a></p>
          </aside>
        </div>
      </div>
    </Layout>
  )
}
