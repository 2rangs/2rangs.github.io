import './App.css'

const PROFILE_IMAGE = 'https://avatars.githubusercontent.com/u/107464775?v=4'



const PROJECTS = [
    {
        title: 'Project A — 모바일 웹 사용자 경험 개선',
        goals: [
            '로그인, 비밀번호 변경, 업로드 흐름을 하나의 사용자 경험으로 연결',
            '모바일 환경에서도 입력과 예외 처리가 자연스럽게 이어지도록 설계',
            '보안 기준을 지키면서도 사용자 혼란을 줄이는 방향으로 개선',
        ],
        learned: [
            '인증과 폼은 기능이 아니라 흐름이라는 것',
            '친절함과 정보 노출은 다를 수 있다는 것',
            '모바일 환경에는 예상보다 많은 예외가 존재한다는 것',
        ],
        chips: ['Mobile Web', 'Auth', 'UX'],
    },
    {
        title: 'Project B — 지도 기반 마커 대시보드 구현',
        goals: [
            '다량의 마커와 상태 정보를 직관적으로 표현',
            '선택/하이라이트/이동 흐름을 예측 가능하게 구성',
            '정보 밀도를 조절하여 시선 흐름 유지',
        ],
        learned: [
            '상태 설계가 UI 복잡도를 결정한다는 것',
            '일관성이 신뢰를 만든다는 것',
            '지도 인터랙션은 예측 가능해야 한다는 것',
        ],
        chips: ['Map UI', 'Interaction', 'State'],
    },
    {
        title: 'Project C — 실시간 대시보드 UI 구성',
        goals: [
            '데이터를 많이 보여주기보다 빠르게 판단하게 만드는 것',
            'KPI, 알림, 리스트, 상세의 우선순위 정리',
            '로딩/빈 상태/에러 상태까지 경험으로 설계',
        ],
        learned: [
            '정보 구조 설계가 UI의 절반이라는 것',
            '보여주는 화면과 사용되는 화면은 다르다는 것',
            '실시간 데이터는 안정감 있는 표현이 중요하다는 것',
        ],
        chips: ['Dashboard', 'Realtime', 'Info Design'],
    },
    {
        title: 'Project D — 디자인 시스템 기획 및 개발',
        goals: [
            '일관성을 유지할 수 있는 UI 기준 수립',
            '다크모드 포함 토큰 기반 설계',
            '재사용 가능한 컴포넌트 패턴 정리',
        ],
        learned: [
            '예쁜 UI보다 일관된 UI가 더 어렵다는 것',
            '디자인 토큰은 유지보수의 핵심이라는 것',
            '명확한 기준이 개발 속도를 만든다는 것',
        ],
        chips: ['Design System', 'Tokens', 'Theming'],
    },
    {
        title: 'Project E — 게임 데이터 기반 개인 프로젝트',
        goals: [
            '관심 있는 게임 데이터를 활용한 인터랙션 설계 실험',
            '필터/시너지 계산/라인업 구성 기능 구현',
            '사용자가 탐색하는 경험 중심 UI 구성',
        ],
        learned: [
            '데이터 구조 설계가 인터랙션의 시작이라는 것',
            '재미있는 탐색 경험도 UX라는 것',
            '사이드 프로젝트는 실험하기 좋은 공간이라는 것',
        ],
        chips: ['Side Project', 'Data UI', 'Experiment'],
    },
]

const EMAIL = '2_rang25@naver.com'

function App() {
    return (
        <>
            <a className="skip-link" href="#main">본문으로 건너뛰기</a>
            <header className="site-header" id="top">
                <div className="shell header-inner">
                    <a className="brand" href="#top"><span aria-hidden="true">2R</span>2rang25</a>
                    <nav aria-label="주 메뉴">
                        <a href="./blog/">블로그</a>
                        <a href="#projects">프로젝트</a>
                        <a href="#contact">연락처</a>
                    </nav>
                </div>
            </header>

            <main className="shell" id="main" tabIndex={-1}>
                <section className="hero" aria-labelledby="intro">
                    <div>

                        <h1 id="intro">김이랑</h1>
                        <p className="intro">사용자 경험을 중요하게 생각하는<br className="desktop-break" /> 프론트엔드 개발자입니다.</p>
                        <div className="actions">
                            <a className="button primary" href="#projects">프로젝트 보기 <span aria-hidden="true">↓</span></a>
                            <a className="button secondary" href="https://github.com/2rangs">GitHub <span aria-hidden="true">↗</span></a>
                        </div>
                    </div>
                    <figure className="portrait">
                        <img src={PROFILE_IMAGE} alt="2rang25 프로필" width="288" height="288" />
                        <figcaption>@2rang25</figcaption>
                    </figure>
                </section>

                <section id="projects" className="projects" aria-labelledby="project-heading">
                    <div className="section-heading">
                        <h2 id="project-heading">프로젝트</h2>
                        <p>각 프로젝트의 목표와 작업하며 배운 점을 정리했습니다.</p>
                    </div>
                    <div className="project-grid">
                        {PROJECTS.map((project) => (
                            <article className="project" key={project.title}>
                                <h3>{project.title.split(' — ')[1] ?? project.title}</h3>
                                <ul className="tags" aria-label="프로젝트 주제">
                                    {project.chips.map((chip) => <li key={chip}>{chip}</li>)}
                                </ul>
                                <p className="project-intro">{project.goals[0]}</p>
                                <details>
                                    <summary>목표와 배운 점</summary>
                                    <div className="project-details">
                                        {[{ label: '목표', items: project.goals }, { label: '배운 점', items: project.learned }].map(({ label, items }) => (
                                            <div key={label}>
                                                <h4>{label}</h4>
                                                <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </article>
                        ))}
                    </div>
                </section>

                <section id="contact" className="contact" aria-labelledby="contact-heading">
                    <div>
                        <h2 id="contact-heading">연락처</h2>
                        <p>프로젝트나 협업에 대해 이야기하고 싶다면 이메일로 연락해 주세요.</p>
                    </div>
                    <a className="button primary" href={'mailto:' + EMAIL}>{EMAIL} <span aria-hidden="true">↗</span></a>
                </section>
            </main>

            <footer className="shell footer">
                <span>© {new Date().getFullYear()} 2rang25</span>
                <a href="#top">맨 위로 ↑</a>
            </footer>
        </>
    )
}

export default App
