
> **참고** 이 글은 "Meta Astryx 완전 가이드" 10부작의 1편입니다. Astryx v0.7.16(2026년 11월) 공식 저장소의 문서와 소스를 읽고 정리했습니다. Astryx는 베타라서 이후 버전에서 달라질 수 있습니다.

새 프로젝트를 시작하면 화면을 무엇으로 만들지부터 정해야 합니다.
선택지는 대개 둘로 갈립니다.

큰 회사가 만든 디자인 시스템을 가져오면 버튼부터 표까지 다 들어 있습니다.
대신 화면이 그 회사 제품처럼 보입니다.

컴포넌트 코드를 복사해 붙여 넣는 방식은 자유롭습니다.
대신 복사한 순간부터 그 코드는 내 것입니다.
원본에서 접근성 버그가 고쳐져도 내 프로젝트에는 들어오지 않고, 프로젝트마다 조금씩 다른 버튼이 생깁니다.

2026년 6월 18일, Meta가 이 둘 사이를 겨냥한 디자인 시스템을 공개했습니다.
이름은 Astryx입니다.
Astryx는 Meta가 사내에서 8년 동안 키운 디자인 시스템을 오픈소스 기술 위에 다시 만들어 공개한 React 디자인 시스템입니다.

위의 두 선택지는 Astryx 공개 글이 직접 꺼낸 문제입니다.
이 글은 그 설명이 실제로 무엇을 뜻하는지 저장소에 적힌 내용만으로 살펴봅니다.

## 한눈에 보기

- Astryx는 Meta가 MIT 라이선스로 공개한 오픈소스 React 디자인 시스템이고, 2026년 11월 현재 베타입니다. 최신 릴리스는 v0.7.16(2026-11-14)입니다.
- Astryx의 뿌리는 Meta 사내에서 8년 동안 쓰인 디자인 시스템이며, 공식 README는 그 시스템이 13,000개 이상의 사내 앱에 쓰였다고 밝힙니다.
- Astryx는 2026년 6월 18일에 공개됐고, 150개 이상의 컴포넌트와 테마 7종, 페이지 템플릿, CLI를 하나의 시스템으로 제공합니다.
- Astryx는 React 19 이상이 필요합니다. `@astryxdesign/core`의 peer dependency가 `react >=19.0.0`, `react-dom >=19.0.0`입니다.
- Astryx의 스타일은 StyleX로 작성됐지만, 사용자는 미리 빌드된 CSS를 import하면 되고 StyleX를 설정하거나 배울 필요가 없습니다.
- Astryx의 안정 패키지는 `@astryxdesign/core`, `cli`, `build`, `theme-*` 7종, 그리고 v0.7.1부터 `richtext`이며, 서로 같은 버전 번호로 함께 배포됩니다.
- Astryx의 `charts`, `vega`, `native`, `lab` 패키지는 실험 단계라서 안정(`latest`) 릴리스가 없습니다.
- Astryx는 1.0 이전이라 마이너 버전이 오를 때마다 호환성을 깨는 변경이 들어옵니다. v0.7.0에는 그런 변경이 26건 있었고, 이를 옮겨 주는 `astryx upgrade` 코드모드(codemod)가 함께 나왔습니다.

## Astryx는 어디서 왔나

### Meta 안에서 반복되던 문제

2026년 6월 29일에 올라온 공식 글 "How Astryx works"가 출발점을 설명합니다.

Meta는 수천 개의 사내 도구 위에서 돌아갑니다.
필요한 도구가 없으면 그 팀이 직접 만드는 문화가 있고, 도구는 여러 조직에 흩어져 있습니다.
그러다 보니 만드는 사람들은 날짜 선택기, 표, 폼 같은 것을 도구마다 다시 만들었습니다.

그 비용은 모두에게 돌아갔습니다.
쓰는 사람은 도구마다 조금씩 다른 동작을 익혀야 했고, 만드는 사람은 같은 것을 다시 만드느라 시간을 썼고, 회사는 같은 컴포넌트를 여러 벌 유지했습니다.

그래서 공통 UI 프레임워크를 만들었습니다.
공통 문제는 한 번만 풀고, 각 팀은 자기 제품에만 있는 문제에 시간을 쓰자는 생각입니다.
글에 따르면 이 시스템은 8년에 걸쳐 Meta에서 가장 많이 쓰이고 가장 큰 디자인 시스템이 됐고, 13,000개가 넘는 제품에 쓰였으며, 업데이트의 절반가량을 그 시스템을 쓰는 사내 개발자들이 직접 기여했습니다.

### 왜 그대로 두지 않고 다시 만들었나

같은 글은 AI가 UI를 만드는 일의 경제성을 바꿨다고 적습니다.
AI 어시스턴트는 TypeScript, 널리 쓰이는 오픈소스 라이브러리, 최신 브라우저 기능처럼 공개된 표준 위에서 훨씬 잘 작동하는데, 사내 시스템은 그 어느 것에도 해당하지 않았습니다.

여기에 세 가지 바람이 겹쳤습니다.
최신 브라우저 기술로 현대화하고, 커스터마이즈 폭을 넓히고, AI 대응을 나중에 덧붙이는 대신 처음부터 설계에 넣는 것입니다.
그리고 AI 덕분에 전체를 다시 만들어 오픈소스로 내는 일이 그 팀 규모로도 가능해졌다고 말합니다.

여기서 흔한 오해 하나를 짚어야 합니다.

**"Astryx는 Meta가 쓰던 사내 코드를 그대로 공개한 것이다"는 정확하지 않습니다.**
공식 글은 Astryx를 그 사내 시스템을 오픈소스 스택 위에 다시 만든 것이라고 설명합니다.
8년 동안 쌓인 컴포넌트의 폭, 관례, 조직의 지식은 가져오고, 발목을 잡던 제약은 덜어냈다고 합니다.

이 구분은 숫자를 읽을 때 중요합니다.
"8년"과 "13,000개 앱"은 Astryx의 계보인 사내 시스템이 쌓은 기록입니다.
지금 npm에서 받는 `@astryxdesign/core`가 8년 동안 검증됐다는 뜻이 아닙니다.
공개된 패키지는 버전이 0.7대인 베타이고, 지금도 빠르게 바뀝니다.

### 이름과 공개 시점

Astryx는 asterisks(별표들)처럼 읽습니다.
공식 글은 이름이 라틴어 문구 ad astra per aspera(고난을 지나 별로)에서 왔고, 끝의 X는 이 생각이 시작된 팀인 xDesign을 가리킨다고 설명합니다.

확인되는 날짜는 둘입니다.
GitHub 저장소 `meta/astryx`의 생성일은 2026년 1월 9일이고(GitHub API 기준), 공개 소개 글 "Introducing Astryx by Meta"의 날짜는 2026년 6월 18일입니다.
한 달 뒤 글도 출시일을 6월 18일로 적습니다.

## Astryx를 쓰는 코드는 어떻게 생겼나

코드를 한 번 보고 가는 편이 이해가 빠릅니다.
README 기준 설치는 이렇습니다.

```bash
npm install @astryxdesign/core @astryxdesign/theme-neutral @stylexjs/stylex
npm install -D @astryxdesign/cli
```

그다음 CSS 세 개를 불러오고 컴포넌트를 가져다 씁니다.
"How Astryx works" 글의 예시입니다.

```css
@import '@astryxdesign/core/reset.css';
@import '@astryxdesign/core/astryx.css';
@import '@astryxdesign/theme-neutral/theme.css'; /* 테마를 하나 고른다 */
```

```tsx
import {Button} from '@astryxdesign/core/Button';
import {Stack} from '@astryxdesign/core/Stack';
import {Card} from '@astryxdesign/core/Card';

<Stack gap="md">
  <Card>
    <Button variant="primary">Save</Button>
  </Card>
</Stack>;
```

빌드 설정은 따로 없습니다.
README는 가장 단순한 설정이 CSS import 몇 줄과 테마 프로바이더이고, 빌드 플러그인도 PostCSS나 Babel 설정도 필요 없다고 적습니다.

여기서 두 번째 오해가 풀립니다.

**"Astryx를 쓰려면 StyleX를 배워야 한다"는 틀렸습니다.**
Astryx 팀은 스타일을 StyleX로 작성하지만, 결과물은 미리 컴파일된 CSS 파일로 배포됩니다.
사용자는 평범한 CSS 파일과 타입이 붙은 React 컴포넌트를 받습니다.
설치 명령의 `@stylexjs/stylex`는 README가 peer dependency로 함께 설치하라고 한 것이고, StyleX 컴파일러를 프로젝트에 붙이라는 뜻이 아닙니다.

프레임워크별 설정과 테마 프로바이더는 [Astryx 설치와 첫 화면](/blog/astryx-getting-started/)에서 다룹니다.

## 다른 디자인 시스템과 다른 네 가지

README는 Astryx의 차별점을 네 가지로 적습니다.

### 1. 열린 내부 구조 (open internals)

많은 컴포넌트 라이브러리는 최상위 컴포넌트만 내보내고 그 안의 조각은 감춥니다.
그러면 "이 부분만 다르게" 하고 싶을 때 막힙니다.

Astryx는 컴포넌트를 어느 층에서든 조합할 수 있게 만들고, 필요할 만한 구성 조각을 직접 내보낸다고 밝힙니다.
더 깊이 들어가야 하면 스위즐(swizzle)을 씁니다.
스위즐은 컴포넌트의 소스 전체를 내 프로젝트로 꺼내 와서 내가 소유하게 하는 CLI 기능입니다.

### 2. 스타일링 잠금 없음 (no styling lock-in)

StyleX는 내부 구현입니다.
스타일을 바꾸고 싶으면 `className`으로 재정의하면 되고, 도구는 Tailwind든 CSS Modules든 일반 CSS든 프로젝트가 이미 쓰는 것이면 됩니다.

### 3. 감싸지 않는 커스터마이즈 (customize without wrapping)

디자인 시스템을 우리 브랜드에 맞추려고 `<Button>`을 감싼 `<OurButton>`을 만드는 일은 흔합니다.
감싼 컴포넌트가 늘어나면 원본이 업데이트될 때마다 따라가기 어려워집니다.

Astryx에서 테마는 CSS 사용자 정의 속성(custom property)을 재정의한 묶음입니다.
그래서 디자이너가 테마를 맡을 수 있고, 개발자는 모양을 바꾸려고 컴포넌트 소스를 포크하거나 감쌀 필요가 없다고 설명합니다.
공개 글의 표현으로는 시스템이 동작, 접근성, 품질을 책임지고 테마가 생김새를 책임집니다.

### 4. 사람과 에이전트를 함께 고려 (built for people and agents)

API, 문서, CLI를 함께 설계해서 사람과 AI 어시스턴트가 같은 참고 자료로 같은 방식으로 만들게 한다는 뜻입니다.

구체적인 장치는 CLI입니다.
2026년 7월 10일 글 "The best CLI is one you never run"은 CLI가 곧 문서라고 말합니다.
모든 문서와 예제의 원본이 CLI 안에 있고, 문서 사이트는 그것을 읽어 가는 소비자입니다.
AI 에이전트가 터미널에서 CLI를 실행하면 사람이 사이트에서 보는 것과 같은 원본을 읽으므로, 따로 관리하다 어긋나는 두 번째 사본이 없습니다.

### 한 단계씩 깊어지는 커스터마이즈 경로

네 가지 특징은 하나의 흐름으로 이어집니다.
"How Astryx works" 글은 이를 단계적 커스터마이즈 경로라고 부릅니다.

1. 컴포넌트를 있는 그대로 쓴다.
2. 테마의 디자인 토큰(design token)을 조정한다.
3. `className`으로 내 스타일을 입힌다.
4. 내 CSS로 컴포넌트 안쪽을 직접 건드린다.
5. 스위즐로 소스를 꺼내 와서 직접 소유한다.

단계가 내려갈수록 통제권도 책임도 커집니다.
복사·붙여 넣기 방식의 자유를 필요한 컴포넌트에만, 필요한 만큼 쓰게 하는 구조입니다.

배포 방식도 둘입니다.
쉬운 길은 미리 빌드된 스타일시트를 import하는 것이고, 다른 길은 TypeScript와 StyleX 소스에서 직접 빌드해 실제로 쓴 컴포넌트의 스타일만 남기는 것입니다.
공식 글은 자신들의 참고 앱에서 후자의 결과가 전체 스타일시트의 3분의 1쯤이었다고 적습니다.

토큰과 테마는 [Astryx 테마와 디자인 토큰](/blog/astryx-theme-tokens/)에서, `className` 재정의와 Tailwind, 스위즐은 [Astryx 스타일링](/blog/astryx-styling-tailwind-swizzle/)에서 다룹니다.

## 네 가지 원칙

README는 원칙을 Astryx가 그 위에서 만드는 사람들에게 하는 약속이라고 부릅니다.

### 강제보다 안내 (guidance over enforcement)

컴포넌트는 사용자와 싸우는 가드레일 대신 능력을 준다는 원칙입니다.
디자인에 대한 의견은 문서와 예제에 담고, 사용자가 값을 넘기면 컴포넌트는 그 값을 그대로 그립니다.
공식 글은 이를 한 줄로 요약합니다: "The system steers; it doesn't police."

대가도 있습니다.
시스템이 막아 주지 않으니, 일관성은 쓰는 쪽의 규율과 문서를 읽는 습관에 달려 있습니다.

### 강하고 문서화된 관례 (strong, documented conventions)

모든 컴포넌트가 같은 이름 규칙, prop 규칙, 조합 규칙을 따르고 빠짐없이 문서화한다는 원칙입니다.
몇 개를 익히면 나머지가 익숙해지고, 처음 보는 컴포넌트의 동작도 사람과 AI 모두 예측할 수 있게 하려는 것입니다.
그 규칙의 내용은 [Astryx 컴포넌트 150개를 읽는 법](/blog/astryx-components-api/)에서 정리합니다.

### 사람과 AI를 위한 하나의 시스템 (one system for humans and AI)

AI용 문서를 따로 만들지 않는다는 원칙입니다.
팀은 AI가 쓰기 쉽게 만든 변경이 매번 사람에게도 쓰기 쉬운 변경이었다고 적습니다.

### 측정으로 검증 (earned by measurement)

관례를 주장하는 대신 시험한다는 원칙입니다.
경쟁하는 접근을 사람과 AI 앞에 내놓고 무엇이 실제로 통하는지 측정하고, 새로운 상황이 반증하면 결과를 다시 봅니다.

이를 위한 장치가 바이브 테스트(vibe test)입니다.
AI 에이전트에게 같은 과제를 Astryx, Astryx와 Tailwind, shadcn/Tailwind 기준선, 순수 HTML 네 가지 구성으로 풀게 하고 별도의 심사 에이전트가 채점합니다.

결과를 감추지 않는다는 점도 눈에 띕니다.
2026년 7월 27일 글 "Vibe Test"는 Astryx가 98점으로 1위를 한 날(2026-07-10)과 함께, 정확성 점수가 2점까지 떨어져 종합 77점으로 기준선에 진 날(2026-06-28)도 공개합니다.
전체 기록으로 보면 기준선이 가장 많은 밤을 이겼다는 문장도 그대로 적혀 있습니다.
"Astryx가 AI에게 항상 더 낫다"는 결론은 공식 자료에서도 나오지 않습니다.
자세한 구조는 [Astryx는 왜 '에이전트 대응'인가](/blog/astryx-ai-agents/)에서 다룹니다.

### CLI 문서의 principles는 또 다른 층입니다

`astryx docs principles`로 읽는 문서는 위 네 가지와 내용이 다릅니다.
README의 원칙이 Astryx 팀이 시스템을 만드는 원칙이라면, 이 문서는 Astryx로 앱을 만드는 사람이 지킬 규칙입니다.

여덟 가지 규칙을 줄이면 이렇습니다.

- 컴포넌트가 다루는 영역에는 컴포넌트를 쓰고, 페이지는 틀(셸과 영역)부터 정한다.
- 밀도 높은 데이터는 행(Table, List)으로 그리고, Card는 위젯, 갤러리, 설정 묶음에 쓴다.
- 커스텀 스타일은 StyleX나 Tailwind로 쓴다. 둘 다 일급이다.
- 하드코딩한 값 대신 의미 기반 토큰을 쓰고, 색은 hex가 아니라 CSS 사용자 정의 속성으로 쓴다.
- 폼 입력은 `value`와 `onChange`로 제어한다.
- 내비게이션에는 `useLinkComponent()`를 써서 프레임워크 라우터를 `LinkProvider`로 꽂을 수 있게 한다.

같은 문서의 안티패턴 목록에는 "prop을 지어내지 말고 컴포넌트 문서를 먼저 읽어라"가 있습니다.
AI 에이전트를 염두에 둔 문장입니다.

## Astryx는 무엇으로 이루어져 있나

### 세 개의 층

README의 Architecture 절은 시스템을 세 층으로 나눕니다.

| 층 | 내용 |
| --- | --- |
| Foundations | 일관되고 접근 가능한 인터페이스의 기초. 타이포그래피, 색, 레이아웃, 접근성 |
| Components | TypeScript를 완전히 지원하는 재사용 UI 조각 150개 이상 |
| Patterns | 흔한 작업 흐름에 대한 검증된 해법. 테이블 페이지, 상세 페이지 레이아웃, 폼 위저드, 내비게이션 패턴, 데이터 입력 흐름 |

Patterns의 예시에서 이 시스템의 출신이 드러납니다.
마케팅 페이지보다 사내 도구, 관리 화면, 데이터가 많은 업무용 화면에서 자란 시스템입니다.
레이아웃과 템플릿은 [Astryx 레이아웃과 템플릿](/blog/astryx-layout-templates/)에서 다룹니다.

### 저장소 구조

`meta/astryx`는 모노레포입니다.

| 디렉터리 | 용도 |
| --- | --- |
| `packages/` | npm에 배포되는 패키지 |
| `apps/` | 예제 앱, 문서 사이트, Storybook, 샌드박스 |
| `internal/` | 내부 도구. 테스트 유틸리티, ESLint 플러그인, 바이브 테스트 |
| `docs/` | 유지보수자용 지식 문서. 아키텍처, 디자인 명세, 컴포넌트 명세 |
| `plugins/astryx/` | AI 코딩 도구용 플러그인과 스킬 파일 |

`docs/`는 사용자 문서가 아닙니다.
`docs/README.md`에 따르면 사용자 문서는 각 컴포넌트의 `.doc.mjs` 파일과 `packages/cli/assets/docs/`에 있습니다.
`docs/`의 기록에는 `draft`, `current`, `archived` 상태가 붙고, `current`인 문서만 구현과 리뷰의 기준이 됩니다.

### 패키지와 역할

v0.7.16 기준 안정 패키지입니다.

| 패키지 | 역할 |
| --- | --- |
| `@astryxdesign/core` | 컴포넌트, 테마 시스템, 유틸리티. 시스템의 본체 |
| `@astryxdesign/cli` | 컴포넌트 문서 조회, 템플릿, 스캐폴딩, 테마 빌드, 코드모드. Node 22.13.0 이상(`package.json`의 `engines`) |
| `@astryxdesign/build` | StyleX 소스 빌드용 플러그인(Babel, PostCSS, Vite). 미리 빌드된 CSS만 쓰면 필요 없음 |
| `@astryxdesign/theme-*` | 테마 7종: neutral, butter, chocolate, matcha, stone, gothic, y2k |
| `@astryxdesign/richtext` | Lexical 기반 리치 텍스트 에디터와 읽기 전용 뷰어. v0.7.1부터 안정 |

### 실험 영역의 현재 상태

| 패키지 | 내용 | 상태 (v0.7.16 기준) |
| --- | --- | --- |
| `@astryxdesign/lab` | core로 승격되기 전 실험 컴포넌트의 대기 장소 | 안정 릴리스 없음. Storybook과 샌드박스에서 내부적으로 사용 |
| `@astryxdesign/charts` | d3 위에 만든 설정 기반 차트 | `@canary` 태그로만 배포 |
| `@astryxdesign/vega` | Vega/Vega-Lite 명세를 그리는 래퍼 | `@canary` 태그로만 배포 |
| `@astryxdesign/native` | iOS, Android, macOS, Windows용 실험 | `@canary` 전용. 운영 앱에는 지원하지 않는다고 명시 |

네 가지를 덧붙입니다.

**lab에는 안정판이 없습니다.**
`latest`로 설치할 버전이 없고 안정성 약속도 없습니다.

**lab과 core의 차이는 품질 기준입니다.**
lab README는 lab 컴포넌트를 동작은 하지만 API가 바뀔 수 있고 접근성 강화, 바이브 테스트, 테마 적용이 끝나지 않은 것으로 설명합니다.
core로 승격하려면 접근성 체크리스트를 모두 통과해야 하고, 승격되면 import 경로가 바뀝니다.

**richtext는 실험 영역을 졸업한 사례입니다.**
v0.4.1에서 lab에서 분리될 때는 canary 전용이었습니다.
2026년 10월 20일 글은 이 패키지가 안정 패키지가 됐고 v0.7.1부터 core와 같은 버전으로 설치된다고 알립니다.

**native는 탐색 단계입니다.**
native README는 플랫폼별로 컴포넌트를 만드는 여러 방법을 같은 채점표로 비교하는 실험이라고 설명합니다.
Swift 패키지와 SwiftUI 뷰 일부가 있고, React Native와 Android 바인딩은 아직 만들어지지 않았습니다.

### 안정판과 카나리

`docs/release.md`에 따르면 배포 경로는 둘입니다.

- **안정(stable)**: 고정된 릴리스 태그 `vX.Y.Z`에서 빌드해 npm의 `latest`로 배포합니다. `main`에서 바로 안정판을 내는 것은 거부됩니다.
- **카나리(canary)**: `main`의 최신 커밋에서 최대 한 시간에 한 번, 또는 요청 시 배포합니다. 버전은 `<선언된 버전>-canary.g<짧은 커밋 해시>` 형태이고 `canary` 태그에만 올라갑니다.

배포는 GitHub Actions에서 npm 신뢰 게시(trusted publishing, OIDC)로 이루어지고, 안정 패키지는 출처 증명(provenance)과 함께 게시됩니다.

## 공개 후 지금까지

공식 블로그 글의 날짜로 정리한 흐름입니다.

| 날짜 | 일어난 일 |
| --- | --- |
| 2026-06-18 | 베타로 공개 |
| 2026-07-04 | v0.1.3. 테이블 컨텍스트 메뉴, WAI-ARIA 키보드 패턴 |
| 2026-07-22 | "One Month of Astryx" |
| 2026-08-05 | Astryx Figma Library 공개 |
| 2026-08-24 | v0.5.0 |
| 2026-09-10 | v0.6.0 |
| 2026-10-12 | v0.7.0 |
| 2026-10-20 | `@astryxdesign/richtext` 안정화 |
| 2026-11-12 | 샌프란시스코 밋업 |
| 2026-11-14 | v0(Vercel)에서 디자인 시스템 스킬로 제공. 같은 날 v0.7.16 릴리스 |

### 첫 한 달

"One Month of Astryx"는 첫 한 달의 숫자를 공개했습니다.

- GitHub 별 10.3K, 포크 758. 출시 주에 GitHub Trending 전체 2위까지 올랐다고 적었습니다.
- 문서 사이트 방문자 224K, 페이지 뷰 179만.
- PR을 연 사람 87명, 모든 브랜치에 815개 커밋을 올린 작성자 61명.

2026년 11월 17일에 GitHub API로 확인한 별 수는 약 29,900개입니다.

같은 글은 커뮤니티의 논의가 CLI, MCP 서버, 에이전트 우선 구조에 모였다고 정리하고, 다음 초점을 품질과 깊이로 잡았습니다.

### v0.5.0 (2026-08-24)

0.4.0 이후 여덟 번의 릴리스를 모은 버전입니다.

- **호환성을 깨는 변경 둘.** Banner의 접힘 관련 prop이 `collapsible` 하나로 합쳐졌습니다(`defaultIsExpanded` 제거). 오버레이들은 Escape 처리를 하나의 스택으로 공유하게 되어, Escape 한 번에 맨 위 층 하나만 닫힙니다.
- **승격.** `BottomSheet`와 `Stepper`가 lab에서 core로 올라왔습니다.
- **국제화.** 로케일 카탈로그가 `en`, `fr-FR` 둘에서 30개로 늘었습니다. `Selector`, `Typeahead`, `DateInput` 같은 입력은 IME 조합이 끝나기를 기다리게 되어, 한글 조합을 확정하는 Enter가 필드까지 확정해 버리지 않습니다.
- **제거.** UMD 번들이 사라졌습니다. React 19에는 `window.React`를 정의하는 빌드가 없어서 동작하는 구성이 없었다는 설명입니다.

접근성과 국제화는 [Astryx의 접근성, 국제화, 모션](/blog/astryx-a11y-i18n-motion/)에서 이어집니다.

### v0.6.0 (2026-09-10)

- **반응형 테마 규칙.** 테마가 뷰포트 너비, 포인터 정밀도, 대비 선호, 모션 줄이기 선호에 따라 토큰과 컴포넌트 스타일을 바꿀 수 있게 됐습니다(`defineTheme`의 `adaptations`).
- **적응형 선택 컴포넌트.** `Selector`와 `MultiSelector`에 `presentation="adaptive"`가 생겨, 좁은 화면에서는 바텀 시트로, 넓은 화면에서는 팝오버로 열립니다.
- **템플릿 여섯 개.** 위저드 다섯 종류와 작업 항목 상세 페이지입니다.
- **v1을 향한 명세.** 컴포넌트의 공개 API, 동작, 접근성 요구, 테마 대상을 적는 명세를 쓰고 있다고 밝혔습니다.

마이그레이션에서 가장 큰 CSS 변경은 시각 상태 표현입니다.
맨 클래스(`.primary`)에서 `data-*` 속성(`[data-variant='primary']`)으로 옮겨 갔습니다.

### v0.7.0 (2026-10-12)

v0.6.1부터 v0.6.8까지를 모은 버전이고, 변경 폭이 가장 큽니다.

- **폼과 입력.** 넘긴 스타일, ID, 핸들러가 실제로 조작하는 컨트롤에 닿게 바뀌었습니다. 예를 들어 `TextInput`의 `xstyle`이 `controlXstyle`로 옮겨 갔습니다.
- **모바일과 터치.** 행을 옆으로 밀어 동작을 드러내는 스와이프가 생겼고, Neutral, Chocolate, Butter, Stone 테마는 좁은 터치 기기에서 글자 크기 기준이 16px이 됐습니다.
- **간격 토큰이 rem으로.** `--spacing-N`이 N × 0.25rem이 되어, 레이아웃이 사용자의 글자 크기 설정을 따라갑니다.
- **CLI 통합.** 다른 라이브러리가 같은 Astryx CLI를 통해 자기 컴포넌트, 문서, 템플릿, 업그레이드 스크립트를 제공할 수 있게 됐습니다.

릴리스 글은 호환성을 깨는 마이그레이션 26건을 전부 나열합니다.
4건은 손으로 코드를 고쳐야 하고, 10건은 CLI 명령과 스크립트에 영향을 주고, 4건은 눈으로 확인할 시각·토큰 변경이고, 8건은 `astryx upgrade`가 처리하거나 점검합니다.
CLI 명령은 [Astryx CLI 완전 정복](/blog/astryx-cli/)에서 다룹니다.

### 그 사이의 실험들

**Figma 라이브러리.**
2026년 8월 5일 글 "Who needs a Figma Library?"는 사내에서 주간 삽입률(weekly insertion rate)이 95% 급감했고 주변 디자이너 대부분이 캔버스가 아니라 코드로 디자인한다고 적습니다.
그래도 빠른 탐색에는 Figma로 돌아가게 되어, 구축과 유지보수를 자동화할 수 있다면 내 보자고 결정했다고 합니다.
코드가 원본이고, 자동화 작업이 릴리스마다 Figma 라이브러리를 갱신합니다.

**밋업.**
2026년 11월 12일 밋업의 주제는 에이전트가 그럴듯한 화면을 스스로 만드는 시대에 디자인 시스템이 여전히 가치 있는가였습니다.
후기 글의 결론은 생성이 빨라진다고 공유 시스템의 중요성이 줄지 않는다는 것입니다.
같은 문제가 수많은 생성 결과에서 반복된다면, 공유된 원천을 고치는 일이 뒤따르는 모든 결과를 낫게 합니다.

## 0.x 버전을 읽는 법

도입을 판단하려면 버전 번호의 뜻을 알아야 합니다.

CLI의 버전 관리 문서(`versioning.doc.mjs`)는 통합 패키지를 만드는 사람을 위한 글이지만 0.x의 규칙을 분명히 설명합니다.
1.0.0 이전에는 npm이 마이너 버전 하나하나를 호환성이 깨지는 것으로 취급해서, `^0.6.0`을 요청한 앱은 `0.7.0`을 받지 않습니다.
그래서 호환성을 깨는 변경은 마이너를, 그 밖의 것은 패치를 올립니다.
`docs/release.md`도 패키지가 `0.x`인 동안 호환성을 깨는 작업은 `main`이 다음 마이너를 선언했을 때만 받아들인다고 적습니다.

올리는 순서도 정해져 있습니다.
먼저 패키지를 새 버전으로 설치하고, 그다음에 업그레이드를 실행합니다.
v0.7.0 릴리스 글의 예시입니다.

```bash
OLD_VERSION=0.6.8 # 지금 프로젝트가 쓰는 core 버전
npm i @astryxdesign/core@0.7.0 @astryxdesign/cli@0.7.0 @astryxdesign/build@0.7.0 @astryxdesign/theme-neutral@0.7.0
npx @astryxdesign/cli upgrade --from "$OLD_VERSION" --apply --path .
```

순서를 바꾸면 안 되는 이유가 v0.6.0 글에 있습니다.
CLI는 설치된 core 버전에서 목표 버전을 알아냅니다.
core가 옛 버전인 채로 업그레이드를 돌리면 이미 최신이라고 보고하고 마이그레이션을 건너뜁니다.

`--apply`를 빼면 미리 보기(dry run)로 동작합니다.
코드모드가 모든 것을 고쳐 주지는 않습니다.
v0.5.0 글은 `<Banner {...props} />`처럼 스프레드로 넘긴 prop은 코드모드도 TypeScript도 보지 못하니 직접 검색해서 고치라고 안내합니다.

## 브라우저 지원

브라우저 지원 문서(`browser-support.doc.mjs`)는 브라우저 요구 조건을 만드는 기능이 세 가지라고 밝힙니다.
CSS 앵커 포지셔닝(anchor positioning), Popover API, CSS `light-dark()`입니다.
그리고 하나의 최저 버전을 선언하는 대신 단계를 나눕니다.

| 단계 | 대표 버전 | 사용자가 겪는 것 |
| --- | --- | --- |
| Tier 1 (완전) | Chrome 125+, Edge 125+, Safari 26+, Firefox 147+ | 모든 것이 동작. 기준 대상 |
| Tier 2 (기능 동작) | Chrome 114+, Edge 114+, Safari 17+, Firefox 125+ | 컴포넌트를 쓸 수 있음. 앵커 포지셔닝만 없어서 툴팁, 메뉴, 팝오버가 트리거 옆에 놓이지 않을 수 있음 |
| Tier 3 (그 아래) | 그보다 오래된 브라우저 | 보장은 "죽지 않는다"뿐. `light-dark()`가 없어 테마 색이 기본값으로 떨어질 수 있음 |

공식 지원과 테스트 대상은 Tier 1과 Tier 2입니다.
Tier 2 사용자를 위해 폴리필을 넣을지, 위치가 어긋나는 것을 받아들일지는 쓰는 쪽이 정하라는 입장입니다.
이 단계는 Web Baseline 연도를 따라 해마다 움직이므로, 위 버전은 v0.7.16 시점의 값으로 읽어야 합니다.

## 누구에게 맞고 누구에게 안 맞나

**맞을 가능성이 높은 경우**

- React 19 이상을 쓰거나 올릴 수 있는 프로젝트.
- 표, 폼, 상세 페이지, 위저드가 많은 업무용 화면. Patterns 층과 템플릿이 겨냥하는 영역입니다.
- AI 코딩 에이전트와 함께 화면을 만드는 팀. CLI와 문서 구조가 이 방식을 전제로 설계됐습니다.
- 동작과 접근성은 맡기고 생김새는 테마로 바꾸고 싶은 팀, 이미 쓰는 Tailwind나 CSS Modules를 유지하고 싶은 팀.

**맞지 않을 가능성이 높은 경우**

- React 18 이하에 머물러야 하는 프로젝트, React가 아닌 프레임워크. 저장소의 패키지 목록에 다른 프레임워크용 패키지는 없습니다.
- API가 바뀌지 않아야 하는 프로젝트. v0.1.3(2026-07-04)에서 v0.7.16(2026-11-14)까지 넉 달 남짓 걸렸습니다.
- 오래된 브라우저를 넓게 지원해야 하는 서비스.
- 안정된 차트 컴포넌트나 네이티브 앱 지원이 당장 필요한 경우. `charts`, `vega`, `native`는 실험입니다.

공개 글은 Astryx를 프로덕션에 쓸 수 있는 도구로 소개하면서 동시에 베타라고 적습니다.
컴포넌트의 계보는 실전에서 검증됐지만, 공개된 패키지의 API는 아직 굳지 않았다고 읽으면 됩니다.
쓰기로 했다면 버전을 정확히 고정하고, 마이너 업그레이드를 일정에 넣어 두는 것이 현실적입니다.

## 시리즈 안내

나머지 아홉 편입니다.

- 2편 [Astryx 설치와 첫 화면 (Next.js, Vite, Tailwind, CDN 설정 총정리)](/blog/astryx-getting-started/): 설치부터 프레임워크별 설정까지.
- 3편 [Astryx 컴포넌트 150개를 읽는 법 (API 규칙과 컴포넌트 지도)](/blog/astryx-components-api/): 이름, prop, 조합 규칙과 컴포넌트 분류.
- 4편 [Astryx 레이아웃과 템플릿 (AppShell부터 대시보드 페이지까지)](/blog/astryx-layout-templates/): 페이지 틀을 잡는 방법과 템플릿.
- 5편 [Astryx 테마와 디자인 토큰 (defineTheme, 다크 모드, 나만의 테마)](/blog/astryx-theme-tokens/): 토큰 구조와 테마를 만드는 법.
- 6편 [Astryx 스타일링 (StyleX, className 재정의, Tailwind 브리지, swizzle)](/blog/astryx-styling-tailwind-swizzle/): 스타일을 바꾸는 단계별 방법.
- 7편 [Astryx CLI 완전 정복 (search, docs, doctor, upgrade)](/blog/astryx-cli/): CLI 명령과 업그레이드 흐름.
- 8편 [Astryx는 왜 '에이전트 대응'인가 (AGENTS.md, MCP 서버, 바이브 테스트)](/blog/astryx-ai-agents/): AI 에이전트를 위한 장치와 측정 방법.
- 9편 [Astryx의 접근성, 국제화, 모션 (보이지 않는 품질)](/blog/astryx-a11y-i18n-motion/): 키보드, 스크린 리더, 로케일, 모션.
- 10편 [이 블로그에 Astryx를 적용한다면 (도입 판단과 단계별 계획)](/blog/astryx-on-this-blog/): 실제 프로젝트에 넣을지 따져 보는 과정.

## 자주 묻는 질문

### Astryx는 Meta가 쓰던 사내 코드를 그대로 공개한 것인가요?

아닙니다.
공식 글 "How Astryx works"는 Astryx를 사내 시스템을 오픈소스 스택 위에 다시 만든 것이라고 설명합니다.
"8년"과 "13,000개 앱"은 그 사내 시스템의 기록으로 읽어야 합니다.

### Astryx를 쓰려면 StyleX를 알아야 하나요?

필요 없습니다.
Astryx의 스타일은 StyleX로 작성되지만 미리 컴파일된 CSS로 배포되므로, 사용자는 CSS 파일을 import하고 컴포넌트를 쓰면 됩니다.
StyleX 소스에서 직접 빌드하는 길은 번들 크기를 더 줄이고 싶을 때 고르는 선택 사항입니다.

### React 18 프로젝트에서 Astryx를 쓸 수 있나요?

쓸 수 없습니다.
README가 React 19 이상을 요구한다고 명시하고, `@astryxdesign/core`의 `package.json`에 `react`와 `react-dom`의 peer dependency가 `>=19.0.0`으로 적혀 있습니다.

### Astryx를 지금 프로덕션에 써도 되나요?

쓸 수는 있지만 조건을 알고 써야 합니다.
v0.7.16 기준 Astryx는 베타이고, 마이너 버전마다 호환성을 깨는 변경이 들어옵니다.
v0.7.0에는 그런 마이그레이션이 26건 있었고, 일부는 코드모드 없이 손으로 고쳐야 했습니다.
버전을 고정하고, 릴리스 글의 마이그레이션 목록을 읽고, `astryx upgrade`를 미리 보기로 먼저 돌려 보는 절차가 필요합니다.

### Astryx에 차트 컴포넌트가 있나요?

있지만 안정판이 아닙니다.
`@astryxdesign/charts`(d3 기반)와 `@astryxdesign/vega`(Vega/Vega-Lite 래퍼)는 v0.7.16 기준 `@canary` 태그로만 배포됩니다.
카나리 빌드는 어느 두 버전 사이에서든 깨질 수 있다고 각 README가 경고하므로, 써 본다면 정확한 버전을 고정해야 합니다.

### Astryx는 Tailwind와 함께 쓸 수 있나요?

쓸 수 있습니다.
README는 `className`으로 Tailwind를 써서 스타일을 재정의할 수 있다고 적고, CLI의 principles 문서는 커스텀 스타일링에서 StyleX와 Tailwind를 둘 다 일급으로 다룬다고 밝힙니다.
저장소에는 `example-vite-tailwind`와 `example-nextjs-tailwind` 예제 앱도 있습니다.

### Astryx로 모바일 네이티브 앱을 만들 수 있나요?

v0.7.16 기준으로는 아닙니다.
`@astryxdesign/native`는 실험 패키지이고, README가 운영 앱에는 지원하지 않는다고 명시합니다.
웹에서는 v0.6.0과 v0.7.0이 바텀 시트, 스와이프, 터치 크기 같은 모바일 웹 경험을 많이 다듬었습니다.

## 정리

- Astryx는 Meta 사내에서 8년 동안 자란 디자인 시스템을 오픈소스 스택 위에 다시 만들어 2026년 6월 18일에 베타로 공개한 React 디자인 시스템입니다.
- 차별점은 네 가지입니다. 내부 구조를 열어 두고, 스타일링 도구를 강요하지 않고, 감싸지 않고 테마로 바꾸게 하고, 사람과 AI 에이전트가 같은 자료로 만들게 합니다.
- 원칙도 네 가지입니다. 강제보다 안내, 강하고 문서화된 관례, 사람과 AI를 위한 하나의 시스템, 측정으로 검증.
- 안정 패키지는 `core`, `cli`, `build`, `theme-*` 7종, `richtext`이고 같은 버전으로 함께 나옵니다. `charts`, `vega`, `native`, `lab`은 실험 영역입니다.
- v0.5.0, v0.6.0, v0.7.0 모두 호환성을 깨는 변경과 그것을 옮겨 주는 코드모드를 함께 냈습니다.
- React 19 이상, 비교적 최신 브라우저, 잦은 업그레이드를 감당할 수 있는 팀에게 맞습니다. 그 조건이 안 되면 1.0을 기다리는 것도 합리적인 선택입니다.

## 참고

모두 `meta/astryx` 저장소의 `main` 브랜치 파일입니다.

- [README.md](https://github.com/meta/astryx/blob/main/README.md), [packages/README.md](https://github.com/meta/astryx/blob/main/packages/README.md)
- [core/README.md](https://github.com/meta/astryx/blob/main/packages/core/README.md), [core/package.json](https://github.com/meta/astryx/blob/main/packages/core/package.json), [cli/package.json](https://github.com/meta/astryx/blob/main/packages/cli/package.json), [build/README.md](https://github.com/meta/astryx/blob/main/packages/build/README.md), [themes/README.md](https://github.com/meta/astryx/blob/main/packages/themes/README.md)
- [lab/README.md](https://github.com/meta/astryx/blob/main/packages/lab/README.md), [charts/README.md](https://github.com/meta/astryx/blob/main/packages/charts/README.md), [vega/README.md](https://github.com/meta/astryx/blob/main/packages/vega/README.md), [native/README.md](https://github.com/meta/astryx/blob/main/packages/native/README.md), [richtext/README.md](https://github.com/meta/astryx/blob/main/packages/richtext/README.md)
- [principles.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/principles.doc.mjs), [browser-support.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/browser-support.doc.mjs), [versioning.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/versioning.doc.mjs)
- [docs/README.md](https://github.com/meta/astryx/blob/main/docs/README.md), [docs/release.md](https://github.com/meta/astryx/blob/main/docs/release.md)
- 공식 블로그: [introducing-astryx](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/introducing-astryx.md), [how-astryx-works](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/how-astryx-works.md), [astryx-v0-1-3](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/astryx-v0-1-3.md), [the-astryx-cli](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/the-astryx-cli.md), [one-month-of-astryx](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/one-month-of-astryx.md), [vibe-tests](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/vibe-tests.md), [who-needs-a-figma-library](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/who-needs-a-figma-library.md), [astryx-v0-5-0](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/astryx-v0-5-0.md), [astryx-v0-6-0](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/astryx-v0-6-0.md), [astryx-v0-7-0](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/astryx-v0-7-0.md), [introducing-astryx-richtext](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/introducing-astryx-richtext.md), [astryx-meetup-are-design-systems-still-valuable](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/astryx-meetup-are-design-systems-still-valuable.md), [astryx-is-now-available-in-v0](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/astryx-is-now-available-in-v0.md)
- 문서 사이트 [astryx.atmeta.com](https://astryx.atmeta.com), 저장소 [github.com/meta/astryx](https://github.com/meta/astryx)
