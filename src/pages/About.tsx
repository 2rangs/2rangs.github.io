import { Layout } from '../components/Layout'
import { projects } from '../lib/content'
import { paths } from '../lib/routes'
import { SITE } from '../lib/site'

const PRINCIPLES: [string, string][] = [
  ['화면보다 부품을 먼저', '같은 버튼을 세 번 만들고 있다면 화면이 아니라 부품이 문제입니다. 디자인 토큰과 공통 컴포넌트로 여러 프로젝트가 같이 쓰는 기준을 만듭니다.'],
  ['증상보다 구조를', '같은 버그가 두 번 나오면 고치는 대신 다시 생기지 않는 구조를 찾습니다. 타입을 엄격하게 하고, 테스트와 시각 회귀 검사를 품질 게이트로 둡니다.'],
  ['동작한 다음의 완성도', '정보가 빽빽한 관제 화면일수록 위계와 밀도, 일관성이 사용성을 좌우합니다. 동작하는 것과 쓰기 좋은 것은 다른 일로 봅니다.'],
  ['범위를 먼저 정하고 작게 보여 주기', '만들면서 완료 조건이 구체화되는 편이라, 시작 전에 이번 단계의 끝을 정하고 작은 결과물로 먼저 확인받습니다.'],
]

const SKILLS: [string, string[]][] = [
  ['주로 쓰는 기술', ['Vue 3', 'TypeScript', 'React', 'Tailwind CSS', 'Vite', 'Storybook']],
  ['지도·시각화', ['OpenLayers', 'MapLibre', 'Deck.gl', 'Chart.js']],
  ['함께 다루는 것', ['Next.js', 'Pinia', 'FastAPI', 'PostgreSQL', 'Docker', 'Nginx', 'GitHub Actions']],
]

const work = projects.filter((project) => project.kind === 'work')

export function About() {
  return (
    <Layout section="about">
      <div className="shell">
        <header className="page-head about-head">
          <img className="avatar-lg" src={SITE.avatar} alt="" width="120" height="120" />
          <div>
            <h1>안녕하세요, {SITE.name}입니다</h1>
            <p className="page-lead">
              AI 탐지·관제 서비스를 만드는 팀에서 프론트엔드를 맡고 있습니다. 지도와 이미지 위에 탐지 결과를 얹는 검수 도구,
              장비와 모델을 관리하는 운영 화면, 그리고 그 화면들이 같이 쓰는 디자인 시스템을 만들어 왔습니다.
            </p>
          </div>
        </header>

        <div className="about-grid">
          <section className="about-section" aria-labelledby="principles">
            <h2 id="principles">일하는 방식</h2>
            <dl className="principles">
              {PRINCIPLES.map(([title, text]) => (
                <div key={title}><dt>{title}</dt><dd>{text}</dd></div>
              ))}
            </dl>
          </section>

          <section className="about-section" aria-labelledby="work">
            <h2 id="work">맡아 온 일</h2>
            <p className="muted">회사 프로젝트는 이름을 가칭으로 적었습니다. 자세한 내용은 각 항목에 있습니다.</p>
            <ul className="work-list">
              {work.map((project) => (
                <li key={project.slug}>
                  <a href={paths.project(project.slug)}>{project.title}</a>
                  <span>{project.role}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="about-section" aria-labelledby="skills">
            <h2 id="skills">기술</h2>
            <dl className="skills">
              {SKILLS.map(([group, items]) => (
                <div key={group}>
                  <dt>{group}</dt>
                  <dd><ul className="stack">{items.map((item) => <li key={item}>{item}</li>)}</ul></dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="about-section" aria-labelledby="blog">
            <h2 id="blog">이 블로그</h2>
            <p>
              프론트엔드를 하며 배운 것을 정리합니다. JavaScript와 TypeScript의 동작 원리, CSS와 디자인 시스템, 협업과 도구에 관한 글이 많습니다.
              틀린 내용을 발견하면 글 아래 댓글이나 이메일로 알려 주세요. 확인하고 바로 고칩니다.
            </p>
          </section>

          <section className="about-section contact-card" aria-labelledby="contact">
            <h2 id="contact">연락하기</h2>
            <p>협업 제안, 글에 대한 의견, 채용 문의 모두 반갑습니다. 보통 이틀 안에 답장합니다.</p>
            <ul className="contact-list">
              <li><span>이메일</span><a href={`mailto:${SITE.email}`}>{SITE.email}</a></li>
              <li><span>GitHub</span><a href={SITE.github} rel="me">github.com/2rangs</a></li>
              <li><span>RSS</span><a href="/rss.xml">{SITE.url.replace('https://', '')}/rss.xml</a></li>
            </ul>
          </section>
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
