import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Layout, OWNER_ID } from '../components/Layout'
import { RichEditor } from '../components/RichEditor'
import { deletePost, getPost, listPosts, savePost, type Draft, type PostSummary } from '../lib/posts'
import { paths } from '../lib/routes'
import { uploadImage } from '../lib/images'
import { excerpt } from '../lib/seo'
import { supabase } from '../lib/supabase'

const DRAFT_KEY = 'blog-draft'
const EMPTY: Draft = { slug: '', title: '', summary: '', tags: [], body_markdown: '' }
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

function loadDraft(): Draft {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') }
  } catch {
    return EMPTY
  }
}

// 대표 이미지: 목록 썸네일, 글 머리 이미지, 링크 미리보기에 쓰인다. 가로 1200×630 비율을 권한다.
function CoverField({ value, onChange, onNotice }: { value?: string; onChange: (url: string) => void; onNotice: (text: string, isError?: boolean) => void }) {
  const picker = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file?: File) {
    if (!file) return
    setBusy(true)
    try {
      const { url, embedded } = await uploadImage(file)
      onChange(url)
      if (embedded) onNotice('이미지 저장소에 올리지 못해 대표 이미지를 글에 직접 넣었습니다. 이 경우 링크 미리보기에는 쓰이지 않습니다. Supabase Storage에 공개 버킷 "blog-images"가 필요합니다.')
    } catch (reason: any) {
      onNotice(String(reason?.message ?? reason), true)
    }
    setBusy(false)
  }

  return (
    <div className="field">
      <span className="field-label" id="cover-label">대표 이미지</span>
      <div className="cover-field" aria-labelledby="cover-label"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); pick(event.dataTransfer.files[0]) }}>
        {value
          ? <img src={value} alt="대표 이미지 미리보기" />
          : <p>이미지를 끌어다 놓거나 아래 버튼으로 고르세요. 가로로 긴 이미지(1200×630)가 잘 맞습니다.</p>}
      </div>
      <div className="form-actions">
        <button className="button ghost" type="button" disabled={busy} onClick={() => picker.current?.click()}>{busy ? '올리는 중…' : value ? '이미지 바꾸기' : '이미지 고르기'}</button>
        {value && <button className="button ghost" type="button" onClick={() => onChange('')}>대표 이미지 빼기</button>}
        <input ref={picker} type="file" accept="image/*" hidden onChange={(event) => { pick(event.target.files?.[0]); event.target.value = '' }} />
      </div>
      <small>비워 두면 목록에는 이미지 없이, 링크 미리보기에는 제목으로 만든 썸네일이 쓰입니다.</small>
    </div>
  )
}

// 마크다운 원문 편집. 이미지는 커서가 있는 자리에 넣는다.
function MarkdownSource({ value, onChange, onNotice }: { value: string; onChange: (markdown: string) => void; onNotice: (text: string, isError?: boolean) => void }) {
  const area = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  function insertAtCursor(text: string) {
    const element = area.current
    const start = element?.selectionStart ?? value.length
    const end = element?.selectionEnd ?? value.length
    // 앞뒤 문단과 붙지 않게 빈 줄을 맞춘다.
    const before = value.slice(0, start)
    const after = value.slice(end)
    const lead = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    const tail = !after || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
    const next = before + lead + text + tail + after
    onChange(next)
    const caret = (before + lead + text).length
    requestAnimationFrame(() => { element?.focus(); element?.setSelectionRange(caret, caret) })
  }

  async function insertImages(files: File[]) {
    setBusy(true)
    for (const file of files) {
      try {
        const { url, embedded } = await uploadImage(file)
        insertAtCursor(`![${file.name.replace(/\.[^.]+$/, '')}](${url})`)
        if (embedded) onNotice('이미지 저장소에 올리지 못해 본문에 직접 넣었습니다. Supabase Storage에 공개 버킷 "blog-images"가 필요합니다.')
      } catch (reason: any) {
        onNotice(String(reason?.message ?? reason), true)
      }
    }
    setBusy(false)
  }

  return (
    <div className="source-wrap">
      <div className="toolbar" role="toolbar" aria-label="넣기">
        <button type="button" onClick={() => picker.current?.click()} disabled={busy}>{busy ? '올리는 중…' : '커서 위치에 이미지'}</button>
        <button type="button" onClick={() => insertAtCursor('```ts\n\n```')}>코드 블록</button>
        <button type="button" onClick={() => insertAtCursor('> **참고** ')}>참고 상자</button>
        <button type="button" onClick={() => insertAtCursor('| 항목 | 설명 |\n| --- | --- |\n|  |  |')}>표</button>
        <button type="button" onClick={() => insertAtCursor('---')}>구분선</button>
        <input ref={picker} type="file" accept="image/*" multiple hidden
          onChange={(event) => { insertImages(Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'))); event.target.value = '' }} />
      </div>
      <textarea ref={area} className="source" aria-labelledby="body-label" spellCheck={false} placeholder={'## 소제목\n\n본문을 마크다운으로 씁니다.'}
        value={value} onChange={(event) => onChange(event.target.value)}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'))
          if (files.length) { event.preventDefault(); insertImages(files) }
        }} />
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(publish: boolean) {
    setBusy(true)
    setError('')
    const { error: failure } = await supabase.auth.signInWithPassword({ email, password })
    if (failure) setError('로그인하지 못했습니다. 이메일과 비밀번호를 확인해 주세요.')
    setBusy(false)
  }

  // GitHub로 로그인하면 GitHub를 거쳐 이 화면(/write/)으로 돌아온다. Supabase에서 GitHub 공급자를 켜 두어야 동작한다.
  async function github() {
    setBusy(true)
    setError('')
    const { error: failure } = await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: `${location.origin}${paths.write}` } })
    if (failure) {
      setError(`GitHub 로그인을 시작하지 못했습니다. ${failure.message}`)
      setBusy(false)
    }
  }

  return (
    <div className="narrow" style={{ maxWidth: 440 }}>
      <header className="page-head">
        <h1>로그인</h1>
        <p className="section-lead">글을 쓰려면 블로그 계정으로 로그인해 주세요.</p>
      </header>
      <div className="form-actions" style={{ marginBottom: 24 }}>
        <button className="button primary" type="button" disabled={busy} onClick={github}>GitHub로 로그인</button>
      </div>
      <p className="muted">또는 이메일로 로그인</p>
      <form className="form" onSubmit={(event) => { event.preventDefault(); save(true) }}>
        <div className="field">
          <label htmlFor="email">이메일</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">비밀번호</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="button ghost" type="submit" disabled={busy}>{busy ? '로그인 중…' : '이메일로 로그인'}</button>
        </div>
      </form>
    </div>
  )
}

function Editor({ session }: { session: Session }) {
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [tagText, setTagText] = useState(() => loadDraft().tags.join(', '))
  const [mode, setMode] = useState<'rich' | 'markdown'>('rich')
  // 에디터 밖에서 본문이 바뀌면(글 불러오기, 새로 쓰기, 마크다운 직접 수정) 에디터를 새로 만든다.
  const [editorKey, setEditorKey] = useState(0)
  const remount = () => setEditorKey((key) => key + 1)
  const [mine, setMine] = useState<PostSummary[]>([])
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string; link?: string; note?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => listPosts(true).then((posts) => setMine(posts.filter((post) => !String(post.id).startsWith('static-')))).catch(() => setMine([]))
  useEffect(() => { refresh() }, [])

  // 글 화면의 "수정" 링크(/write/?edit=주소)로 들어오면 그 글을 불러온다.
  useEffect(() => {
    const key = new URLSearchParams(location.search).get('edit')
    if (key) edit(key)
  }, [])

  // Cmd/Ctrl+S: 발행된 글은 수정 저장, 아니면 초안 저장.
  const saveRef = useRef<() => void>(() => {})
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 쓰던 글은 이 브라우저에 자동으로 임시 저장한다.
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [draft])

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))

  // 주소를 직접 고치기 전까지는 제목에서 주소를 만들어 준다. 한글 제목이면 날짜로 만든다.
  const [slugTouched, setSlugTouched] = useState(() => Boolean(loadDraft().slug))
  function changeTitle(title: string) {
    if (draft.id || slugTouched) return set({ title })
    const fromTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
    set({ title, slug: fromTitle.length >= 3 ? fromTitle : `post-${stamp}` })
  }

  function reset() {
    setDraft(EMPTY)
    setTagText('')
    setStatus(null)
    setSlugTouched(false)
    remount()
  }

  async function edit(key: string) {
    setStatus(null)
    const post = await getPost(key)
    if (!post) return
    // 사이트에 같이 배포된 글(DB에 아직 없음)은 저장하면 DB에 새 글로 들어간다.
    const bundled = String(post.id).startsWith('static-')
    setDraft({ id: bundled ? undefined : post.id, published: !bundled && !post.draft, slug: post.key, title: post.title, summary: post.summary, tags: post.tags, body_markdown: post.markdown, cover_url: post.cover })
    setTagText(post.tags.join(', '))
    remount()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save(publish: boolean) {
    if (!draft.body_markdown.trim()) {
      setStatus({ kind: 'error', text: '본문을 입력해 주세요.' })
      return
    }
    if (!SLUG.test(draft.slug)) {
      setStatus({ kind: 'error', text: '주소는 영문 소문자, 숫자, 하이픈(-)만 쓸 수 있습니다. 예: my-first-post' })
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      // 요약을 비워 두면 본문 앞부분으로 채운다. 목록과 링크 미리보기에 쓰인다.
      const saved = await savePost({ ...draft, summary: draft.summary.trim() || excerpt(draft.body_markdown, 120) }, publish)
      const live = publish || draft.published
      setStatus({ kind: 'ok', text: !live ? '초안으로 저장했습니다.' : draft.published ? '수정했습니다.' : '발행했습니다.', link: live ? paths.post(saved.slug) : undefined, note: live })
      setDraft(EMPTY)
      setTagText('')
      setSlugTouched(false)
      remount()
      refresh()
    } catch (reason: any) {
      setStatus({ kind: 'error', text: `저장하지 못했습니다. ${reason?.message ?? reason}` })
    }
    setBusy(false)
  }

  saveRef.current = () => { if (!busy && draft.title && draft.slug) save(Boolean(draft.published)) }

  async function remove() {
    if (!draft.id || !confirm(`"${draft.title}" 글을 삭제할까요? 되돌릴 수 없습니다.`)) return
    setBusy(true)
    try {
      await deletePost(draft.id)
      reset()
      setStatus({ kind: 'ok', text: '삭제했습니다.' })
      refresh()
    } catch (reason: any) {
      setStatus({ kind: 'error', text: `삭제하지 못했습니다. ${reason?.message ?? reason}` })
    }
    setBusy(false)
  }

  return (
    <div className="shell">
      <header className="page-head">
        <h1>{draft.id ? '글 수정' : '새 글'}</h1>
        <div className="meta">
          <span>{session.user.email}</span>
          <LinkGithub session={session} />
          <button className="button ghost" type="button" style={{ minHeight: 36, padding: '4px 12px' }} onClick={() => supabase.auth.signOut()}>로그아웃</button>
        </div>
      </header>

      <form className="form" onSubmit={(event) => { event.preventDefault(); save(true) }}>
        <div className="field">
          <label htmlFor="title">제목</label>
          <input id="title" required value={draft.title} onChange={(event) => changeTitle(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="slug">주소</label>
          <input id="slug" required placeholder="my-first-post" value={draft.slug} onChange={(event) => { setSlugTouched(true); set({ slug: event.target.value.trim().toLowerCase() }) }} />
          <small>글 주소에 쓰입니다. 영문 소문자, 숫자, 하이픈(-)만 쓸 수 있습니다.</small>
        </div>
        <div className="field">
          <label htmlFor="summary">요약</label>
          <input id="summary" value={draft.summary} onChange={(event) => set({ summary: event.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="tags">태그</label>
          <input id="tags" placeholder="TypeScript, CSS" value={tagText}
            onChange={(event) => { setTagText(event.target.value); set({ tags: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }) }} />
          <small>쉼표로 구분합니다.</small>
        </div>

        <CoverField value={draft.cover_url} onChange={(url) => set({ cover_url: url })}
          onNotice={(text, isError) => setStatus({ kind: isError ? 'error' : 'ok', text })} />

        <div className="field">
          <span className="field-label" id="body-label">본문</span>
          <div className="editor-tabs" role="group" aria-label="편집 방식">
            <button type="button" aria-pressed={mode === 'rich'} onClick={() => { remount(); setMode('rich') }}>에디터</button>
            <button type="button" aria-pressed={mode === 'markdown'} onClick={() => setMode('markdown')}>마크다운</button>
          </div>
          {mode === 'rich' ? (
            <RichEditor key={editorKey} initial={draft.body_markdown}
              onChange={(markdown) => set({ body_markdown: markdown })}
              onNotice={(text, isError) => setStatus({ kind: isError ? 'error' : 'ok', text })} />
          ) : (
            <MarkdownSource value={draft.body_markdown} onChange={(markdown) => set({ body_markdown: markdown })}
              onNotice={(text, isError) => setStatus({ kind: isError ? 'error' : 'ok', text })} />
          )}
          <small>저장은 마크다운으로 됩니다. 에디터와 마크다운 원문을 오가며 고칠 수 있습니다.</small>
        </div>

        {status && (
          <p className={`notice ${status.kind === 'error' ? 'error' : ''}`} role="status">
            {status.text} {status.link && <a href={status.link} style={{ color: 'var(--accent)', fontWeight: 700 }}>글 보기</a>}
            {status.note && <><br />블로그에는 바로 보입니다. 검색 결과와 링크 미리보기 썸네일은 다음 빌드 뒤에 반영됩니다. <a href="https://github.com/2rangs/2rangs.github.io/actions/workflows/static.yml" style={{ color: 'var(--accent)', fontWeight: 700 }}>지금 빌드하기</a></>}
          </p>
        )}
        <div className="form-actions">
          <button className="button primary" type="submit" disabled={busy}>{busy ? '저장 중…' : draft.published ? '수정 저장' : '발행'}</button>
          {!draft.published && <button className="button ghost" type="button" onClick={() => save(false)} disabled={busy}>초안 저장</button>}
          <button className="button ghost" type="button" onClick={reset} disabled={busy}>새로 쓰기</button>
          {draft.id && <button className="button danger" type="button" onClick={remove} disabled={busy}>삭제</button>}
          <span className="muted" style={{ fontSize: 15 }}>쓰던 내용은 이 브라우저에 자동 저장됩니다. Cmd/Ctrl+S로 저장할 수 있습니다.</span>
        </div>
      </form>

      <section className="section" aria-labelledby="mine-title">
        <h2 className="section-title" id="mine-title">내 글</h2>
        {mine.length === 0 && <p className="section-lead">아직 쓴 글이 없습니다.</p>}
        <ul className="mine">
          {mine.map((post) => (
            <li key={post.key}>
              <span>{post.draft ? <span className="tag">초안</span> : null} {post.draft ? post.title : <a href={paths.post(post.key)}>{post.title}</a>}</span>
              <button type="button" onClick={() => edit(post.key)}>수정</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// 주인 계정(이메일)에 GitHub 로그인을 붙인다. 붙이면 GitHub로 로그인해도 같은 계정(OWNER_ID)이 되어 글을 쓸 수 있다.
// 다른 GitHub 사용자는 로그인해도 다른 계정이 되므로 글을 쓸 수 없다(RLS가 OWNER_ID만 허용).
// Supabase 대시보드에서 GitHub 공급자와 "Allow manual linking"을 켜 두어야 동작한다.
function LinkGithub({ session }: { session: Session }) {
  const [error, setError] = useState('')
  const linked = session.user.identities?.some((identity) => identity.provider === 'github')
  if (linked) return <span className="muted">GitHub 연결됨</span>
  async function link() {
    setError('')
    const { error: failure } = await supabase.auth.linkIdentity({ provider: 'github', options: { redirectTo: `${location.origin}${paths.write}` } })
    if (failure) setError(`연결하지 못했습니다. ${failure.message}`)
  }
  return (
    <>
      <button className="button ghost" type="button" style={{ minHeight: 36, padding: '4px 12px' }} onClick={link}>GitHub 계정 연결</button>
      {error && <span role="alert" className="muted">{error}</span>}
    </>
  )
}

// 블로그 주인이 아닌 계정(예: 다른 GitHub 사용자)으로 로그인한 경우.
function NotOwner({ email }: { email?: string }) {
  return (
    <div className="narrow" style={{ maxWidth: 440 }}>
      <header className="page-head">
        <h1>글쓰기 권한이 없습니다</h1>
        <p className="section-lead">{email ? `${email} 계정은` : '이 계정은'} 이 블로그에 글을 쓸 수 없습니다.</p>
      </header>
      <button className="button ghost" type="button" onClick={() => supabase.auth.signOut()}>로그아웃</button>
    </div>
  )
}

export function Write() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <Layout section="write">
      {session === undefined ? <p className="narrow muted" style={{ paddingTop: 56 }}>확인 중…</p>
        : !session ? <Login />
        : session.user.id === OWNER_ID ? <Editor session={session} />
        : <NotOwner email={session.user.email ?? session.user.user_metadata?.user_name} />}
    </Layout>
  )
}
