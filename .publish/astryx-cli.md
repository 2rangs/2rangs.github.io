
> **참고** 이 글은 "Meta Astryx 완전 가이드" 10부작의 7편입니다. Astryx v0.7.16(2026년 11월) 공식 저장소의 문서와 소스를 읽고 정리했습니다. Astryx는 베타라서 이후 버전에서 달라질 수 있습니다.

Button에 작은 사이즈가 있었는지 기억이 나지 않습니다.
문서 사이트 탭을 열고, 검색하고, props 표까지 내려갑니다.
그런데 그 사이트는 최신 버전 기준이고, 내 프로젝트는 두 버전 전에 머물러 있습니다.
표에 있는 prop을 썼더니 타입 에러가 납니다.

디자인 시스템을 쓰다 보면 "문서와 설치된 코드가 서로 다른 버전"인 상황을 자주 만납니다.
Meta가 공개한 오픈소스 React 디자인 시스템 Astryx는 이 문제를 터미널에서 풉니다.

```bash
astryx component Button --props
```

이 명령은 프로젝트에 설치된 버전의 문서를 읽어 답합니다.
웹 문서를 CLI가 옮겨 담은 구조가 아닙니다.
CLI가 원본이고 웹 문서가 이를 가져다 씁니다.

이 편은 그 CLI, `@astryxdesign/cli`를 처음부터 끝까지 다룹니다.

## 한눈에 보기

- Astryx CLI의 패키지 이름은 `@astryxdesign/cli`이고 실행 명령은 `astryx`입니다. Node.js 22.13.0 이상이 필요합니다.
- Astryx CLI는 문서의 원본입니다. 공식 블로그에 따르면 문서 사이트가 CLI의 내용을 가져다 쓰며, 반대가 아닙니다.
- Astryx CLI의 최상위 명령은 `init`, `search`, `component`, `hook`, `docs`, `blog`, `build`, `template`, `theme`, `swizzle`, `upgrade`, `doctor`, `discover`, `gap-report`, `integration`, `mcp`, `experimental`이고, 여기에 CLI 자신을 설명하는 `manifest`가 있습니다.
- Astryx CLI를 전역으로 설치해도 프로젝트 안에서는 그 프로젝트가 설치한 버전이 답합니다. 전역 설치는 프로젝트의 버전을 바꾸지 않습니다.
- Astryx CLI의 `--json` 출력은 `{apiVersion, type, data, meta}` 봉투 하나이고, 실패하면 `{apiVersion, error, code}`입니다. `code`는 한번 배포되면 뜻이 바뀌지도 지워지지도 않습니다.
- `astryx doctor`는 실패한 검사가 하나라도 있으면 종료 코드 1, 경고만 있으면 0으로 끝납니다. 그래서 CI 단계로 그대로 쓸 수 있습니다.
- `astryx upgrade`는 패키지 버전을 올리는 명령이 아닙니다. 패키지를 올린 뒤에 내 코드를 코드모드(codemod)로 고치는 명령이고, `--apply`를 붙이기 전에는 아무것도 쓰지 않습니다.
- Astryx CLI는 스스로 업데이트하지 않습니다. 새 버전이 나오면 하루에 한 번 이내로 알려 주기만 합니다.

## CLI가 디자인 시스템의 일부인 이유

보통 디자인 시스템의 CLI는 프로젝트를 만들 때 한 번 쓰는 스캐폴딩 도구입니다.
Astryx는 다릅니다.
CLI README의 첫 문장은 CLI를 "디자인 시스템을 다루는 주된 인터페이스"라고 소개합니다.
컴포넌트 문서, 디자인 토큰, 페이지 템플릿, 테마 도구, 업그레이드 코드모드가 모두 CLI를 통해 나옵니다.

공식 블로그 글 "The best CLI is one you never run"(2026-07-10)은 한 걸음 더 나갑니다.
"CLI가 곧 문서"라고 정하고, 모든 문서·예제·참고 자료가 CLI에서 시작한다고 씁니다.
문서 사이트는 CLI의 소비자입니다.
사본이 하나뿐이니 서로 어긋날 일이 없다는 것이 이 결정의 요지입니다.

글 제목이 "한 번도 직접 실행하지 않는 CLI가 가장 좋은 CLI"인 이유도 여기에 있습니다.
실행하는 쪽이 사람이 아니라 코딩 에이전트이기 때문입니다.
설계 문서 `docs/architecture/cli-surface.md`는 이 점을 더 분명하게 적습니다.
CLI의 호출자는 서브프로세스로 CLI를 실행하는 에이전트 하나이고, 터미널 앞의 사람은 "지원되는 독자"입니다.

이 전제에서 CLI의 성격이 대부분 정해집니다.

- **질문하지 않습니다.** 프롬프트도, 확인 창도, 터미널인지 감지하는 코드도 없습니다. `astryx init`조차 대화형이 아닙니다. 끝낼 수 없는 명령은 에러 코드와 다음 행동 제안을 돌려줍니다.
- **출력은 데이터가 먼저입니다.** `--json`이 원본이고, 사람이 읽는 글자 출력은 같은 값을 다시 그린 것입니다.
- **명령을 쉽게 늘리지 않습니다.** 기여자 문서는 새 최상위 명령에 네 가지 조건을 겁니다. 에이전트가 실제로 가진 질문에 답할 것, 기존 명령을 깊게 만들어서는 답할 수 없을 것, 한 가지 일만 할 것(요약에 "그리고"가 들어가면 명령 두 개), 결과가 데이터로 돌려줄 만할 것. 하나라도 어기면 보통 옵션이나 문서 주제가 됩니다.

사람에게도 손해는 없습니다.
에이전트가 헷갈리지 않는 출력은 `grep`하기에도 좋습니다.

## 설치: 프로젝트, 전역, 둘 다

### 한 번만 실행해 보기

설치하지 않고도 패키지 이름을 그대로 써서 실행할 수 있습니다.

```bash
npx @astryxdesign/cli --help
npx @astryxdesign/cli search button
npx @astryxdesign/cli docs tokens
```

여기서 주의할 점이 하나 있습니다.
CLI를 설치하기 전에 `npx astryx`처럼 스코프 없는 이름으로 실행하면 안 됩니다.
README는 npm에서 `astryx`라는 이름이 관계없는 다른 패키지로 연결된다고 경고합니다.
설치 전에는 항상 `@astryxdesign/cli`라고 씁니다.

### 프로젝트에 설치하기

```bash
npm install -D @astryxdesign/cli
```

프로젝트 의존성이 되면 패키지 매니저의 실행기로 짧은 이름을 쓸 수 있습니다.
예를 들면 `pnpm exec astryx component Button`입니다.
버전이 `package.json`과 잠금 파일에 고정되므로 팀원과 CI가 같은 버전을 실행합니다.

### 전역으로 설치하기

```bash
npm i -g @astryxdesign/cli
```

이제 어느 폴더에서나 `astryx`가 동작합니다.
프로젝트가 아직 없는 빈 폴더에서도 컴포넌트와 문서를 읽을 수 있습니다.
공식 문서는 이것을 전역 모드(global mode)라고 부릅니다.

### 셋 중 무엇을 고를까

공식 문서 `astryx docs global/project-global-or-both`의 권장은 "둘 다"입니다.

| 구성 | 얻는 것 | 치르는 값 | 맞는 경우 |
| --- | --- | --- | --- |
| 둘 다 | 프로젝트마다 고정된 버전, 어느 폴더에서나 문서·검색, 모든 에이전트용 안내서 | 설치 두 개를 관리 | 대부분의 사람 |
| 프로젝트만 | 저장소에 고정된 버전. 팀과 CI가 같다 | 프로젝트 밖에서는 `astryx` 명령이 없다 | CI 머신, 빌드 서버 |
| 전역만 | 어느 폴더에서나 문서·컴포넌트·검색 | 팀이 공유하는 고정 버전이 없다 | 프로토타입, 빠른 조회 |

### 전역으로 깔았는데 프로젝트 버전과 다르면

흔히 하는 걱정이 있습니다.
전역에는 0.7.2가 깔려 있고 프로젝트는 0.6.8을 쓰면 어느 쪽 문서가 나올까요.

답은 "프로젝트 안에서는 항상 프로젝트 쪽"입니다.

| 실행하는 곳 | 답하는 버전 |
| --- | --- |
| CLI를 설치한 프로젝트 안 | 프로젝트의 CLI. 전역 `astryx`를 쳐도 실행을 프로젝트의 CLI에 넘긴다 |
| Core만 설치한 프로젝트 안 | 내가 실행한 `astryx`. 하루에 한 번, CLI를 Core와 같은 버전으로 추가하라는 안내가 붙는다 |
| 프로젝트의 CLI가 설치돼 있지만 시작하지 못할 때 | 프로젝트의 Core와 같은 버전의 CLI. 사용자별 캐시에 한 번 설치해 재사용한다 |
| 프로젝트 밖 | 전역으로 설치한 버전 |

전역 명령이 프로젝트의 CLI에 실행을 넘길 때는 인자, 입력, 출력, 종료 코드를 그대로 전달합니다.
그래서 어느 명령으로 시작하든 같은 답이 나옵니다.

이렇게 만든 이유는 전역 모드 명세(AST-081)의 결정 기록에 적혀 있습니다.
한 번의 실행에 두 릴리스가 섞이면 **에러 없이 틀린 코드**가 나옵니다.
한 릴리스의 템플릿과 컴포넌트 문서에는 다른 릴리스의 Core에 없는 prop이 들어 있기 때문입니다.
그래서 "가장 최신 버전이 어디서나 답한다"는 안은 기각됐습니다.

누가 답했는지는 숨기지 않습니다.
글자 출력에서는 표준 에러에 한 줄이 찍힙니다.

```text
astryx: answered by this project's CLI 0.6.8, handed over from CLI 0.7.2
```

`--json`에서는 줄을 더 찍는 대신 모든 성공 응답의 `meta.answeredBy`에 담깁니다.
`cli`(답한 CLI 버전), `core`(짝이 된 Core 버전 또는 `null`), `copy`(어느 사본이 답했는지)입니다.
`copy` 값은 `project`, `starting`, `matched`, `carried`, `fallback` 다섯 가지입니다.

## 명령 전체 표

README의 Commands 절과 각 명령의 문서 파일을 기준으로 정리한 표입니다(v0.7.16 릴리스 무렵의 main 브랜치 기준).
오른쪽 열은 프로젝트 밖에서 실행했을 때의 동작입니다.
`same`은 새 프로젝트에서와 같은 답, `refuse`는 아무것도 쓰지 않고 실패, `own`은 다른 일을 한다는 뜻입니다.
모든 명령이 이 값을 문서에 선언하고, 테스트가 빈 폴더에서 실제로 실행해 선언과 맞는지 확인합니다.

| 명령 | 하는 일 | 프로젝트 밖 |
| --- | --- | --- |
| `init` | 프로젝트에 디자인 시스템을 초기화한다(에이전트 문서 블록 작성) | `own` |
| `search` | 컴포넌트·훅·문서·템플릿·테마를 순위가 매겨진 한 목록으로 검색한다 | `same` |
| `component` | 컴포넌트 목록을 보거나 컴포넌트 문서를 출력한다 | `same` |
| `hook` | 훅 목록을 보거나 훅 문서를 출력한다 | `same` |
| `docs` | 참고 문서를 출력한다 | `same` |
| `blog` | 공개된 피드에서 Astryx 블로그를 읽는다 | `same` |
| `build` | 페이지를 만들 때 시작할 템플릿을 고른다. 질의가 없으면 작업 순서(플레이북)를 준다 | `same` |
| `template` | 페이지·블록 템플릿을 나열하고, 보고, 프로젝트에 복사한다 | `same` |
| `theme` | 테마를 추가·전환·빌드·작성한다 | 하위 명령마다 다름 |
| `swizzle` | 컴포넌트 소스를 프로젝트로 복사한다 | `refuse` |
| `upgrade` | Astryx를 올린 뒤 내 코드를 고치고, ShadCN 방식으로 복사한 컴포넌트를 새로 고친다 | `own` |
| `doctor` | 프로젝트와 통합 패키지를 진단한다 | `own` |
| `discover` | 통합(integration)을 둘러보고 검색한다 | `same` |
| `gap-report` | 빠진 컴포넌트나 기능을 그것을 소유한 패키지에 알린다 | `same` |
| `integration` | 통합 패키지를 작성하고 검증한다 | 하위 명령마다 다름 |
| `mcp` | 명령을 실행할 수 없는 AI 도구를 위해 모든 명령을 MCP 도구로 제공한다 | `same` |
| `experimental` | 패치 릴리스에서도 바뀔 수 있는 실험 기능(아이콘 세트, 페이지 렌더링, 테마 편집) | 하위 명령마다 다름 |
| `manifest` | CLI의 전체 명령·옵션·응답 타입을 JSON으로 출력한다 | `same` |

아이콘 관련 기능은 최상위 `icon` 명령이 아니라 `astryx experimental icon` 아래에 있습니다.

### 명령별 쓰임과 대표 옵션

**찾고 읽는 명령**

- `astryx component Button`: 컴포넌트 문서를 출력합니다. `--props`(props 목록만), `--source`(소스), `--showcase`(쇼케이스 소스), `--blocks`(예제 블록 목록), `--category <그룹>`, `--package <패키지>`가 있습니다. `astryx component Button Badge Text`처럼 여러 개를 주면 순서대로 한 묶음으로 답하고, 최대 100개까지 받습니다.
- `astryx hook useFocusTrap`: 훅 문서를 출력합니다. `--list`, `--category`, `--params`(매개변수 표만)가 있습니다.

**만드는 명령**

- `astryx init`: 대화형이 아닙니다. 기본 동작은 에이전트 문서 블록을 `AGENTS.md`와 프로젝트의 Claude Code 파일에 쓰고 시작 단계를 출력하는 것입니다. `--features <목록>`(agents, theme, template), `--all`, `--agent <도구>`, `--agent-docs-path <경로...>`, `--remove-agents`, `--user`가 있습니다. 설치 절차는 [Astryx 설치와 첫 화면](/blog/astryx-getting-started/)에서, 에이전트 문서는 8편에서 다룹니다.
- `astryx build "analytics dashboard"`: 시작할 페이지 템플릿 하나와 그다음 후보 둘, 끼워 넣을 블록과 컴포넌트·훅을 알려 줍니다. `--type`, `--limit`(기본 60), `--verbose`가 있습니다. 공식 블로그에 따르면 네트워크 호출도 모델도 없는 순위 알고리즘이라 같은 질의에는 같은 결과가 나옵니다.
- `astryx template dashboard ./src/app`: 템플릿을 프로젝트에 복사합니다. 경로를 빼면 소스를 출력합니다. `--list`, `--type <page|block>`, `--package`, `--skeleton`(레이아웃 뼈대만), `--cdn [path]`(빌드 단계 없는 CDN 시작 페이지), `-f, --overwrite`가 있습니다. 템플릿 자체는 [Astryx 레이아웃과 템플릿](/blog/astryx-layout-templates/)에서 다뤘습니다.

**내 것으로 만드는 명령**

- `astryx theme`: 하위 명령은 `build`, `list`, `add`, `remove`, `use`, `eject`, `template`, `palette`, `targets`입니다. 자세한 내용은 [Astryx 테마와 디자인 토큰](/blog/astryx-theme-tokens/)에 있습니다.
- `astryx swizzle Button`: 컴포넌트 소스를 `--output <dir>`(기본 `./components/astryx`)에 복사합니다. `--list`, `--package`, `-f, --overwrite`가 있습니다. 언제 쓰는지는 [Astryx 스타일링](/blog/astryx-styling-tailwind-swizzle/)에서 다뤘습니다.

나머지 `search`, `docs`, `doctor`, `upgrade`, `discover`, `gap-report`는 아래에서 절을 따로 두고 봅니다.

### 전역 옵션

| 옵션 | 뜻 |
| --- | --- |
| `--json` | 타입이 붙은 JSON 봉투로 출력한다. `astryx theme`처럼 하위 명령만 묶는 그룹을 뺀 모든 명령이 지원한다 |
| `--detail <level>` | `component`, `hook`, 문서 트리 읽기의 자세함. `brief` < `compact` < `full` |
| `--dense` | `astryx component <Name>`과 `astryx docs <topic>`을 토큰을 아끼는 압축 글로 출력한다 |
| `--zh` | 번역이 있는 컴포넌트와 문서를 중국어 간체로 출력한다(없으면 영어) |
| `--lang <locale>` | `en`(기본), `zh`, `dense` 중 하나 |
| `--base <package>` | 실행의 기반 패키지를 고른다. 기본은 Core |

한국어 번역은 v0.7.16 기준 선택지에 없습니다.
`--dense`가 "언어"로 분류되는 점이 눈에 띕니다. 사람이 아니라 에이전트를 위한 표기라는 뜻입니다.

## `astryx search`로 찾기

필요한 것이 컴포넌트인지, 훅인지, 문서 주제인지, 템플릿인지 모를 때 쓰는 명령입니다.
모든 영역을 한 번에 찾습니다.

```bash
astryx search button
astryx search dark mode --type doc
astryx search "data table" --type template --json
```

여러 단어는 따옴표 없이 써도 됩니다.
결과는 관련도순입니다.
키워드 일치와 퍼지 매칭으로 점수를 매기므로 오타가 있어도 찾고, 질의가 어떤 항목의 정확한 이름이면 그 항목이 맨 위에 옵니다.

결과 한 줄에는 영역 꼬리표(`[component]`, `[hook]`, `[template]` 등)와 설명, 그리고 **다음에 실행할 명령**이 붙습니다.

```text
  [component]  Button
               Button triggers an action when clicked. Use it for form submissions…
               → astryx component Button
```

이 "다음 명령"은 방금 답한 릴리스가 다시 답하도록 만들어집니다.
프로젝트의 CLI가 답했으면 `pnpm exec astryx …` 같은 프로젝트 실행기로, 프로젝트 밖에서 전역 설치가 답했으면 `astryx …`로 시작합니다.
출력된 명령을 그대로 복사해 실행해도 버전이 바뀌지 않게 하려는 장치입니다.

옵션은 네 가지입니다.

- `--type <component|hook|doc|template|theme>`: 한 영역만 찾습니다.
- `--limit <n>`: 결과 수 상한(기본 20).
- `--verbose`: 점수와 일치 이유, 설명 전체를 함께 출력합니다.
- `--json`: `{query, matchCount, results}`를 담은 봉투. `matchCount`는 전체 일치 수이고 `results`는 `--limit`이 허용한 만큼입니다.

결과가 0건이어도 종료 코드는 0입니다.
"못 찾았다"는 실패가 아니라 답이기 때문입니다.

`search`는 설치된 내용만 다룹니다.
아직 설치하지 않은 패키지에 무엇이 있는지는 뒤에 나오는 `discover`의 일입니다.

## `astryx docs`와 문서 트리

`astryx docs`는 참고 문서를 읽는 명령입니다.
인자에 따라 동작이 달라집니다.

| 명령 | 출력 |
| --- | --- |
| `astryx docs` | 모든 주제 목록 |
| `astryx docs theme` | 주제 전체. 전체 글이 16KB를 넘으면 절 목록을 대신 보여 준다 |
| `astryx docs theme --index` | 주제의 절과 그 키 |
| `astryx docs theme --full` | 크기와 상관없이 주제 전체 |
| `astryx docs theme quick-start` | 절 하나 |
| `astryx docs cli` | 문서 트리의 한 노드와 바로 아래 항목 |
| `astryx docs cli --depth all` | 그 아래 전부를 한 줄씩 |

16KB라는 기준에는 이유가 있습니다.
탐색 가능한 출력 명세(AST-047)는 그 크기까지는 통째로 읽어도 절 목록을 거쳐 읽는 것보다 비용이 크지 않다고 설명합니다.
읽는 쪽은 처음 받은 출력을 보고 바로 움직이기 때문입니다.
이 명세는 글을 쓴 시점에 초안(draft)이고 구현 중이라 세부 동작은 달라질 수 있습니다.

`tokens`, `theme`, `color`, `spacing`, `principles` 같은 단일 주제 외에 경로로 여는 트리가 있습니다.
CLI 자신을 설명하는 문서가 여기 들어 있습니다.

```text
cli                      CLI 문서의 꼭대기 (가이드 + 레퍼런스)
├─ cli/commands          모든 명령과 하위 명령
│   └─ cli/commands/build
└─ cli/api               프로그래밍 API
    ├─ cli/api/functions     예: cli/api/functions/search
    ├─ cli/api/schemas
    └─ cli/api/enums
global                   전역 모드 (project-global-or-both, who-answers, updates, uninstall …)
authoring                통합 패키지를 만드는 가이드
migration                Tailwind·shadcn·Radix 앱을 옮기는 가이드
```

상위 문서는 자식 목록을 직접 적지 않습니다.
가이드가 자기 위치를 스스로 선언하고, `commands`와 `api`는 해당 그룹의 문서를 자동으로 받아들입니다.
그래서 명령이 하나 늘어도 목록 파일을 고칠 필요가 없고, 통합 패키지의 문서도 같은 트리에 들어옵니다.

다음에 읽을 곳도 출력에 들어 있습니다.
JSON 응답의 `links`에 `up`, `previous`, `next`가 명령 문자열로 담깁니다.
경로를 외우지 않아도 검색으로 들어간 뒤 옆이나 위 문서로 옮겨 갈 수 있습니다.

명령 하나의 인자와 옵션은 `astryx <command> --help`로, CLI 전체의 명령·옵션·응답 타입은 `astryx manifest --json`으로 볼 수 있습니다.
도움말, README의 표, 매니페스트는 모두 명령마다 있는 문서 파일 하나에서 생성됩니다.

## `astryx doctor`: 검사 항목과 CI 게이트

`astryx doctor`는 프로젝트와 환경을 점검합니다.
프로젝트의 파일은 아무것도 바꾸지 않습니다.

```text
$ astryx doctor
astryx doctor
Each check: status, id, label, message, fix

[ok]    node-version - Node.js version - Node v24.18.1 meets the minimum (>=22.13.0).
[warn]  themes - Theme packages - No @astryxdesign/theme-* packages are installed. - fix: Install a theme, …

summary
pass: 4, warn: 2, fail: 0, info: 2
```

검사 한 줄은 상태(`[ok]`, `[warn]`, `[fail]`, `[info]`), id, 이름, 메시지, 그리고 고치는 방법(`fix`)으로 이루어집니다.
경고와 실패에는 `fix`가 항상 붙습니다.

README가 꼽는 검사 항목은 다음과 같습니다.

| 검사 | 나올 수 있는 상태 | 확인하는 것 |
| --- | --- | --- |
| Node.js 버전 | pass / fail | 실행 중인 Node가 CLI의 최소 버전을 만족하는가 |
| `@astryxdesign/core` 설치 | pass / fail | 프로젝트에서 Core를 찾을 수 있는가 |
| 버전 정렬 | pass / warn / info | 설치된 Core와 CLI의 버전이 맞는가 |
| 테마 패키지 | pass / warn | `@astryxdesign/theme-*`가 설치되고 테마가 연결됐는가 |
| `astryx.config` | pass / fail / info | 설정 파일이 있다면 올바른 형태로 읽히는가 |
| AI 에이전트 문서 | pass / warn / info | 에이전트 문서가 있고 Astryx 구역 표시가 들어 있는가 |
| peer 의존성 | pass / warn / info | Core의 peer 의존성(react 등)이 설치됐는가 |
| 패키지 매니저 | info / warn / fail | 어떤 패키지 매니저를 쓰는지, 근거가 모호하거나 모순되는지 |

명령 문서는 이 밖에도 통합 패키지가 모두 읽히는지, 컴퓨터가 알고 있는 최신 릴리스(`newest-release`), 검색 경로에 있는 모든 `astryx` 명령(`cli-on-path`)을 본다고 적습니다.

프로젝트 밖에서 실행하면 폴더 대신 **컴퓨터**를 점검합니다.
Node 버전, 답한 릴리스, 최신 릴리스, 경로상의 `astryx` 명령들, 전역으로 설치한 통합, 컴퓨터 단위 에이전트 안내서입니다.
프로젝트가 없다는 이유로 검사를 실패시키지는 않습니다.

`--built <path>` 옵션은 배포 전 산출물을 검사합니다.
프로젝트 폴더, 빌드 출력 폴더, 빌드된 HTML 파일 하나를 줄 수 있습니다.
Astryx를 전혀 쓰지 않으면 실패하고, 소스에 HTML 요소나 아이콘을 직접 쓴 곳, 스타일을 직접 지정한 곳이 있으면 하나씩 경고합니다.

### CI 게이트로 쓰기

README의 표현대로 "종료 코드가 계약"입니다.
실패가 없으면 0(경고는 괜찮음), 실패가 하나라도 있으면 1입니다.

```yaml
- run: npx @astryxdesign/cli doctor
```

"경고가 있으면 CI가 실패하지 않을까" 걱정할 수 있지만 그렇지 않습니다.
설계 문서의 규칙(INV32)은 `--strict`를 붙였을 때만 경고가 명령을 실패시킨다고 정합니다.
경고 하나 때문에 잘 통과하던 빌드가 깨지지 않게 하려는 것입니다.
v0.7.16 기준으로 `--strict`를 제공하는 명령은 통합 패키지용인 `astryx integration check` 하나입니다.

종료 코드는 `--json`을 붙이든 말든 같습니다.
그래서 게이트로 쓸 때 표준 출력을 파싱할 필요가 없습니다.
스크립트가 내용을 읽어야 하면 `astryx doctor --json`으로 `{checks, summary}`를 받습니다.

## `astryx upgrade`와 코드모드

### 무엇을 하는 명령인가

이름 때문에 오해하기 쉬운 명령입니다.
`astryx upgrade`는 **패키지 버전을 올리지 않습니다.**
명령 문서의 요약은 "Astryx를 업그레이드한 **뒤에** 내 코드를 갱신한다"입니다.

순서는 이렇습니다.

1. 패키지 매니저로 Core와 CLI를 같은 새 버전으로 올린다.
2. `astryx upgrade --from <이전 버전>`으로 무엇이 바뀔지 미리 본다.
3. `--apply`를 붙여 실제로 쓴다.

```bash
pnpm add @astryxdesign/core@0.7.3 @astryxdesign/cli@0.7.3
pnpm exec astryx upgrade --from 0.7.1          # 미리 보기
pnpm exec astryx upgrade --from 0.7.1 --apply  # 쓰기
```

`--from`은 올리기 전에 쓰던 버전이고, 목표는 지금 설치된 Core의 버전입니다.
그 사이 버전들에 등록된 코드모드가 차례로 실행됩니다.
코드모드는 소스 코드를 구문 단위로 읽어 고치는 변환 스크립트이고, Astryx는 jscodeshift를 씁니다.

CLI가 프로젝트의 버전을 직접 바꾸지 않는 것은 의도한 설계입니다.
전역 모드 명세는 "프로젝트의 버전은 그 주인의 것"이라는 이유로, 어떤 실행 경로도 프로젝트에 무언가를 설치하지 않는다고 정했습니다.

### 대표 옵션

| 옵션 | 뜻 |
| --- | --- |
| `--from <version>` | 의존성을 올리기 전 버전. `--list`나 `--registry`가 아니면 필수 |
| `--apply` | 디스크에 쓴다. 없으면 미리 보기(dry run) |
| `--list` | 쓸 수 있는 코드모드를 나열하기만 한다 |
| `--codemod <name>` | 이름을 준 코드모드만 실행한다. 선택적(optional) 코드모드는 이렇게 이름을 줘야 돈다 |
| `--skip-codemod <name...>` | 이름을 준 코드모드를 뺀다. 실패한 코드모드를 건너뛰고 다시 돌릴 때 쓴다 |
| `--integration <package>` | 통합 패키지를 명시한다(반복 가능) |
| `--path <dir>` | 훑을 소스 디렉터리. 기본은 프로젝트 루트의 `./src` |
| `--registry` | ShadCN 방식으로 복사한 컴포지션만 설치 영수증을 기준으로 갱신한다 |

### 건드리지 않는 파일

코드모드는 프로젝트가 생성물, 벤더 코드, 무시 대상으로 표시한 파일에 쓰지 않습니다.

- `.gitattributes`가 `linguist-generated`나 `linguist-vendored`로 표시한 파일
- 맨 앞 주석에 `@generated`, `@partially-generated`, `Code generated ... DO NOT EDIT.`가 있는 파일
- `.gitignore`나 프로젝트 루트의 `.hgignore`가 제외한 파일
- `node_modules` 같은 설치된 의존성, `.git` 안, 심볼릭 링크, 프로젝트 밖의 파일

`dist`나 `generated` 같은 폴더 이름만으로는 보호되지 않습니다. 표시가 있어야 합니다.

보호된 파일에 변경이 필요하면 그 변경은 메모리에서만 만들고 파일은 그대로 둡니다.
나머지 파일은 정상적으로 고칩니다.
보호된 파일이 고쳐지지 않은 채 남으면 실행은 미완료로 끝납니다.
종료 코드 1과 `ERR_CODEMOD_PROTECTED`가 나오고, 어떤 파일이 어떤 규칙으로 보호됐는지 알려 줍니다.
생성 파일을 다시 만든 뒤 같은 명령을 다시 돌리면 됩니다.

### CLI가 Core보다 오래됐을 때

Core 코드모드는 CLI 안에 들어 있습니다.
그래서 CLI가 설치된 Core보다 오래되면, CLI에는 자기 버전 이후 릴리스의 코드모드가 없습니다.
이때 `upgrade`는 "최신 상태"라고 보고하지 않습니다.
끝낼 수 없다고 말하고, Core와 같은 버전의 CLI로 같은 업그레이드를 실행하는 명령을 출력합니다.
Core와 CLI를 늘 같은 버전으로 함께 올려야 하는 이유입니다.

## 설정 파일 `astryx.config`

CLI는 프로젝트 루트(`package.json` 옆)의 `astryx.config.{ts,mjs,js}`를 읽습니다.
파일이 없어도 되고, 모든 필드가 선택입니다.
팩토리 함수 없이 평범한 객체를 내보냅니다.

```ts
import type {AstryxConfig} from '@astryxdesign/cli/authoring';

export default {
  integrations: ['@acme/astryx-widgets'],
  issuesUrl: 'https://github.com/your-org/your-repo/issues',
  hooks: {
    postCodemod: [
      {
        name: 'format',
        // upgrade가 파일을 바꾼 뒤 실행할 명령을 돌려준다. null이면 건너뛴다.
        buildCommand: ({files}) =>
          files.length > 0
            ? {command: 'npx', args: ['prettier', '--write', ...files]}
            : null,
      },
    ],
  },
} satisfies AstryxConfig;
```

이 밖에 모든 명령 실행을 기록하는 `debug`, `gap-report`를 프로젝트가 직접 처리하는 `gapReport`, 추가할 수 있는 통합 목록을 돌려주는 `discover`, 실험 기능용 `experimental` 필드가 있습니다.

스키마는 **엄격합니다**.
모르는 키나 오타가 있으면 파일 전체가 무효가 됩니다.
그런데 무효일 때의 반응이 명령마다 다릅니다.
`gap-report`, `discover`, `upgrade`는 에러로 멈추고 `doctor`는 `config` 검사를 실패시키지만, `component`, `docs`, `search`, `template`, `theme` 같은 읽기 명령은 설정이 없는 것처럼 조용히 계속합니다.
공식 문서가 설정을 고친 뒤 `astryx doctor`를 돌리라고 하는 이유입니다.

또 설정 파일을 읽으면 그 파일의 코드가 실행된다는 점도 알아 둡니다.

## JSON API와 에러 코드

### 봉투 하나

`--json`을 붙이면 표준 출력에는 JSON 봉투 하나만 나옵니다.

```json
{"apiVersion": 1, "type": "component.detail", "data": {"name": "Button", ...}, "meta": {"answeredBy": {"cli": "0.7.2", "core": "0.7.2", "copy": "project"}}}
```

`type`은 응답의 종류를 가르는 구분자입니다.
`component.list`, `component.detail.props`, `docs.detail`, `search`, `doctor`, `upgrade.run` 같은 값이 있고, 전체 목록은 `astryx manifest --json`에 명령별로 실려 있습니다.

실패는 모양이 다릅니다.

```json
{
  "apiVersion": 1,
  "error": "No component named \"Buttn\"",
  "code": "ERR_UNKNOWN_COMPONENT",
  "suggestions": [{"name": "Button", "reason": "similar name"}]
}
```

설계 문서는 이 두 가지 외의 "세 번째 모양"은 없다고 못 박습니다.
잡히지 않은 예외도 스택 트레이스 대신 봉투가 됩니다.

### `code`로 분기하고 `error`로 분기하지 않는다

`error`는 사람이 읽는 문장이라 문구가 언제든 바뀔 수 있습니다.
`code`는 계약입니다.
한번 배포된 코드는 뜻이 바뀌지 않고 지워지지도 않으며, 새 상황에는 새 코드를 추가합니다.

```ts
import {parseResponse, isError} from '@astryxdesign/cli/json';

const result = parseResponse(stdout);
if (isError(result)) {
  switch (result.code) {
    case 'ERR_UNKNOWN_COMPONENT':
      // result.suggestions에서 가장 가까운 이름을 제안한다
      break;
    case 'ERR_CORE_NOT_FOUND':
      // @astryxdesign/core 설치를 안내한다
      break;
    default:
      console.error(result.error);
  }
}
```

`ERR_UNKNOWN_COMPONENT`, `ERR_CORE_NOT_FOUND`, `ERR_FILE_EXISTS`, `ERR_PROJECT_REQUIRED`, `ERR_NODE_VERSION`처럼 이름만으로 상황을 알 수 있게 지어져 있고, 전체 표는 README의 Error codes 절에 있습니다. 그 표도 코드에서 생성됩니다.

### 사람용 출력과 기계용 출력을 나눈 이유

정확히는 둘로 나눈 것이 아니라 **하나를 두 방식으로 그린 것**입니다.
설계 문서의 규칙을 옮기면 이렇습니다.

- 글자 출력은 JSON의 투영이고, 정해진 포매터만 만들 수 있습니다. 명령이 문자열을 직접 찍을 수 없습니다.
- 글자 출력은 순수 ASCII입니다. 색도, 터미널 감지도, 폭에 맞춘 줄바꿈도 없습니다. 화면에 찍든 파이프로 넘기든 바이트 단위로 같습니다.
- 글자 출력의 필드 이름은 JSON 키와 일대일로 같습니다. 그래서 두 출력이 서로 어긋날 수 없고 모든 필드를 `grep`할 수 있습니다.
- 종료 코드는 출력 방식과 무관합니다.
- 경고는 표준 에러로 나가서 JSON 봉투를 오염시키지 않습니다.

이렇게 해 두면 문구는 마음껏 고치면서 계약은 지킬 수 있습니다.
사람을 위한 메시지를 다듬는 일이 스크립트를 깨뜨리지 않습니다.

## 프로그래밍 API

`astryx --json`을 움직이는 로직은 함수로도 가져다 쓸 수 있습니다.

```ts
import {component, docs, search, AstryxError} from '@astryxdesign/cli/api';

// astryx --json component Button 과 같은 결과
const btn = await component('Button');
btn.type;      // 'component.detail'
btn.data.name; // 'Button'

try {
  await component('Buttn');
} catch (e) {
  if (e instanceof AstryxError) {
    e.code;        // 'ERR_UNKNOWN_COMPONENT'
    e.suggestions; // [{ name: 'Button', reason: 'similar name' }]
  }
}
```

명령 승인 명세(AST-042)는 이를 규칙으로 정했습니다.
모든 명령은 `@astryxdesign/cli/api`가 내보내는 함수 하나를 감싼 얇은 층입니다.
명령이 하는 일은 인자 파싱, 함수 호출, 결과 출력뿐입니다.
그래서 CLI와 API가 같은 입력에 같은 데이터를 돌려줍니다.

서브프로세스로 CLI를 실행하는 쪽을 위해서는 `@astryxdesign/cli/json`이 `parseResponse`, `isError`, `assertResponse`와 응답 타입을 내보내고, 자기 도구 안에 CLI를 통째로 싣는 쪽을 위해서는 `@astryxdesign/cli/host`의 `runHostedCli`가 있습니다.

하나 알아 둘 차이가 있습니다.
프로그래밍 API는 내 프로세스 안에서, 내가 import한 패키지 버전으로 실행됩니다.
CLI처럼 프로젝트의 버전에 실행을 넘기지 않습니다.

## 통합과 `discover`로 외부 패키지 찾기

통합(integration)은 Astryx에 자기 컴포넌트, 템플릿, 테마, 문서, 코드모드를 보태는 npm 패키지입니다.
사내 디자인 시스템 패키지를 여러 앱에 나눠 쓰거나, 서드파티 컴포넌트 라이브러리를 배포할 때 씁니다.

파일 두 개로 동작합니다.

| 파일 | 쓰는 쪽 | 역할 |
| --- | --- | --- |
| `astryx.config.{ts,mjs,js}` | 앱 | 어떤 통합을 읽을지 |
| `astryx.integration.{ts,mjs,js}` | 패키지 작성자 | 패키지가 무엇을 보태는지 |

쓰는 쪽은 패키지를 설치하기만 하면 됩니다.
CLI가 선언된 의존성 가운데 `astryx.integration.*`을 가진 패키지를 찾아 자동으로 연결(autolink)합니다.
`astryx.config`의 `integrations`는 직접 의존성이 아닌 패키지를 읽게 하거나 통합을 명시적으로 고정할 때 씁니다.

설치하고 나면 통합이 보탠 항목이 Core의 항목과 함께 같은 명령에 나옵니다.
`astryx component --list`, `astryx template --list`, `astryx theme list`, `astryx docs`, `astryx search`가 모두 그렇습니다.
제대로 연결됐는지는 `astryx doctor`로 확인합니다.

`astryx discover`는 통합을 둘러보는 명령입니다.

```bash
astryx discover                         # 가진 것과 추가할 수 있는 것
astryx discover --type theme            # 테마를 보태는 패키지만
astryx discover @acme/ui                # 패키지 하나와 그 버전들
astryx discover dashboard --type template --available
```

옵션은 `--components`, `--type <kind>`(component, template, doc, theme, codemod, agent-doc), `--installed`, `--available`, `--limit <n>`(기본 20)입니다.
`--installed`와 `--available`은 함께 쓸 수 없습니다.

"추가할 수 있는 것"의 목록은 두 곳에서 옵니다.
하나는 CLI 릴리스에 들어 있는 공식 패키지 목록입니다. 실행 중에 내려받지 않으므로 오프라인과 빈 폴더에서도 동작합니다.
다른 하나는 소스(source)입니다. 프로젝트의 `astryx.config`나 통합 패키지가 제공하는, 카탈로그를 돌려주는 비동기 함수입니다.
한 소스가 실패하거나 30초를 넘겨도 다른 소스의 결과는 그대로 나옵니다.

`discover`는 **읽기만** 합니다.
설치하지 않은 패키지에 대해서는 추가하는 명령을 글자로 출력할 뿐 실행하지 않습니다.
`discover add` 같은 하위 명령은 설계 단계에서 기각됐습니다. 설치는 패키지 매니저의 일이라는 이유입니다.

## `gap-report`로 빠진 기능 알리기

필요한 변형(variant)이 없어서 컴포넌트를 통째로 복사해 고친 적이 있을 겁니다.
그 사실이 디자인 시스템 팀에 전달되지 않으면 같은 일이 다른 팀에서 반복됩니다.
`astryx gap-report`는 그 빈틈을 소유자에게 알리는 명령입니다.

```bash
astryx gap-report --list-categories
astryx gap-report Button --category missing_variant --reason 'Need a compact size'
```

보고에는 컴포넌트(또는 영역) 이름, `--category`, `--reason`이 필요합니다.
`--additional-context`로 설명을 덧붙일 수 있습니다.

누구에게 가는지는 정해진 순서로 고릅니다.
`--package`로 이름을 준 패키지, 없으면 그 컴포넌트를 대체하는 통합, 없으면 그 컴포넌트를 제공하는 유일한 패키지, 그래도 없으면 Core입니다.

가장 중요한 안전장치는 `--confirm-public`입니다.
이 옵션 없이는 **공개된 곳에 아무것도 보내지 않습니다.**
처리 핸들러가 없으면 소유 패키지의 GitHub 이슈로 올리는데, 이것도 `--confirm-public`이 있어야 하고 `gh` CLI의 로그인을 씁니다.
GitHub이 아닌 주소라면 호출자가 열어 볼 수 있게 주소만 돌려줍니다.

보낼 곳이 여럿이면 CLI는 목적지를 나열하고, 에이전트에게 사람에게 물어보라고 알립니다.
사람이 고른 곳은 `--to <package>`로 전달합니다.
에이전트가 목적지를 스스로 고르지 않는다는 것이 문서에 적힌 규칙입니다.
보고에는 에이전트가 실행했는지 사람이 실행했는지도 기록됩니다.

## 업데이트와 버전 정책

### 알리되 스스로 올리지 않는다

전역 설치는 하루에 한 번(설치 첫날은 제외) 레지스트리의 `latest` 버전을 백그라운드에서 확인합니다.
더 새 버전이 있으면 성공한 명령의 끝에 두 줄을 표준 에러로 출력합니다. 하루에 한 번까지입니다.

```text
A new release of Astryx is available: 0.7.2 → 0.7.3
To upgrade, run: npm i -g @astryxdesign/cli@latest
```

둘째 줄의 명령은 전역 설치에 쓴 패키지 매니저에 맞춰 나옵니다.
프로젝트 안에서는 프로젝트 버전에 대한 알림이 되고, 설치 명령과 `upgrade` 명령을 함께 알려 줍니다.

CLI는 자신도, 프로젝트도 스스로 업그레이드하지 않습니다.
명세는 이것이 `gh`나 Vercel CLI가 따르는 관례와 같다고 설명합니다.
백그라운드에서 새 릴리스로 갈아타는 안은 "사람이 고르지 않았는데 답하는 버전이 바뀐다"는 이유로 기각됐습니다.

한 가지는 관례와 다릅니다.
표준 에러가 터미널이 아니어도 알림을 출력합니다.
에이전트는 터미널 없이 CLI를 실행하므로, 터미널에만 알림을 찍으면 에이전트는 새 버전을 알 수 없습니다.

알림이 나오지 않는 경우는 네 가지입니다.
`--json`을 쓴 경우, 명령이 실패한 경우, `CI` 환경 변수가 설정된 경우, `NO_UPDATE_NOTIFIER`가 설정된 경우입니다.
뒤의 두 변수가 있으면 레지스트리 확인 자체를 하지 않습니다.

### 무엇이 언제 바뀔 수 있나

자료에서 확인한 범위로 정리합니다.

- Astryx는 0.x 단계이고, 릴리스 문서에 따르면 호환성을 깨는 변경은 마이너 릴리스에만 들어갑니다. 패치 릴리스는 그런 변경을 거부합니다.
- Core 코드모드는 그 변경이 처음 들어간 버전별로 묶여 CLI에 실립니다. 깨지는 변경에는 코드모드가 따라옵니다.
- 에러 코드는 추가만 됩니다.
- `astryx experimental` 아래의 명령은 예외입니다. 인자, 옵션, 출력이 예고 없이 어느 패치 릴리스에서든 바뀌거나 사라질 수 있습니다.
- CLI와 Core는 같은 버전으로 맞춥니다. 어긋나면 `astryx doctor`가 경고하고 맞추는 명령을 출력합니다.

## 제거 방법

전역 설치를 지울 때는 순서가 있습니다.
CLI가 아직 설치돼 있을 때 홈 폴더의 에이전트 안내서를 먼저 지웁니다.

```bash
astryx init --user --remove-agents
npm uninstall -g @astryxdesign/cli
```

프로젝트는 영향을 받지 않습니다. 각 프로젝트는 자기가 설치한 CLI를 그대로 가집니다.
프로젝트에서 에이전트 문서 블록을 지우려면 그 프로젝트에서 `astryx init --remove-agents`를 실행합니다.

CLI가 쓰는 폴더는 두 개이고, 지워도 다음 실행 때 필요한 것을 다시 만듭니다.

| 폴더 | Linux | macOS | Windows |
| --- | --- | --- | --- |
| 캐시(프로젝트용 버전, 저장된 discover 응답) | `~/.cache/astryx` | `~/Library/Caches/astryx` | `%LOCALAPPDATA%\astryx\Cache` |
| 설정(업데이트 확인, 에이전트 안내서 설정) | `~/.config/astryx` | `~/Library/Application Support/astryx` | `%APPDATA%\astryx` |

Linux에서는 `XDG_CACHE_HOME`과 `XDG_CONFIG_HOME`을 절대 경로로 설정하면 위치가 바뀝니다.
공식 문서는 Astryx가 자기만의 환경 변수를 읽지 않는다고 적습니다.

## CI와 컨테이너에서 쓰기

CI에서는 네 가지만 기억하면 됩니다.

1. **프로젝트에 고정한다.** `@astryxdesign/cli`를 `@astryxdesign/core`와 같은 버전의 devDependency로 추가합니다. 그러면 CI가 저장소에 고정된 버전을 실행하고 실행 중에 내려받는 것이 없습니다.
2. **`CI` 변수가 알림을 끈다.** 대부분의 CI 서비스는 `CI=true`를 설정합니다. 빈 값, `0`, `false`가 아닌 값이면 업데이트 확인도 알림도 없습니다.
3. **스크립트는 `--json`을 읽는다.** `--json` 출력에는 "누가 답했다"는 줄도, 업데이트 알림도 섞이지 않습니다.
4. **게이트는 종료 코드로 건다.** `astryx doctor`가 그 용도입니다.

프로젝트가 자기 CLI를 설치하고 의존성 설치를 먼저 한다면 캐시할 것이 없습니다.
CI 이미지에 전역으로 설치한 경우에는 사정이 다릅니다.
CI에서는 백그라운드로 아무것도 내려받지 않으므로, 컴포넌트를 읽는 첫 명령이 그 자리에서 Core를 받습니다.
매번 받지 않으려면 위 표의 캐시 폴더를 실행 사이에 보존합니다.

명령을 직접 실행할 수 없고 MCP(Model Context Protocol)로만 외부 도구를 쓰는 AI 도구를 위해서는 `astryx mcp`가 있습니다.
`--json`을 지원하는 명령 하나하나를 MCP 도구로 내놓는 서버이고, 자세한 내용은 8편 [Astryx는 왜 '에이전트 대응'인가](/blog/astryx-ai-agents/)에서 다룹니다.

## 한계와 주의점

- **베타입니다.** 명령과 옵션이 버전마다 달라질 수 있습니다. 실제로 2026년 7월의 공식 블로그 글은 `astryx layout`을 소개하지만, 이 글을 쓴 시점의 명령 표에는 그 명령이 없고 설정 문서는 "제거된 레이아웃 확장기"라고 적습니다.
- **Node.js 22.13.0 이상이 필요합니다.** 그보다 낮으면 `ERR_NODE_VERSION`으로 멈춥니다.
- **에이전트를 먼저 생각한 출력입니다.** 색이 없고 폭에 맞춘 줄바꿈도 없습니다. 화려한 터미널 UI를 기대하면 밋밋하게 느껴집니다.
- **Yarn Plug'n'Play 프로젝트에서는** 전역 명령이 프로젝트의 CLI를 보지 못해 내가 실행한 `astryx`가 답합니다. 문서는 `yarn astryx`로 프로젝트의 CLI를 직접 실행하라고 안내합니다.

## 자주 묻는 질문

### `npx astryx`라고 실행해도 되나요?

CLI를 설치하기 전에는 안 됩니다.
README에 따르면 npm에서 스코프 없는 `astryx`는 Astryx와 관계없는 다른 패키지입니다.
설치 전에는 `npx @astryxdesign/cli …`로 실행하고, 프로젝트에 설치한 뒤에는 `pnpm exec astryx …`처럼 패키지 매니저의 실행기를 씁니다.

### 전역으로 설치하면 프로젝트의 버전과 충돌하지 않나요?

충돌하지 않습니다.
프로젝트 안에서는 어떤 `astryx` 명령으로 시작하든 프로젝트의 CLI가 답하고, 전역 명령은 실행을 그쪽으로 넘깁니다.
전역 버전은 프로젝트 밖에서만 답합니다.
공식 문서는 프로젝트 설치와 전역 설치를 둘 다 하는 구성을 권장합니다.

### `astryx upgrade`가 패키지 버전을 올려 주나요?

아닙니다.
패키지는 패키지 매니저로 직접 올리고, `astryx upgrade --from <이전 버전>`은 그 뒤에 내 소스 코드를 코드모드로 고칩니다.
기본은 미리 보기이고 `--apply`를 붙여야 파일을 씁니다.

### `astryx doctor`에 경고가 있으면 CI가 실패하나요?

실패하지 않습니다.
`astryx doctor`는 실패한 검사가 있을 때만 종료 코드 1로 끝나고, 경고만 있으면 0입니다.
경고로 명령을 실패시키는 `--strict`는 v0.7.16 기준 `astryx integration check`에만 있습니다.

### 에러 메시지 문자열을 보고 분기해도 되나요?

안 됩니다.
`error` 문자열은 문구를 다듬으면서 언제든 바뀝니다.
`code` 필드로 분기해야 하고, 코드는 한번 배포되면 뜻이 바뀌지 않으며 지워지지 않습니다.
프로그래밍 API가 던지는 `AstryxError`에도 같은 `code`가 들어 있습니다.

### 통합 패키지를 설치했는데 그 패키지의 코드모드가 실행되지 않습니다.

설치만으로는 부족합니다.
통합 작성 문서에 따르면 `astryx upgrade`는 앱의 `astryx.config`에 있는 `integrations`에 그 패키지가 적혀 있거나 `--integration <패키지>`를 줬을 때만 통합의 코드모드를 실행합니다.
그렇지 않으면 경고 없이 건너뜁니다.
또 코드모드 폴더는 통합 패키지의 버전이 아니라 Core의 버전을 기준으로 실행됩니다.

## 정리

- Astryx에서 CLI는 문서의 원본이고, 호출자는 에이전트라는 전제로 설계됐습니다. 그래서 질문하지 않고, 출력은 데이터가 먼저입니다.
- 설치는 프로젝트와 전역 둘 다가 권장입니다. 프로젝트 안에서는 언제나 프로젝트의 버전이 답합니다.
- 모를 때는 `astryx search`, 읽을 때는 `astryx component`와 `astryx docs`, 점검은 `astryx doctor`, 버전을 올린 뒤에는 `astryx upgrade --from`입니다.
- 스크립트는 `--json`의 `type`과 `code`로 분기합니다. 글자 출력은 같은 데이터를 다시 그린 것이라 둘이 어긋나지 않습니다.
- 외부 패키지는 `astryx discover`로 찾고, 빠진 기능은 `astryx gap-report`로 알립니다. 둘 다 사람의 확인 없이 설치하거나 공개 게시하지 않습니다.
- CLI는 스스로 업데이트하지 않습니다. 알려 주기만 하고, 올리는 것은 사람이 패키지 매니저로 합니다.

## 참고

- [packages/cli/README.md](https://github.com/meta/astryx/blob/main/packages/cli/README.md)
- [packages/cli/package.json](https://github.com/meta/astryx/blob/main/packages/cli/package.json)
- [docs/architecture/cli-surface.md](https://github.com/meta/astryx/blob/main/docs/architecture/cli-surface.md)
- [docs/contributing/cli-conventions.md](https://github.com/meta/astryx/blob/main/docs/contributing/cli-conventions.md)
- [docs/release.md](https://github.com/meta/astryx/blob/main/docs/release.md)
- [docs/specs/AST-042-cli-command-admission/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-042-cli-command-admission/spec.md)
- [docs/specs/AST-047-navigable-output/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-047-navigable-output/spec.md)
- [docs/specs/AST-051-discover-integration-manager/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-051-discover-integration-manager/spec.md)
- [docs/specs/AST-081-global-mode/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-081-global-mode/spec.md)
- 공식 블로그: [the-astryx-cli.md](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/the-astryx-cli.md), [astryx-cli-build-command.md](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/astryx-cli-build-command.md)
- 명령 문서: [search](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/search.doc.mjs), [docs](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/docs.doc.mjs), [doctor](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/doctor.doc.mjs), [upgrade](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/upgrade.doc.mjs), [init](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/init.doc.mjs), [discover](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/discover.doc.mjs), [gap-report](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/gap-report.doc.mjs), [component](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/component.doc.mjs), [hook](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/hook.doc.mjs), [build](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/build.doc.mjs), [template](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/template.doc.mjs), [theme](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/theme.doc.mjs), [swizzle](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/swizzle.doc.mjs), [integration](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/integration.doc.mjs), [manifest](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/manifest.doc.mjs), [mcp](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/mcp.doc.mjs), [blog](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/blog.doc.mjs), [experimental](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/experimental.doc.mjs)
- 전역 모드 문서: [global](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/global.doc.mjs), [project-global-or-both](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/project-global-or-both.doc.mjs), [install-once](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/install-once.doc.mjs), [who-answers](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/who-answers.doc.mjs), [updates](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/updates.doc.mjs), [uninstall](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/uninstall.doc.mjs), [ci-and-containers](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/ci-and-containers.doc.mjs), [reference](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/reference.doc.mjs), [monorepos](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/monorepos.doc.mjs), [problems](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/problems.doc.mjs)
- 문서 트리: [cli](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/cli.doc.mjs), [commands](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/commands.doc.mjs), [api](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/api.doc.mjs), [migration](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/migration.doc.mjs)
- 설정과 통합: [config.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/authoring/config/config.doc.mjs), [config/type.ts](https://github.com/meta/astryx/blob/main/packages/cli/authoring/config/type.ts), [use-integrations](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/use-integrations.doc.mjs), [codemods](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/codemods.doc.mjs), [upgrading](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/upgrading.doc.mjs), [checks](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/checks.doc.mjs), [debug-and-gap-reports](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/debug-and-gap-reports.doc.mjs), [cli-command](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/cli-command.doc.mjs)
