// 글 대표 이미지(1200x630)를 public/img/covers/<slug>.png 로 만든다.
//   node scripts/covers.mjs            목록의 글 중 아직 이미지가 없는 것만
//   node scripts/covers.mjs --force    전부 다시
//   node scripts/covers.mjs <slug>...  고른 글만 다시
// 연재 글은 어두운 카드 + 오른쪽 칩 세 개(chips, on이 강조할 칸). 밈이 없는 낱개 글은 밝은 카드 + 오른쪽 무늬(motif)로 대신한다.
// 연재가 아닌 낱개 글은 밈 원본(scripts/memes, imgflip 템플릿)이 썸네일 전체를 차지하고, 그 위에 캡션만 얹는다(memes).
import { existsSync, readFileSync } from 'node:fs'
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
  { slug: 'korean-search-chosung', kicker: `${DEV} · JavaScript`, title: '한글 검색은 왜 이렇게 어려울까 (초성 검색)', motif: 'ㄱㅊ' },
  { slug: 'web-font-flash', kicker: `${DEV} · 웹 성능`, title: '웹폰트는 왜 늦게 뜰까 (font-display와 서브셋)', motif: 'swap' },
  { slug: 'dark-mode-flash', kicker: `${DEV} · CSS`, title: '다크 모드인데 하얀 화면이 번쩍이는 이유', motif: 'dark' },
  { slug: 'million-markers-on-map', kicker: `${DEV} · 웹 성능`, title: '지도에 마커 10만 개를 찍으면 생기는 일', motif: '10만' },
  { slug: 'canvas-svg-dom-boxes', kicker: `${DEV} · Web API`, title: '이미지 위에 박스 수천 개 그리기 (Canvas vs SVG vs DOM)', motif: 'Canvas' },
  { slug: 'works-on-my-machine-node', kicker: `${DEV} · 협업`, title: '같은 코드인데 내 컴퓨터에서만 되는 이유', motif: 'npm ci' },
  { slug: 'url-fragment-scroll', kicker: `${DEV} · Web API`, title: '주소에 #을 붙이면 왜 그 위치로 갈까', motif: '#id' },
  { slug: 'color-token-naming', kicker: `${DEV} · 디자인 시스템`, title: '색 이름을 blue-500 대신 primary로 지어야 하는 이유', motif: 'primary' },
  { slug: 'spa-404-on-github-pages', kicker: `${DEV} · HTTP`, title: '깃허브 페이지에 React를 올리면 새로고침할 때 404가 나는 이유', motif: '404' },
  { slug: 'service-worker-push', kicker: `${DEV} · Web API`, title: '탭을 닫았는데 알림이 오는 이유 (Service Worker)', motif: 'Push' },
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
  { slug: '2026-retrospective', kicker: '회고', title: '2026 회고: 할 일 없는 자리에서', motif: '2026' },
  { slug: 'do-you-know-this-chicken', kicker: '헛소리', title: '이 닭을 아시나요', motif: '펭귄' },
  { slug: 'foxtail-is-human-tail', kicker: '헛소리', title: '강아지풀은 인간의 꼬리다', motif: '꼬리' },
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

// 밈을 붙일 글. image는 scripts/memes 안의 파일, W×H는 원본 크기.
// top/bottom은 밈 위아래 검은 띠에 들어갈 문구, text는 [x, y, 문구, 크기, 모양, 회전]로 그림 위에 얹는 글.
// x, y는 그림 안에서의 비율(0~1), 모양은 ink(흰 칸에 검은 글씨) 또는 meme(흰 글씨 + 검은 테두리).
const memes = {
  'choose-boring-technology': { image: 'two-buttons.jpg', W: 600, H: 908, text: [[0.27, 0.15, '새 프레임워크', 20, 'ink', -14], [0.665, 0.115, '검증된 기술', 20, 'ink', -14], [0.5, 0.93, '혁신 토큰 0개 남은 나', 26, 'meme']] },
  'code-is-liability': { image: 'change-my-mind.jpg', W: 482, H: 361, top: '내가 쓴 코드', text: [[0.66, 0.8, '코드는 빚이다', 24, 'ink', -7]] },
  'naming-is-design': { image: 'expanding-brain.jpg', W: 857, H: 1202, text: [[0.24, 0.125, 'data', 30, 'ink'], [0.24, 0.375, 'data2', 30, 'ink'], [0.24, 0.625, 'newData', 28, 'ink'], [0.24, 0.875, 'finalData\n_v2_진짜', 26, 'ink']] },
  'duplication-over-wrong-abstraction': { image: 'drake.jpg', W: 1200, H: 1200, text: [[0.75, 0.25, '두 번 보이자마자\n공통 함수로\n합치기', 28, 'ink'], [0.75, 0.75, '세 번째까지\n일단 복붙', 30, 'ink']] },
  'what-code-review-is-for': { image: 'head-out.jpg', W: 467, H: 365, top: '리뷰 요청: +2,431줄' },
  'why-write-it-down': { image: 'spiderman-pointing.jpg', W: 800, H: 450, top: '이 코드 누가 짰어?', text: [[0.28, 0.14, '반년 전의 나', 26, 'meme'], [0.74, 0.14, '지금의 나', 26, 'meme']] },
  'why-estimates-are-wrong': { image: 'grus-plan.jpg', W: 700, H: 449, top: '일정 추정', text: [[0.375, 0.25, '2주면\n끝', 26, 'ink'], [0.87, 0.25, '개발\n시작', 26, 'ink'], [0.375, 0.76, '6주째\n개발 중', 22, 'ink'], [0.87, 0.76, '6주째\n개발 중', 22, 'ink']] },
  'tech-debt-is-a-choice': { image: 'this-is-fine.jpg', W: 580, H: 282, top: '// TODO: 나중에 고침', bottom: '3년 뒤의 우리 팀' },
  'stoic-dichotomy-of-control': { image: 'panik-kalm.png', W: 640, H: 881, text: [[0.24, 0.17, '03:00\n장애 알림', 32, 'ink'], [0.24, 0.5, '내 몫은\n대응뿐', 32, 'ink'], [0.24, 0.83, '원인은\n내 어제\n배포', 30, 'ink']] },
  'ship-of-theseus-refactoring': { image: 'same-picture.jpg', W: 1363, H: 1524, text: [[0.27, 0.17, 'v1.0\n(2019)', 28, 'ink', -12], [0.74, 0.2, 'v8.3\n(코드 전부 교체)', 22, 'ink', -12]] },
  'sisyphus-repetitive-work': { image: 'here-we-go-again.jpg', W: 299, H: 168, top: '고쳤던 버그가 또 열렸다', bottom: '이번이 37번째' },
  'popper-falsification-testing': { image: 'pigeon.jpg', W: 1587, H: 1425, text: [[0.8, 0.36, '테스트\n전부 통과', 30, 'meme'], [0.2, 0.74, '나', 40, 'meme'], [0.5, 0.92, '이것은 증명인가?', 40, 'meme']] },
  'wittgenstein-meaning-is-use': { image: 'always-has-been.png', W: 960, H: 540, top: "잠깐, 다들 '완료'의 뜻이 달랐어?", bottom: 'Always has been', text: [[0.2, 0.42, "'완료'", 36, 'meme']] },
  'aristotle-excellence-habit': { image: 'roll-safe.jpg', W: 702, H: 395, top: '출처가 기억 안 나는 명언도', bottom: '아리스토텔레스라고 하면 됨' },
  'heidegger-broken-hammer': { image: 'surprised-pikachu.jpg', W: 1893, H: 1892, text: [[0.5, 0.11, '매일 쓰던 망치가 부러졌다', 30, 'ink'], [0.5, 0.25, '나: 이게 망치였구나', 30, 'ink']] },
  '2024-retrospective': { image: 'stonks.png', W: 825, H: 619, top: '2024년 돌아보기' },
  '2026-retrospective': { image: 'panik-kalm.png', W: 640, H: 881, text: [[0.24, 0.17, '권고사직\n명단에\n내 이름', 30, 'ink'], [0.24, 0.5, '1월까지는\n소속 유지', 28, 'ink'], [0.24, 0.83, '근데 할 일이\n하나도 없음', 28, 'ink']] },
  'do-you-know-this-chicken': { image: 'disappointed.jpg', W: 1172, H: 756, text: [[0.3, 0.25, '새 하숙인이\n닭인 줄 알았는데', 32, 'ink'], [0.3, 0.75, '펭귄이었다', 38, 'ink']] },
  'foxtail-is-human-tail': { image: 'conspiracy.jpg', W: 1024, H: 768, top: '강아지풀 = 인간의 꼬리', bottom: '다 연결되어 있다고' },
  // 개발 이야기
  'search-request-race-condition': { image: 'bike-fall.jpg', W: 500, H: 680, text: [[0.5, 0.06, '빠르게 검색어 입력', 26, 'meme'], [0.5, 0.39, '응답 순서는 신경 안 씀', 26, 'meme'], [0.5, 0.94, '왜 결과가 엉뚱하지?', 28, 'meme']] },
  'event-loop-microtask': { image: 'distracted-boyfriend.jpg', W: 1200, H: 800, text: [[0.28, 0.62, 'Promise.then', 24, 'meme'], [0.58, 0.32, '이벤트 루프', 24, 'meme'], [0.84, 0.5, 'setTimeout(0)', 22, 'meme']] },
  'css-stacking-context': { image: 'yall-got-any-more.jpg', W: 600, H: 471, top: 'z-index: 9999가 안 먹힌다', bottom: '혹시 99999 더 있어요?' },
  'layout-shift-cls': { image: 'woman-yelling-at-cat.jpg', W: 680, H: 438, text: [[0.5, 0.1, '크기 안 정한 이미지가 늦게 뜰 때', 18, 'ink'], [0.25, 0.86, '읽던 줄 어디 갔어!', 18, 'meme'], [0.75, 0.86, '늦게 뜬 배너', 18, 'meme']] },
  'floating-point-money': { image: 'skeptical-kid.jpg', W: 426, H: 426, top: '0.1 + 0.2 = 0.3이라고?', bottom: '0.30000000000000004' },
  'date-timezone-bug': { image: 'they-dont-know.png', W: 671, H: 673, text: [[0.62, 0.13, "다들 모르겠지\nnew Date('2025-01-01')이\nUTC 자정이라는 걸", 22, 'ink']] },
  'react-rerender-memo': { image: 'oprah.jpg', W: 620, H: 464, top: '너도 memo!', bottom: '너도 memo! 전부 다 memo!' },
  'react-key-index': { image: 'scooby-reveal.jpg', W: 720, H: 960, text: [[0.22, 0.42, '엉뚱한 줄에\n남은 입력값', 24, 'meme'], [0.25, 0.93, 'key={index}', 28, 'meme']] },
  'cors-explained': { image: 'batman-slap.jpg', W: 400, H: 387, text: [[0.27, 0.13, 'Postman에선\n되는데요?', 22, 'ink'], [0.74, 0.12, '브라우저가\n막는 거야', 22, 'ink']] },
  'http-cache-deploy': { image: 'waiting-skeleton.jpg', W: 298, H: 403, top: '새 배포를 기다리는 사용자', bottom: 'max-age=31536000' },
  'token-storage-xss-csrf': { image: 'left-exit.jpg', W: 804, H: 767, text: [[0.36, 0.15, 'localStorage', 18, 'meme'], [0.6, 0.29, 'HttpOnly 쿠키', 18, 'meme'], [0.45, 0.84, 'XSS가 무서운 나', 26, 'meme']] },
  'frontend-memory-leak': { image: 'uno-draw-25.jpg', W: 500, H: 494, text: [[0.29, 0.34, '이벤트 리스너\n해제하기', 18, 'ink', -8], [0.76, 0.92, '탭 메모리 2GB', 24, 'meme']] },
  'korean-ime-enter-twice': { image: 'monkey-puppet.jpg', W: 923, H: 768, text: [[0.5, 0.15, '한글 치고 Enter 한 번 눌렀는데\n메시지가 두 개 감', 22, 'ink']] },
  'div-onclick-accessibility': { image: 'buff-doge.png', W: 937, H: 720, text: [[0.24, 0.9, '<button>\n키보드 · 포커스 · 스크린 리더', 20, 'ink'], [0.8, 0.86, '<div onClick>\n마우스로만 됨', 20, 'ink']] },
  'bundle-size-tree-shaking': { image: 'trade-offer.jpg', W: 607, H: 794, text: [[0.22, 0.33, 'debounce\n함수 하나', 26, 'meme'], [0.76, 0.33, 'lodash 전체\n70KB', 26, 'meme']] },
  'git-rebase-vs-merge': { image: 'anakin-padme.png', W: 768, H: 768, text: [[0.25, 0.42, 'rebase 했어', 22, 'meme'], [0.75, 0.4, 'force push는\n안 했지?', 22, 'meme'], [0.75, 0.92, '안 한 거지?', 24, 'meme']] },
  'optimistic-update': { image: 'tuxedo-pooh.png', W: 800, H: 582, text: [[0.71, 0.25, '서버 응답 오면\n하트 칠하기', 20, 'ink'], [0.71, 0.75, '먼저 칠하고\n실패하면 되돌리기', 20, 'ink']] },
  'n-plus-one-query': { image: 'x-everywhere.jpg', W: 2118, H: 1440, top: '목록 하나 그렸을 뿐인데', bottom: '쿼리, 쿼리 everywhere' },
  'unknown-over-any': { image: 'clown-makeup.jpg', W: 750, H: 798, text: [[0.3, 0.125, '일단 any로\n넘기자', 28, 'ink'], [0.3, 0.375, 'as any', 30, 'ink'], [0.3, 0.625, '// @ts-ignore', 26, 'ink'], [0.3, 0.875, 'TypeScript라\n안전함', 28, 'ink']] },
  'web-worker-heavy-compute': { image: 'futurama-fry.jpg', W: 552, H: 414, top: '화면이 멈춘 건지', bottom: '계산 중인 건지 모르겠다' },
  'virtual-list': { image: 'rock-driving.jpg', W: 568, H: 700, text: [[0.77, 0.12, '목록이\n몇 줄이야?', 20, 'ink'], [0.77, 0.45, '1만 줄,\n전부 DOM에', 20, 'ink']] },
  'korean-search-chosung': { image: 'grandma-internet.jpg', W: 640, H: 480, top: '검색창에 ㄱㅊ만 쳤는데', bottom: '김치찌개가 나온다' },
  'web-font-flash': { image: 'megamind-no.jpg', W: 674, H: 734, top: '웹폰트 받는 중', bottom: 'No 글자?' },
  'dark-mode-flash': { image: 'disaster-girl.jpg', W: 500, H: 375, top: '다크 모드 켜 두셨죠?', bottom: '새로고침할 때마다 흰 화면 번쩍' },
  'million-markers-on-map': { image: 'sad-pablo.jpg', W: 720, H: 709, text: [[0.5, 0.08, '마커 10만 개 찍고', 30, 'meme'], [0.25, 0.9, '지도 드래그', 22, 'meme'], [0.75, 0.9, '아직 기다리는 중', 20, 'meme']] },
  'canvas-svg-dom-boxes': { image: 'bell-curve.png', W: 675, H: 499, text: [[0.14, 0.38, '그냥 Canvas', 18, 'ink'], [0.2, 0.12, 'DOM이냐 SVG냐\nCanvas냐 비교표', 15, 'ink'], [0.82, 0.32, '그냥 Canvas', 18, 'ink']] },
  'works-on-my-machine-node': { image: 'scroll-of-truth.jpg', W: 1280, H: 1236, text: [[0.265, 0.71, 'lockfile을\n커밋 안\n했다', 15, 'ink']] },
  'url-fragment-scroll': { image: 'two-guys-bus.jpg', W: 762, H: 675, text: [[0.2, 0.35, '스크롤 위치\n직접 계산', 20, 'meme'], [0.8, 0.35, '주소에\n#id 붙이기', 20, 'meme']] },
  'color-token-naming': { image: 'evil-kermit.jpg', W: 700, H: 325, top: '나: primary로 이름 짓자', bottom: '또 다른 나: 그냥 blue-500 써' },
  'spa-404-on-github-pages': { image: 'bernie-asking.jpg', W: 750, H: 750, top: '새로고침할 때마다 404라서', text: [[0.5, 0.93, '404.html 하나만 만들어 주세요', 22, 'meme']] },
  'service-worker-push': { image: 'gus-fring.png', W: 700, H: 1000, text: [[0.5, 0.09, '넌 탭을 닫으면 끝나지만\n난 백그라운드에서 깨어나', 22, 'meme'], [0.5, 0.93, 'We are not the same', 28, 'meme']] },
  // 기술 노트
  'scope-and-hoisting': { image: 'ancient-aliens.jpg', W: 500, H: 436, top: '선언하기 전에 써도 되는 이유?', bottom: '호이스팅' },
  'typescript-basics': { image: 'one-does-not-simply.jpg', W: 568, H: 335, top: 'One does not simply', bottom: '타입 없이 배포한다' },
  'axios-vs-fetch': { image: 'yoda.jpg', W: 620, H: 713, top: 'fetch를 쓴다면', bottom: 'res.ok는 직접 확인해야 하느니라' },
  'scheduler-api-posttask-yield': { image: 'domino.jpg', W: 820, H: 565, text: [[0.68, 0.9, 'scheduler.yield()', 20, 'meme'], [0.22, 0.12, 'INP 개선', 28, 'meme']] },
  'web-image-optimization': { image: 'captain-now.jpg', W: 478, H: 350, top: 'Look at me', bottom: '이제 4MB짜리 PNG가 LCP다' },
  'commit-message-conventions': { image: 'harold.jpg', W: 480, H: 601, text: [[0.5, 0.08, "git commit -m '수정'", 22, 'meme'], [0.5, 0.58, "git commit -m '진짜 최종'", 22, 'meme']] },
  'what-is-monorepo': { image: 'epic-handshake.jpg', W: 900, H: 645, text: [[0.5, 0.12, 'packages/ui', 26, 'meme'], [0.2, 0.75, 'apps/web', 24, 'meme'], [0.8, 0.75, 'apps/admin', 24, 'meme']] },
  'design-system-basics': { image: 'spiderman-triple.jpg', W: 600, H: 551, text: [[0.2, 0.3, 'Button', 24, 'meme'], [0.56, 0.1, 'Btn', 24, 'meme'], [0.84, 0.36, 'BaseButton', 22, 'meme']] },
  'cnn-basics': { image: 'scientist.jpg', W: 1200, H: 600, top: '3×3 필터로 특징 맵 한 번 뽑아 보고', bottom: "I'm something of a scientist myself" },
  'agentica-typescript-function-calling': { image: 'absolute-cinema.png', W: 936, H: 725, top: 'TypeScript 함수가 그대로 LLM 도구로', bottom: 'ABSOLUTE CINEMA' },
}

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

function titleSvg(title, color, width = 640) {
  const { size, lines } = fit(title, width)
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

// 그림 위에 얹는 글. 여러 줄이면 (x, y)를 가운데로 두고 위아래로 나눈다.
function caption(x, y, text, size, style, rotate = 0) {
  const lines = text.split('\n')
  const gap = size * 1.18
  const first = y - ((lines.length - 1) * gap) / 2 + size * 0.36
  const spans = lines.map((line, index) => `<tspan x="${x}" y="${first + index * gap}">${xml(line)}</tspan>`).join('')
  const turn = rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : ''
  const base = `font-size="${size}" font-weight="700" text-anchor="middle"${turn}`
  if (style === 'ink') return `<text ${base} fill="#111111">${spans}</text>`
  return `<text ${base} fill="none" stroke="#000000" stroke-width="${size * 0.22}" stroke-linejoin="round">${spans}</text><text ${base} fill="#ffffff">${spans}</text>`
}

// 밈이 썸네일 전체를 차지한다(제목은 글 목록에 따로 보이므로 넣지 않는다).
// 원본 비율 그대로 1200×630 안에 맞추고, 남는 양옆은 같은 그림을 흐리고 어둡게 깔아 채운다.
// text의 글자 크기는 예전 600×630 칸 기준으로 적어 두었으니, 그림이 커진 만큼 키우고 작은 썸네일에서도 읽히게 1.3배 더 키운다.
function memeCover(_cover, { image, W, H, top, bottom, text = [] }) {
  const file = join(root, 'scripts/memes', image)
  const href = `data:image/${image.endsWith('.png') ? 'png' : 'jpeg'};base64,${readFileSync(file).toString('base64')}`
  const scale = Math.min(1200 / W, 630 / H)
  const grow = scale / Math.min(600 / W, 630 / H)
  const w = W * scale
  const h = H * scale
  const x = (1200 - w) / 2
  const y = (630 - h) / 2
  const cover = Math.max(1200 / W, 630 / H)
  const backdrop = w < 1199 || h < 629
    ? `<image x="${(1200 - W * cover) / 2}" y="${(630 - H * cover) / 2}" width="${W * cover}" height="${H * cover}" preserveAspectRatio="none" xlink:href="${href}" filter="url(#blur)"/>
<rect width="1200" height="630" fill="#000000" opacity="0.45"/>`
    : ''
  // 위·아래 문구는 고전 밈처럼 그림 위아래 끝에 흰 글씨 + 검은 테두리로 얹는다.
  const edge = (label, at) => {
    if (!label) return ''
    const size = Math.min(54, Math.floor((w - 60) / em(label)))
    return caption(600, at === 'top' ? y + 22 + size * 0.5 : y + h - 22 - size * 0.5, label, size, 'meme')
  }
  const overlays = text.map(([fx, fy, label, size, style, rotate]) => caption(x + fx * w, y + fy * h, label, Math.round(size * grow * 1.3), style, rotate)).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630" font-family="Pretendard">
<defs><filter id="blur" x="0" y="0" width="1" height="1"><feGaussianBlur stdDeviation="28"/></filter></defs>
<rect width="1200" height="630" fill="#111111"/>
${backdrop}
<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" xlink:href="${href}"/>
${edge(top, 'top')}
${edge(bottom, 'bottom')}
${overlays}
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
  const svg = cover.series ? serial(cover) : memes[cover.slug] ? memeCover(cover, memes[cover.slug]) : single(cover)
  const png = new Resvg(svg, { font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: 'Pretendard' } }).render().asPng()
  await writeFile(file, png)
  made += 1
}
console.log(`대표 이미지 ${made}개를 만들었습니다 (${out})`)
