// 글 대표 이미지(1200x630)를 public/img/covers/<slug>.png 로 만든다.
//   node scripts/covers.mjs            목록의 글 중 아직 이미지가 없는 것만
//   node scripts/covers.mjs --force    전부 다시
//   node scripts/covers.mjs <slug>...  고른 글만 다시
// 낱개 글은 밝은 카드 + 오른쪽 무늬(motif), 연재 글은 어두운 카드 + 오른쪽 칩 세 개(chips, on이 강조할 칸).
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const root = join(import.meta.dirname, '..')
const out = join(root, 'public/img/covers')
const fonts = ['Bold', 'SemiBold', 'Medium'].map((weight) => join(root, `node_modules/pretendard/dist/public/static/Pretendard-${weight}.otf`))

const DEV = '개발 이야기'
const THINK = '개발 철학'
const ESSAY = '철학 에세이'
const ASTRYX = 'Meta Astryx 완전 가이드'

const covers = [
  // 개발 이야기
  { slug: 'search-request-race-condition', kicker: `${DEV} · JavaScript`, title: '검색 결과가 가끔 엉뚱하게 나오는 이유 (요청 경쟁과 AbortController)', motif: 'abort' },
  { slug: 'event-loop-microtask', kicker: `${DEV} · JavaScript`, title: 'Promise.then은 왜 setTimeout(0)보다 먼저 실행될까 (이벤트 루프와 마이크로태스크)', motif: 'then' },
  { slug: 'css-stacking-context', kicker: `${DEV} · CSS`, title: 'z-index: 9999는 왜 안 먹힐까 (쌓임 맥락)', motif: '9999' },
  { slug: 'layout-shift-cls', kicker: `${DEV} · 웹 성능`, title: '읽던 글이 왜 갑자기 아래로 밀릴까 (레이아웃 이동과 CLS)', motif: 'CLS' },
  { slug: 'floating-point-money', kicker: `${DEV} · JavaScript`, title: '0.1 + 0.2는 왜 0.3이 아닐까 (부동소수점과 금액 계산)', motif: '0.3?' },
  { slug: 'date-timezone-bug', kicker: `${DEV} · JavaScript`, title: '날짜가 왜 하루씩 밀려 보일까 (Date 파싱과 타임존)', motif: 'UTC' },
  { slug: 'react-rerender-memo', kicker: `${DEV} · React`, title: 'React 컴포넌트는 언제 다시 렌더링될까 (memo를 아무 데나 붙이면 안 되는 이유)', motif: 'memo' },
  { slug: 'react-key-index', kicker: `${DEV} · React`, title: '리스트 key에 index를 쓰면 왜 입력값이 엉뚱한 줄에 남을까', motif: 'key' },
  { slug: 'cors-explained', kicker: `${DEV} · HTTP`, title: '왜 CORS 에러는 Postman에서는 안 날까 (서버가 아니라 브라우저가 막는 이유)', motif: 'CORS' },
  { slug: 'http-cache-deploy', kicker: `${DEV} · HTTP`, title: '배포했는데 왜 사용자는 옛날 화면을 볼까 (HTTP 캐시와 배포 전략)', motif: '304' },
  { slug: 'token-storage-xss-csrf', kicker: `${DEV} · 보안`, title: '로그인 토큰은 어디에 저장해야 할까 (localStorage, 쿠키, XSS와 CSRF)', motif: 'XSS' },
  { slug: 'frontend-memory-leak', kicker: `${DEV} · JavaScript`, title: '탭을 오래 열어 두면 왜 느려질까 (SPA 메모리 누수)', motif: 'GC' },
  { slug: 'korean-ime-enter-twice', kicker: `${DEV} · JavaScript`, title: '한글을 치고 Enter를 누르면 왜 두 번 전송될까 (IME 조합과 isComposing)', motif: 'ㅎㅏㄴ' },
  { slug: 'div-onclick-accessibility', kicker: `${DEV} · 웹 접근성`, title: 'div에 onClick을 달면 왜 안 될까 (button이 공짜로 주는 것들)', motif: '<div>' },
  { slug: 'bundle-size-tree-shaking', kicker: `${DEV} · 웹 성능`, title: 'import 한 줄에 번들이 왜 이렇게 커졌을까 (트리 셰이킹의 원리)', motif: 'ESM' },
  { slug: 'git-rebase-vs-merge', kicker: `${DEV} · Git`, title: 'rebase와 merge, 무엇을 써야 할까 (커밋 그래프로 보는 차이)', motif: 'git' },
  { slug: 'optimistic-update', kicker: `${DEV} · React`, title: '좋아요 버튼은 왜 서버보다 먼저 바뀔까 (낙관적 업데이트)', motif: '+1' },
  { slug: 'n-plus-one-query', kicker: `${DEV} · 데이터베이스`, title: '목록 하나 그리는데 쿼리는 왜 101번 나갈까 (N+1 문제)', motif: 'N+1' },
  { slug: 'unknown-over-any', kicker: `${DEV} · TypeScript`, title: '왜 any 대신 unknown을 써야 할까', motif: 'any' },
  { slug: 'web-worker-heavy-compute', kicker: `${DEV} · Web API`, title: '무거운 계산을 돌리면 왜 화면이 얼어붙을까 (Web Worker)', motif: 'Worker' },
  { slug: 'virtual-list', kicker: `${DEV} · React`, title: '행 1만 개짜리 목록은 왜 버벅일까 (가상 스크롤)', motif: '10,000' },
  // 개발 철학
  { slug: 'choose-boring-technology', kicker: `${THINK} · 아키텍처`, title: '새 기술을 들이기 전에, 혁신 토큰은 몇 개 남았나요', motif: 'boring' },
  { slug: 'code-is-liability', kicker: THINK, title: '내가 쓴 코드는 자산일까요, 빚일까요', motif: '자산?' },
  { slug: 'naming-is-design', kicker: `${THINK} · 협업`, title: '이름이 안 떠오른다면, 설계가 덜 끝난 건 아닐까요', motif: 'data2' },
  { slug: 'duplication-over-wrong-abstraction', kicker: `${THINK} · 아키텍처`, title: '같은 코드가 두 번 보이면 바로 합쳐야 할까요', motif: 'DRY' },
  { slug: 'what-code-review-is-for', kicker: `${THINK} · 협업`, title: '코드 리뷰는 정말 버그를 찾는 자리일까?', motif: 'LGTM' },
  { slug: 'why-write-it-down', kicker: `${THINK} · 협업`, title: '반년 뒤의 나는 왜 이 코드를 이해하지 못할까?', motif: 'Why' },
  { slug: 'why-estimates-are-wrong', kicker: `${THINK} · 협업`, title: '일정 추정은 왜 늘 틀릴까?', motif: '2주?' },
  { slug: 'tech-debt-is-a-choice', kicker: `${THINK} · 아키텍처`, title: "기술 부채는 정말 '나쁜 코드'의 다른 이름일까?", motif: 'TODO' },
  // 철학 에세이
  { slug: 'stoic-dichotomy-of-control', kicker: ESSAY, title: '새벽 세 시의 장애 앞에서, 내 몫은 어디까지일까요', motif: '03:00' },
  { slug: 'ship-of-theseus-refactoring', kicker: ESSAY, title: '코드를 한 줄씩 다 바꾸면, 그것은 여전히 같은 서비스일까?', motif: '같은 배' },
  { slug: 'sisyphus-repetitive-work', kicker: ESSAY, title: '같은 버그를 또 고치는 날, 시지프는 행복할 수 있을까', motif: '다시' },
  { slug: 'popper-falsification-testing', kicker: ESSAY, title: '테스트가 전부 통과했다는 건 무엇을 증명할까', motif: '반증' },
  { slug: 'wittgenstein-meaning-is-use', kicker: ESSAY, title: "'완료'라고 말했는데 왜 서로 다른 걸 떠올렸을까", motif: '쓰임' },
  { slug: 'aristotle-excellence-habit', kicker: ESSAY, title: '탁월함은 습관이다, 라고 아리스토텔레스는 말하지 않았다', motif: '습관' },
  { slug: 'heidegger-broken-hammer', kicker: ESSAY, title: '도구는 고장 난 순간에야 눈에 보인다', motif: '망치' },
  // 예전 블로그에서 옮겨 온 글
  { slug: 'scope-and-hoisting', kicker: '기술 노트 · JavaScript', title: '자바스크립트 스코프와 호이스팅 정리', motif: 'TDZ' },
  { slug: 'typescript-basics', kicker: '기술 노트 · TypeScript', title: 'TypeScript 기본 타입 문법 정리', motif: ': T' },
  { slug: 'axios-vs-fetch', kicker: '기술 노트 · HTTP', title: 'Axios vs Fetch API 비교와 선택 기준', motif: 'fetch' },
  { slug: 'scheduler-api-posttask-yield', kicker: '기술 노트 · 웹 성능', title: 'Scheduler API로 메인 스레드 작업 우선순위 다루기', motif: 'yield' },
  { slug: 'web-image-optimization', kicker: '기술 노트 · 웹 성능', title: '웹 성능을 위한 이미지 최적화 방법', motif: 'AVIF' },
  { slug: 'commit-message-conventions', kicker: '기술 노트 · Git', title: '좋은 커밋 메시지 작성 규칙과 Conventional Commits', motif: 'feat:' },
  { slug: 'what-is-monorepo', kicker: '기술 노트 · 아키텍처', title: '모노레포란 무엇인가 - 장단점과 도구 정리', motif: 'apps/' },
  { slug: 'design-system-basics', kicker: '기술 노트 · 디자인 시스템', title: '디자인 시스템이 필요한 이유와 구축 전략', motif: 'Token' },
  { slug: 'cnn-basics', kicker: '기술 노트 · AI', title: 'CNN 기초 정리, 구성 요소부터 특징 맵 크기 계산까지', motif: '3×3' },
  { slug: 'agentica-typescript-function-calling', kicker: '기술 노트 · AI', title: 'Agentica로 TypeScript 함수를 LLM Function Calling에 연결하기', motif: 'f(x)' },
  { slug: '2024-retrospective', kicker: '회고', title: '2024년 연말 회고, 성취와 배운 점과 개선할 점', motif: '2024' },
  { slug: 'do-you-know-this-chicken', kicker: '에세이', title: '이 닭을 아시나요', motif: '펭귄' },
  { slug: 'foxtail-is-human-tail', kicker: '에세이', title: '강아지풀은 인간의 꼬리다', motif: '꼬리' },
  // 연재: Meta Astryx 완전 가이드
  { slug: 'astryx-overview', series: ASTRYX, part: 1, title: 'Meta Astryx란 무엇인가', chips: ['150+ components', '@astryxdesign/core', 'MIT · Beta'], on: 1 },
  { slug: 'astryx-getting-started', series: ASTRYX, part: 2, title: 'Astryx 설치와 첫 화면', chips: ['reset.css', 'astryx.css', 'theme.css'], on: 1 },
  { slug: 'astryx-components-api', series: ASTRYX, part: 3, title: 'Astryx 컴포넌트 150개를 읽는 법', chips: ['Button · TextInput', 'astryx component', 'Dialog · Table'], on: 1 },
  { slug: 'astryx-layout-templates', series: ASTRYX, part: 4, title: 'Astryx 레이아웃과 템플릿', chips: ['AppShell', 'Layout', 'astryx template'], on: 2 },
  { slug: 'astryx-theme-tokens', series: ASTRYX, part: 5, title: 'Astryx 테마와 디자인 토큰', chips: ['defineTheme', '--color-text-primary', 'theme.css'], on: 0 },
  { slug: 'astryx-styling-tailwind-swizzle', series: ASTRYX, part: 6, title: 'Astryx 스타일링', chips: ['className', 'tailwind-theme.css', 'astryx swizzle'], on: 2 },
  { slug: 'astryx-cli', series: ASTRYX, part: 7, title: 'Astryx CLI 완전 정복', chips: ['astryx search', 'astryx docs', 'astryx doctor'], on: 0 },
  { slug: 'astryx-ai-agents', series: ASTRYX, part: 8, title: "Astryx는 왜 '에이전트 대응'인가", chips: ['AGENTS.md', 'astryx init', 'vibe tests'], on: 0 },
  { slug: 'astryx-a11y-i18n-motion', series: ASTRYX, part: 9, title: 'Astryx의 접근성, 국제화, 모션', chips: ['a11y', 'i18n · RTL · IME', 'reduced motion'], on: 1 },
  { slug: 'astryx-on-this-blog', series: ASTRYX, part: 10, title: '이 블로그에 Astryx를 적용한다면', chips: ['Vite · React 19', '2rangs.github.io', '@astryxdesign/core'], on: 1 },
]

const xml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// 글자 너비를 em 단위로 어림한다(Pretendard Bold 기준).
const em = (text) => [...text].reduce((sum, char) => sum + (char === ' ' ? 0.27 : /[ᄀ-￿]/.test(char) ? 0.9 : /[mwMW@]/.test(char) ? 0.9 : /[A-Z0-9]/.test(char) ? 0.66 : /[ilj.,:;'!|()]/.test(char) ? 0.32 : 0.56), 0)

function wrap(title, limit) {
  const lines = []
  let line = ''
  for (const word of title.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (em(next) <= limit || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

// 제목이 길수록 글자를 줄여 다섯 줄 안에 담는다.
function fit(title, widthPx) {
  for (const size of [62, 54, 48, 42, 38]) {
    const lines = wrap(title, widthPx / size)
    const limit = size >= 62 ? 3 : size >= 48 ? 4 : 5
    if (lines.length <= limit && lines.every((line) => em(line) * size <= widthPx)) return { size, lines }
  }
  return { size: 38, lines: wrap(title, widthPx / 38).slice(0, 5) }
}

const flower = (x, y, petal, heart) => {
  const petals = [0, 72, 144, 216, 288].map((angle) => `<ellipse cy="-30" rx="19" ry="30" fill="${petal}" transform="rotate(${angle})"/>`).join('')
  return `<g transform="translate(${x},${y}) scale(0.42) rotate(-14)">${petals}<circle r="13" fill="${heart}"/></g>`
}

function titleSvg(title, color) {
  const { size, lines } = fit(title, 640)
  const gap = size * 1.32
  const top = 305 - ((lines.length - 1) * gap) / 2 + size * 0.36
  return lines.map((line, index) => `<text x="72" y="${top + index * gap}" font-size="${size}" font-weight="700" fill="${color}">${xml(line)}</text>`).join('\n')
}

function single({ kicker, title, motif }) {
  const size = Math.min(150, Math.floor(290 / em(motif)))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Pretendard">
<rect width="1200" height="630" fill="#ffffff"/>
<rect x="760" width="440" height="630" fill="#f1f1f1"/>
<text x="72" y="104" font-size="24" font-weight="600" fill="#6b6b6b">${xml(kicker)}</text>
${titleSvg(title, '#000000')}
${flower(96, 546, '#1b1b1b', '#ffffff')}
<text x="134" y="556" font-size="24" font-weight="500" fill="#474747">김이랑 · 2rangs.github.io</text>
<text x="980" y="${330 + size * 0.36}" font-size="${size}" font-weight="700" fill="#1b1b1b" text-anchor="middle">${xml(motif)}</text>
</svg>`
}

function serial({ series, part, title, chips, on }) {
  const number = String(part).padStart(2, '0')
  const boxes = chips.map((label, index) => {
    const x = 860 - index * 18
    const y = 150 + index * 100
    const active = index === on
    return `<rect x="${x}" y="${y}" width="250" height="76" rx="10" fill="${active ? '#f1f1f1' : '#1b1b1b'}"${active ? '' : ' stroke="#333333" stroke-width="2"'}/>
<text x="${x + 24}" y="${y + 46}" font-size="${em(label) * 22 > 204 ? Math.floor(204 / em(label)) : 22}" font-weight="500" fill="${active ? '#111111' : '#a0a0a0'}">${xml(label)}</text>`
  }).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Pretendard">
<rect width="1200" height="630" fill="#111111"/>
<text x="72" y="104" font-size="24" font-weight="500" fill="#8f8f8f">${xml(series)}</text>
<text x="${72 + em(series) * 24 * 0.94 + 36}" y="104" font-size="24" font-weight="700" fill="#ffffff">${number}</text>
${titleSvg(title, '#ffffff')}
${flower(96, 546, '#f1f1f1', '#111111')}
<text x="134" y="556" font-size="24" font-weight="500" fill="#bdbdbd">김이랑 · 2rangs.github.io</text>
${boxes}
</svg>`
}

const args = process.argv.slice(2)
const force = args.includes('--force')
const only = args.filter((arg) => !arg.startsWith('--'))
await mkdir(out, { recursive: true })

let made = 0
for (const cover of covers) {
  const file = join(out, `${cover.slug}.png`)
  if (only.length ? !only.includes(cover.slug) : !force && existsSync(file)) continue
  const svg = cover.series ? serial(cover) : single(cover)
  const png = new Resvg(svg, { font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: 'Pretendard' } }).render().asPng()
  await writeFile(file, png)
  made += 1
}
console.log(`대표 이미지 ${made}개를 만들었습니다 (${out})`)
