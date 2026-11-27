import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { OWNER_ID } from './Layout'

// 글 아래 댓글. 로그인 없이 닉네임과 비밀번호로 쓰고, 작성자 IP 앞 두 자리를 함께 보여 준다.
// 읽기는 DB 함수 list_comments를 바로 부르고, 쓰기·지우기는 Edge Function comments를 거친다(IP를 서버만 알기 때문).
// 블로그 주인이 로그인해 있으면 닉네임·비밀번호 없이 쓰고, 어떤 댓글이든 지울 수 있다.
type Comment = { id: number; nickname: string; body: string; ip_prefix: string; is_owner: boolean; created_at: string; deleted: boolean }

const NICK_KEY = 'comment-nickname'
const BODY_MAX = 2000

const stamp = (value: string) =>
  new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(value))

function readNick() {
  try {
    return localStorage.getItem(NICK_KEY) ?? ''
  } catch {
    return ''
  }
}

// Edge Function이 돌려준 오류 문구를 꺼낸다. 없으면 기본 문구.
async function errorText(error: unknown, fallback: string) {
  const context = (error as { context?: Response })?.context
  try {
    const data = context ? await context.json() : null
    if (data?.error) return String(data.error)
  } catch {
    // 본문을 못 읽으면 기본 문구를 쓴다.
  }
  return fallback
}

export function Comments({ postKey }: { postKey: string }) {
  const [comments, setComments] = useState<Comment[] | undefined>()
  const [loadError, setLoadError] = useState('')
  const [owner, setOwner] = useState(false)
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [body, setBody] = useState('')
  const [trap, setTrap] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_comments', { p_post_key: postKey })
    if (error) setLoadError('댓글을 불러오지 못했습니다.')
    else {
      setLoadError('')
      setComments(data as Comment[])
    }
  }, [postKey])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setNickname(readNick())
    supabase.auth.getSession().then(({ data }) => setOwner(data.session?.user.id === OWNER_ID))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setOwner(session?.user.id === OWNER_ID))
    return () => data.subscription.unsubscribe()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!body.trim()) return setMessage({ kind: 'error', text: '댓글 내용을 입력해 주세요.' })
    if (!owner && !nickname.trim()) return setMessage({ kind: 'error', text: '닉네임을 입력해 주세요.' })
    if (!owner && password.length < 4) return setMessage({ kind: 'error', text: '비밀번호는 4자 이상 입력해 주세요. 댓글을 지울 때 씁니다.' })
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.functions.invoke('comments', {
      body: { action: 'create', postKey, nickname: nickname.trim(), password, body, website: trap },
    })
    setBusy(false)
    if (error) return setMessage({ kind: 'error', text: await errorText(error, '댓글을 저장하지 못했습니다. 잠시 뒤에 다시 시도해 주세요.') })
    try {
      if (!owner) localStorage.setItem(NICK_KEY, nickname.trim())
    } catch {
      // 닉네임을 기억하지 못해도 댓글은 저장됐다.
    }
    setBody('')
    setPassword('')
    setMessage({ kind: 'ok', text: '댓글을 남겼습니다.' })
    load()
  }

  const count = comments?.filter((item) => !item.deleted).length ?? 0

  return (
    <section className="comments-area" aria-labelledby="comments-title">
      <h2 id="comments-title">댓글{comments && count > 0 && <span className="cmt-count">{count}</span>}</h2>
      {loadError && <p className="notice error">{loadError}</p>}
      {!loadError && comments === undefined && <p className="muted">댓글을 불러오는 중입니다.</p>}
      {comments && comments.length === 0 && <p className="muted cmt-empty">아직 댓글이 없습니다. 첫 댓글을 남겨 주세요.</p>}
      {comments && comments.length > 0 && (
        <ol className="cmt-list">
          {comments.map((comment) => <CommentItem key={comment.id} comment={comment} owner={owner} onChange={load} />)}
        </ol>
      )}

      <form className="cmt-form" onSubmit={submit} noValidate>
        {owner ? (
          <p className="cmt-as">글쓴이로 댓글을 남깁니다.</p>
        ) : (
          <div className="cmt-fields">
            <label>
              <span>닉네임</span>
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={20} autoComplete="nickname" />
            </label>
            <label>
              <span>비밀번호</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={50} autoComplete="new-password" />
            </label>
          </div>
        )}
        {/* 사람에게는 보이지 않는 칸. 자동 등록 봇이 채우면 서버가 저장하지 않는다. */}
        <label className="cmt-trap" aria-hidden="true">
          웹사이트<input tabIndex={-1} autoComplete="off" value={trap} onChange={(event) => setTrap(event.target.value)} />
        </label>
        <label className="cmt-body">
          <span className="sr-only">댓글 내용</span>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={BODY_MAX} rows={4} placeholder="댓글을 남겨 주세요." />
        </label>
        <div className="cmt-actions">
          <span className="cmt-note">{owner ? `${body.length} / ${BODY_MAX}` : `IP 앞자리가 함께 표시됩니다 · ${body.length} / ${BODY_MAX}`}</span>
          <button className="button primary" type="submit" disabled={busy}>{busy ? '등록 중…' : '등록'}</button>
        </div>
        {message && <p className={message.kind === 'error' ? 'cmt-message error' : 'cmt-message'} role="status">{message.text}</p>}
      </form>
    </section>
  )
}

function CommentItem({ comment, owner, onChange }: { comment: Comment; owner: boolean; onChange: () => void }) {
  const [asking, setAsking] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (comment.deleted) {
    return <li className="cmt deleted"><p>삭제된 댓글입니다.</p></li>
  }

  async function remove(event?: FormEvent) {
    event?.preventDefault()
    if (busy) return
    if (owner && !window.confirm('이 댓글을 지울까요?')) return
    setBusy(true)
    setError('')
    const { error: failure } = await supabase.functions.invoke('comments', { body: { action: 'delete', id: comment.id, password } })
    setBusy(false)
    if (failure) return setError(await errorText(failure, '댓글을 지우지 못했습니다.'))
    onChange()
  }

  return (
    <li className={comment.is_owner ? 'cmt by-owner' : 'cmt'}>
      <p className="cmt-meta">
        <strong>{comment.nickname}</strong>
        {comment.is_owner ? <span className="cmt-badge">글쓴이</span> : comment.ip_prefix && <span className="cmt-ip">({comment.ip_prefix})</span>}
        <time dateTime={comment.created_at}>{stamp(comment.created_at)}</time>
        {!asking && (
          <button className="cmt-delete" type="button" onClick={() => (owner ? remove() : setAsking(true))} disabled={busy}>삭제</button>
        )}
      </p>
      <p className="cmt-text">{comment.body}</p>
      {asking && (
        <form className="cmt-confirm" onSubmit={remove}>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호" aria-label="댓글 비밀번호" autoFocus />
          <button className="button ghost" type="submit" disabled={busy || !password}>삭제</button>
          <button className="cmt-cancel" type="button" onClick={() => { setAsking(false); setPassword(''); setError('') }}>취소</button>
        </form>
      )}
      {error && <p className="cmt-message error" role="status">{error}</p>}
    </li>
  )
}
