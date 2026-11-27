// 블로그 댓글 쓰기·고치기·지우기. 로그인 없이 닉네임과 비밀번호로 쓰고, 작성자 IP 앞 두 자리를 함께 보여 준다.
// 고치거나 지울 때는 쓸 때 정한 비밀번호가 맞아야 한다. 블로그 주인이 로그인해 있으면 어떤 댓글이든 비밀번호 없이 지운다.
// IP는 브라우저가 스스로 알 수 없어서 이 함수가 요청 헤더에서 읽어 DB 함수(create_comment)에 넘긴다.
// 읽기는 브라우저가 list_comments()를 바로 부른다. 쓰기·고치기·지우기 DB 함수는 service_role만 부를 수 있다.
import { createClient } from 'npm:@supabase/supabase-js@2'

const OWNER_ID = '92193eba-8130-497f-94ff-04531af65136'
const OWNER_NAME = '김이랑'
const ORIGINS = ['https://2rangs.github.io', 'http://localhost:5173', 'http://localhost:4173']

const MESSAGES: Record<string, [number, string]> = {
  too_fast: [429, '댓글은 20초에 한 번 쓸 수 있습니다. 잠시 뒤에 다시 시도해 주세요.'],
  too_many: [429, '오늘 쓸 수 있는 댓글 수를 넘었습니다. 내일 다시 써 주세요.'],
  invalid_input: [400, '닉네임은 20자, 댓글은 2,000자까지 쓸 수 있습니다.'],
  invalid_password: [400, '비밀번호는 4자 이상 입력해 주세요.'],
  post_not_found: [404, '댓글을 달 글을 찾지 못했습니다.'],
  parent_not_found: [404, '답글을 달 댓글을 찾지 못했습니다.'],
}

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const clientIp = (req: Request) =>
  (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || ''

Deno.serve(async (req) => {
  const headers = { ...cors(req), 'Content-Type': 'application/json' }
  const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return reply(405, { error: '허용하지 않는 요청입니다.' })

  let input: Record<string, unknown>
  try {
    input = await req.json()
  } catch {
    return reply(400, { error: '요청 형식이 올바르지 않습니다.' })
  }
  const text = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : '')

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // 로그인한 주인이면 닉네임이 김이랑으로 고정되고 '글쓴이'로 표시되며, 아무 댓글이나 비밀번호 없이 지울 수 있다.
  let owner = false
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (token) {
    const { data } = await admin.auth.getUser(token)
    owner = data.user?.id === OWNER_ID
  }

  if (input.action === 'create') {
    // 사람 눈에 안 보이는 칸이 채워져 있으면 자동 등록 봇이다. 저장하지 않고 성공한 척한다.
    if (text('website')) return reply(200, { ok: true })
    const { data, error } = await admin.rpc('create_comment', {
      p_post_key: text('postKey'),
      p_nickname: owner ? OWNER_NAME : text('nickname'),
      p_password: text('password'),
      p_body: text('body'),
      p_ip: clientIp(req),
      p_owner: owner,
      p_parent_id: Number.isInteger(Number(input.parentId)) && input.parentId ? Number(input.parentId) : null,
    })
    if (error) {
      const code = Object.keys(MESSAGES).find((key) => error.message.includes(key))
      const [status, message] = code ? MESSAGES[code] : [500, '댓글을 저장하지 못했습니다. 잠시 뒤에 다시 시도해 주세요.']
      return reply(status, { error: message })
    }
    return reply(200, { ok: true, id: data })
  }

  if (input.action === 'edit') {
    const id = Number(input.id)
    if (!Number.isInteger(id)) return reply(400, { error: '고칠 댓글을 찾지 못했습니다.' })
    const { data, error } = await admin.rpc('update_comment', { p_id: id, p_password: text('password'), p_body: text('body') })
    if (error) return reply(500, { error: '댓글을 고치지 못했습니다. 잠시 뒤에 다시 시도해 주세요.' })
    if (data === 'wrong_password') return reply(403, { error: '비밀번호가 맞지 않습니다.' })
    if (data === 'invalid_input') return reply(400, { error: '댓글은 1자 이상 2,000자까지 쓸 수 있습니다.' })
    if (data !== 'ok') return reply(404, { error: '고칠 댓글을 찾지 못했습니다.' })
    return reply(200, { ok: true })
  }

  if (input.action === 'delete') {
    const id = Number(input.id)
    if (!Number.isInteger(id)) return reply(400, { error: '지울 댓글을 찾지 못했습니다.' })
    const { data, error } = await admin.rpc('delete_comment', { p_id: id, p_password: text('password'), p_owner: owner })
    if (error) return reply(500, { error: '댓글을 지우지 못했습니다. 잠시 뒤에 다시 시도해 주세요.' })
    if (!data) return reply(403, { error: '비밀번호가 맞지 않습니다.' })
    return reply(200, { ok: true })
  }

  return reply(400, { error: '알 수 없는 요청입니다.' })
})
