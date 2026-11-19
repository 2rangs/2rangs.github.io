
> **참고** 이 글은 "Meta Astryx 완전 가이드" 10부작의 8편입니다. Astryx v0.7.16(2026년 11월) 공식 저장소의 문서와 소스를 읽고 정리했습니다. Astryx는 베타라서 이후 버전에서 달라질 수 있습니다.

AI 코딩 도구에게 "설정 페이지 하나 만들어 줘"라고 시켰습니다.
코드는 그럴듯합니다.
그런데 빌드해 보면 그 컴포넌트에 없는 prop이 들어가 있고, 임포트 경로는 두 버전 전의 것입니다.
레이아웃은 디자인 시스템 컴포넌트 대신 `<div style={{...}}>`로 채워져 있습니다.

모델의 능력이 모자라서가 아닙니다.
모델은 그 디자인 시스템의 "지금 설치된 버전"을 본 적이 없고, 그래서 가장 흔한 React 코드로 빈칸을 메웁니다.

Astryx는 Meta가 공개한 오픈소스 React 디자인 시스템이고(MIT, 베타), 공식 글에서 스스로를 "사람과, 사람 옆에서 만드는 에이전트를 위한" 시스템이라고 소개합니다.
이 글은 그 말이 저장소 안에서 구체적으로 어떤 파일과 명령으로 구현되어 있는지 따라가 봅니다.

## 한눈에 보기

- Astryx의 '에이전트 대응(agent ready)'은 기능 하나가 아니라 네 가지의 묶음입니다. 예측 가능한 API 규칙, CLI로 전달되는 문서, 에이전트 파일·스킬·MCP 같은 전달 경로, 그리고 결과를 재는 바이브 테스트(vibe tests)입니다.
- `astryx init`은 프로젝트의 `AGENTS.md`(그리고 이미 있는 Claude Code 파일)에 Astryx가 관리하는 블록 하나를 써 넣습니다. 블록에는 설치된 버전, 3단계 작업 순서, 실수 방지 규칙, CLI 빠른 참조가 들어갑니다.
- Astryx CLI의 모든 명령은 `--json`으로 타입이 붙은 응답을 내고, 오류에는 바뀌지 않는 `code`가 붙습니다. `astryx manifest --json`은 CLI 전체를 한 번에 설명하는 능력 목록(capability manifest)을 돌려줍니다.
- Astryx의 공식 입장은 "명령을 실행할 수 있는 에이전트는 CLI를 쓰고, MCP는 그럴 수 없는 도구를 위한 것"입니다. `astryx mcp` 명령을 정의한 AST-121 명세는 2026-11-16에 승인되었고 구현은 2026-11-17에 main에 들어갔습니다. v0.7.16 태그에는 이 명령이 없습니다.
- Astryx 저장소의 `plugins/astryx`는 Claude Code와 Codex가 함께 쓰는 스킬 하나짜리 플러그인입니다. 컴포넌트 문서나 버전은 담지 않고 "Astryx가 있다, 언제 쓴다, 어디서 시작한다"만 알려 줍니다.
- Astryx의 바이브 테스트는 같은 프롬프트를 Astryx, Astryx + Tailwind, shadcn/Tailwind 기준선, 순수 HTML 네 환경에 주고 생성된 코드를 같은 기준으로 채점하는 평가입니다. 매일 밤 돌고, 기준선이 이기는 밤이 더 많다는 사실까지 공개되어 있습니다.
- Astryx의 에이전트 상태(agentic states) 디자인 문서는 아직 초안(draft)입니다. 승인된 시각 규칙은 없고, 대신 `Chat` 계열 컴포넌트가 AI 대화 화면의 실용적인 부품을 제공합니다.

## '에이전트 대응'이 뜻하는 것

먼저 흔한 오해부터 짚겠습니다.
"에이전트 대응"이라고 하면 보통 "MCP 서버가 있다"거나 "모델이 이 라이브러리를 학습했다"를 떠올립니다.
Astryx의 문서를 읽어 보면 둘 다 중심이 아닙니다.

공식 글 "How Astryx works"는 이렇게 설명합니다.
LLM이 라이브러리를 실제로 어떻게 쓰는지 측정해 API와 문서를 다듬었고, 엔지니어가 읽는 참고 문서를 AI 도구도 CLI로 똑같이 읽는다는 내용입니다.

저장소 기준으로 풀면 네 층입니다.

| 층 | 무엇인가 | 저장소에서 보이는 곳 |
| --- | --- | --- |
| 규칙 | 모든 컴포넌트가 같은 이름·prop·조합 규칙을 따른다 | `docs/contributing/`, 각 컴포넌트의 `*.doc.mjs` |
| 문서 | 문서의 원본이 CLI 안에 있고, 사람과 에이전트가 같은 것을 읽는다 | `packages/cli/assets/docs/` |
| 전달 | 에이전트 파일, 전역 스킬, 플러그인, MCP | `astryx init`, `plugins/astryx/`, `astryx mcp` |
| 측정 | 에이전트가 실제로 잘 만드는지 잰다 | `internal/vibe-tests/` |

규칙 층은 [Astryx 컴포넌트 150개를 읽는 법](/blog/astryx-components-api/)에서, CLI 명령 하나하나는 [Astryx CLI 완전 정복](/blog/astryx-cli/)에서 다룹니다.
이 글은 나머지, 즉 에이전트에게 지식이 어떻게 전달되고 그 결과를 어떻게 재는지에 집중합니다.

## 에이전트가 디자인 시스템 앞에서 틀리는 방식

Astryx 문서와 블로그에는 팀이 실제로 본 실패가 구체적으로 적혀 있습니다.

| 실패 | 자료에 적힌 내용 | Astryx의 대응 |
| --- | --- | --- |
| 없는 prop·임포트를 지어낸다 | 바이브 테스트 글: 어느 밤에는 에이전트가 임포트와 prop 이름을 지어내 정확성 점수가 2점까지 떨어졌다 | 쓰기 전에 `astryx component <Name>`으로 props를 읽게 하는 작업 순서 |
| 옛 버전 API를 쓴다 | AST-081: 다른 릴리스의 템플릿·문서·에이전트 지침은 프로젝트의 Core가 거부하는 코드를 만들고, 오류도 나지 않는다 | 프로젝트 안에서는 그 프로젝트 버전의 CLI가 답한다 |
| 흔한 React 패턴으로 돌아간다 | working-with-ai 문서: 맥락이 없으면 모델은 일반적인 React 패턴으로 돌아가거나 prop을 지어낸다 | `AGENTS.md` 블록의 규칙과 자기 점검 |
| 나쁜 예제를 베낀다 | `astryx build` 글: 초기 템플릿에 div와 생 StyleX가 많았고 에이전트가 그대로 따라 했다 | 템플릿 채점 기준을 만들고, 모든 페이지를 템플릿에서 시작하게 함 |
| 문서가 길어 컨텍스트를 다 쓴다 | 저장소 이슈 #2306: 테마 문서 한 번에 42K 토큰이 나오자 에이전트가 포기했다 | 섹션 단위 읽기, `--detail`, `--dense` |
| CLI 경로를 틀린다 | working-with-ai 문서: 에이전트가 실행 파일 경로를 잘못 추측해 조용히 실패한다 | 블록 맨 위에 실행 방법을 한 번 적고, npm 스크립트 별칭을 권장 |

"옛 버전 API" 문제가 생기는 원리를 짚어 보겠습니다.
모델의 기억은 학습 시점에 멈춰 있고, 웹 검색은 최신 문서를 가져옵니다.
어느 쪽도 "이 프로젝트의 `node_modules`에 설치된 버전"과 일치한다는 보장이 없습니다.
그래서 Astryx는 문서를 npm 패키지(CLI) 안에 넣어 배포합니다.
설치된 패키지에서 읽으면 버전이 어긋날 수 없습니다.

## astryx init이 AGENTS.md에 써 넣는 것

공식 문서가 권하는 시작 방법은 사람이 명령을 치는 것이 아니라, AI에게 이 문장을 붙여 넣는 것입니다.

```text
Install @astryxdesign/cli and run `astryx init --features agents` to set up your Astryx context. Read the generated file.
```

직접 실행한다면 이렇습니다.

```bash
npm install -D @astryxdesign/cli
npx astryx init                     # 기본 설정: 에이전트 문서 블록을 쓰고 시작 안내를 출력
npx astryx init --features agents   # 에이전트 문서만
```

`init`은 질문을 하지 않는 비대화형 명령입니다.
명령 문서는 그 이유를 "사람, 에이전트, CI에서 똑같이 동작하도록"이라고 적습니다.

### 어느 파일에 쓰는가

기본 동작은 이렇습니다(`astryx docs working-with-ai` 기준).

- `AGENTS.md`에 블록을 씁니다. 위치는 프로젝트 루트, 즉 `package.json`에 Astryx 패키지가 선언된 가장 가까운 폴더입니다.
- 프로젝트에 `CLAUDE.md`나 `.claude/CLAUDE.md`가 이미 있으면 거기에도 사본을 씁니다. Claude Code는 이 파일이 있으면 `AGENTS.md`를 건너뛰기 때문입니다. `CLAUDE.md`가 `AGENTS.md`를 임포트하고 있어도 사본을 쓰는데, 하위 폴더에서 시작한 세션에서는 그 임포트를 따라가지 않아서라고 문서에 적혀 있습니다.
- Gemini CLI는 `GEMINI.md`만 읽으므로, 거기에는 `AGENTS.md`를 임포트하는 한 줄을 넣습니다.
- 홈 폴더나 그 안의 설정 폴더(`~/.claude`, `~/.codex` 같은 점으로 시작하는 폴더)에는 쓰지 않습니다.

도구를 지정하려면 `--agent <claude|cursor|codex|hermes|muse|all>`을, 파일을 직접 지정하려면 `--agent-docs-path`를 씁니다.
Cursor의 프로젝트 규칙으로 따로 두는 예가 문서에 있습니다.

```bash
npx astryx init --features agents --agent-docs-path .cursor/rules/astryx.mdc
```

### 블록 안에 무엇이 들어가는가

블록을 만드는 소스(`packages/cli/foundation/agent-docs/agent-docs.mjs`)를 읽어 보면 구성이 분명합니다.
주석에는 "작업 순서(행동) → 규칙(실수 방지) → CLI 참조" 순서라고 적혀 있습니다.

```text
<!-- ASTRYX:START -->
Astryx v0.7.16 · <컴포넌트 수> components
CLI: run every command as `<이 프로젝트의 실행 방법> <cmd>` (shown below as `astryx ...`).

SETUP (once, in app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — start every page from a template, never from scratch:
1. `astryx build "<idea>"` — ...
2. `astryx template <name> <path>` — ...
3. `astryx template <Block>` ...; `astryx component <Name>` to read props before using one.

RULES:
- No <div> — components handle all layout and spacing.
- ...
- SELF-CHECK: re-read the file; replace any raw <div>/<span>, ... with the component or a token.

(search, docs, upgrade 같은 명령의 빠른 참조)
<!-- ASTRYX:END -->
```

(위는 구조를 보여 주려고 줄인 것입니다. 전체 문구는 설치된 버전이 생성합니다.)

눈여겨볼 점이 몇 가지 있습니다.

**블록은 프로젝트를 읽고 만들어집니다.**
첫 줄의 버전과 컴포넌트 수는 설치된 Core에서 나옵니다.
스타일링 규칙은 프로젝트에 StyleX 컴파일러가 있는지, Tailwind가 있는지, 둘 다 없는지에 따라 문장이 달라집니다.
소스 주석의 표현으로는 "여기서 컴파일되지 않는 스타일링 경로를 에이전트가 고르지 않게" 하기 위해서입니다.
스타일링 경로의 차이는 [Astryx 스타일링](/blog/astryx-styling-tailwind-swizzle/)에서 다룹니다.

**작업 순서는 템플릿에서 시작합니다.**
`build`로 가장 가까운 템플릿을 찾고, `template`으로 프로젝트에 내려받고, 쓰는 컴포넌트마다 `component`로 props를 읽습니다.
템플릿에 화면의 틀과 간격이 이미 잡혀 있어서, 컴포넌트만으로 조립할 때 에이전트가 자주 틀리는 부분을 건너뛸 수 있다는 것이 소스 주석의 설명입니다.
템플릿 자체는 [Astryx 레이아웃과 템플릿](/blog/astryx-layout-templates/)에서 다룹니다.

**자기 점검(SELF-CHECK) 줄은 측정 결과를 보고 넣었습니다.**
소스 주석에 따르면, 복잡한 여러 단계 UI에서는 규칙만으로는 약 11~13%의 실행에서 생 CSS가 남았고, "파일을 다시 읽고 고쳐라"는 한 줄이 그 비율을 약 4분의 1로 줄였습니다.
뒤에서 볼 바이브 테스트로 검증했다고 적혀 있습니다.

**블록은 Astryx가 관리합니다.**
마커 사이의 내용은 `init`과 `upgrade`가 쓰고 갱신하고 지웁니다.
마커 바깥의 글은 건드리지 않습니다.
팀 규칙은 블록 밖에 적어야 합니다.
의존성을 올린 뒤에는 `astryx upgrade --from <이전 버전>`이 블록이 낡았다고 알려 주고, `--apply`를 붙이면 갱신합니다.
지울 때는 `astryx init --remove-agents`입니다.

**통합 패키지도 한 줄을 보탤 수 있습니다.**
Astryx 위에 자기 컴포넌트를 얹어 배포하는 통합(integration) 패키지는 `astryx integration add agent-doc '<안내 한 줄>'`로 블록 끝의 `INTEGRATIONS:` 아래에 실릴 줄을 등록합니다.
한도는 패키지당 8줄, 한 줄 240자, 앱 전체 32줄입니다.
모든 줄이 각 앱의 에이전트 파일에서 자리를 차지하니 자세한 내용은 문서에 두라는 것이 가이드의 설명입니다.

## CLI가 에이전트의 문서 창구가 되는 방식

공식 글 "The best CLI is one you never run"의 주장은 제목 그대로입니다.
CLI는 사람이 아니라 에이전트가 실행하는 도구이고, **CLI가 곧 문서**라는 것입니다.
문서 사이트는 CLI의 소비자이고 그 반대가 아니라고 적혀 있습니다.
원본이 하나라서 사본이 어긋날 일이 없습니다.

에이전트 입장에서 창구는 세 개입니다.

```bash
astryx search "success message"     # 컴포넌트·훅·문서·템플릿·테마를 한 목록으로
astryx component Dialog             # props, 예제, 사용 지침
astryx docs tokens                  # 주제별 참고 문서
```

`search` 결과에는 항목마다 다음에 실행할 명령이 붙어 나옵니다.
에이전트가 "그다음엔 뭘 치지"를 추측하지 않아도 됩니다.

### 짧게 읽게 하는 장치

문서가 길면 에이전트가 쓰는 토큰도 늘어납니다.
Astryx는 문서를 트리 구조로 만들고(AST-046), 한 번에 한 단계씩 읽게 합니다.

- `astryx docs <주제>`는 전체 텍스트가 16KB 이하면 통째로, 넘으면 섹션 목록을 보여 줍니다. `--index`로 목록을, 섹션 키를 붙여 한 섹션만 읽습니다.
- 통합 작성자용 가이드는 한 섹션에 생각 하나, 약 30줄을 권하고, `astryx doctor`는 32KB가 넘는 읽기에 경고를 냅니다.
- 검색은 주제 전체가 아니라 답이 들어 있는 가장 작은 부분(섹션)을 가리킵니다.
- `--detail brief`(이름만), `--detail compact`(이름과 한 줄 설명), `--detail full`로 양을 고릅니다.

### JSON 출력과 오류 코드

모든 명령은 `--json`을 받습니다(하위 명령만 묶는 그룹은 제외).
응답은 타입이 붙은 봉투입니다.

```json
{"apiVersion": 1, "type": "component.detail", "data": {"name": "Button"}, "meta": {"answeredBy": {"cli": "0.7.2", "core": "0.7.2", "copy": "project"}}}
```

오류도 같은 형태입니다.

```json
{
  "apiVersion": 1,
  "error": "No component named \"Buttn\"",
  "code": "ERR_UNKNOWN_COMPONENT",
  "suggestions": [{"name": "Button", "reason": "similar name"}]
}
```

CLI README는 `error` 문자열이 아니라 `code`로 분기하라고 분명히 적습니다.
문구는 자유롭게 고치지만, 코드는 한번 배포되면 뜻이 바뀌지 않고 지워지지도 않는 추가 전용(append-only)입니다.
에이전트가 이름을 틀리면 `suggestions`로 올바른 이름을 돌려받는데, 이것도 환각을 바로잡는 장치입니다.

### 능력 목록

에이전트가 `--help`를 하나하나 읽어 CLI를 익힐 필요가 없도록, 한 번의 호출로 전체를 설명하는 목록을 줍니다.

```bash
astryx manifest --json   # type: "manifest"
astryx --json            # 같은 내용이 data.manifest 아래에
```

모든 명령과 인자, 옵션, `--json` 지원 여부, 응답 `type`, 종료 코드가 들어 있습니다.
README는 이것을 "CLI의 OpenAPI 명세"에 비유합니다.
실제 명령 정의에서 뽑아내므로 실제와 어긋나지 않습니다.
이 목록이 뒤에 나올 MCP 서버의 재료가 됩니다.

## 사람용 문서와 에이전트용 dense 판

Astryx 문서에는 `--dense`라는 옵션이 있습니다.
토큰을 아끼는 압축판을 읽는 옵션입니다.

```bash
astryx component Dialog --dense
astryx docs principles --dense
```

dense 판은 별도의 문서 체계가 아니라 **번역**처럼 다뤄집니다.
`--lang` 옵션의 선택지가 `en`, `zh`, `dense`이고, 컴포넌트 문서 파일 하나에 `docs`(영어), `docsZh`(중국어 간체), `docsDense`가 나란히 있습니다.

`Button.doc.mjs`를 예로 보겠습니다.
영어 원문의 설명 대신 dense 판은 `'action trigger w/ 4 variants, 3 sizes, loading state'`라고 씁니다.
prop 설명도 `'visual style variant'`처럼 줄여 적습니다.
props의 이름과 타입은 원본을 그대로 쓰고, 설명 문장만 갈아 끼웁니다.

다만 모든 문서에 dense 판이 있지는 않습니다.
문서의 표현은 "dense 판이 있는 문서에서는 그것으로 바꿔 준다"입니다.
v0.7.16 기준으로 주제 문서 중 `.doc.dense.mjs` 파일이 따로 있는 것은 `principles`, `theme`, 토큰 가이드 몇 개 등 8개입니다.

흔한 오해가 하나 더 있습니다.
"에이전트용 문서를 따로 쓴다"는 것은 내용이 두 벌이라는 뜻이 아닙니다.
Astryx가 문서의 독자를 나누는 기준은 사람이냐 에이전트냐가 아니라 **쓰는 사람이냐 만드는 사람이냐**입니다.
AST-041 명세는 배포되는 문서의 독자를 "Astryx로 제품을 만드는 사람과 에이전트"로 묶고, 모든 섹션이 그 독자가 행동할 수 있는 내용이어야 한다고 정합니다.
Astryx 자체를 만드는 과정(내부 채점, 기여 절차, CI)은 배포 문서에 넣지 않습니다.
배포 문서는 에이전트와 사람이 직접 읽고, 섹션 하나하나가 읽는 쪽의 주의를 쓰기 때문이라고 설명합니다.

## MCP 서버: 명세와 현재 상태

이 부분은 시점이 중요해서 날짜를 붙여 적습니다.

### Astryx의 기본 입장

`astryx docs working-with-ai`의 MCP 절 제목은 "If your AI tool needs MCP", 곧 "AI 도구에 MCP가 필요하다면"입니다.
첫 문장은 CLI부터 쓰라는 것입니다.
명령을 실행할 수 있는 에이전트는 `init`이 써 준 에이전트 문서를 따라 `astryx`를 직접 실행합니다.
MCP(Model Context Protocol)는 도구가 명령을 실행할 수 없거나 MCP로만 도구에 접근할 때 쓰라고 합니다.

이 입장에는 근거가 있습니다.
저장소 이슈 #2306(2026년 5월, 이름이 XDS이던 시절)은 문서를 에이전트에게 전달하는 여섯 가지 방식을 프롬프트 7개로 비교한 기록입니다.
"CLI + search"가 10점 만점에 9.6점(약 20K 토큰)으로 가장 좋았고, 도구 두 개짜리 MCP가 9.3점(약 35K 토큰)이었습니다.
결론은 "MCP는 내용의 질을 높이지 않는다. 배포를 쉽게 한다"였습니다.
표본이 작은 초기 실험이라는 점은 감안해서 읽어야 합니다.

### v0.7.16 시점

v0.7.16 태그의 저장소에는 `astryx mcp` 명령이 없습니다.
그 시점의 MCP는 문서 사이트가 운영하는 원격 서버 하나였고(`https://astryx.atmeta.com/mcp`), v0.7.16의 working-with-ai 문서는 도구가 두 개라고 설명합니다.
`search(query)`로 컴포넌트·문서·템플릿을 찾고, `get(name)`으로 props와 예제가 든 전체 문서를 가져옵니다.

### AST-121이 정한 것

`docs/specs/AST-121-mcp-server/spec.md`는 2026-11-16에 승인된 시스템 명세입니다.
구현은 2026-11-17에 main 브랜치에 들어갔고(PR #11686), 릴리스 노트용 changeset이 대기 중입니다.
v0.7.16 이후 릴리스에 실릴 내용입니다.

| 항목 | 명세 내용 |
| --- | --- |
| 전송 | `astryx mcp`는 표준 입출력으로 MCP 통신을 한다. 한 줄에 JSON-RPC 2.0 메시지 하나. tools 기능만 선언한다 |
| 도구 목록 | 능력 목록이 `--json` 지원으로 표시한 명령 하나가 도구 하나. 이름은 명령의 단어를 `_`로 이은 것(`theme build` → `theme_build`) |
| 입력 | 명령의 인자와 옵션을 CLI 이름 그대로. 명령이 실행될 폴더를 가리키는 `cwd`. 스키마에 없는 입력은 거부 |
| 실행 | 호출마다 같은 CLI를 별도 프로세스로 `--json`을 붙여 실행하고, 출력을 한 글자도 바꾸지 않고 돌려준다. 종료 코드가 0이 아니면 오류 |
| 첫 안내 | 서버 이름은 `astryx`. 프로젝트에 에이전트 문서가 아직 없으면 `init`이 쓰는 그 텍스트를 서버 안내문(instructions)에 싣는다 |
| 문서 전용 | `astryx mcp --docs-only`는 문서를 읽는 명령만 제공한다: `search`, `build`, `component`, `hook`, `docs`, `template`, `discover`, `theme list`, `theme targets` |
| 문서 사이트 | 사이트의 MCP 엔드포인트는 `--docs-only` 서버 그 자체다. Streamable HTTP, 요청당 메시지 하나, 세션 없음, 55초 안에 답이 없으면 중단 |
| 다루지 않는 것 | 표준 입출력 외의 전송, MCP의 resources·prompts·sampling, 클라이언트 설정 파일을 프로젝트에 써 주는 일 |

결정 기록에서 설계 의도가 드러납니다.

- **도구 목록을 따로 만들지 않는다(DEC-1).** 도구는 CLI의 능력 목록에서 나오므로 서버와 CLI가 어긋날 수 없고, 명령을 추가할 때 MCP 작업이 필요 없습니다. "검색 도구와 가져오기 도구"처럼 골라 만든 도구 집합은 자체 로직으로 답하다가 CLI와 어긋난다는 이유로 기각되었습니다. v0.7.16의 `search`/`get` 방식이 바로 이 기각된 형태입니다.
- **함수를 부르지 않고 프로세스를 띄운다(DEC-2).** 그래야 파싱, 기본값, 오류, 종료 상태까지 명령의 답과 바이트 단위로 같아집니다.
- **문서 사이트 서버는 쓰기를 하지 않는다(DEC-4).** 여러 사람이 함께 쓰는 서버가 파일을 쓰거나 호출자가 지정한 경로를 읽어서는 안 되기 때문입니다.

main의 문서가 제시하는 설정 예는 이렇습니다(Claude Code의 `.mcp.json`, Cursor의 `.cursor/mcp.json`, Cline 공통).

```json
{
  "mcpServers": {
    "astryx": {
      "command": "npx",
      "args": ["@astryxdesign/cli", "mcp"]
    }
  }
}
```

이 설정은 `astryx mcp` 명령이 들어간 릴리스에서만 동작합니다.
아무것도 설치하지 않았다면 문서 사이트 서버를 원격 HTTP 서버로 연결합니다. Claude Code에서는 `claude mcp add --transport http astryx https://astryx.atmeta.com/mcp`이고, 설정 파일의 모양은 도구마다 다르니 문서의 해당 예시를 씁니다.

두 서버의 차이도 알아 둡니다.
프로젝트에서 띄운 서버는 그 프로젝트의 버전·테마·통합 기준으로 답합니다.
문서 사이트 서버는 최신 공개 릴리스 기준으로 답하고, 내 프로젝트를 모릅니다.

명세에는 아직 정하지 않은 질문도 하나 있습니다.
`astryx init`이 에이전트 문서 옆에 MCP 클라이언트 설정까지 써 줄 것인가(OQ2)는 아직 결정되지 않았습니다.

## Claude Code·Codex 플러그인과 스킬

저장소의 `plugins/astryx/`는 구성이 단순합니다.

```text
.claude-plugin/marketplace.json        # 저장소 루트: 마켓플레이스 정의
plugins/astryx/
  .claude-plugin/plugin.json           # Claude Code용 메타데이터
  .codex-plugin/plugin.json            # Codex용 메타데이터 (skills 경로, 표시 이름)
  skills/astryx/SKILL.md               # 스킬 하나
  README.md
```

두 `plugin.json`은 이름 `astryx`, 버전 `0.1.0`, 그리고 "Astryx가 `astryx` 명령으로 쓸 수 있고, 언제 쓰고, 어디서 시작하는지 알려 준다"는 설명을 담고 있습니다.
스킬은 Claude Code와 Codex가 같은 파일 하나를 공유합니다.

README가 강조하는 것은 이 스킬이 **담지 않는 것**입니다.
컴포넌트 문서도, 버전도 없습니다.
그것은 CLI가 답할 일이기 때문입니다.
스킬 본문을 요약하면 이렇습니다.
Astryx가 이 컴퓨터에 있다, UI를 만들거나 고칠 때 써라, 페이지는 `astryx build`로 나머지는 `astryx search`로 시작해라, 패키지 파일 대신 `astryx component`나 `astryx docs`를 읽어라, `astryx`가 없으면 전역 설치부터 해라.

이 파일은 손으로 쓰지 않습니다.
CLI의 `renderComputerAgentText`에서 생성하고, 커밋된 파일이 생성 결과와 다르면 저장소 검사가 실패합니다(AST-081 FR13).

설치는 README 기준으로 이렇습니다.

```bash
claude plugin marketplace add meta/astryx
claude plugin install astryx@astryx
```

Codex에서는 `meta/astryx`를 마켓플레이스로 추가하고 `astryx@astryx`를 켭니다.
README는 Claude 마켓플레이스 등재가 별도의 수동 절차이고, 이 저장소는 그 등재에 쓸 플러그인 파일을 제공할 뿐이라고 적어 둡니다.

## 전역 설치: 모든 코딩 에이전트가 Astryx를 알게 하기

프로젝트의 `AGENTS.md`는 그 프로젝트에서 일하는 에이전트에게만 닿습니다.
빈 폴더에서 "뭔가 만들어 줘"라고 시작하는 에이전트는 Astryx가 있는 줄 모릅니다.
전역 모드(global mode)는 이런 경우를 위한 것입니다.

```bash
npm i -g @astryxdesign/cli
```

### 어느 버전이 답하는가

전역 설치의 핵심 규칙은 "전역 설치가 프로젝트가 받는 답을 바꾸지 않는다"입니다.

| 실행 위치 | 답하는 버전 |
| --- | --- |
| 프로젝트 안 | 프로젝트 자신의 CLI. 전역 `astryx`를 쳐도 실행을 프로젝트 CLI에 넘긴다 |
| 프로젝트 밖 | 전역 버전. 그 버전의 새 프로젝트가 받을 답을 준다 |
| `astryx init --user` 같은 컴퓨터 대상 명령 | 어느 폴더에서든 전역 버전 |

누가 답했는지는 숨기지 않습니다.
텍스트 모드에서는 표준 오류에 한 줄로 알려 주고, `--json`에서는 앞에서 본 `meta.answeredBy`에 CLI 버전과 Core 버전이 실립니다.
전역 설치는 스스로도, 프로젝트도 업그레이드하지 않습니다. 새 버전이 나오면 하루에 한 번 이하로 알림만 띄웁니다.

### 컴퓨터 수준의 스킬 파일

전역 설치는 홈 폴더에 스킬 파일 하나를 둡니다.
`~/.agents/skills/astryx/SKILL.md`입니다.
내용은 앞의 플러그인 스킬과 같은 안내이고, 버전을 적지 않아서 낡지 않습니다.

자기 스킬 폴더만 읽는 도구를 위해서는 이 폴더로 가는 링크를 겁니다.
`~/.claude/skills/astryx`는 항상 만들고, Kiro·Windsurf·Letta·Xcode 코딩 어시스턴트 등은 해당 도구의 폴더가 있을 때만 연결합니다.
링크를 건너뛰는 Continue에는 사본을 둡니다.
링크는 상대 경로의 폴더 심볼릭 링크이고, Windows에서는 정션입니다.

다른 파일을 건드리지 않도록 신경 쓴 부분도 있습니다.

- 패키지 설치 스크립트는 이 파일을 쓰지 않습니다. 전역 CLI의 첫 실행 때와 업그레이드 뒤 첫 실행 때 백그라운드로 씁니다.
- 사람이 고친 파일은 덮어쓰지도 지우지도 않습니다. 파일 안에 텍스트의 해시를 기록해 두고, 맞지 않으면 사람이 편집한 것으로 봅니다.
- Astryx가 만들지 않은 것은 바꾸지 않고, 에이전트 도구의 설정도 고치지 않습니다.

직접 제어하는 명령은 둘입니다.

```bash
astryx init --user                   # 지금 쓰기
astryx init --user --remove-agents   # 파일과 링크를 지우고 끄기
```

놓치기 쉬운 점이 하나 있습니다.
클라우드에서 도는 에이전트나 백그라운드 에이전트는 저장소만 읽습니다.
이런 에이전트가 읽는 것은 홈 폴더의 스킬이 아니라 저장소에 커밋된 `AGENTS.md`나 `CLAUDE.md`의 블록입니다.

### 컴퓨터에 설치한 통합

통합 패키지를 전역 CLI 옆에 같이 설치할 수도 있습니다.
규칙은 버전 규칙과 같은 방향입니다.
프로젝트 **밖**에서는 전역으로 설치된 통합의 컴포넌트·템플릿·문서·테마가 보입니다.
프로젝트 **안**에서는 그 프로젝트가 설치한 통합만 동작합니다.
프로젝트가 설치하지 않은 패키지의 컴포넌트를 에이전트에게 알려 주면 빌드가 깨지기 때문입니다.
전역에만 있는 통합은 `astryx discover`에 "이 프로젝트에 추가할 수 있는 패키지"로만 나옵니다.

## 지식 계약: 무엇이 이미 결정되었는가

지금까지는 Astryx를 **쓰는** 에이전트 이야기였습니다.
Astryx를 **만드는** 쪽에도 에이전트가 깊이 들어와 있습니다.
"How Astryx works"는 저장소 관리, 문서 감사, 바이브 테스트 실행이 AI의 도움을 받고, core에 들어가는 코드는 AI가 도운 것까지 모두 사람이 리뷰한다고 밝힙니다.

이 구조의 바탕이 `docs/architecture/knowledge-contracts.md`의 지식 계약(knowledge contracts)입니다.
목적은 지난 풀 리퀘스트를 다시 읽지 않고도 다음 두 질문에 답하는 것입니다.

1. 사람이 이미 결정한 동작은 무엇인가.
2. 이 풀 리퀘스트는 사람이 필요한 새 결정을 하고 있는가.

컴포넌트 계약, 패밀리 계약, 디자인 명세, 시스템 명세(AST-121 같은 것)처럼 사실마다 기록할 곳이 정해져 있습니다.
모든 기록은 `draft`(검토용, 규칙 아님), `current`(명시적으로 승인됨), `archived`(이력) 중 하나입니다.

불변 조건 몇 가지를 보면 이 체계의 성격이 드러납니다.

- `current` 기록만 구현과 리뷰의 기준이 된다. 병합된 코드나 침묵에서 승인을 추론하지 않는다.
- 사실 하나에는 주인이 하나다. 다른 기록은 복사하지 않고 링크한다.
- 기존 결정이 적용되면 리뷰어는 사람에게 다시 묻지 않는다. 적용되는 결정이 없거나 결정끼리 충돌할 때만 묻는다.
- 명세에 대한 자동 리뷰는 사람 소유자를 위한 조언이다. 검사가 통과했다고 자동 승인되지 않는다(DEC-8).

저장소 루트의 `AGENTS.md`는 이 체계를 에이전트의 작업 지침으로 옮긴 것으로, 경로를 고치기 전에 `pnpm specs:for <경로>`로 그 경로에 걸린 기록부터 찾으라고 적습니다.

사용자에게도 쓸모가 있습니다.
기록의 `authority`를 보면 그 문서를 얼마나 믿어도 되는지 알 수 있습니다.
AST-121은 `current`입니다.
뒤에 나올 에이전트 상태 디자인 문서는 `draft`입니다.
이 글이 둘을 다르게 다루는 이유입니다.

## 바이브 테스트: 에이전트가 정말 잘 만드는지 재기

"에이전트 친화적"이라는 말은 누구나 할 수 있습니다.
Astryx는 그 말을 검증하는 장치를 저장소에 넣어 두었습니다.

바이브 테스트(vibe tests)는 README의 정의로 "서로 다른 디자인 시스템 구성에서 LLM이 UI 코드를 얼마나 잘 생성하는지 비교하는 구조화된 평가"입니다.
같은 프롬프트를 여러 시스템에 주고 결과를 수치로 비교합니다.

### 처음에는 잘못 쟀다

블로그 글 "Vibe Test"는 이 과정을 자세히 적습니다.
첫 버전은 생성된 코드가 기대한 컴포넌트를 썼는지, 지어낸 컴포넌트나 감싸는 div 같은 "탈출구"가 있는지를 봤습니다.
그런데 이 방식은 "에이전트가 Astryx를 우리가 원하는 대로 썼는가"를 재는 것이어서, Astryx가 정답이라고 가정하고 있었습니다.
다른 시스템과 공정하게 비교할 수 없었습니다.

다음 버전은 공정성을 우선했습니다.
대상에 상관없이 같은 결정론적 분석을 돌리고, 어떤 좋은 결과물이든 가져야 할 속성으로 채점합니다.

- **대상 네 가지**: Astryx, Astryx + Tailwind, 기준선(shadcn/Tailwind), 순수 HTML
- **차원 여섯 가지**: 정확성, 접근성, 코드 품질, 효율, 유지보수성, 디자인. 디자인은 렌더링한 스크린샷을 참조 이미지와 비교하는 방식이고 아직 작업 중인 차원입니다.

### 공정하게 재기 위한 규칙

README의 "Checker Protocol"은 테스트를 돌리거나 고치기 전에 확인할 다섯 가지를 적습니다.

1. **평가자가 공정한가.** 모든 구성에 같은 평가 로직과 합격 기준을 쓴다.
2. **시험 대상만 달라지는가.** 프롬프트와 페르소나, 출력 형식이 같다. "StyleX를 써라" 같은 시스템별 코칭은 넣지 않는다. 그것은 문서가 가르칠 일이다.
3. **답을 흘리지 않는가.** 프롬프트마다 기대 컴포넌트(`expectedComponents`)가 있지만 평가에만 쓰고 에이전트에게는 절대 보여 주지 않는다.
4. **환경이 현실적인가.** 실제 사용자가 npm 패키지만 갖고 있다면 하위 에이전트에게도 소스 저장소를 주지 않는다. 손으로 쓴 스킬 문서가 아니라 실제 전달 경로를 시험한다.
5. **하위 에이전트에 맥락이 없는가.** 프롬프트마다 새 에이전트를 띄우고, 부모 세션의 지식을 물려주지 않는다.

프롬프트도 유도하지 않게 씁니다.
블로그의 예로는 "접을 수 있는 목록으로 아코디언을 만들어라"가 아니라 "사용자가 질문을 하나씩 여는 FAQ 페이지를 만들어라"입니다.
컴포넌트 이름이 아니라 사용자 경험을 설명합니다.

채점은 하위 에이전트가 스스로 하지 않고 별도의 심판 에이전트가 합니다.
README는 기준선에 살짝 유리한 계산 방식 몇 가지를 "받아들인 비대칭"으로 적어 두기도 했습니다.

### 공개된 점수

테스트는 매일 밤 돕니다.
블로그에는 결과가 좋은 밤과 나쁜 밤이 모두 실려 있습니다.

| 날짜 | Astryx | Astryx + Tailwind | 기준선 | 순수 HTML |
| --- | --- | --- | --- | --- |
| 2026-07-10 (좋은 밤) | 98 | 97 | 95 | 82 |

나쁜 밤인 2026-06-28에는 Astryx의 종합이 77점으로 떨어져 기준선에 졌습니다.
접근성 98, 코드 품질 99, 효율 91, 유지보수성 96이었는데 정확성이 2점이었습니다.
몇몇 프롬프트에서 에이전트가 임포트와 prop 이름을 지어냈기 때문입니다.

글은 전체 기록에서 기준선이 이기는 밤이 가장 많다고 적고, 점수표를 숨기지 않고 공개한다고 밝힙니다.

### 측정 결과로 하는 일

밤 사이 결과가 나오면 두 번째 자동 작업인 디버거가 실패한 프롬프트를 읽고 분류한 뒤, 고칠 수 있는 것은 문서나 CLI에 대한 풀 리퀘스트로 엽니다.
다만 하룻밤의 나쁜 결과에 휘둘리지 않도록 반복되는 패턴을 찾고 문제를 재현해 증거를 보이라는 지시를 받습니다.

설계 결정에도 씁니다.
블로그는 토큰 이름 구조, Selector API, CLI 대 MCP를 바이브 테스트로 정한 예로 듭니다.
앞에서 본 자기 점검 줄과 MCP에 대한 입장이 모두 여기서 나왔습니다.

## "AI에게 쉬워진 변화는 사람에게도 쉬웠다"

"How Astryx works"의 원칙 가운데 "사람과 AI를 위한 하나의 시스템"에는 이런 관찰이 붙어 있습니다.
Astryx를 AI에게 더 쉽게 만든 변화는 모두 사람에게도 더 쉽게 만들었다는 것입니다.

이 글에서 본 내용에 비춰 보면 근거가 있는 말입니다.

- 규칙이 일관되면 모델이 처음 보는 컴포넌트의 prop을 맞히기 쉽습니다. 사람도 마찬가지입니다.
- 섹션이 짧고 제목이 "사용자가 검색할 말"로 되어 있으면 에이전트의 토큰이 절약됩니다. 사람의 시간도 절약됩니다.
- 오류에 고정된 코드와 "혹시 이것?" 제안이 붙으면 에이전트가 스스로 고칩니다. 사람도 오타를 바로 압니다.
- `init`이 질문을 하지 않으면 에이전트가 멈추지 않습니다. CI 스크립트도 멈추지 않습니다.

다만 이것은 Astryx 팀이 자기 시스템에서 관찰한 것이지, 증명된 일반 법칙은 아닙니다.
dense 판처럼 에이전트만을 위한 장치도 있습니다.
"에이전트를 위한 최적화가 언제나 사람에게도 좋다"로 넓혀 읽지는 않는 편이 안전합니다.

## 에이전트 상태 디자인과 Chat 컴포넌트

Astryx로 **AI 제품의 화면**을 만드는 경우도 있습니다.
여기에는 정해진 것과 정해지지 않은 것이 섞여 있습니다.

### 정해지지 않은 것: 에이전트 상태

`docs/design/agentic-states.md`는 에이전트가 진행 중인지, 기다리는지, 살펴보는지, 동기화하는지, 결과를 내놓는지를 사람이 어떻게 알아보게 할지를 다루는 디자인 문서입니다.
다만 `authority: draft`이고, 스스로 "씨앗 기록"이라고 부릅니다.

승인된 원칙은 하나뿐입니다.
의도가 같다면 에이전트 상태는 기존 사용자 상태·시스템 상태의 표현을 먼저 재사용한다는 것입니다(DR1).
새 표현을 제안하려면 기존의 로딩, 처리 중, 상태 표시로는 왜 부족한지부터 보여야 합니다.

나머지는 열린 질문 여덟 개로 남아 있습니다.
생각 중/처리 중, 사용자에게 보이는 근거, 스트리밍, 도구 실행, 입력 대기, 동기화, 살펴보기, 렌더링입니다.
문서는 숨겨진 추론 과정의 공개를 요구하지 않는다는 점도 분명히 합니다.

그러니 "Astryx에는 에이전트의 '생각 중' 상태를 표현하는 공식 규칙이 있다"고 말하면 틀립니다.
v0.7.16 기준으로는 없습니다.

### 정해진 것: Chat 계열 컴포넌트

대신 쓸 수 있는 부품은 있습니다.
`@astryxdesign/core/Chat`의 문서는 Chat을 "AI와 사람의 채팅 경험을 만드는 조합형 기본 부품의 모음"이라고 설명합니다.

`ChatLayout`이 메시지 영역과 입력창을 배치하고, `ChatMessage`(`sender`는 `'user' | 'assistant' | 'system'`)와 `ChatMessageBubble`이 메시지를, `ChatComposer`가 입력창을, `ChatToolCalls`가 LLM의 도구 호출을 그립니다.
도구 호출의 `status`는 `'pending' | 'running' | 'complete' | 'error'` 넷입니다.
공식 블록 템플릿을 바탕으로 줄이면 이런 모양입니다.

```tsx
import {
  ChatLayout,
  ChatMessageList,
  ChatMessage,
  ChatMessageBubble,
  ChatToolCalls,
  ChatComposer,
} from '@astryxdesign/core/Chat';

type Props = {
  isStreaming: boolean;
  onSend: (value: string) => void;
  onStop: () => void;
};

export function AssistantPanel({isStreaming, onSend, onStop}: Props) {
  return (
    <ChatLayout
      composer={
        <ChatComposer onSubmit={onSend} isStopShown={isStreaming} onStop={onStop} />
      }>
      <ChatMessageList isStreaming={isStreaming}>
        <ChatMessage sender="user">
          <ChatMessageBubble>테스트가 왜 실패하는지 봐 줘</ChatMessageBubble>
        </ChatMessage>
        <ChatMessage sender="assistant">
          <ChatToolCalls
            calls={[
              {name: 'read_file', status: 'complete', target: 'Button.tsx', duration: '120ms'},
              {name: 'run_tests', status: 'running', target: 'yarn test'},
            ]}
          />
        </ChatMessage>
      </ChatMessageList>
    </ChatLayout>
  );
}
```

문서의 지침 가운데 실무에서 걸리기 쉬운 것 두 가지만 옮깁니다.

첫째, `ChatToolCalls`에서 `status`를 빠뜨리지 않습니다.
생략하면 `complete`로 처리되어, 아직 실행 중이거나 실패한 호출이 끝난 것처럼 보입니다.

둘째, `ChatMessageList`의 `isStreaming`은 모양을 바꾸는 prop이 아닙니다.
대화 기록을 `aria-busy`로 표시해서, 스크린 리더가 토큰이 올 때마다 조각을 다시 읽지 않고 완성된 메시지를 한 번만 읽게 합니다.
접근성 전반은 [Astryx의 접근성, 국제화, 모션](/blog/astryx-a11y-i18n-motion/)에서 다룹니다.

페이지 템플릿에도 `ai-chat`과 `ai-chat-landing`이 있어서, `astryx build`가 채팅 화면의 출발점으로 가리킬 수 있습니다.

## v0에서 쓸 수 있게 된 것

2026-11-14 공식 글에 따르면 Astryx는 Vercel의 v0에서 쓸 수 있게 되었습니다.
글의 설명은 짧습니다.
v0에서 디자인 시스템은 에이전트 스킬이고, 만드는 사람이 프로젝트에 Astryx를 고르면 v0가 만드는 동안 Astryx의 지침, 컴포넌트, 예제, 템플릿이 컨텍스트에 들어옵니다.
스타터 템플릿도 함께 공개되었습니다.

글은 이것을 Vercel과의 협업이라고 부르고, 디자인 시스템이 사람과 에이전트를 함께 지원한다는 것이 무엇인지 탐색하는 한 방법이라고 적습니다.
v0 안에서 구체적으로 어떤 파일이 어떻게 주입되는지는 저장소 자료에 없어서 이 글에서는 다루지 않습니다.

## gap-report: 에이전트가 "이건 없다"고 말하는 통로

에이전트가 Astryx로 화면을 만들다 필요한 변형이 없다는 것을 알게 되면, 보통은 `<div>`로 우회하고 넘어갑니다.
`astryx gap-report`는 그 순간을 기록으로 남기는 명령입니다.

```bash
astryx gap-report --list-categories
astryx gap-report Button --category missing_variant --reason 'Need a compact size'
```

빠진 컴포넌트, 변형, 레이아웃, 스타일링, 접근성, API, 문서를 그것을 소유한 패키지에 보고합니다.
안전장치가 여럿 있습니다.

- **공개 전송은 동의가 있어야 합니다.** `--confirm-public` 없이는 아무것도 공개로 나가지 않습니다. 붙이지 않고 실행하면 `consent_required` 상태와 "이 옵션을 붙여 다시 실행하라"는 안내가 돌아옵니다.
- **처리기가 없으면 이슈로 갑니다.** 대상 패키지의 `issuesUrl`이 GitHub 이슈 주소면 GitHub CLI(`gh`)의 내 로그인으로 이슈를 올립니다. 역시 `--confirm-public`이 있어야 합니다.
- **목적지를 에이전트가 고르지 않습니다.** 보낼 수 있는 곳이 여럿이면 출력에 목록과 함께 "사람에게 물어보라"는 줄이 나옵니다. 사람이 고른 곳은 `--to <패키지>`로 전달합니다.
- **누가 실행했는지 남습니다.** 보고에는 에이전트가 실행했는지 사람이 실행했는지가 기록됩니다.

통합 패키지 쪽에서는 `gapReport` 처리기를 내보내 자기 추적 시스템으로 받을 수 있습니다.

## 내 프로젝트에서 에이전트와 함께 쓰는 절차

공식 문서를 기준으로 순서를 정리하면 이렇습니다.
직접 실행해 본 절차가 아니라 문서가 안내하는 흐름입니다.

1. **설치한다.** Core와 테마, 그리고 CLI를 개발 의존성으로 넣습니다. 설정 전체는 [Astryx 설치와 첫 화면](/blog/astryx-getting-started/)에 있습니다.
2. **`astryx init`을 돌리고 생긴 블록을 읽는다.** 에이전트가 읽을 내용을 사람이 먼저 읽어 보는 것이 좋습니다. 생성된 파일은 커밋합니다. 클라우드 에이전트가 읽을 수 있는 유일한 경로입니다.
3. **CLI 호출 경로를 고정한다.** 문서는 에이전트가 실행 파일 경로를 틀리는 일을 막으려고 npm 스크립트 별칭을 권합니다.

   ```json
   "scripts": {
     "astryx": "node node_modules/@astryxdesign/cli/clients/cli/bin/astryx.mjs"
   }
   ```

   그러면 에이전트는 `npm run astryx -- component Dialog --dense`처럼 부릅니다.
4. **에이전트가 준비됐는지 묻는다.** 문서가 제안하는 점검 질문은 셋입니다. Button의 올바른 임포트 경로, Dialog를 닫을 수 없게 만드는 방법, Selector가 항목에 쓰는 prop. 셋을 모르면 에이전트 문서부터 읽게 합니다.
5. **요청은 화면의 목적으로 한다.** 에이전트는 블록의 순서대로 `build` → `template` → `component`를 실행합니다. 컴포넌트 이름을 일일이 지정해 줄 필요가 없습니다.
6. **결과를 확인한다.** 블록의 자기 점검이 생 div와 하드코딩된 값을 한 번 걸러 주지만, 빌드와 눈으로 보는 확인은 여전히 필요합니다.
7. **업그레이드 뒤에는 블록도 갱신한다.** `astryx upgrade --from <이전 버전> --apply`가 코드 변환과 함께 에이전트 문서를 새로 씁니다.
8. **없는 것은 우회하지 말고 보고하게 한다.** `gap-report`로 남기되, 공개 전송 여부와 목적지는 사람이 정합니다.
9. **MCP는 필요할 때만.** 에이전트가 명령을 실행할 수 있다면 건너뜁니다.

여러 프로젝트를 오가거나 빈 폴더에서 자주 시작한다면 전역 설치를 더합니다.
문서는 프로젝트 설치와 전역 설치를 둘 다 하는 구성을 권장으로 표시합니다.

## 한계와 주의점

**환각이 사라지지는 않습니다.**
Astryx도 이 점을 공개하고 있습니다.
에이전트 문서와 CLI가 다 갖춰진 상태에서도 정확성이 2점까지 떨어진 밤이 있었고, 전체 기록에서는 기준선이 가장 많이 이겼습니다.
에이전트 대응은 확률을 높이는 장치이지 보증이 아닙니다.

**빠르게 바뀝니다.**
MCP가 좋은 예입니다.
v0.7.16의 문서는 도구 두 개짜리 원격 서버를 설명하는데, 사흘 뒤 main에서는 CLI 명령 전체를 도구로 내놓는 설계로 바뀌었습니다.
MCP 설정을 쓰기 전에 설치된 버전의 `astryx docs working-with-ai`를 읽는 것이 안전합니다.
문서 사이트의 서버가 지금 어느 구현으로 답하는지는 이 글에서 확인하지 못했습니다.

**블록은 강한 규칙을 가져옵니다.**
"div를 쓰지 않는다", "모든 페이지를 템플릿에서 시작한다" 같은 줄이 에이전트 파일에 들어갑니다.
Astryx를 부분적으로만 쓰는 기존 코드베이스라면 팀의 관례와 부딪힐 수 있습니다.
이것은 문서에 적힌 경고가 아니라 블록 내용을 읽고 내린 제 판단입니다.
블록 안은 Astryx가 다시 쓰므로, 조정이 필요하면 블록 밖에 팀 규칙을 적어야 합니다.

**원격 MCP 서버는 내 프로젝트를 모릅니다.**
최신 공개 릴리스 기준으로 답하므로, 프로젝트가 예전 버전에 묶여 있으면 맞지 않는 API를 알려 줄 수 있습니다.

**AI 화면의 디자인 규칙은 아직 초안입니다.**
`Chat` 컴포넌트는 쓸 수 있지만, 에이전트 상태를 어떻게 보여 줄지에 대한 승인된 지침은 없습니다.

**실험 명령이 블록에 등장합니다.**
테마 규칙은 `astryx experimental theme editor`를 권하는데, CLI의 명령 목록은 `experimental` 묶음이 패치 릴리스에서도 바뀔 수 있다고 설명합니다.

## 자주 묻는 질문

### Astryx를 AI 도구와 쓰려면 MCP 서버를 꼭 연결해야 하나요?

아닙니다. 공식 문서는 CLI부터 쓰라고 합니다.
명령을 실행할 수 있는 에이전트는 `astryx init`이 쓴 에이전트 문서를 따라 `astryx`를 직접 실행합니다.
MCP는 도구가 명령을 실행할 수 없거나 MCP로만 도구에 접근할 때를 위한 경로입니다.

### astryx init이 내가 쓴 AGENTS.md 내용을 덮어쓰나요?

아닙니다. Astryx는 `<!-- ASTRYX:START -->`와 `<!-- ASTRYX:END -->` 사이의 블록만 쓰고 갱신하고 지웁니다.
문서는 그 주변의 텍스트는 절대 바꾸지 않는다고 명시합니다.
반대로 블록 안을 손으로 고치면 다음 `init`이나 `upgrade --apply` 때 다시 쓰일 수 있으니, 팀 규칙은 블록 밖에 둡니다.

### --dense는 일반 문서와 무엇이 다른가요?

`--dense`는 토큰을 아끼도록 설명 문장을 줄인 판을 읽는 옵션입니다.
`astryx component <Name>`과 `astryx docs <topic>`에 적용되고, `--lang dense`와 같습니다.
별도의 문서가 아니라 번역 한 벌처럼 관리되며, dense 판이 없는 문서도 있습니다.

### 바이브 테스트 점수가 높으면 Astryx가 다른 방식보다 낫다는 뜻인가요?

그렇게 단정할 수 없습니다.
공개된 좋은 밤에는 Astryx가 98점으로 기준선(95점)을 앞섰지만, 팀은 전체 기록에서 기준선이 이기는 밤이 가장 많다고 밝혔습니다.
에이전트는 결정론적이지 않아서 밤마다 결과가 흔들리고, 디자인 차원은 아직 작업 중입니다.
이 테스트의 가치는 순위보다 "변경이 시스템을 쓰기 어렵게 만들었는지"를 잡아내는 데 있습니다.

### 에이전트가 gap-report로 마음대로 GitHub 이슈를 올리나요?

`--confirm-public` 없이는 공개로 아무것도 전송되지 않습니다.
보낼 곳이 여러 개일 때는 에이전트가 고르지 않고 사람에게 묻도록 출력이 안내하며, 사람이 고른 곳을 `--to`로 넘깁니다.
보고에는 에이전트가 실행했는지 사람이 실행했는지도 기록됩니다.

### Astryx에 에이전트의 '생각 중' 상태를 위한 공식 디자인이 있나요?

v0.7.16 기준으로 없습니다.
에이전트 상태 디자인 문서는 초안이고, 승인된 원칙은 "기존 상태 표현을 먼저 재사용한다" 하나입니다.
실제 화면은 `Chat` 계열 컴포넌트와 `ChatToolCalls`의 네 가지 상태값, 기존 로딩·상태 컴포넌트로 구성합니다.

## 정리

- Astryx의 '에이전트 대응'은 MCP 서버 하나가 아니라, 일관된 API 규칙, CLI에 든 단일 원본 문서, 여러 전달 경로, 그리고 측정의 조합입니다.
- 프로젝트 안에서는 `astryx init`이 쓰는 `AGENTS.md` 블록이, 프로젝트 밖에서는 전역 설치가 두는 스킬 파일이 에이전트에게 "Astryx가 있고 이렇게 시작한다"를 알려 줍니다. 세부 지식은 언제나 CLI가 설치된 버전 기준으로 답합니다.
- MCP는 명령을 실행하지 못하는 도구를 위한 보조 경로입니다. `astryx mcp`(AST-121)는 CLI의 능력 목록을 그대로 도구로 내놓는 설계이고, v0.7.16 태그 이후에 main에 들어갔습니다.
- 바이브 테스트는 같은 프롬프트로 네 환경을 비교해 "정말 더 잘 만드는가"를 매일 재고, 지는 밤까지 공개합니다. 블록의 자기 점검 줄 같은 세부가 이 측정에서 나왔습니다.
- 에이전트 상태 디자인은 초안이고, 환각은 줄어들 뿐 없어지지 않습니다. 도입한다면 생성된 블록을 직접 읽고, 결과는 빌드와 눈으로 확인하는 절차를 유지해야 합니다.

## 참고

모두 공식 저장소(https://github.com/meta/astryx)의 파일입니다.

- 공식 블로그: [Vibe Test](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/vibe-tests.md), [The best CLI is one you never run](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/the-astryx-cli.md), [How Astryx works](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/how-astryx-works.md), [Astryx is now available in v0](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/astryx-is-now-available-in-v0.md), [Building for people and agents](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/building-for-people-and-agents.md), [astryx build 글](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/astryx-cli-build-command.md)
- 사용자 문서: [working-with-ai](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/working-with-ai.doc.mjs), [agent-guidance](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/agent-guidance.doc.mjs), [computer-agent-guide](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/computer-agent-guide.doc.mjs), [computer-integrations](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/computer-integrations.doc.mjs), [global](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/global.doc.mjs), [who-answers](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/who-answers.doc.mjs), [short-and-findable](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/short-and-findable.doc.mjs), [debug-and-gap-reports](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/debug-and-gap-reports.doc.mjs)
- CLI 소스와 명령 문서: [agent-docs.mjs](https://github.com/meta/astryx/blob/main/packages/cli/foundation/agent-docs/agent-docs.mjs), [init](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/init.doc.mjs), [mcp](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/mcp.doc.mjs), [manifest](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/manifest.doc.mjs), [gap-report](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/gap-report.doc.mjs), [CLI README](https://github.com/meta/astryx/blob/main/packages/cli/README.md)의 "JSON API"와 "Capability manifest" 절
- 명세와 설계 문서: [AST-121 MCP server](https://github.com/meta/astryx/blob/main/docs/specs/AST-121-mcp-server/spec.md), [AST-041](https://github.com/meta/astryx/blob/main/docs/specs/AST-041-consumer-docs-audience/spec.md), [AST-046](https://github.com/meta/astryx/blob/main/docs/specs/AST-046-docs-tree/spec.md), [AST-081 Global mode](https://github.com/meta/astryx/blob/main/docs/specs/AST-081-global-mode/spec.md), [knowledge-contracts.md](https://github.com/meta/astryx/blob/main/docs/architecture/knowledge-contracts.md), [agentic-states.md](https://github.com/meta/astryx/blob/main/docs/design/agentic-states.md), [AGENTS.md](https://github.com/meta/astryx/blob/main/AGENTS.md), 저장소 이슈 #2306
- 플러그인과 바이브 테스트: [plugins/astryx/README.md](https://github.com/meta/astryx/blob/main/plugins/astryx/README.md), [SKILL.md](https://github.com/meta/astryx/blob/main/plugins/astryx/skills/astryx/SKILL.md), [marketplace.json](https://github.com/meta/astryx/blob/main/.claude-plugin/marketplace.json), [internal/vibe-tests/README.md](https://github.com/meta/astryx/blob/main/internal/vibe-tests/README.md)
- Chat 컴포넌트: [Chat.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Chat/Chat.doc.mjs), [ChatToolCalls.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Chat/ChatToolCalls.doc.mjs), [ChatComposer.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Chat/ChatComposer.doc.mjs), [ChatLayoutPanelChat.tsx](https://github.com/meta/astryx/blob/main/packages/cli/assets/templates/blocks/components/ChatLayout/ChatLayoutPanelChat.tsx)
