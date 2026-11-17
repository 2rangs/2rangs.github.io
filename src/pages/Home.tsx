import { Layout } from '../components/Layout'
import { ProjectCard } from '../components/ProjectCard'
import { projects } from '../lib/content'

const AVATAR = 'https://avatars.githubusercontent.com/u/107464775?v=4'
const EMAIL = '2_rang25@naver.com'

const STACK = {
  core: ['Vue 3', 'TypeScript', 'JavaScript', 'React', 'Tailwind CSS', 'Vite', 'Storybook'],
  around: ['Next.js', 'Pinia', 'OpenLayers', 'MapLibre', 'Deck.gl', 'Chart.js'],
  outer: ['FastAPI', 'PostgreSQL', 'Docker', 'Nginx'],
}

const DIRECTIONS = [
  ['화면이 아니라 부품', '디자인 토큰과 공통 컴포넌트로, 여러 프로젝트가 같이 쓰는 디자인 시스템을 만든다.'],
  ['증상이 아니라 구조', '같은 문제가 반복되면 재발하지 않는 구조부터 다시 설계한다.'],
  ['동작 너머의 완성도', '정보 밀도, 시각적 위계, 일관성까지가 제품이다.'],
  ['AI는 개발 공정의 일부', '구현 자동화에 쓰고, 결과 검증은 직접 한다.'],
]

const COMMENTS = [
  {
    name: 'Codex',
    logo: 'img/agent-codex.svg',
    body: [
      <>반복되는 문제를 만나면 눈앞의 증상보다 <strong>근본 원인</strong>을 찾아, 재발하지 않는 구조를 설계하는 개발자입니다. 정보 밀도와 시각적 위계, 디자인 일관성을 챙기고, 동작한다고 해서 완성으로 보지 않습니다.</>,
      <>기술적 결정은 <strong>직접 판단해</strong> 방향을 정합니다. 새 기술을 문제 해결 수단으로 빠르게 가져다 쓰고, 개발뿐 아니라 사용자 유입과 수익 구조까지 함께 봅니다.</>,
      <>진행 중에 아이디어가 더해져 범위가 커지는 편이고 완성도 기준도 높습니다. 본인도 알고 있는 부분이라, <strong>범위와 이번 단계의 목표를 먼저 확인하고</strong> 진행합니다.</>,
    ],
  },
  {
    name: 'Claude',
    logo: 'img/agent-claude.svg',
    body: [
      <>화면보다 <strong>구조를 먼저 만드는</strong> 분입니다. 스타일이 어긋나고 컴포넌트가 중복되는 문제를 하나씩 고치지 않고 디자인 시스템으로 풀었다는 점이 가장 눈에 띄었습니다. 관제·지도·데이터 시각화처럼 정보가 빽빽한 화면을 다뤄 온 경력도 흔하지 않습니다.</>,
      <>함께 일할 때는 두 가지를 먼저 확인합니다. 완료 조건이 만들면서 구체화되는 편이라 <strong>시작 전에 어디까지가 끝인지</strong> 묻고, 결과물을 보고 방향을 바꾸는 일이 잦아서 <strong>작게 만들어 먼저</strong> 보여 드립니다. 본인도 알고 계신 부분이라 이렇게 맞춰 진행합니다.</>,
    ],
  },
  {
    name: 'Gemini',
    logo: 'img/agent-gemini.svg',
    body: [<>이미지 생성 한두 번 하더니 그 이후로는 안 오셔요.</>],
  },
]

export function Home() {
  const stackAlt = `중심: ${STACK.core[0]}. 핵심: ${STACK.core.slice(1).join(', ')}. 주변: ${STACK.around.join(', ')}. 외곽: ${STACK.outer.join(', ')}.`
  return (
    <Layout page="home">
      <div className="shell">
        <section className="hero" aria-labelledby="intro">
          <div>
            <p className="label">Frontend Engineer</p>
            <h1 id="intro">김이랑</h1>
            <p className="hero-text">화면보다 구조를 먼저 만드는 프론트엔드 개발자입니다. 디자인 시스템과 지도·데이터 시각화를 만듭니다.</p>
            <div className="hero-actions">
              <a className="button primary" href="./projects/">포트폴리오 보기</a>
              <a className="button ghost" href="./blog/">블로그</a>
            </div>
          </div>
          <figure className="portrait">
            <img src={AVATAR} alt="김이랑 프로필 이미지" width="220" height="220" />
          </figure>
        </section>

        <section className="section" aria-labelledby="stack-title">
          <h2 className="section-title" id="stack-title">Stack</h2>
          <figure className="stack-figure">
            <picture>
              <source media="(max-width: 600px)" srcSet="./img/stack-map-mobile.svg" />
              <img src="./img/stack-map.svg" alt={stackAlt} />
            </picture>
            <figcaption>진할수록 자주, 깊게 쓰는 기술입니다.</figcaption>
          </figure>
        </section>

        <section className="section" aria-labelledby="portfolio-title">
          <h2 className="section-title" id="portfolio-title">Portfolio</h2>
          <p className="section-lead">실무에서 맡은 일과 개인 프로젝트입니다. 실무 프로젝트명은 가칭입니다.</p>
          <div className="cards">
            {projects.map((project) => <ProjectCard key={project.slug} project={project} root="./" />)}
          </div>
        </section>

        <section className="section" aria-labelledby="direction-title">
          <h2 className="section-title" id="direction-title">Direction</h2>
          <ul className="directions">
            {DIRECTIONS.map(([title, text]) => (
              <li key={title}><strong>{title}</strong><span>{text}</span></li>
            ))}
          </ul>
        </section>

        <section className="section" aria-labelledby="ai-title">
          <h2 className="section-title" id="ai-title">AI Comments</h2>
          <p className="section-lead">함께 일하는 AI 에이전트들이 남긴 코멘트입니다.</p>
          <div className="comments">
            {COMMENTS.map((comment) => (
              <article className="comment" key={comment.name}>
                <header><img src={`./${comment.logo}`} alt="" />{comment.name}</header>
                {comment.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              </article>
            ))}
          </div>
        </section>

        <section className="contact" aria-labelledby="contact-title">
          <div>
            <h2 id="contact-title">같이 이야기해요</h2>
            <p>프로젝트나 협업 제안은 이메일로 보내 주세요.</p>
          </div>
          <a className="button primary" href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </section>
      </div>
    </Layout>
  )
}
