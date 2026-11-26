// 글을 발행·수정·삭제하면 blog_posts 트리거가 이 함수를 부르고, 이 함수가 GitHub Pages 배포 워크플로를 실행한다.
// 글별 HTML·썸네일·사이트맵은 빌드 때 만들어지므로, 발행 직후 빌드해야 새 글 주소가 404 대신 200으로 응답한다.
//
// 필요한 비밀값(Edge Function secret)
//   GITHUB_DEPLOY_TOKEN: 2rangs/2rangs.github.io 저장소만 가리키는 fine-grained PAT, 권한은 Actions: Read and write 하나.
// 호출 확인
//   트리거가 x-deploy-hook 헤더에 Vault의 deploy_hook_secret 값을 실어 보낸다. 함수는 그 값을 DB 함수로 대조한다.
import { createClient } from 'npm:@supabase/supabase-js@2'

const REPO = '2rangs/2rangs.github.io'
const WORKFLOW = 'static.yml'
const GITHUB = 'https://api.github.com'

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' })

  // 1. 호출한 쪽이 트리거인지 확인한다.
  const secret = req.headers.get('x-deploy-hook') ?? ''
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: ok, error } = await admin.rpc('verify_deploy_hook', { secret })
  if (error) return json(500, { error: 'verify failed' })
  if (!ok) return json(401, { error: 'unauthorized' })

  const token = Deno.env.get('GITHUB_DEPLOY_TOKEN')
  if (!token) return json(500, { error: 'GITHUB_DEPLOY_TOKEN is not set' })
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'blog-deploy-hook',
  }

  // 2. 아직 시작하지 않은 실행이 이미 있으면 건너뛴다. 그 실행이 시작할 때 최신 글을 읽는다.
  //    이미 돌고 있는 실행은 이번 변경 전에 글을 읽었을 수 있으니, 그때는 하나 더 건다(concurrency로 차례를 기다린다).
  for (const status of ['queued', 'waiting', 'pending', 'requested']) {
    const runs = await fetch(`${GITHUB}/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?status=${status}&per_page=1`, { headers })
    if (!runs.ok) return json(502, { error: `list runs ${runs.status}` })
    const { total_count } = await runs.json()
    if (total_count > 0) return json(200, { skipped: `a ${status} run already exists` })
  }

  // 3. 배포 워크플로를 실행한다.
  const dispatch = await fetch(`${GITHUB}/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main' }),
  })
  if (!dispatch.ok) return json(502, { error: `dispatch ${dispatch.status}`, detail: await dispatch.text() })
  return json(200, { dispatched: true })
})
