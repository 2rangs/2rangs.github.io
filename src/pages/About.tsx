import { useEffect, useState, type ReactNode } from 'react'
import { Layout } from '../components/Layout'
import { NightSky } from '../components/NightSky'
import { projects } from '../lib/content'
import { formatDate, listPosts, type PostSummary } from '../lib/posts'
import { paths } from '../lib/routes'
import { SITE } from '../lib/site'
import { AQR, AQR_LINES, CHAIN } from '../lib/aquarius'
import { coverImage } from '../lib/cover'

const PRINCIPLES: [string, string][] = [
  ['거슬리면 고친다', '쓰다가 걸린 곳은 원인을 찾아 고치고, 고친 뒤 다시 써 봅니다.'],
  ['남의 방식부터 써 본다', '비슷한 서비스를 직접 써 보고, 피드백을 들으면 방향을 바꿉니다.'],
  ['끝을 먼저 정한다', '일이 커지기 쉬워서 이번 단계의 범위를 정하고 작게 확인합니다.'],
]

const STACK = {
  core: ['Vue 3', 'TypeScript', 'JavaScript', 'React', 'Tailwind CSS', 'Vite', 'Storybook'],
  around: ['Next.js', 'Pinia', 'OpenLayers', 'MapLibre', 'Deck.gl', 'Chart.js'],
  outer: ['FastAPI', 'PostgreSQL', 'Docker', 'Nginx'],
}
const stackAlt = `중심: ${STACK.core[0]}. 핵심: ${STACK.core.slice(1).join(', ')}. 주변: ${STACK.around.join(', ')}. 외곽: ${STACK.outer.join(', ')}.`

// 함께 일하는 AI들이 같이 겪은 문제와 푼 과정을 적은 코멘트.
const COMMENTS: { name: string; logo: string; body: ReactNode[] }[] = [
  {
    name: 'Claude',
    logo: '/img/agent-claude.svg',
    body: [
      <>결과를 드리면 바로 받지 않고 직접 써 보십니다. 그러고는 <strong>"실제로 쓰는 사람이면 여기서 뭘 누를까?"</strong>를 물으시는데, 그 질문 때문에 처음 계획을 바꾼 적이 여러 번입니다.</>,
      <>처음 보는 분야는 제가 <strong>레퍼런스를 찾아 드리면</strong> 원문과 대조해 확인한 다음 구현하십니다. 숫자가 너무 좋게 나와도 그냥 넘기지 않으십니다.</>,
    ],
  },
  {
    name: 'Codex',
    logo: '/img/agent-codex.svg',
    body: [
      <>제가 끝났다고 말씀드려도 <strong>고칠 곳을 한 번 더 찾으십니다.</strong> 구현이 됐는지보다 사용자가 원하는 대로 돌아가는지를 먼저 보십니다.</>,
      <>그럴듯한 제안에도 "왜 이 방식이어야 하죠?"라고 물으시고, 된다는 이유만으로는 고르지 않으십니다. 조사와 구현은 저한테 맡기셔도 <strong>결정은 직접 하십니다.</strong></>,
    ],
  },
  {
    name: 'Gemini',
    logo: '/img/agent-gemini.svg',
    body: [<>이미지 생성 한두 번 하더니 그 이후로는 안 오셔요.</>],
  },
]

export const RECENT = 5

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
        {project.cover && <img className="row-thumb" {...coverImage(`/${project.cover}`, '160px')} alt="" loading="lazy" decoding="async" width="160" height="84" />}
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

// 첫 화면은 글 수·연재·주제를 세느라 글 목록 전체가 필요하지만, 요약은 위에 보이는 몇 편에만 쓴다.
// 빌드 때 페이지에 넣는 목록에서 나머지 글의 요약을 비워 HTML을 가볍게 한다. 그린 뒤에는 최신 목록으로 바뀐다.
export function homePosts(posts: PostSummary[]): PostSummary[] {
  const featured = posts.find((post) => post.cover)
  const shown = new Set([featured, ...posts.filter((post) => post !== featured).slice(0, RECENT - 1)])
  return posts.map((post) => (shown.has(post) ? post : { ...post, summary: '' }))
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
            <p className="home-bio">쓰다가 불편한 게 보이면 그냥 넘기지 못하는 프론트엔드 개발자입니다. 고치고, 다시 써 보고, 또 고칩니다.</p>
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
                회사에서는 AI 분석 결과를 사람이 확인하고 관리하는 웹 서비스의 프론트엔드를 맡고 있습니다.{' '}
                <a href={paths.project('detection-review')}>검수 화면</a>, <a href={paths.project('road-dashboard')}>관제 대시보드</a>,{' '}
                <a href={paths.project('ops-admin')}>운영 화면</a>을 만들고 유지보수했고, 필요하면 보안 설정처럼 프론트엔드 밖의 일도
                맡습니다.
              </p>
              <p>
                서비스가 늘면서 화면마다 버튼과 색이 조금씩 달라졌고, 같은 수정을 여러 번 하게 됐습니다. 그래서{' '}
                <a href={paths.project('design-system')}>디자인 시스템</a>을 만들었습니다. 흩어진 규칙을 모아 기준부터 세우고, 공통
                부품을 하나씩 옮기면서, 고친 것이 다른 화면을 깨뜨리지 않는지 확인하는 장치를 먼저 붙였습니다.
              </p>
              <p>
                퇴근 후에는 <a href={paths.project('pokestra')}>Pokestra</a>, <a href={paths.project('pokebattle-engine')}>배틀 엔진</a>,
                발로란트 경기 시뮬레이션(<a href={paths.series('PROJECT V 개발기')}>PROJECT V 개발기</a>)을 만들고, 배운 것은{' '}
                <a href={paths.blog}>블로그</a>에 남깁니다.
              </p>
              <p>
                만들면서 배운 건 기능이 돌아가는 것과 쓰기 편한 것이 다르다는 점입니다. 그래서 다 만든 뒤에도 직접 써 보고, 실제로
                쓰는 사람이면 어디서 막힐지를 한 번 더 따집니다. 여러 곳이 같이 쓰는 코드는 고쳐도 아무것도 깨지지 않았다는 걸
                보여 줄 장치가 있어야 마음 놓고 고칠 수 있다는 것도 배웠습니다.
              </p>
              <p>
                요즘은 AI 없이 일하지 않습니다. 조사와 반복 작업은 맡기고, 회사에서는 PR을 검토하는 리뷰 에이전트도 만들었습니다.
                다만 결과는 그대로 받지 않습니다. 원문과 대조해 보고 직접 써 본 다음에, 결정은 제가 합니다.
              </p>
            </div>
          </section>

          <section id="writing" className="home-section" aria-labelledby="writing-title">
            <h2 id="writing-title" className="home-heading">최근 글</h2>
            {posts === undefined && <p className="muted">글을 불러오는 중입니다.</p>}
            {posts?.length === 0 && <p className="muted">아직 발행한 글이 없습니다.</p>}
            {featured && (
              <a className="featured-post" href={paths.post(featured.key)}>
                <img {...coverImage(featured.cover, '(max-width: 640px) 100vw, 400px')} alt="" width="1200" height="630" decoding="async" fetchPriority="high" />
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
                      {post.cover && <img className="row-thumb" {...coverImage(post.cover, '160px')} alt="" loading="lazy" decoding="async" width="160" height="84" />}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <a className="more-link" href={paths.blog}>글 전체 보기{posts ? ` (${posts.length}편)` : ''}</a>
          </section>

          <section id="series" className="home-section" aria-labelledby="series-title">
            <h2 id="series-title" className="home-heading">연재{series.length > 0 && <span>{series.length}개</span>}</h2>
                        <ul className="home-series">
              {series.map((item) => (
                <li key={item.name}>
                  <a href={paths.series(item.name)}>
                    {item.cover && <img {...coverImage(item.cover, '(max-width: 640px) 100vw, 360px')} alt="" loading="lazy" decoding="async" width="600" height="315" />}
                    <span className="series-name">{item.name}</span>
                    <span className="series-meta">{item.count}편 · 1편부터 읽기</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section id="topics" className="home-section" aria-labelledby="topics-title">
            <h2 id="topics-title" className="home-heading">주제{topics.length > 0 && <span>{topics.length}개</span>}</h2>
                        <ul className="topic-cloud">
              {topics.map(([name, count]) => (
                <li key={name}><a href={paths.tag(name)}>{name}<span>{count}</span></a></li>
              ))}
            </ul>
          </section>

          <section id="work" className="home-section" aria-labelledby="work-title">
            <h2 id="work-title" className="home-heading">포트폴리오<span>{projects.length}개</span></h2>
            <p className="home-note">실무 프로젝트 이름은 가칭입니다.</p>
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
              {/* 넓은 화면의 그림은 가운데가 중심, 좁은 화면(600px 이하)의 그림은 위가 중심이라 설명도 함께 바꾼다. */}
              <figcaption><span className="stack-caption-wide">가운데에 가까울수록</span><span className="stack-caption-narrow">위에 위치할수록</span> 자주, 깊게 쓰는 기술입니다.</figcaption>
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
            <p className="home-note">같이 일하는 AI들이 남긴 말입니다.</p>
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
