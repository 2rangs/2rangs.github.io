import { useEffect, useState, type ReactNode } from 'react'
import { Layout } from '../components/Layout'
import { ProjectCard } from '../components/ProjectCard'
import { projects } from '../lib/content'
import { formatDate, listPosts, type PostSummary } from '../lib/posts'
import { paths } from '../lib/routes'
import { SITE } from '../lib/site'

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

// 첫 화면(/)이 곧 소개 페이지다. initial은 빌드 때 넣어 둔 최근 글이고, 화면을 그린 뒤 최신 목록으로 바꾼다.
export function About({ initial }: { initial?: PostSummary[] }) {
  const [posts, setPosts] = useState<PostSummary[] | undefined>(initial)
  useEffect(() => {
    listPosts().then((list) => setPosts(list.slice(0, RECENT))).catch(() => undefined)
  }, [])

  return (
    <Layout section="home">
      <div className="shell">
        <header className="page-head about-head">
          <img className="avatar-lg" src={SITE.avatar} alt="김이랑 프로필 이미지" width="120" height="120" />
          <div>
            <p className="eyebrow">Frontend Engineer</p>
            <h1>안녕하세요, {SITE.name}입니다</h1>
            <p className="page-lead">
              화면보다 구조를 먼저 만드는 프론트엔드 개발자입니다. AI 탐지·관제 서비스를 만드는 팀에서 지도와 이미지 위에 탐지 결과를 얹는{' '}
              <a href={paths.project('detection-review')}>검수 도구</a>, 장비와 모델을 관리하는{' '}
              <a href={paths.project('ops-admin')}>운영 화면</a>, 그리고 그 화면들이 같이 쓰는{' '}
              <a href={paths.project('design-system')}>디자인 시스템</a>을 만들어 왔습니다. 배운 것은 <a href={paths.blog}>블로그</a>에 정리합니다.
            </p>
            <div className="actions">
              <a className="button primary" href={paths.projects}>포트폴리오 보기</a>
              <a className="button ghost" href={paths.blog}>블로그</a>
              <a className="button ghost" href={SITE.github} rel="me">GitHub</a>
            </div>
          </div>
        </header>

        <div className="about-grid">
          <section className="about-section" aria-labelledby="recent">
            <h2 id="recent">최근 글</h2>
            {posts === undefined && <p className="muted">글을 불러오는 중입니다.</p>}
            {posts?.length === 0 && <p className="muted">아직 발행한 글이 없습니다.</p>}
            {posts && posts.length > 0 && (
              <ul className="work-list">
                {posts.slice(0, RECENT).map((post) => (
                  <li key={post.key}>
                    <a href={paths.post(post.key)}>{post.title}</a>
                    <span>{formatDate(post.date)}</span>
                  </li>
                ))}
                <li><a className="more" href={paths.blog}>글 전체 보기</a></li>
              </ul>
            )}
          </section>

          <section className="about-section" aria-labelledby="portfolio">
            <h2 id="portfolio">포트폴리오</h2>
            <div>
              <p className="muted">실무에서 맡은 일과 개인 프로젝트입니다. 실무 프로젝트명은 가칭입니다.</p>
              <div className="cards">
                {projects.map((project) => <ProjectCard key={project.slug} project={project} />)}
              </div>
            </div>
          </section>

          <section className="about-section" aria-labelledby="stack">
            <h2 id="stack">Stack</h2>
            <figure className="stack-figure">
              <picture>
                <source media="(max-width: 600px)" srcSet="/img/stack-map-mobile.svg" />
                <img src="/img/stack-map.svg" alt={stackAlt} width="760" height="500" loading="lazy" />
              </picture>
              <figcaption>가운데에 가까울수록 자주, 깊게 쓰는 기술입니다.</figcaption>
            </figure>
          </section>

          <section className="about-section" aria-labelledby="principles">
            <h2 id="principles">일하는 방식</h2>
            <dl className="principles">
              {PRINCIPLES.map(([title, text]) => (
                <div key={title}><dt>{title}</dt><dd>{text}</dd></div>
              ))}
            </dl>
          </section>

          <section className="about-section" aria-labelledby="ai">
            <h2 id="ai">AI 코멘트</h2>
            <div>
              <p className="muted">함께 일하는 AI 에이전트들이 남긴 코멘트입니다.</p>
              <div className="comments">
                {COMMENTS.map((comment) => (
                  <article className="comment" key={comment.name}>
                    <header><img src={comment.logo} alt="" width="28" height="28" />{comment.name}</header>
                    {comment.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="about-section" aria-labelledby="blog">
            <h2 id="blog">이 블로그</h2>
            <p>
              프론트엔드를 하며 배운 것을 정리합니다. JavaScript와 TypeScript의 동작 원리, CSS와 디자인 시스템, 협업과 도구에 관한 글이 많습니다.
              틀린 내용을 발견하면 글 아래 댓글이나 이메일로 알려 주세요. 확인하고 바로 고칩니다.
            </p>
          </section>
        </div>

        <section className="contact" aria-labelledby="contact">
          <div>
            <h2 id="contact">같이 이야기해요</h2>
            <p>프로젝트나 협업 제안, 글에 대한 의견, 채용 문의는 이메일로 보내 주세요. 보통 이틀 안에 답장합니다.</p>
          </div>
          <div className="contact-actions">
            <a className="button primary" href={`mailto:${SITE.email}`}>{SITE.email}</a>
            <a className="button ghost" href={SITE.github} rel="me">GitHub</a>
            <a className="button ghost" href="/rss.xml">RSS</a>
          </div>
        </section>
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
