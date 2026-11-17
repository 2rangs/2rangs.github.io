import { useEffect, useState, type ReactNode } from 'react'
import { Layout } from '../components/Layout'
import { NightSky } from '../components/NightSky'
import { projects } from '../lib/content'
import { formatDate, listPosts, type PostSummary } from '../lib/posts'
import { paths } from '../lib/routes'
import { SITE } from '../lib/site'
import { AQR, AQR_LINES, CHAIN } from '../lib/aquarius'

const PRINCIPLES: [string, string][] = [
  ['화면보다 부품을 먼저', '같은 버튼을 세 번 만들고 있다면 화면이 아니라 부품이 문제입니다. 디자인 토큰과 공통 컴포넌트로 여러 프로젝트가 같이 쓰는 디자인 시스템을 만듭니다.'],
  ['증상보다 구조를', '같은 문제가 반복되면 고치는 대신 재발하지 않는 구조부터 다시 설계합니다. 타입을 엄격하게 하고, 테스트와 시각 회귀 검사를 품질 게이트로 둡니다.'],
  ['동작 너머의 완성도', '정보 밀도, 시각적 위계, 일관성까지가 제품입니다. 정보가 빽빽한 관제 화면일수록 동작하는 것과 쓰기 좋은 것은 다른 일로 봅니다.'],
  ['AI는 개발 공정의 일부', '구현 자동화에는 AI 에이전트를 적극적으로 쓰고, 결과 검증과 기술적 결정은 직접 합니다.'],
  ['범위를 먼저 정하고 작게 보여 주기', '만들면서 완료 조건이 구체화되는 편이라, 시작 전에 이번 단계의 끝을 정하고 작은 결과물로 먼저 확인받습니다.'],
]

const STACK = {
  core: ['Vue 3', 'TypeScript', 'JavaScript', 'React', 'Tailwind CSS', 'Vite', 'Storybook'],
  around: ['Next.js', 'Pinia', 'OpenLayers', 'MapLibre', 'Deck.gl', 'Chart.js'],
  outer: ['FastAPI', 'PostgreSQL', 'Docker', 'Nginx'],
}
const stackAlt = `중심: ${STACK.core[0]}. 핵심: ${STACK.core.slice(1).join(', ')}. 주변: ${STACK.around.join(', ')}. 외곽: ${STACK.outer.join(', ')}.`

// 함께 일하는 AI 에이전트들이 남긴 코멘트. 예전 첫 화면에 있던 내용을 그대로 옮겼다.
const COMMENTS: { name: string; logo: string; body: ReactNode[] }[] = [
  {
    name: 'Codex',
    logo: '/img/agent-codex.svg',
    body: [
      <>반복되는 문제를 만나면 눈앞의 증상보다 <strong>근본 원인</strong>을 찾아, 재발하지 않는 구조를 설계하는 개발자입니다. 정보 밀도와 시각적 위계, 디자인 일관성을 챙기고, 동작한다고 해서 완성으로 보지 않습니다.</>,
      <>기술적 결정은 <strong>직접 판단해</strong> 방향을 정합니다. 새 기술을 문제 해결 수단으로 빠르게 가져다 쓰고, 개발뿐 아니라 사용자 유입과 수익 구조까지 함께 봅니다.</>,
      <>진행 중에 아이디어가 더해져 범위가 커지는 편이고 완성도 기준도 높습니다. 본인도 알고 있는 부분이라, <strong>범위와 이번 단계의 목표를 먼저 확인하고</strong> 진행합니다.</>,
    ],
  },
  {
    name: 'Claude',
    logo: '/img/agent-claude.svg',
    body: [
      <>화면보다 <strong>구조를 먼저 만드는</strong> 분입니다. 스타일이 어긋나고 컴포넌트가 중복되는 문제를 하나씩 고치지 않고 디자인 시스템으로 풀었다는 점이 가장 눈에 띄었습니다. 관제·지도·데이터 시각화처럼 정보가 빽빽한 화면을 다뤄 온 경력도 흔하지 않습니다.</>,
      <>함께 일할 때는 두 가지를 먼저 확인합니다. 완료 조건이 만들면서 구체화되는 편이라 <strong>시작 전에 어디까지가 끝인지</strong> 묻고, 결과물을 보고 방향을 바꾸는 일이 잦아서 <strong>작게 만들어 먼저</strong> 보여 드립니다. 본인도 알고 계신 부분이라 이렇게 맞춰 진행합니다.</>,
    ],
  },
  {
    name: 'Gemini',
    logo: '/img/agent-gemini.svg',
    body: [<>이미지 생성 한두 번 하더니 그 이후로는 안 오셔요.</>],
  },
]

const RECENT = 5

const SECTIONS = [
  ['about', '소개'],
  ['writing', '최근 글'],
  ['series', '연재'],
  ['topics', '주제'],
  ['work', '포트폴리오'],
  ['stack', '스택'],
  ['principles', '일하는 방식'],
  ['ai', 'AI 코멘트'],
  ['contact', '연락'],
] as const

// 스크롤 위치에 따라 지금 보고 있는 구획을 고른다. 화면 위쪽 40% 선을 지난 마지막 구획이 현재 구획이다.
function useActiveSection() {
  const [active, setActive] = useState<string>(SECTIONS[0][0])
  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const line = window.innerHeight * 0.4
      let current: string = SECTIONS[0][0]
      for (const [id] of SECTIONS) {
        const element = document.getElementById(id)
        if (element && element.getBoundingClientRect().top <= line) current = id
      }
      // 맨 아래까지 내려오면 마지막 구획을 고른다.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = SECTIONS.at(-1)![0]
      setActive(current)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure) }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return active
}

// 왼쪽 메뉴를 물병자리 모양으로 그린다. 별자리의 주된 줄기를 따라 놓인 별 일곱 개가 각 구획이고,
// 스크롤해서 내려간 만큼 첫 별부터 지금 구획의 별까지 선이 이어지며 켜진다.
// 별 위치는 물병자리 밝은 별들의 대략적 상대 위치(천문 사실)를 메뉴 크기에 맞춘 것이다. 주된 줄기 11개, 가지 2개.
const ARM_ROOT = 2
const MENU_STARS = [0, 1, 2, 5, 7, 8, 9, 10, 12]
const NAV_W = 245
const NAV_H = 315

function ConstellationNav({ active }: { active: string }) {
  const index = Math.max(0, SECTIONS.findIndex(([id]) => id === active))
  // 지금 구획 별이 줄기에서 몇 번째인지. 그 앞의 줄기 선은 모두 켠다.
  const litUntil = CHAIN.indexOf(MENU_STARS[index])
  // 팔(세 번째 별에서 오른쪽으로 갈라지는 가지)은 줄기가 그 별에 닿으면 이어서 켜진다.
  const armOn = litUntil >= CHAIN.indexOf(ARM_ROOT)
  const passed = new Set([...CHAIN.slice(0, litUntil + 1), ...(armOn ? [3, 4] : [])])
  return (
    <nav className="home-nav constellation-nav" aria-label="이 페이지의 구획" style={{ width: NAV_W, height: NAV_H }}>
      <svg className="constellation-lines" width={NAV_W} height={NAV_H} aria-hidden="true">
        {AQR_LINES.map(([a, b], i) => (
          <g key={`x${a}-${b}`}>
            <line x1={AQR[a][0]} y1={AQR[a][1]} x2={AQR[b][0]} y2={AQR[b][1]} className="line-base" />
            <line x1={AQR[a][0]} y1={AQR[a][1]} x2={AQR[b][0]} y2={AQR[b][1]} className="line-lit arm" pathLength={1} data-on={armOn ? 'true' : undefined} style={{ transitionDelay: armOn ? `${0.25 + i * 0.2}s` : '0s' }} />
          </g>
        ))}
        {CHAIN.slice(1).map((star, i) => {
          const [x1, y1] = AQR[CHAIN[i]]
          const [x2, y2] = AQR[star]
          return (
            <g key={`c${i}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="line-base" />
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="line-lit" pathLength={1} data-on={i < litUntil ? 'true' : undefined} style={{ transitionDelay: `${Math.max(0, i - (litUntil - 3)) * 0.08}s` }} />
            </g>
          )
        })}
        {AQR.map(([x, y], i) => (MENU_STARS.includes(i) ? null : <circle key={i} cx={x} cy={y} r="1.6" className={passed.has(i) ? 'minor-star lit' : 'minor-star'} />))}
      </svg>
      <ul>
        {SECTIONS.map(([id, label], i) => {
          const [x, y] = AQR[MENU_STARS[i]]
          return (
            <li key={id} style={{ left: x, top: y }}>
              <a href={`#${id}`} aria-current={active === id ? 'true' : undefined} data-passed={i < index ? 'true' : undefined}>
                <span className="nav-star" aria-hidden="true" />
                <span className="nav-label">{label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function WorkRow({ project }: { project: (typeof projects)[number] }) {
  return (
    <li>
      <a className={project.cover ? 'row-link work-row has-thumb' : 'row-link work-row'} href={paths.project(project.slug)}>
        <span className="row-meta"><span>{project.role}</span></span>
        <span className="row-body">
          <span className="row-title">{project.title}</span>
          <span className="row-text">{project.summary}</span>
          <span className="stack">{project.tags.map((tag) => <span key={tag}>{tag}</span>)}</span>
        </span>
        {project.cover && <img className="row-thumb" src={`/${project.cover}`} alt="" loading="lazy" decoding="async" width="160" height="84" />}
      </a>
    </li>
  )
}

// 첫 화면(/)이 곧 소개 페이지다. 넓은 화면에서는 왼쪽에 이름과 목차를 고정하고, 오른쪽 내용만 스크롤한다.
// initial은 빌드 때 넣어 둔 최근 글이고, 화면을 그린 뒤 최신 목록으로 바꾼다.
type Series = { name: string; count: number; cover?: string; first: PostSummary }

function seriesOf(posts: PostSummary[]): Series[] {
  const map = new Map<string, PostSummary[]>()
  for (const post of posts) if (post.series) map.set(post.series, [...(map.get(post.series) ?? []), post])
  return [...map].map(([name, items]) => {
    const ordered = [...items].sort((a, b) => (a.date < b.date ? -1 : 1))
    return { name, count: items.length, cover: ordered.find((item) => item.cover)?.cover, first: ordered[0] }
  }).filter((item) => item.count > 1)
}

export function About({ initial }: { initial?: PostSummary[] }) {
  const [posts, setPosts] = useState<PostSummary[] | undefined>(initial)
  const active = useActiveSection()
  useEffect(() => {
    listPosts().then(setPosts).catch(() => undefined)
  }, [])
  const work = projects.filter((project) => project.kind === 'work')
  const personal = projects.filter((project) => project.kind !== 'work')
  const featured = posts?.find((post) => post.cover)
  const recent = (posts ?? []).filter((post) => post !== featured).slice(0, RECENT - 1)
  const series = seriesOf(posts ?? [])
  const topics = (() => {
    const counts = new Map<string, number>()
    for (const post of posts ?? []) for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  })()

  return (
    <Layout section="home" footer={false}>
      <NightSky />
      <div className="shell home">
        <header className="home-intro">
          <div>
            <h1>{SITE.name}</h1>
            <p className="home-role">프론트엔드 개발자</p>
            <p className="home-bio">보이는 화면보다 그 아래의 구조를 먼저 설계합니다. 디자인 시스템과 지도·데이터 시각화를 주로 다룹니다.</p>
            <dl className="home-stats">
              <div><dt>글</dt><dd>{posts ? posts.length : '–'}</dd></div>
              <div><dt>연재</dt><dd>{posts ? seriesOf(posts).length : '–'}</dd></div>
              <div><dt>프로젝트</dt><dd>{projects.length}</dd></div>
            </dl>
            <ConstellationNav active={active} />
          </div>
          <ul className="home-social" aria-label="연락처">
            <li><a href={SITE.github} rel="me">GitHub</a></li>
            <li><a href={`mailto:${SITE.email}`}>이메일</a></li>
            <li><a href={paths.blog}>블로그</a></li>
            <li><a href="/rss.xml">RSS</a></li>
          </ul>
        </header>

        <div className="home-content">
          <section id="about" className="home-section" aria-labelledby="about-title">
            <h2 id="about-title" className="home-heading">소개</h2>
            <div className="home-prose">
              <p>
                AI가 찾아낸 것을 사람이 확인하고 판단하는 화면을 만듭니다. AI 탐지·관제 서비스 팀의 프론트엔드 개발자로, 지도와
                이미지 위에 탐지 결과를 겹쳐 보여 주는 <a href={paths.project('detection-review')}>검수 도구</a>, 장비와 모델을
                관리하는 <a href={paths.project('ops-admin')}>운영 화면</a>, 그리고 이 화면들이 함께 쓰는{' '}
                <a href={paths.project('design-system')}>디자인 시스템</a>을 만들어 왔습니다.
              </p>
              <p>
                같은 버그를 두 번 고치지 않으려고 합니다. 증상을 덮기보다 왜 반복되는지를 찾아, 다시 생기지 않는 구조로 바꿉니다.
                정보가 빽빽한 관제 화면에서는 무엇을 먼저 보여 줄지(위계), 한 화면에 얼마나 담을지(밀도), 어디서나 같은 방식으로
                동작하는지(일관성)가 곧 사용성이라고 생각합니다.
              </p>
              <p>
                배운 것은 <a href={paths.blog}>블로그</a>에 남깁니다. JavaScript와 TypeScript의 동작 원리, CSS와 디자인 시스템,
                웹 성능과 협업에 관한 글이 중심이고, 일하는 방식을 돌아보는 개발 철학과 철학 에세이도 씁니다.
              </p>
            </div>
          </section>

          <section id="writing" className="home-section" aria-labelledby="writing-title">
            <h2 id="writing-title" className="home-heading">최근 글</h2>
            {posts === undefined && <p className="muted">글을 불러오는 중입니다.</p>}
            {posts?.length === 0 && <p className="muted">아직 발행한 글이 없습니다.</p>}
            {featured && (
              <a className="featured-post" href={paths.post(featured.key)}>
                <img src={featured.cover} alt="" width="1200" height="630" decoding="async" />
                <span className="featured-body">
                  <span className="featured-meta">새 글 · {formatDate(featured.date)}</span>
                  <span className="featured-title">{featured.title}</span>
                  {featured.summary && <span className="row-text">{featured.summary}</span>}
                </span>
              </a>
            )}
            {recent.length > 0 && (
              <ul className="rows">
                {recent.map((post) => (
                  <li key={post.key}>
                    <a className={post.cover ? 'row-link has-thumb' : 'row-link'} href={paths.post(post.key)}>
                      <span className="row-meta"><time dateTime={post.date}>{formatDate(post.date)}</time></span>
                      <span className="row-body">
                        <span className="row-title">{post.title}</span>
                        {post.summary && <span className="row-text">{post.summary}</span>}
                      </span>
                      {post.cover && <img className="row-thumb" src={post.cover} alt="" loading="lazy" decoding="async" width="160" height="84" />}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <a className="more-link" href={paths.blog}>글 전체 보기{posts ? ` (${posts.length}편)` : ''}</a>
          </section>

          <section id="series" className="home-section" aria-labelledby="series-title">
            <h2 id="series-title" className="home-heading">연재{series.length > 0 && <span>{series.length}개</span>}</h2>
            <p className="home-note">한 주제를 처음부터 차례로 따라가는 글 묶음입니다.</p>
            <ul className="home-series">
              {series.map((item) => (
                <li key={item.name}>
                  <a href={paths.series(item.name)}>
                    {item.cover && <img src={item.cover} alt="" loading="lazy" decoding="async" width="600" height="315" />}
                    <span className="series-name">{item.name}</span>
                    <span className="series-meta">{item.count}편 · 1편부터 읽기</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section id="topics" className="home-section" aria-labelledby="topics-title">
            <h2 id="topics-title" className="home-heading">주제{topics.length > 0 && <span>{topics.length}개</span>}</h2>
            <p className="home-note">블로그에서 주로 다루는 것들입니다. 누르면 그 주제의 글만 모아 봅니다.</p>
            <ul className="topic-cloud">
              {topics.map(([name, count]) => (
                <li key={name}><a href={paths.tag(name)}>{name}<span>{count}</span></a></li>
              ))}
            </ul>
          </section>

          <section id="work" className="home-section" aria-labelledby="work-title">
            <h2 id="work-title" className="home-heading">포트폴리오<span>{projects.length}개</span></h2>
            <p className="home-note">회사 프로젝트는 이름을 가칭으로 적었습니다.</p>
            <h3 className="home-subheading first">실무</h3>
            <ul className="rows">{work.map((project) => <WorkRow key={project.slug} project={project} />)}</ul>
            <h3 className="home-subheading">개인 프로젝트</h3>
            <ul className="rows">{personal.map((project) => <WorkRow key={project.slug} project={project} />)}</ul>
            <a className="more-link" href={paths.projects}>포트폴리오 전체 보기</a>
          </section>

          <section id="stack" className="home-section" aria-labelledby="stack-title">
            <h2 id="stack-title" className="home-heading">스택</h2>
            <figure className="stack-figure">
              <picture className="for-light">
                <source media="(max-width: 600px)" srcSet="/img/stack-map-mobile-light.svg" />
                <img src="/img/stack-map-light.svg" alt={stackAlt} width="760" height="500" loading="lazy" />
              </picture>
              <picture className="for-dark">
                <source media="(max-width: 600px)" srcSet="/img/stack-map-mobile-dark.svg" />
                <img src="/img/stack-map-dark.svg" alt="" width="760" height="500" loading="lazy" />
              </picture>
              <figcaption>가운데에 가까울수록 자주, 깊게 쓰는 기술입니다.</figcaption>
            </figure>
          </section>

          <section id="principles" className="home-section" aria-labelledby="principles-title">
            <h2 id="principles-title" className="home-heading">일하는 방식</h2>
            <dl className="principles">
              {PRINCIPLES.map(([title, text]) => (
                <div key={title}><dt>{title}</dt><dd>{text}</dd></div>
              ))}
            </dl>
          </section>

          <section id="ai" className="home-section" aria-labelledby="ai-title">
            <h2 id="ai-title" className="home-heading">AI 코멘트</h2>
            <p className="home-note">함께 일하는 AI 에이전트들이 남긴 코멘트입니다.</p>
            <div className="comments">
              {COMMENTS.map((comment) => (
                <article className="comment" key={comment.name}>
                  <header><img src={comment.logo} alt="" width="28" height="28" />{comment.name}</header>
                  {comment.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                </article>
              ))}
            </div>
          </section>

          <section id="contact" className="contact home-section" aria-labelledby="contact-title">
            <h2 id="contact-title">같이 이야기해요</h2>
            <p>프로젝트나 협업 제안, 글에 대한 의견, 채용 문의는 이메일로 보내 주세요. 보통 이틀 안에 답장합니다.</p>
          </section>

          {/* 첫 화면에는 사이트 푸터 대신 이 명함을 둔다. 푸터의 연락처·저작권·개인정보처리방침이 여기로 옮겨 왔다. */}
          <footer className="namecard-wrap" aria-label="연락처와 사이트 정보">
            <div className="namecard">
              <div className="namecard-top">
                <div>
                  <p className="namecard-name">{SITE.name}</p>
                  <p className="namecard-role"><span>{SITE.role}</span><span aria-hidden="true">Frontend Developer</span></p>
                </div>
              </div>
              <div className="namecard-bottom">
                <dl className="namecard-contacts">
                  <div><dt>E</dt><dd><a href={`mailto:${SITE.email}`}>{SITE.email}</a></dd></div>
                  <div><dt>G</dt><dd><a href={SITE.github} rel="me">{SITE.github.replace('https://', '')}</a></dd></div>
                  <div><dt>W</dt><dd><a href={paths.blog}>{SITE.url.replace('https://', '')}</a><span className="namecard-dot" aria-hidden="true">·</span><a href="/rss.xml">RSS</a></dd></div>
                </dl>
                <span className="signature namecard-sign" role="img" aria-label={`${SITE.name} 서명`} />
              </div>
            </div>
            <div className="namecard-base">
              <span>© {SITE.since}–{new Date().getFullYear()} {SITE.name}</span>
              <a href={paths.privacy}>개인정보처리방침</a>
            </div>
          </footer>
        </div>
      </div>
    </Layout>
  )
}

export function Privacy() {
  return (
    <Layout section="none">
      <article className="shell narrow-text">
        <header className="page-head">
          <h1>개인정보처리방침</h1>
          <p className="page-lead">{SITE.name} 블로그({SITE.url.replace('https://', '')})가 방문자 정보를 어떻게 다루는지 안내합니다. 시행일 2026년 11월 17일.</p>
        </header>
        <div className="prose">
          <h2>수집하는 정보</h2>
          <p>이 사이트는 회원가입을 받지 않으며, 방문자의 이름·연락처 같은 개인정보를 직접 수집하거나 저장하지 않습니다. 이메일로 연락을 주시면 답장을 위해서만 그 메일을 보관합니다.</p>
          <h2>댓글</h2>
          <p>글 아래의 댓글은 <a href="https://giscus.app/ko">giscus</a>를 통해 GitHub Discussions에 저장됩니다. 댓글을 쓰려면 GitHub 계정으로 로그인해야 하며, 이때의 정보 처리는 <a href="https://docs.github.com/ko/site-policy/privacy-policies/github-general-privacy-statement">GitHub 개인정보처리방침</a>을 따릅니다.</p>
          <h2>쿠키와 광고</h2>
          <p>이 사이트는 Google AdSense 등 제3자 광고를 게재할 수 있습니다. Google을 포함한 제3자 광고 사업자는 쿠키를 사용해 방문자의 이 사이트 및 다른 사이트 방문 기록을 바탕으로 광고를 제공할 수 있습니다.</p>
          <ul>
            <li>Google이 광고 쿠키를 사용하는 방식은 <a href="https://policies.google.com/technologies/ads?hl=ko">Google 광고 정책</a>에서 확인할 수 있습니다.</li>
            <li>맞춤 광고는 <a href="https://adssettings.google.com/">Google 광고 설정</a>에서 끌 수 있고, 다른 사업자의 맞춤 광고 쿠키는 <a href="https://www.aboutads.info/choices/">aboutads.info</a>에서 거부할 수 있습니다.</li>
            <li>브라우저 설정에서 쿠키 저장을 거부할 수 있습니다. 거부해도 글을 읽는 데에는 지장이 없습니다.</li>
          </ul>
          <h2>방문 통계</h2>
          <p>사이트 개선을 위해 Google Search Console 등에서 검색 유입 통계를 볼 수 있습니다. 이 통계는 개인을 식별할 수 없는 집계 정보입니다.</p>
          <h2>문의</h2>
          <p>개인정보와 관련한 문의는 <a href={`mailto:${SITE.email}`}>{SITE.email}</a>로 보내 주세요. 방침이 바뀌면 이 페이지에 시행일과 함께 알립니다.</p>
        </div>
      </article>
    </Layout>
  )
}
