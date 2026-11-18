// 포트폴리오를 "문제" 축으로 다시 묶는다. 같은 문제를 실무와 개인 프로젝트에서 어떻게 풀었는지 나란히 보여 준다.
// note는 그 프로젝트에서 이 문제를 두고 내린 결정 한 줄이다. 프로젝트 본문(content/projects/*.md)에 근거가 있어야 한다.
export type Problem = {
  id: string
  title: string
  lead: string
  entries: { slug: string; note: string }[]
}

export const problems: Problem[] = [
  {
    id: 'data',
    title: '많은 데이터를 읽히게',
    lead: '데이터가 많을수록 다 보여 주는 것보다 무엇을 먼저, 어떻게 보여 줄지가 중요했습니다.',
    entries: [
      { slug: 'detection-review', note: '탐지 결과·신뢰도·라벨을 목록·이미지·지도에서 같은 모양으로 보여 줘, 화면을 오가도 같은 결과로 읽히게 했습니다.' },
      { slug: 'ops-admin', note: '상태 요약 → 알림 → 목록 → 상세 순으로 우선순위를 정해, 이상이 있는 장비가 먼저 눈에 띄게 했습니다.' },
      { slug: 'ground-scan', note: '한 번에 받던 대량 조회를 나눠 병렬로 보내, 화면보다 먼저 막히던 요청 병목을 풀었습니다.' },
      { slug: 'pokestra', note: '1,000개 넘는 항목을 로컬 데이터로 브라우저 안에서 검색하고, 긴 목록은 보이는 만큼만 그렸습니다.' },
    ],
  },
  {
    id: 'flow',
    title: '상태와 흐름 설계',
    lead: '여러 화면과 단계가 얽힐 때, 상태를 어디에 두고 어떤 순서로 보여 줄지를 먼저 정했습니다.',
    entries: [
      { slug: 'detection-review', note: '선택한 객체·필터·지도 위치를 한곳에서 관리해, 목록·이미지·지도가 같은 규칙으로 따라오게 했습니다.' },
      { slug: 'road-watch', note: '로그인·추가 인증·세션 만료를 하나의 흐름으로 보고, 끊겼을 때 어디로 돌아가는지 분명하게 했습니다.' },
      { slug: 'pokestra', note: '한 턴의 이벤트를 장면으로 기록해 순서대로 재생하고, 필터와 대결 조합은 URL에 담았습니다.' },
      { slug: 'anonymizer-site', note: '스크롤 위치를 장면 전환에 묶어, 원본이 가려지는 과정을 스크롤만으로 따라오게 했습니다.' },
    ],
  },
  {
    id: 'quality',
    title: '바뀐 것이 깨뜨리지 않게',
    lead: '여러 곳이 같이 쓰는 코드일수록, 기능보다 검증 장치를 먼저 갖췄습니다.',
    entries: [
      { slug: 'pokebattle-engine', note: '7가지 불변식을 정하고 무작위 배틀 1,000만 번으로 시뮬레이터와 어긋나지 않는지 검증했습니다.' },
      { slug: 'design-system', note: 'Storybook 시각 회귀 테스트와 브라우저 품질 게이트로, 공통 컴포넌트 변경이 다른 화면을 깨뜨리지 않게 했습니다.' },
      { slug: 'ops-admin', note: 'TypeScript 엄격화와 자동화 테스트를 먼저 갖추고, 배포 전 백업을 거치는 GitHub Actions 배포를 만들었습니다.' },
      { slug: 'pokestra', note: '영어·일본어 문구가 하나라도 빠지면 타입 검사에서 실패하게 했습니다.' },
    ],
  },
  {
    id: 'standard',
    title: '하나의 기준으로 묶기',
    lead: '제각각인 것을 하나하나 고치기보다, 같이 따를 기준을 세웠습니다.',
    entries: [
      { slug: 'design-system', note: 'KRDS 위에 토큰과 규칙을 세우고, Vue 3와 React 구현은 각 프레임워크 방식에 맞췄습니다.' },
      { slug: 'pokebattle-engine', note: 'PokeAPI와 Showdown의 서로 다른 이름 체계를 포켓몬 1,351개(폼 포함) 전부 하나로 연결했습니다.' },
      { slug: 'pokestra', note: 'Astryx 테마 토큰 위에 Tailwind를 얹어, 값을 직접 쓰지 않는 원칙을 개인 프로젝트에도 적용했습니다.' },
    ],
  },
  {
    id: 'security',
    title: '인증과 보안',
    lead: '보안 기준을 지키면서도, 사용자가 지금 어느 단계에 있는지 헷갈리지 않게 했습니다.',
    entries: [
      { slug: 'ops-admin', note: 'MFA 로그인을 넣고 토큰을 HttpOnly 쿠키로 옮겨, 스크립트에서 토큰을 읽을 수 없게 했습니다.' },
      { slug: 'road-watch', note: 'MFA와 세션 관리를 맡고, 민감한 값은 보내기 전에 브라우저에서 RSA-OAEP로 암호화했습니다.' },
    ],
  },
]
