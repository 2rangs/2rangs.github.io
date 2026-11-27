import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { OWNER_ID } from './Layout'

// 글 아래 댓글. 티스토리·디시 손님 댓글처럼 로그인 없이 닉네임과 비밀번호로 쓰고, 작성자 IP 앞 두 자리를 함께 보여 준다.
// 고치거나 지울 때는 쓸 때 정한 비밀번호를 넣는다. 블로그 주인도 똑같이 비밀번호를 정해서 쓰고,
// 주인이 로그인해 있으면 닉네임이 고정되고 '글쓴이'로 표시되며, 어떤 댓글이든 비밀번호 없이 지울 수 있다.
// 읽기는 DB 함수 list_comments를 바로 부르고, 쓰기·고치기·지우기는 Edge Function comments를 거친다(IP를 서버만 알기 때문).
type Comment = {
  id: number
  parent_id: number | null
  nickname: string
  body: string
  ip_prefix: string
  is_owner: boolean
  created_at: string
  edited: boolean
  deleted: boolean
}

const NICK_KEY = 'comment-nickname'
const BODY_MAX = 2000
const OWNER_NAME = '김이랑'

// 디시처럼 짧게: 올해 글은 "11.27 16:05", 지난해 글은 "2025.11.27 16:05".
function stamp(value: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Seoul' })
      .formatToParts(new Date(value)).map((part) => [part.type, part.value]),
  )
  const thisYear = new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date())
  return `${parts.year === thisYear ? '' : `${parts.year}.`}${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`
}

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

async function call(body: Record<string, unknown>, fallback: string) {
  const { error } = await supabase.functions.invoke('comments', { body })
  return error ? errorText(error, fallback) : ''
}

export function Comments({ postKey }: { postKey: string }) {
  const [comments, setComments] = useState<Comment[] | undefined>()
  const [loadError, setLoadError] = useState('')
  const [owner, setOwner] = useState(false)
  // 지금 열려 있는 답글·수정·삭제 칸. 한 번에 하나만 연다.
  const [open, setOpen] = useState<{ id: number; mode: 'reply' | 'edit' | 'delete' } | null>(null)

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
    supabase.auth.getSession().then(({ data }) => setOwner(data.session?.user.id === OWNER_ID))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setOwner(session?.user.id === OWNER_ID))
    return () => data.subscription.unsubscribe()
  }, [])

  const done = () => {
    setOpen(null)
    load()
  }

  const roots = (comments ?? []).filter((item) => !item.parent_id)
  const replies = (id: number) => (comments ?? []).filter((item) => item.parent_id === id)
  // 지운 댓글은 답글이 남아 있을 때만 자리를 남긴다.
  const visible = roots.filter((item) => !item.deleted || replies(item.id).some((reply) => !reply.deleted))
  const count = comments?.filter((item) => !item.deleted).length ?? 0

  const item = (comment: Comment) => (
    <CommentItem
      key={comment.id}
      comment={comment}
      owner={owner}
      postKey={postKey}
      open={open?.id === comment.id ? open.mode : null}
      onOpen={(mode) => setOpen(mode && { id: comment.id, mode })}
      onDone={done}
    />
  )

  return (
    <section className="comments-area" aria-labelledby="comments-title">
      <h2 id="comments-title">댓글{comments && <span className="cmt-count">{count}</span>}</h2>
      {loadError && <p className="notice error">{loadError}</p>}
      {!loadError && comments === undefined && <p className="muted">댓글을 불러오는 중입니다.</p>}
      {comments && visible.length === 0 && <p className="muted cmt-empty">아직 댓글이 없습니다. 첫 댓글을 남겨 주세요.</p>}
      {visible.length > 0 && (
        <ol className="cmt-list">
          {visible.map((root) => {
            const children = replies(root.id).filter((reply) => !reply.deleted)
            return (
              <li key={root.id} className="cmt-thread">
                {item(root)}
                {children.length > 0 && <ol className="cmt-replies">{children.map((reply) => <li key={reply.id}>{item(reply)}</li>)}</ol>}
              </li>
            )
          })}
        </ol>
      )}
      <CommentForm postKey={postKey} owner={owner} onDone={done} />
    </section>
  )
}

// 새 댓글·답글 입력 칸. 디시처럼 닉네임·비밀번호를 한 줄에 두고 그 아래 본문.
function CommentForm({ postKey, owner, parentId, onDone, onCancel }: { postKey: string; owner: boolean; parentId?: number; onDone: () => void; onCancel?: () => void }) {
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [body, setBody] = useState('')
  const [trap, setTrap] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setNickname(readNick())
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!owner && !nickname.trim()) return setMessage({ kind: 'error', text: '닉네임을 입력해 주세요.' })
    if (password.length < 4) return setMessage({ kind: 'error', text: '비밀번호는 4자 이상 입력해 주세요. 댓글을 고치거나 지울 때 씁니다.' })
    if (!body.trim()) return setMessage({ kind: 'error', text: '내용을 입력해 주세요.' })
    setBusy(true)
    setMessage(null)
    const error = await call({ action: 'create', postKey, parentId, nickname: nickname.trim(), password, body, website: trap }, '댓글을 저장하지 못했습니다. 잠시 뒤에 다시 시도해 주세요.')
    setBusy(false)
    if (error) return setMessage({ kind: 'error', text: error })
    try {
      if (!owner) localStorage.setItem(NICK_KEY, nickname.trim())
    } catch {
      // 닉네임을 기억하지 못해도 댓글은 저장됐다.
    }
    setBody('')
    setPassword('')
    if (!parentId) setMessage({ kind: 'ok', text: '댓글을 남겼습니다.' })
    onDone()
  }

  return (
    <form className={parentId ? 'cmt-form is-reply' : 'cmt-form'} onSubmit={submit} noValidate>
      <div className="cmt-fields">
        {owner ? (
          <span className="cmt-as"><strong>{OWNER_NAME}</strong><span className="cmt-badge">글쓴이</span></span>
        ) : (
          <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={20} placeholder="닉네임" aria-label="닉네임" autoComplete="nickname" />
        )}
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={50} placeholder="비밀번호" aria-label="비밀번호" autoComplete="new-password" />
      </div>
      {/* 사람에게는 보이지 않는 칸. 자동 등록 봇이 채우면 서버가 저장하지 않는다. */}
      <label className="cmt-trap" aria-hidden="true">
        웹사이트<input tabIndex={-1} autoComplete="off" value={trap} onChange={(event) => setTrap(event.target.value)} />
      </label>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={BODY_MAX} rows={parentId ? 3 : 4} aria-label={parentId ? '답글 내용' : '댓글 내용'}
        placeholder={parentId ? '답글을 남겨 주세요.' : '댓글을 남겨 주세요. 비밀번호는 고치거나 지울 때 씁니다.'} autoFocus={Boolean(parentId)} />
      <div className="cmt-actions">
        <span className="cmt-note">{owner ? '' : 'IP 앞자리가 함께 표시됩니다 · '}{body.length} / {BODY_MAX}</span>
        <span className="cmt-buttons">
          {onCancel && <button className="cmt-link" type="button" onClick={onCancel}>취소</button>}
          <button className="button primary" type="submit" disabled={busy}>{busy ? '등록 중…' : parentId ? '답글 등록' : '등록'}</button>
        </span>
      </div>
      {message && <p className={message.kind === 'error' ? 'cmt-message error' : 'cmt-message'} role="status">{message.text}</p>}
    </form>
  )
}

type Mode = 'reply' | 'edit' | 'delete'

function CommentItem({ comment, owner, postKey, open, onOpen, onDone }: {
  comment: Comment
  owner: boolean
  postKey: string
  open: Mode | null
  onOpen: (mode: Mode | null) => void
  onDone: () => void
}) {
  const [password, setPassword] = useState('')
  const [draft, setDraft] = useState(comment.body)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (comment.deleted) {
    return <div className="cmt deleted"><p>삭제된 댓글입니다.</p></div>
  }

  function toggle(mode: Mode) {
    setPassword('')
    setError('')
    setDraft(comment.body)
    onOpen(open === mode ? null : mode)
  }

  // 고치기·지우기를 보내고, 오류가 없으면 목록을 다시 받는다.
  async function run(body: Record<string, unknown>, fallback: string, event?: FormEvent) {
    event?.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const failure = await call({ id: comment.id, password, ...body }, fallback)
    setBusy(false)
    if (failure) setError(failure)
    else onDone()
  }

  function save(event: FormEvent) {
    if (!draft.trim()) {
      event.preventDefault()
      return setError('내용을 입력해 주세요.')
    }
    run({ action: 'edit', body: draft }, '댓글을 고치지 못했습니다.', event)
  }

  const remove = (event?: FormEvent) => run({ action: 'delete' }, '댓글을 지우지 못했습니다.', event)

  // 주인이 로그인해 있으면 비밀번호 없이 바로 지운다.
  function ownerDelete() {
    if (!window.confirm('이 댓글을 지울까요?')) return
    remove()
  }

  return (
    <div className={comment.is_owner ? 'cmt by-owner' : 'cmt'}>
      <p className="cmt-meta">
        <strong>{comment.nickname}</strong>
        {comment.is_owner ? <span className="cmt-badge">글쓴이</span> : comment.ip_prefix && <span className="cmt-ip">({comment.ip_prefix})</span>}
        <time dateTime={comment.created_at}>{stamp(comment.created_at)}</time>
        {comment.edited && <span className="cmt-edited">수정됨</span>}
        <span className="cmt-tools">
          {!comment.parent_id && <button className="cmt-link" type="button" aria-expanded={open === 'reply'} onClick={() => toggle('reply')}>답글</button>}
          <button className="cmt-link" type="button" aria-expanded={open === 'edit'} onClick={() => toggle('edit')}>수정</button>
          <button className="cmt-link" type="button" aria-expanded={open === 'delete'} onClick={() => (owner ? ownerDelete() : toggle('delete'))}>삭제</button>
        </span>
      </p>
      {open === 'edit' ? (
        <form className="cmt-edit" onSubmit={save}>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={BODY_MAX} rows={3} aria-label="고칠 내용" autoFocus />
          <div className="cmt-confirm">
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호" aria-label="댓글 비밀번호" />
            <button className="button ghost" type="submit" disabled={busy || !password}>수정</button>
            <button className="cmt-link" type="button" onClick={() => toggle('edit')}>취소</button>
          </div>
        </form>
      ) : (
        <p className="cmt-text">{comment.body}</p>
      )}
      {open === 'delete' && (
        <form className="cmt-confirm" onSubmit={remove}>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호" aria-label="댓글 비밀번호" autoFocus />
          <button className="button ghost" type="submit" disabled={busy || !password}>삭제</button>
          <button className="cmt-link" type="button" onClick={() => toggle('delete')}>취소</button>
        </form>
      )}
      {error && <p className="cmt-message error" role="status">{error}</p>}
      {open === 'reply' && <CommentForm postKey={postKey} owner={owner} parentId={comment.id} onDone={onDone} onCancel={() => toggle('reply')} />}
    </div>
  )
}
