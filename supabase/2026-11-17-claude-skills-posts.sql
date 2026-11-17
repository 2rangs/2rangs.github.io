-- "Claude 스킬 실전" 연재 10편 (2026-01 ~ 2026-10). 여러 번 실행해도 결과가 같다.
-- 대표 이미지는 사이트에 함께 배포된 public/img/covers/<slug>.png 를 쓴다.
insert into public.blog_posts (slug, title, summary, tags, series, cover_url, body_markdown, published_at)
values
  ('claude-skills-what-and-why', 'Claude 스킬이란 무엇이고 왜 필요한가', '스킬은 SKILL.md 하나로 시작하는 폴더다. 프롬프트, CLAUDE.md와 무엇이 다르고 언제 스킬이 맞는지 정리한다.', array['AI', 'Claude', 'AI 에이전트']::text[], 'Claude 스킬 실전', 'https://2rangs.github.io/img/covers/claude-skills-what-and-why.png', $skill$
프론트엔드 팀에서 Claude를 쓰다 보면 같은 설명을 반복하는 순간이 온다. 디자인 토큰은 이 이름 규칙을 따라야 하고, 버튼은 이 컴포넌트만 써야 하고, 코드 리뷰에서는 이 항목을 먼저 본다는 식의 이야기다. 처음에는 대화창에 붙여 넣고, 조금 지나면 프로젝트의 `CLAUDE.md`에 옮기고, 결국 그 파일이 길어져서 무엇이 언제 필요한지 흐려진다.

Anthropic이 2025년 10월에 공개한 Agent Skills(이하 스킬)는 이 문제를 겨냥한 형식이다. 이 연재 "Claude 스킬 실전"의 첫 글에서는 스킬이 무엇인지, 폴더가 어떻게 생겼는지, 그리고 프롬프트나 `CLAUDE.md`와 무엇이 다른지를 공식 문서 기준으로 정리한다. 이 글은 2026년 1월 기준으로 확인한 내용이다.

## 스킬은 폴더다

공식 문서의 정의는 단순하다. 스킬은 지시문, 스크립트, 참고 자료를 담은 폴더이고, 에이전트가 필요할 때 찾아서 불러온다. 가장 작은 스킬은 `SKILL.md` 파일 하나가 들어 있는 디렉터리다.

```text
pdf-processing/
├── SKILL.md        (필수. 메타데이터와 지시문)
├── FORMS.md        (필요할 때 읽는 안내서)
├── REFERENCE.md    (상세 참고 자료)
└── scripts/
    └── fill_form.py  (실행하는 스크립트)
```

Anthropic 엔지니어링 블로그는 스킬 만들기를 신입 팀원에게 줄 온보딩 가이드를 쓰는 일에 비유한다. 사용 사례마다 별도의 에이전트를 만드는 대신, 팀이 가진 절차적 지식을 재사용 가능한 단위로 묶어 두는 것이다. 프론트엔드 팀으로 치면 "우리 팀 컴포넌트 리뷰 방법"이나 "디자인 토큰 추가 절차" 같은 문서를 에이전트가 읽을 수 있는 형태로 정리해 두는 셈이다.

## SKILL.md의 모양

`SKILL.md`는 YAML 프론트매터와 마크다운 본문으로 이루어진다. 공식 문서에 나오는 기본 형태는 다음과 같다.

```md
---
name: your-skill-name
description: Brief description of what this Skill does and when to use it
---

# Your Skill Name

## Instructions
[Clear, step-by-step guidance for Claude to follow]

## Examples
[Concrete examples of using this Skill]
```

Agent Skills 개요 문서가 요구하는 필드는 `name`과 `description` 두 개이고, 각각 제약이 있다.

- `name`은 최대 64자이고 소문자, 숫자, 하이픈만 쓸 수 있다. XML 태그를 넣을 수 없고 `anthropic`, `claude`라는 예약어도 쓸 수 없다.
- `description`은 비어 있으면 안 되고 최대 1,024자이며 XML 태그를 넣을 수 없다.

`description`에는 스킬이 무엇을 하는지와 언제 써야 하는지가 함께 들어가야 한다. 문서는 Claude가 요청을 이 설명과 비교해 스킬을 쓸지 정한다고 설명한다. 스킬이 제대로 불려 오느냐가 거의 이 한 줄에 달려 있다는 뜻이고, 그래서 다음 편 [SKILL.md 잘 쓰기](/blog/writing-skill-md/)에서 따로 다룬다.

> **참고** Claude Code에서는 규칙이 조금 느슨하다. Claude Code 문서 기준으로 프론트매터 필드는 모두 선택이고 `description`만 권장되며, `name`을 생략하면 디렉터리 이름을 쓴다. 다만 API나 claude.ai에 올릴 스킬이라면 두 필드를 모두 채우는 편이 안전하다.

## 필요한 만큼만 읽는다

스킬의 핵심 설계는 점진적 공개(progressive disclosure)다. 개요 문서는 스킬의 내용을 세 단계로 나눈다.

| 단계 | 언제 읽나 | 비용 |
|---|---|---|
| 메타데이터 | 항상(시작할 때) | 스킬당 약 100토큰 |
| 지시문(`SKILL.md` 본문) | 스킬이 호출될 때 | 5k 토큰 미만 |
| 참고 파일과 스크립트 | 필요할 때 | 읽기 전까지는 없음 |

시작할 때 시스템 프롬프트에 들어가는 것은 각 스킬의 `name`과 `description`뿐이다. 요청이 설명과 맞으면 Claude가 bash로 `SKILL.md`를 읽어 본문을 컨텍스트에 올린다. 본문이 다른 파일을 가리키면 그 파일도 필요할 때만 읽는다. 스크립트는 실행만 하고, 코드가 아니라 출력만 컨텍스트에 들어온다.

이 구조 덕분에 스킬을 여러 개 설치해도 쓰지 않는 스킬은 거의 공간을 차지하지 않는다. 문서 표현으로는 번들된 내용에 사실상 한도가 없다. 읽기 전까지는 컨텍스트를 소비하지 않기 때문이다. 세부 동작과 파일을 나누는 요령은 [점진적 공개 편](/blog/skills-progressive-disclosure/)에서 이어서 본다.

## 프롬프트와 무엇이 다른가

개요 문서는 프롬프트를 "일회성 작업을 위한 대화 단위의 지시"로, 스킬을 "필요할 때 불러오는 재사용 자원"으로 구분한다. 차이를 실무 관점에서 풀면 세 가지다.

- **반복이 사라진다.** 프롬프트는 매번 붙여 넣어야 한다. 스킬은 한 번 만들어 두면 관련 요청이 왔을 때 Claude가 알아서 쓴다.
- **코드와 자료를 함께 담는다.** 프롬프트에는 텍스트만 넣을 수 있다. 스킬은 파일 시스템에 있는 폴더라서 스크립트, 템플릿, 스키마 같은 파일을 같이 둘 수 있다. 엔지니어링 블로그는 정렬 같은 작업은 토큰을 생성하는 것보다 코드를 실행하는 편이 결정적이고 반복 가능하다고 설명한다.
- **조합된다.** 문서는 여러 스킬을 묶어 복잡한 다단계 작업을 처리하는 것을 장점으로 든다.

반대로 이번 대화에서 한 번만 필요한 지시라면 스킬로 만들 이유가 없다. 스킬은 "다음에도 또 설명하게 될 것"을 위한 형식이다.

## CLAUDE.md와 무엇이 다른가

Claude Code를 쓰는 팀이라면 `CLAUDE.md`와의 경계가 더 헷갈린다. 둘 다 마크다운이고 둘 다 팀 규칙을 담는다. 차이는 언제 읽히느냐다.

Claude Code 메모리 문서에 따르면 `CLAUDE.md`는 세션을 시작할 때마다 컨텍스트에 들어간다. 문서는 파일 하나를 200줄 안쪽으로 유지하라고 권하고, 길어질수록 컨텍스트를 더 쓰고 지시를 따르는 정도도 떨어진다고 적는다. 그리고 `CLAUDE.md`에는 매 세션 알아야 할 사실, 즉 빌드 명령, 컨벤션, 프로젝트 구조, "항상 X를 한다" 같은 규칙만 두라고 한다. 여러 단계로 된 절차이거나 코드베이스의 일부에서만 필요한 내용이면 스킬로 옮기라는 것이 문서의 안내다.

Claude Code 스킬 문서도 같은 방향이다. 같은 지시나 체크리스트를 계속 대화에 붙여 넣고 있거나, `CLAUDE.md`의 한 섹션이 절차가 되어 버렸다면 스킬을 쓰라고 한다. 스킬 본문은 쓰일 때만 로드되므로 긴 참고 자료도 필요해지기 전까지는 비용이 거의 없다.

정리하면 이렇게 나눌 수 있다.

| | CLAUDE.md | 스킬 |
|---|---|---|
| 읽히는 시점 | 매 세션 시작 | 호출될 때(평소엔 이름과 설명만) |
| 어울리는 내용 | 항상 지켜야 할 짧은 사실과 규칙 | 특정 작업의 절차, 긴 참고 자료, 스크립트 |
| 프론트엔드 팀 예시 | 패키지 매니저, 테스트 명령, 폴더 규칙 | 새 컴포넌트 추가 절차, 접근성 리뷰 체크리스트 |

예를 들어 "이 저장소는 pnpm을 쓴다"는 `CLAUDE.md`에 둔다. "새 디자인 토큰을 추가할 때는 이름 규칙을 확인하고, 다크 모드 값을 함께 정의하고, 문서 페이지를 갱신한다"는 토큰을 다룰 때만 필요한 절차이므로 스킬이 맞다. 스킬, 서브에이전트, MCP, 슬래시 명령까지 넓힌 비교는 [8편](/blog/skills-vs-mcp-subagents-claude-md/)에서 따로 정리한다.

## 어디에서 쓸 수 있나

개요 문서 기준으로 스킬은 Claude API, Claude Code, claude.ai에서 쓸 수 있고, 쓰는 방식은 제품마다 다르다.

- **Claude API**는 Anthropic이 만든 문서용 스킬(PowerPoint, Excel, Word, PDF)과 직접 만든 스킬을 모두 지원한다. code execution 도구가 필요하고, 직접 만든 스킬은 `/v1/skills` 엔드포인트로 올린다. 실행 환경은 네트워크 접근과 런타임 패키지 설치가 없는 샌드박스다.
- **Claude Code**는 직접 만든 스킬을 지원하며 업로드가 필요 없다. `~/.claude/skills/`(개인) 또는 `.claude/skills/`(프로젝트)에 폴더를 두면 된다. 문서 기준으로 사전 제작 문서 스킬은 Claude Code에서 제공되지 않는다.
- **claude.ai**는 사전 제작 스킬을 바로 쓸 수 있고, 직접 만든 스킬은 zip으로 올린다. code execution이 켜져 있어야 한다.

주의할 점은 표면 사이에 스킬이 동기화되지 않는다는 것이다. 문서는 claude.ai에 올린 스킬을 API에 따로 올려야 하고, Claude Code 스킬은 둘과 별개라고 명시한다. Claude Code에서의 실제 사용법은 [4편](/blog/claude-code-skills-in-practice/), API는 [6편](/blog/skills-on-the-claude-api/)에서 다룬다.

형식 자체는 Claude 전용이 아니다. 엔지니어링 블로그의 2025년 12월 업데이트에 따르면 Agent Skills는 플랫폼 간 이식성을 위한 오픈 표준으로 공개되었고, 명세는 agentskills.io에 있다.

## 신뢰할 수 있는 스킬만 쓴다

스킬은 지시문과 코드로 Claude에게 새 능력을 준다. 같은 이유로 악의적인 스킬은 Claude가 설명과 다른 방식으로 도구를 호출하거나 코드를 실행하게 만들 수 있다. 개요 문서는 직접 만들었거나 Anthropic에서 받은 스킬만 쓰라고 권하고, 출처가 불분명한 스킬은 `SKILL.md`, 스크립트, 이미지까지 번들된 파일 전체를 검토하라고 한다. 특히 외부 URL에서 데이터를 가져오는 스킬은 가져온 내용에 악의적인 지시가 섞일 수 있어 위험하다고 적는다. 문서의 표현대로 스킬은 소프트웨어를 설치하는 것처럼 다뤄야 한다. 배포와 보안 수칙은 마지막 [10편](/blog/sharing-skills-with-plugins/)에서 자세히 본다.

## 정리

- 스킬은 `SKILL.md`를 가진 폴더이고, 지시문뿐 아니라 참고 파일과 스크립트를 함께 담는다.
- `name`과 `description`만 항상 로드되고, 본문과 부속 파일은 필요할 때 읽힌다. 그래서 많이 설치해도 부담이 작다.
- 일회성 지시는 프롬프트로, 매 세션 필요한 짧은 사실은 `CLAUDE.md`로, 특정 작업의 절차와 자료는 스킬로 나눈다.
- API, Claude Code, claude.ai는 각각 따로 관리해야 하고, 남이 만든 스킬은 설치 전에 반드시 검토한다.

다음 편에서는 스킬이 제때 불려 오도록 `SKILL.md`, 특히 `description`을 쓰는 방법을 다룬다.

## 참고

- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/memory
- https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- https://agentskills.io
$skill$, '2026-01-12T09:00:00+09:00'::timestamptz),
  ('writing-skill-md', 'SKILL.md 잘 쓰기, description이 호출을 좌우한다', '스킬이 제때 불려 오는지는 name과 description에 달려 있다. 공식 모범 사례를 기준으로 프론트매터와 본문 쓰는 법을 정리한다.', array['AI', 'Claude']::text[], 'Claude 스킬 실전', 'https://2rangs.github.io/img/covers/writing-skill-md.png', $skill$
스킬을 처음 만들면 대개 본문부터 공들인다. 절차를 꼼꼼히 적고 예시도 넣는다. 그런데 막상 써 보면 Claude가 그 스킬을 쓰지 않는다. 본문이 나빠서가 아니라 Claude가 본문을 읽을 기회조차 얻지 못했기 때문이다.

[지난 편](/blog/claude-skills-what-and-why/)에서 본 것처럼 평소 컨텍스트에 들어가는 것은 스킬의 `name`과 `description`뿐이다. 이번 글은 Anthropic의 스킬 작성 모범 사례 문서(Skill authoring best practices)를 기준으로 프론트매터와 본문을 쓰는 방법을 정리한다. 2026년 2월 기준으로 확인한 내용이다.

## 프론트매터의 규칙

개요 문서와 모범 사례 문서 모두 `SKILL.md` 프론트매터에 두 필드를 요구한다.

- `name`은 최대 64자, 소문자와 숫자와 하이픈만 쓴다. XML 태그와 예약어(`anthropic`, `claude`)는 쓸 수 없다.
- `description`은 비어 있으면 안 되고 최대 1,024자이며 XML 태그를 쓸 수 없다. 스킬이 무엇을 하는지와 언제 써야 하는지를 담아야 한다.

오픈 표준 명세(agentskills.io)는 `name`에 몇 가지를 더 요구한다. 하이픈으로 시작하거나 끝나면 안 되고, 하이픈을 연달아 쓸 수 없으며, 상위 디렉터리 이름과 같아야 한다. 여러 제품에서 같은 스킬을 쓸 생각이라면 처음부터 이 규칙에 맞춰 두는 편이 낫다.

## 이름은 활동을 드러내게

모범 사례 문서는 이름에 동명사 형태(동사 + -ing)를 권한다. 스킬이 제공하는 활동이 이름에서 바로 보이기 때문이다.

- 권장: `processing-pdfs`, `analyzing-spreadsheets`, `testing-code`, `writing-documentation`
- 허용: `pdf-processing` 같은 명사구, `process-pdfs` 같은 동작형
- 피할 것: `helper`, `utils`, `tools`처럼 모호한 이름, `documents`, `data`처럼 지나치게 넓은 이름, 예약어를 포함한 이름

문서가 하나 더 강조하는 것은 한 컬렉션 안에서 패턴을 섞지 않는 것이다. 프론트엔드 팀이라면 `reviewing-components`, `adding-design-tokens`, `writing-storybook-stories`처럼 한 가지 형태로 맞춰 두면 문서와 대화에서 부르기 쉽다.

## description이 호출을 좌우하는 이유

모범 사례 문서는 Claude가 많게는 100개가 넘는 스킬 가운데 맞는 것을 고를 때 `description`을 쓴다고 설명한다. 개요 문서도 Claude가 요청을 이 설명과 비교해 스킬을 쓸지 정한다고 적는다. 설명이 모호하면 스킬은 존재하지만 쓰이지 않고, 설명이 너무 넓으면 엉뚱한 요청에 끼어든다.

문서가 제시하는 원칙은 세 가지다.

### 무엇을, 언제를 함께 쓴다

문서의 예시는 이렇다.

```yaml
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
```

앞 문장은 기능, 뒤 문장은 사용 시점이다. 피해야 할 예로는 `Helps with documents`, `Processes data`, `Does stuff with files`를 든다. 무엇을 하는지도, 언제 써야 하는지도 알 수 없는 설명이다.

### 3인칭으로 쓴다

문서는 경고 상자로 3인칭을 강조한다. 설명은 시스템 프롬프트에 들어가는데, 시점이 섞이면 스킬을 찾는 데 문제가 생길 수 있다는 이유다.

- 좋은 예: "Processes Excel files and generates reports"
- 피할 예: "I can help you process Excel files", "You can use this to process Excel files"

### 사용자가 실제로 쓰는 말을 넣는다

구체적인 키워드와 상황을 넣으라는 것이 문서의 요구다. PDF 예시가 "PDFs, forms, document extraction"을 나열하는 이유다. 프론트엔드 팀의 컴포넌트 리뷰 스킬이라면 이런 식이 된다.

```yaml
name: reviewing-components
description: Reviews Vue and React components against the team design system rules, including token usage, accessibility, and prop naming. Use when the user asks for a component review, mentions design tokens, or opens a pull request that touches UI components.
```

"component review", "design tokens", "pull request" 같은 단어는 팀원이 실제로 요청할 때 쓰는 말이다. Claude Code 문서의 문제 해결 항목도 스킬이 호출되지 않으면 먼저 설명에 사용자가 자연스럽게 말할 키워드가 들어 있는지 확인하라고 한다. 반대로 너무 자주 호출되면 설명을 더 구체적으로 좁히라고 한다.

> **참고** Claude Code 문서 기준으로 스킬 목록에서 `description`은 길이 상한에서 잘릴 수 있고, 스킬이 많으면 일부 설명이 목록에서 빠질 수도 있다. 문서는 핵심 사용 사례를 앞에 두라고 권한다. 1,024자를 다 채우기보다 앞 문장에 핵심을 담는 편이 안전하다.

## 본문은 짧게, Claude가 모르는 것만

모범 사례 문서의 첫 원칙은 "간결함"이다. 문서는 컨텍스트 창을 공공재에 비유한다. 스킬 본문은 시스템 프롬프트, 대화 기록, 다른 스킬의 메타데이터, 사용자의 요청과 같은 공간을 나눠 쓴다.

기본 가정은 Claude가 이미 똑똑하다는 것이다. 문서는 각 문단에 세 가지 질문을 던지라고 한다. Claude에게 이 설명이 정말 필요한가, 이미 알고 있다고 가정해도 되는가, 이 문단이 토큰 비용을 정당화하는가. 문서의 예시에서 PDF가 무엇인지부터 설명하는 장황한 버전은 약 150토큰, 라이브러리와 코드 몇 줄만 남긴 버전은 약 50토큰이다.

프론트엔드 스킬에 적용하면 "Vue의 `props`는 부모에서 자식으로 데이터를 전달하는 방법이다" 같은 문장은 지운다. 대신 "prop 이름은 `is`, `has`로 시작하는 불리언만 허용한다"처럼 팀에만 있는 규칙을 남긴다.

## 자유도를 작업에 맞춘다

문서는 지시의 구체성을 작업의 취약성에 맞추라고 한다.

- **높은 자유도**: 여러 접근이 모두 유효하고 맥락에 따라 판단이 달라질 때. 텍스트 지시로 충분하다. 코드 리뷰가 대표적이다.
- **중간 자유도**: 선호하는 패턴은 있지만 변형도 허용될 때. 의사 코드나 매개변수가 있는 템플릿을 준다.
- **낮은 자유도**: 작업이 깨지기 쉽고 순서가 중요할 때. 정확한 명령을 주고 바꾸지 말라고 적는다.

문서의 비유가 기억하기 좋다. 양쪽이 절벽인 좁은 다리에서는 정확한 난간이 필요하고, 위험 요소가 없는 들판에서는 방향만 알려 주면 된다. 디자인 토큰 빌드 스크립트를 돌리는 단계는 좁은 다리이고, 컴포넌트 구조에 대한 리뷰 의견은 들판에 가깝다.

## 본문 구성의 기본 틀

모범 사례 문서와 명세가 권하는 내용을 합치면 본문은 대략 이런 순서가 된다.

```md
---
name: reviewing-components
description: Reviews Vue and React components against the team design system rules, including token usage, accessibility, and prop naming. Use when the user asks for a component review, mentions design tokens, or opens a pull request that touches UI components.
---

# 컴포넌트 리뷰

## 리뷰 순서

다음 체크리스트를 복사해 진행 상황을 표시한다.

- [ ] 색상, 간격, 타이포그래피가 토큰을 쓰는지 확인
- [ ] 인터랙티브 요소에 접근 가능한 이름이 있는지 확인
- [ ] prop 이름 규칙 확인
- [ ] 결과를 아래 형식으로 정리

## 규칙

- 색상 값은 하드코딩하지 않는다. 반드시 `--color-*` 토큰을 쓴다.
- 불리언 prop은 `is` 또는 `has`로 시작한다.

## 출력 형식

리뷰 결과는 항상 이 구조를 따른다.

**요약**: 한 문단
**수정 필요**: 파일과 줄 번호를 포함한 목록
**제안**: 선택 사항 목록

## 추가 자료

- 토큰 전체 목록은 [tokens.md](tokens.md)를 본다.
```

이 틀에 담긴 문서의 권고를 하나씩 짚으면 다음과 같다.

- **복잡한 작업은 단계로 나누고 체크리스트를 준다.** 문서는 Claude가 응답에 복사해 하나씩 체크할 수 있는 체크리스트를 권한다. 검증 단계를 건너뛰는 것을 막아 준다.
- **출력 형식은 템플릿으로 준다.** 형식이 엄격해야 하면 "항상 이 구조를 쓴다"고 적고, 유연해도 되면 기본 형식을 주되 판단해서 조정하라고 적는다.
- **품질이 예시에 달려 있으면 입력과 출력 쌍을 준다.** 문서는 커밋 메시지 예시로 이 패턴을 보여 준다. 설명보다 예시가 원하는 스타일을 더 분명하게 전달한다.
- **용어를 통일한다.** "토큰", "변수", "CSS 변수"를 섞어 쓰지 말고 하나로 정한다. 문서는 일관된 용어가 Claude가 지시를 해석하고 따르는 데 도움이 된다고 적는다.
- **선택지를 너무 많이 주지 않는다.** 여러 라이브러리를 나열하기보다 기본값 하나와 예외 상황 하나를 준다.
- **시간에 따라 틀려질 정보를 넣지 않는다.** "8월 전이면 옛 API를 쓴다" 같은 문장 대신, 현재 방법을 적고 옛 방식은 별도의 "옛 패턴" 섹션으로 접어 둔다.

마지막 줄의 `tokens.md`처럼 길어지는 내용은 별도 파일로 뺀다. 문서는 `SKILL.md` 본문을 500줄 미만으로 유지하라고 권한다. 파일을 나누는 구체적인 방법은 [다음 편](/blog/skills-progressive-disclosure/)에서 다룬다.

## 만든 뒤에는 관찰한다

문서는 스킬을 만들 때 Claude 자신을 활용하라고 권한다. 한 Claude 인스턴스와 함께 스킬을 설계하고, 스킬을 불러온 새 인스턴스에게 실제 작업을 맡겨 관찰하는 방식이다. 이때 볼 것은 Claude가 예상과 다른 순서로 파일을 읽는지, 중요한 파일 링크를 놓치는지, 특정 파일만 반복해서 읽는지, 아예 열지 않는 파일이 있는지다. 문서는 특히 `name`과 `description`이 호출 여부를 결정하므로 관찰 결과를 설명에 반영하라고 한다. 평가 세트를 만드는 방법은 [9편](/blog/testing-skills/)에서 자세히 본다.

## 정리

- `name`은 소문자, 숫자, 하이픈으로 64자 이내. 활동이 보이는 동명사 형태를 권하고 한 컬렉션 안에서 패턴을 맞춘다.
- `description`은 무엇을 하는지와 언제 쓰는지를 3인칭으로, 사용자가 실제로 쓰는 키워드와 함께 적는다. 호출이 안 되면 키워드를 보강하고, 너무 자주 되면 범위를 좁힌다.
- 본문은 Claude가 모르는 팀 고유의 규칙만 담는다. 자유도는 작업의 취약성에 맞추고, 체크리스트, 템플릿, 예시로 구조를 잡는다.
- 본문은 500줄 미만으로 유지하고, 넘치는 내용은 별도 파일로 나눈다.

## 참고

- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://code.claude.com/docs/en/skills
- https://agentskills.io/specification
$skill$, '2026-02-09T09:00:00+09:00'::timestamptz),
  ('skills-progressive-disclosure', '스킬의 점진적 공개와 컨텍스트 예산', '스킬은 메타데이터, 본문, 참고 파일 순서로 필요한 만큼만 읽힌다. 이 구조를 이해하고 파일을 나누는 방법을 정리한다.', array['AI', 'Claude', '아키텍처']::text[], 'Claude 스킬 실전', 'https://2rangs.github.io/img/covers/skills-progressive-disclosure.png', $skill$
디자인 시스템 규칙을 스킬로 옮기다 보면 금방 분량 문제에 부딪힌다. 색상 토큰만 수십 개이고, 컴포넌트마다 사용 규칙이 있고, 접근성 체크리스트도 따로 있다. 이걸 `SKILL.md` 하나에 다 넣으면 버튼 색 하나를 물어볼 때도 전체 문서가 컨텍스트에 올라간다.

스킬은 이 문제를 점진적 공개(progressive disclosure)로 푼다. [1편](/blog/claude-skills-what-and-why/)에서 개념만 짧게 소개했는데, 이번 글에서는 실제로 어떤 순서로 무엇이 읽히는지, 그리고 그 구조에 맞춰 파일을 어떻게 나누는지를 공식 문서 기준으로 정리한다. 2026년 3월 기준으로 확인한 내용이다.

## 세 단계로 읽힌다

Agent Skills 개요 문서는 스킬의 내용을 로드 시점에 따라 세 단계로 나눈다.

| 단계 | 로드 시점 | 토큰 비용 | 내용 |
|---|---|---|---|
| 1단계 메타데이터 | 항상(시작할 때) | 스킬당 약 100토큰 | 프론트매터의 `name`, `description` |
| 2단계 지시문 | 스킬이 호출될 때 | 5k 토큰 미만 | `SKILL.md` 본문 |
| 3단계 이상 자료 | 필요할 때 | 읽기 전까지 없음 | 번들된 파일. 참고 파일은 읽을 때 컨텍스트에 들어가고, 스크립트는 실행 결과만 들어간다 |

오픈 표준 명세(agentskills.io)도 같은 구조를 Discovery, Activation, Execution이라는 이름으로 설명하고, 본문은 5,000토큰 미만을 권장한다. 엔지니어링 블로그는 이 구조를 목차, 장, 부록이 있는 매뉴얼에 비유한다.

각 단계를 조금 더 들여다보자.

### 1단계, 이름과 설명만 시스템 프롬프트에

Claude는 시작할 때 설치된 모든 스킬의 `name`과 `description`을 읽어 시스템 프롬프트에 넣는다. 문서 표현으로는 이 가벼운 방식 덕분에 컨텍스트 부담 없이 스킬을 많이 설치할 수 있다. 스킬이 호출되기 전까지 컨텍스트를 차지하는 것은 이름과 설명뿐이다.

### 2단계, 호출되면 SKILL.md를 읽는다

요청이 설명과 맞으면 Claude는 bash로 파일 시스템에서 `SKILL.md`를 읽는다. 이때 처음으로 본문이 컨텍스트에 들어온다. 개요 문서의 예시를 그대로 옮기면 이런 흐름이다.

```text
1. 시작: 시스템 프롬프트에 "pdf-processing - Extract text and tables from PDF files ..." 포함
2. 요청: "이 PDF의 텍스트를 추출해서 요약해 줘"
3. Claude 호출: bash: cat pdf-processing/SKILL.md → 본문이 컨텍스트에 로드됨
4. 판단: 양식 작성은 필요 없으므로 FORMS.md는 읽지 않음
5. 완료: SKILL.md의 지시만으로 작업 수행
```

4번이 핵심이다. 같은 스킬 안에 있어도 이번 작업에 필요 없는 파일은 열지 않는다.

### 3단계, 필요할 때만 파일을 연다

본문이 다른 파일을 가리키면 Claude는 필요할 때 그 파일을 추가로 읽는다. 스크립트는 다르게 다뤄진다. 개요 문서에 따르면 Claude가 스크립트를 실행하면 코드는 컨텍스트에 들어가지 않고 출력만 들어온다. "Validation passed" 같은 결과나 구체적인 오류 메시지만 토큰을 쓰는 것이다. 그래서 같은 일을 하는 코드를 작업 중에 Claude가 새로 생성하게 하는 것보다 훨씬 효율적이다.

문서는 이 덕분에 번들할 수 있는 내용에 사실상 한도가 없다고 설명한다. 파일은 읽히기 전까지 컨텍스트를 쓰지 않으므로 방대한 API 문서나 데이터셋, 예시를 넣어도 쓰이지 않으면 비용이 없다.

## 컨텍스트는 공공재다

그렇다고 본문을 아무렇게나 길게 써도 된다는 뜻은 아니다. 모범 사례 문서는 컨텍스트 창을 공공재(public good)라고 부른다. 스킬 본문은 시스템 프롬프트, 대화 기록, 다른 스킬의 메타데이터, 사용자 요청과 같은 공간을 나눠 쓴다. 문서는 시작할 때는 메타데이터만 로드되지만, `SKILL.md`가 한번 로드되면 모든 토큰이 대화 기록이나 다른 컨텍스트와 경쟁한다고 적는다.

이걸 예산으로 생각하면 판단이 쉬워진다.

- **1단계 예산**은 스킬 수에 비례한다. 설명 하나하나는 작지만 스킬이 늘면 합계가 커진다. 쓰지 않는 스킬을 정리하는 이유다.
- **2단계 예산**은 호출될 때마다 쓴다. 매번 필요한 내용만 본문에 남긴다. 문서는 본문을 500줄 미만으로 유지하고, 그 한도에 다가가면 별도 파일로 나누라고 권한다.
- **3단계 예산**은 실제로 읽은 파일만큼만 쓴다. 상세 자료는 여기에 둔다.

## 파일을 나누는 세 가지 패턴

모범 사례 문서는 `SKILL.md`를 온보딩 가이드의 목차처럼 쓰라고 한다. 본문은 개요와 안내를 맡고, 상세 내용은 필요할 때 Claude를 그쪽 파일로 보낸다. 문서가 제시하는 패턴은 세 가지다.

### 패턴 1, 개요와 참고 파일

가장 기본적인 형태다. 본문에 빠른 시작을 두고, 고급 기능은 파일로 안내한다.

```md
# PDF Processing

## Quick start

Extract text with pdfplumber. (코드 예시 몇 줄)

## Advanced features

**Form filling**: See [FORMS.md](FORMS.md) for complete guide
**API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
**Examples**: See [EXAMPLES.md](EXAMPLES.md) for common patterns
```

### 패턴 2, 도메인별로 나누기

여러 영역을 다루는 스킬이면 영역별로 파일을 나눈다. 문서의 예시는 BigQuery 스킬을 finance, sales, product, marketing으로 나눠 매출 질문에는 finance 파일만 읽게 한다. 디자인 시스템 스킬에 적용하면 이런 구조가 된다.

```text
design-system/
├── SKILL.md            (개요와 안내)
└── reference/
    ├── color.md        (색상 토큰과 다크 모드 규칙)
    ├── spacing.md      (간격, 레이아웃 토큰)
    ├── typography.md   (폰트, 행간 토큰)
    └── components.md   (컴포넌트 사용 규칙)
```

```md
# 디자인 시스템

## 영역별 자료

**색상**: 토큰, 다크 모드, 대비 기준 → [reference/color.md](reference/color.md)
**간격**: 여백, 그리드, 브레이크포인트 → [reference/spacing.md](reference/spacing.md)
**타이포그래피**: 폰트, 크기, 행간 → [reference/typography.md](reference/typography.md)
**컴포넌트**: 사용 규칙과 금지 패턴 → [reference/components.md](reference/components.md)

## 빠른 검색

특정 토큰은 `grep -i "surface" reference/color.md`처럼 검색해서 찾는다.
```

버튼 색을 물으면 `color.md`만 읽고 나머지 세 파일은 파일 시스템에 남는다. 문서는 각 파일 옆에 무엇이 들어 있는지 짧게 적어 두는 방식과, 긴 파일에서 필요한 부분을 `grep`으로 찾게 하는 방식을 함께 보여 준다.

### 패턴 3, 조건부 세부 사항

기본 내용은 본문에 두고, 특정 상황에서만 필요한 내용은 링크로 뺀다. 문서의 예시는 DOCX 스킬에서 일반 편집은 본문에 두고, 변경 추적이 필요할 때만 `REDLINING.md`를 읽게 한다. 프론트엔드라면 일반 컴포넌트 규칙은 본문에, 차트나 지도처럼 특수한 컴포넌트의 규칙은 별도 파일에 두는 식이다.

## 나눌 때 지켜야 할 것

파일을 나누면 Claude가 그 파일을 제대로 찾아 끝까지 읽는지가 새로운 문제가 된다. 모범 사례 문서가 짚는 주의점은 다음과 같다.

### 참조는 한 단계까지만

문서에 따르면 참조된 파일이 또 다른 파일을 참조하면 Claude가 그 파일을 부분적으로만 읽을 수 있다. 중첩된 참조를 만나면 파일 전체 대신 `head -100` 같은 명령으로 앞부분만 미리 볼 수 있고, 그러면 정보가 빠진다. 그래서 모든 참고 파일은 `SKILL.md`에서 바로 링크하라고 권한다. 위 디자인 시스템 예시에서 `color.md`가 다시 `dark-mode.md`를 가리키게 만들지 말고, 필요하면 `SKILL.md`에서 두 파일을 모두 직접 링크한다.

> **참고** 오픈 표준 명세도 파일 참조를 `SKILL.md`에서 한 단계 깊이로 유지하고, 깊게 이어지는 참조 사슬을 피하라고 적는다. 경로는 스킬 루트 기준 상대 경로로 쓴다.

### 긴 참고 파일에는 목차를 둔다

문서는 100줄이 넘는 참고 파일에는 맨 위에 목차를 두라고 한다. Claude가 앞부분만 미리 보더라도 파일 전체에 어떤 정보가 있는지 알 수 있고, 필요하면 전체를 읽거나 특정 섹션으로 바로 갈 수 있다. 토큰이 수십 개씩 나열된 `color.md` 같은 파일에 특히 유용하다.

```md
# 색상 토큰

## 목차
- 기본 팔레트
- 의미 토큰(surface, text, border)
- 상태 토큰(success, warning, danger)
- 다크 모드 대응 규칙

## 기본 팔레트
...
```

### 파일 이름과 경로

문서는 Claude가 스킬 디렉터리를 파일 시스템처럼 탐색한다는 점을 강조한다. 그래서 몇 가지가 중요해진다.

- 내용을 알 수 있는 이름을 쓴다. `doc2.md`가 아니라 `form_validation_rules.md`처럼.
- 도메인이나 기능별로 디렉터리를 나눈다. `docs/file1.md`보다 `reference/finance.md`가 낫다.
- 경로에는 항상 슬래시(`/`)를 쓴다. Windows 스타일 역슬래시는 Unix 환경에서 오류를 낸다.

### 스크립트는 실행인지 참고인지 밝힌다

스크립트를 번들할 때는 Claude가 그 파일을 실행해야 하는지, 읽어서 참고해야 하는지를 지시에 분명히 적으라고 문서는 말한다. "`analyze_form.py`를 실행해 필드를 추출한다"와 "추출 알고리즘은 `analyze_form.py`를 참고한다"는 컨텍스트 비용이 다르다. 대부분은 실행이 더 안정적이고 효율적이다. 스크립트를 쓰는 스킬은 [5편](/blog/skills-with-scripts/)에서 따로 다룬다.

## 언제 나눌까

모든 스킬을 처음부터 쪼갤 필요는 없다. 실무에서 쓰기 좋은 기준을 문서 내용에서 뽑으면 이렇다.

- 본문이 500줄에 가까워진다.
- 내용이 서로 다른 작업에 쓰인다. 색상 질문과 컴포넌트 질문은 같은 순간에 거의 함께 필요하지 않다.
- 특정 상황에서만 필요한 긴 절차나 참고 표가 있다.

반대 신호도 있다. 문서는 Claude가 같은 파일을 반복해서 읽는다면 그 내용을 `SKILL.md` 본문으로 옮기는 것을 고려하라고 하고, 한 번도 열지 않는 파일이 있다면 불필요하거나 본문에서 제대로 안내되지 않은 것일 수 있다고 한다. 나누는 것도 관찰을 보고 조정한다.

## 정리

- 스킬은 메타데이터(항상), 본문(호출될 때), 참고 파일과 스크립트(필요할 때) 순서로 읽힌다. 스크립트는 코드가 아니라 출력만 컨텍스트에 들어간다.
- 컨텍스트는 공공재다. 본문은 500줄 미만으로, 매번 필요한 내용만 남긴다.
- 개요와 참고 파일, 도메인별 분리, 조건부 세부 사항의 세 패턴으로 나눈다.
- 참조는 `SKILL.md`에서 한 단계까지만, 긴 파일에는 목차를, 파일 이름은 내용이 보이게 짓는다.

다음 편에서는 이 구조를 Claude Code에서 실제로 만들고 호출하는 방법을 다룬다.

## 참고

- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- https://agentskills.io/specification
- https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
$skill$, '2026-03-10T09:00:00+09:00'::timestamptz),
  ('claude-code-skills-in-practice', 'Claude Code에서 스킬 만들고 쓰기', 'Claude Code의 개인 스킬과 프로젝트 스킬 위치, 자동 호출과 직접 호출, 호출을 제어하는 프론트매터, 동작을 확인하는 방법을 정리한다.', array['AI', 'Claude', 'AI 에이전트']::text[], 'Claude 스킬 실전', 'https://2rangs.github.io/img/covers/claude-code-skills-in-practice.png', $skill$
지금까지 세 편에 걸쳐 스킬의 개념, `SKILL.md` 쓰는 법, 점진적 공개를 다뤘다. 이번에는 실제로 손을 움직일 차례다. 프론트엔드 팀에서 스킬을 가장 먼저 쓰게 되는 곳은 대개 Claude Code다. API처럼 업로드할 필요가 없고, 저장소에 폴더를 하나 커밋하면 팀 전체가 같은 스킬을 쓴다.

이 글은 Claude Code 문서(Extending Claude Code with Skills)를 기준으로 스킬을 어디에 두는지, 어떻게 호출되는지, 잘 동작하는지 어떻게 확인하는지를 정리한다. 2026년 4월 기준으로 문서에서 확인한 내용만 다룬다. Claude Code는 업데이트가 잦으므로 세부 동작은 사용하는 버전의 문서를 함께 확인하는 것이 좋다.

## 스킬을 두는 위치

Claude Code의 스킬은 파일 시스템 기반이다. 개요 문서 표현대로 API 업로드가 필요 없고 디렉터리에 `SKILL.md`를 두면 된다. 위치에 따라 적용 범위가 달라진다.

| 위치 | 경로 | 적용 범위 |
|---|---|---|
| 개인 | `~/.claude/skills/<skill-name>/SKILL.md` | 이 컴퓨터의 모든 프로젝트 |
| 프로젝트 | `.claude/skills/<skill-name>/SKILL.md` | 이 저장소의 세션. 커밋하면 팀과 공유된다 |
| 하위 디렉터리 | `<subdir>/.claude/skills/<skill-name>/SKILL.md` | `<subdir>` 안이나 그 아래에서 시작한 세션 |
| 플러그인 | `<plugin>/skills/<skill-name>/SKILL.md` | 플러그인이 켜진 곳. `/plugin-name:skill-name` 형태 |
| 엔터프라이즈 | 관리 설정 디렉터리 안의 `.claude/skills/<skill-name>/SKILL.md` | 조직이 배포한 컴퓨터의 모든 사용자 |

실무 기준으로는 이렇게 나누면 된다.

- **개인 스킬**에는 나만의 작업 습관을 둔다. 커밋 메시지 형식이나 내가 자주 쓰는 리팩터링 절차 같은 것이다.
- **프로젝트 스킬**에는 팀 규칙을 둔다. 디자인 토큰 추가 절차, 컴포넌트 리뷰 체크리스트처럼 이 저장소에서만 의미가 있는 것이다. 코드 리뷰를 거쳐 함께 다듬을 수 있다는 것도 장점이다.
- **하위 디렉터리 스킬**은 모노레포에서 유용하다. 예를 들어 `packages/ui/.claude/skills/`에 디자인 시스템 패키지 전용 스킬을 둘 수 있다. 문서에 따르면 하위 디렉터리의 스킬은 Claude가 그 디렉터리의 파일을 처음 읽거나 수정할 때 로드된다.

같은 이름의 스킬이 여러 곳에 있으면 엔터프라이즈가 개인을, 개인이 프로젝트를 이긴다. 플러그인 스킬은 이름 앞에 플러그인 이름이 붙으므로 충돌하지 않는다. 플러그인으로 배포하는 방법은 [10편](/blog/sharing-skills-with-plugins/)에서 다룬다.

> **참고** 예전 방식인 `.claude/commands/deploy.md`도 여전히 동작해서 `/deploy` 명령을 만든다. 문서는 새로 만들 때는 스킬을 권한다. 스킬은 부속 파일을 둘 수 있기 때문이다. 같은 이름이면 스킬이 우선한다.

## 첫 스킬 만들기

프로젝트 스킬 하나를 만들어 보자. 팀의 컴포넌트 작성 규칙에 맞춰 새 컴포넌트 뼈대를 만드는 스킬이다.

```bash
mkdir -p .claude/skills/new-component
```

`.claude/skills/new-component/SKILL.md`:

```md
---
name: new-component
description: Scaffolds a new UI component following the team design system conventions, including the component file, a Storybook story, and a unit test. Use when the user asks to create, add, or scaffold a new component.
argument-hint: [ComponentName]
---

# 새 컴포넌트 만들기

$ARGUMENTS 컴포넌트를 만든다.

## 규칙

- 컴포넌트 파일은 `src/components/<ComponentName>/` 아래에 둔다.
- 스타일 값은 하드코딩하지 않고 디자인 토큰을 쓴다.
- 불리언 prop은 `is` 또는 `has`로 시작한다.

## 순서

1. 같은 이름의 컴포넌트가 이미 있는지 확인한다.
2. 컴포넌트, 스토리, 테스트 파일을 만든다.
3. 테스트를 실행해 통과하는지 확인한다.
4. 만든 파일 목록을 보고한다.
```

여기에 쓴 프론트매터 필드는 모두 문서에 있는 것이다. Claude Code 문서 기준으로 프론트매터 필드는 전부 선택 사항이고 `description`만 권장된다. `name`을 생략하면 디렉터리 이름이 `/` 메뉴의 명령 이름이 된다. `argument-hint`는 자동 완성할 때 보여 줄 인자 힌트다.

문서는 필드 이름이 정확히 일치해야 하고, 알 수 없는 필드는 조용히 무시된다고 적는다. 오타가 나도 오류가 없으니 주의해야 한다. 또 YAML이 파싱되지 않으면 스킬은 필드가 하나도 없는 상태로 로드된다. 이 경우 `/new-component`로 직접 부를 수는 있지만 Claude가 `description`과 요청을 비교할 수 없어 자동 호출은 되지 않는다.

## 자동 호출과 직접 호출

스킬이 쓰이는 길은 두 가지다.

- **자동 호출**: 요청이 `description`과 맞으면 Claude가 스스로 스킬을 불러온다. "Badge 컴포넌트 하나 만들어 줘"라고 하면 위 스킬이 로드될 수 있다.
- **직접 호출**: `/new-component Badge`처럼 슬래시와 이름으로 부른다. 문서에 따르면 메시지 맨 앞에 이름을 써야 직접 호출이 된다. 평범한 문장 뒤에 `/deploy`를 쓰면 Claude가 그 스킬을 실행해도 된다는 허락으로 받아들일 뿐 바로 실행되지는 않는다.

### 인자 넘기기

직접 호출할 때 이름 뒤에 쓴 내용은 본문의 자리표시자로 들어간다.

| 자리표시자 | 들어가는 값 |
|---|---|
| `$ARGUMENTS` | 입력한 인자 전체 |
| `$ARGUMENTS[N]` 또는 `$N` | 0부터 세는 위치의 인자. `$0`, `$1` 등 |
| `${CLAUDE_SKILL_DIR}` | `SKILL.md`가 있는 디렉터리 |

문서의 예시처럼 `Migrate the $0 component from $1 to $2.`라고 쓰고 `/migrate-component SearchBar JavaScript TypeScript`로 부르면 세 값이 모두 채워진다. 여러 단어로 된 인자는 따옴표로 묶는다. 본문에 자리표시자가 없는데 인자를 넘기면 Claude Code가 `ARGUMENTS: <값>`을 덧붙인다.

`${CLAUDE_SKILL_DIR}`는 스킬에 스크립트를 넣을 때 쓸모가 있다. 스킬이 개인, 프로젝트, 플러그인 어디에 설치되어 있든 경로가 맞게 풀리기 때문이다.

## 호출을 제어하는 필드

모든 스킬이 자동으로 불려야 하는 것은 아니다. 문서는 두 필드로 누가 부를 수 있는지 정한다.

| 프론트매터 | 사용자 호출 | Claude 호출 | 설명이 컨텍스트에 |
|---|---|---|---|
| 기본값 | 가능 | 가능 | 들어감 |
| `disable-model-invocation: true` | 가능 | 불가 | 들어가지 않음 |
| `user-invocable: false` | 불가 | 가능 | 들어감 |

`disable-model-invocation: true`는 부작용이 있는 작업에 쓴다. 배포, 릴리스 태그 만들기, 디자인 토큰 패키지 배포처럼 Claude가 "지금이 적절하다"고 판단해서 실행하면 곤란한 일들이다. 이 필드를 켜면 설명이 컨텍스트에 아예 들어가지 않으므로 [3편](/blog/skills-progressive-disclosure/)에서 말한 1단계 예산도 아낄 수 있다.

`user-invocable: false`는 반대다. `/` 메뉴에서 숨기고 Claude만 쓰게 한다. 사용자가 직접 부를 일은 없지만 관련 작업에서 Claude가 참고해야 하는 배경 지식용 스킬에 맞다.

### 도구 사전 승인

`allowed-tools`는 스킬을 호출한 턴 동안 Claude가 확인 없이 쓸 수 있는 도구를 적는다. 문서의 커밋 스킬 예시는 이렇다.

```yaml
---
name: commit
description: Stage and commit the current changes
disable-model-invocation: true
allowed-tools: Bash(git add *) Bash(git commit *) Bash(git status *)
---
```

오해하기 쉬운 점이 두 가지 있다. 첫째, 이 필드는 나열한 도구를 미리 승인할 뿐 다른 도구를 막지는 않는다. 나열하지 않은 도구에는 평소 권한 설정이 그대로 적용된다. 둘째, 문서는 Claude Code가 신뢰하지 않은 폴더에서도 프로젝트 스킬의 승인을 적용하므로, 남의 저장소에서 Claude Code를 실행하기 전에 그 저장소 스킬의 `allowed-tools`를 검토하라고 경고한다. 팀 저장소에 스킬을 추가하는 PR이라면 리뷰할 때 이 필드를 꼭 본다.

## 잘 동작하는지 확인하기

스킬을 만들었으면 실제로 인식되고 호출되는지 확인해야 한다.

### 인식 여부

문서의 문제 해결 항목은 먼저 Claude에게 `What skills are available?`라고 물어 스킬이 목록에 보이는지 확인하라고 한다. 사용자 호출이 가능한 스킬이라면 `/`를 입력해 메뉴에 이름이 뜨는지, `/new-component`로 직접 부를 수 있는지도 본다. 문서는 `/context`로 스킬이 컨텍스트를 얼마나 쓰는지 볼 수 있다고 안내한다.

수정 사항은 다시 시작하지 않아도 반영된다. 문서에 따르면 Claude Code는 스킬 디렉터리를 감시하므로 `~/.claude/skills/`나 프로젝트의 `.claude/skills/` 아래를 고치면 바로 적용된다.

### 호출되지 않을 때

문서가 제시하는 순서는 이렇다.

1. 설명에 사용자가 자연스럽게 말할 키워드가 들어 있는지 확인한다.
2. `What skills are available?`에 스킬이 보이는지 확인한다.
3. 요청을 설명에 더 가깝게 바꿔 본다.
4. 사용자 호출이 가능하면 `/skill-name`으로 직접 불러 본다.

프론트매터 YAML이 잘못된 경우에도 직접 호출은 되므로, 직접 호출은 되는데 자동 호출만 안 된다면 YAML부터 의심한다. 문서는 `claude --debug`로 실행하면 파싱 오류를 볼 수 있다고 한다.

### 너무 자주 호출될 때

반대로 원하지 않는 요청에 스킬이 끼어들면 문서는 두 가지를 권한다. 설명을 더 구체적으로 좁히거나, 수동으로만 쓰고 싶다면 `disable-model-invocation: true`를 켠다. [2편](/blog/writing-skill-md/)에서 다룬 description 작성 원칙이 여기서 그대로 적용된다.

## 한 번 로드된 스킬은 대화에 남는다

마지막으로 알아 두면 좋은 동작이 하나 있다. 문서에 따르면 스킬이 호출되면 그 내용은 이후 턴에도 대화에 남아 있고, Claude Code는 파일을 다시 읽지 않는다. 그래서 문서는 스킬을 한 번만 할 단계가 아니라 계속 지킬 지침으로 쓰라고 권한다. "테스트를 실행한다"보다 "수정할 때마다 테스트를 실행한다"처럼 작업 전체에 걸리는 문장으로 쓰는 식이다. 반드시 매번 지켜야 하는 규칙이라면 스킬보다 훅으로 강제하는 편이 맞다고 문서는 설명한다. 이 구분은 [8편](/blog/skills-vs-mcp-subagents-claude-md/)에서 더 자세히 다룬다.

## 정리

- 개인 스킬은 `~/.claude/skills/`, 프로젝트 스킬은 `.claude/skills/`에 둔다. 프로젝트 스킬을 커밋하면 팀이 같은 스킬을 쓴다.
- 스킬은 `description`과 맞는 요청에 자동으로 불리거나, 메시지 맨 앞의 `/skill-name`으로 직접 불린다. 인자는 `$ARGUMENTS`, `$0` 등으로 받는다.
- 부작용 있는 작업에는 `disable-model-invocation: true`를, 배경 지식용 스킬에는 `user-invocable: false`를 쓴다. `allowed-tools`는 승인일 뿐 제한이 아니므로 리뷰에서 꼭 확인한다.
- 인식 여부는 `What skills are available?`와 `/` 메뉴로, 파싱 문제는 `claude --debug`로 확인한다.

다음 편에서는 스킬에 스크립트를 넣어 결정적인 작업을 코드에 맡기는 방법을 다룬다.

## 참고

- https://code.claude.com/docs/en/skills
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
$skill$, '2026-04-07T09:00:00+09:00'::timestamptz),
  ('skills-with-scripts', '스킬에 스크립트 넣기, 결정적인 일은 코드에 맡긴다', '스킬에 실행 스크립트를 넣는 이유와 방법을 정리한다. 자유도 정하기, 실행 환경별 의존성 제약, 출력 검증 루프까지 다룬다.', array['AI', 'Claude', 'AI 에이전트']::text[], 'Claude 스킬 실전', 'https://2rangs.github.io/img/covers/skills-with-scripts.png', $skill$
지금까지는 [SKILL.md 쓰는 법](/blog/writing-skill-md/), [점진적 공개](/blog/skills-progressive-disclosure/), [Claude Code에서 스킬 쓰기](/blog/claude-code-skills-in-practice/)처럼 모두 "글"에 관한 이야기였다. 이번에는 스킬 폴더에 실행 가능한 코드를 넣는다.

프론트엔드 팀에는 매번 같은 방식으로, 틀리지 않게 해야 하는 일이 많다. 디자인 토큰 형식 검사, 아이콘 파일 이름 규칙 확인 같은 것들이다. 이런 일을 매번 모델이 새로 코드를 짜서 처리하게 두면 결과가 조금씩 달라진다. 스크립트를 넣으면 이 부분을 고정할 수 있다. 2026년 5월 기준으로 공식 문서에서 확인한 내용이다.

## 왜 스크립트인가

Anthropic 엔지니어링 블로그는 어떤 작업은 토큰 생성보다 전통적인 코드가 낫다고 설명한다. 목록 정렬을 예로 들며, 많은 작업에 코드만이 주는 결정적인 신뢰성이 필요하다고 말한다.

공식 개요 문서의 동작 방식도 같은 방향이다. 스킬의 스크립트는 Claude가 bash로 실행하고, **스크립트 코드 자체는 컨텍스트에 들어가지 않는다.** 들어가는 것은 실행 결과뿐이다. 작성 모범 사례 문서는 미리 만든 스크립트의 장점으로 생성 코드보다 믿을 수 있고, 토큰과 시간을 아끼며, 매번 같은 결과를 낸다는 점을 든다.

## 얼마나 고정할지 먼저 정한다

모든 일을 스크립트로 만들 필요는 없다. 모범 사례 문서는 작업이 얼마나 깨지기 쉬운지에 맞춰 지시의 구체성을 정하라고 하며 세 단계로 나눈다.

- **높은 자유도**: 글로 된 지시. 여러 접근이 모두 맞고 맥락에 따라 판단이 달라질 때. 코드 리뷰가 대표적이다.
- **중간 자유도**: 의사 코드나 매개변수가 있는 스크립트. 선호 패턴은 있지만 변형을 허용할 때.
- **낮은 자유도**: 매개변수가 거의 없는 특정 스크립트. 실수하기 쉽고 일관성이 중요하며 순서가 정해진 작업.

문서의 비유대로, 양쪽이 절벽인 좁은 다리에는 난간과 정확한 지시가, 넓은 들판에는 방향만 있으면 된다. 토큰 파일 검증은 좁은 다리다. 규칙이 명확하고 틀리면 빌드나 디자인 QA에서 터진다. "이 컴포넌트 API가 자연스러운가"는 들판이다.

## 예시: 디자인 토큰 검증 스킬

토큰을 `{"color.bg.surface": "#FFFFFF"}` 같은 평평한 JSON으로 관리한다고 하자. 바꿀 때마다 이름 규칙, 색 형식, 참조 대상의 존재를 확인한다.

```text
validating-design-tokens/
├── SKILL.md
└── scripts/
    └── validate_tokens.py
```

SKILL.md는 언제 무엇을 실행할지만 알려 준다.

````md
---
name: validating-design-tokens
description: Validates design token JSON files for naming rules, color formats, and broken references. Use when adding or changing design tokens, editing tokens/*.json, or when the user mentions tokens or theme values.
---

# Validating design tokens

1. Edit the token file.
2. Run the validator on every changed file:

   ```bash
   python3 scripts/validate_tokens.py tokens/color.json
   ```

3. If it prints errors, fix each one and run it again.
4. Report the change as done only after it prints `OK`.

Do not hand-check the rules. The script is the source of truth.
````

스크립트는 표준 라이브러리만 쓴다. 이유는 뒤에서 설명한다.

```python
#!/usr/bin/env python3
"""Validate a flat design token JSON file."""
import json, re, sys

NAME = re.compile(r"^[a-z0-9]+(\.[a-z0-9-]+)+$")
HEX = re.compile(r"^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$")
REF = re.compile(r"^\{([a-z0-9.-]+)\}$")

def main(path):
    try:
        tokens = json.load(open(path, encoding="utf-8"))
    except FileNotFoundError:
        print(f"File not found: {path}. Pass a path such as tokens/color.json")
        return 2
    except json.JSONDecodeError as e:
        print(f"Invalid JSON in {path} at line {e.lineno}: {e.msg}")
        return 2

    errors = []
    for name, value in tokens.items():
        if not NAME.match(name):
            errors.append(f"Bad name '{name}'. Use dot-separated lowercase, e.g. color.bg.surface")
        ref = REF.match(str(value))
        if ref and ref.group(1) not in tokens:
            group = ref.group(1).rsplit(".", 1)[0]
            similar = [t for t in tokens if t.startswith(group)][:5]
            errors.append(f"'{name}' references missing '{ref.group(1)}'. Similar: {similar}")
        elif not ref and name.startswith("color.") and not HEX.match(str(value)):
            errors.append(f"'{name}' has invalid color '{value}'. Use #RRGGBB or #RRGGBBAA")

    print("\n".join(errors) if errors else "OK")
    return 1 if errors else 0

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: validate_tokens.py <token-file.json>")
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
```

## 실행할지, 읽을지를 분명히 쓴다

모범 사례 문서는 지시문에서 스크립트를 **실행**할지 **참고 자료로 읽을지**를 분명히 하라고 강조한다. "`analyze_form.py`를 실행해 필드를 추출한다"와 "추출 알고리즘은 `analyze_form.py`를 본다"는 전혀 다른 행동을 끌어낸다. 대부분은 실행이 더 믿을 만하고 효율적이라고 문서는 덧붙인다. 예시의 "Do not hand-check the rules"도 판정을 스크립트에 맡긴다고 못 박는 문장이다.

스크립트 작성 원칙도 문서에 있다.

- **떠넘기지 말고 해결한다.** 예외를 그냥 던져 Claude가 수습하게 두지 않는다.
- **마법 숫자를 피한다.** 설정값에는 이유를 주석으로 남긴다.
- **오류 메시지를 구체적으로 쓴다.** 무엇이 없고 대신 무엇이 있는지 알려 주면 Claude가 바로 고친다. 예시가 비슷한 토큰 이름을 함께 출력하는 이유다.
- **경로는 슬래시로 쓴다.** `scripts\helper.py` 같은 경로는 Unix 환경에서 오류를 낸다.

## 실행 환경과 의존성

같은 스킬도 어디서 도느냐에 따라 쓸 수 있는 것이 다르다. 개요 문서 기준으로 정리하면 이렇다.

- **Claude API**: 네트워크 접근이 없고 실행 중 패키지를 설치할 수 없다. 미리 설치된 패키지만 쓰며, 목록은 code execution 도구 문서에 있다.
- **claude.ai**: 사용자와 관리자 설정에 따라 네트워크 접근이 전부, 일부, 없음 중 하나다.
- **Claude Code**: 사용자 컴퓨터의 다른 프로그램과 같은 네트워크 접근을 가진다. 패키지는 전역이 아니라 로컬에만 설치하라고 권한다.

그래서 여러 곳에서 쓸 스킬은 의존성을 최소화하는 편이 안전하다. 외부 패키지가 꼭 필요하면 SKILL.md에 적고 대상 환경에서 쓸 수 있는지 확인한다. 모범 사례 문서도 패키지가 설치되어 있다고 가정하지 말라고 경고한다.

Claude Code에는 추가 장치가 있다. 문서에 따르면 `${CLAUDE_SKILL_DIR}`는 SKILL.md가 있는 디렉터리로 치환되어 작업 디렉터리와 상관없이 번들 스크립트를 가리킨다. `allowed-tools`는 스킬을 호출한 턴 동안 나열한 도구를 승인 없이 쓰게 한다. 문서 예시처럼 `allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)`로 두고 본문에서도 같은 경로를 쓰면, 그 스크립트는 권한 확인 없이 실행된다.

> **참고** 이런 Claude Code 전용 기능은 claude.ai 업로드나 API에서는 동작하지 않는다. 여러 환경에서 쓸 스킬이라면 `scripts/validate_tokens.py` 같은 상대 경로가 무난하다.

## 출력을 검증하는 루프

스크립트의 진짜 가치는 검증 루프에서 나온다. 모범 사례 문서가 권하는 기본 패턴은 "검증기 실행 → 오류 수정 → 반복"이고, 문서는 이 패턴이 출력 품질을 크게 높인다고 한다. 앞의 SKILL.md가 이 구조다. `OK`가 나오기 전에는 완료라고 보고하지 못한다.

여러 파일을 한 번에 바꾸면 한 단계를 더 둔다. 문서가 "계획-검증-실행"이라 부르는 패턴이다. Claude가 바꿀 내용을 `changes.json` 같은 파일로 먼저 쓰고, 스크립트로 그 계획을 검증한 뒤, 통과했을 때만 적용한다. 일괄 작업이나 되돌리기 어려운 변경에 맞는다. 토큰 이름 일괄 변경이라면 "변경 목록 작성 → 목록 검증 → 적용 → 전체 검증"이 된다. 흐름이 길면 체크리스트를 주고 Claude가 응답에 복사해 단계마다 지워 가게 한다. 검증 단계를 건너뛰는 일이 줄어든다.

코드가 들어가면 보안도 챙겨야 한다. 개요 문서는 직접 만들었거나 Anthropic에서 받은 스킬만 쓰라고 권하고, 출처가 불분명하면 스크립트를 포함한 모든 파일을 검토하라고 한다. 팀 저장소의 스킬이라면 스크립트 변경도 일반 코드처럼 리뷰를 거치게 한다.

## 정리

- 결정적이어야 하는 일과 복잡한 검증은 스크립트로 뺀다. 코드는 컨텍스트에 들어가지 않고 출력만 들어간다.
- 작업이 얼마나 깨지기 쉬운지에 따라 자유도를 정한다.
- 스크립트를 실행할지 읽을지 분명히 쓰고, 오류 메시지는 고칠 방법이 보이게 쓴다.
- API에는 네트워크와 런타임 설치가 없다. 여러 환경에서 쓸 스킬은 의존성을 줄인다.
- 검증 루프를 워크플로에 넣고, 통과 전에는 완료라고 보고하지 않게 한다.

다음 편에서는 이런 스킬을 [Claude API에서 쓰는 방법](/blog/skills-on-the-claude-api/)을 다룬다.

## 참고

- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- https://code.claude.com/docs/en/skills
- https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
$skill$, '2026-05-12T09:00:00+09:00'::timestamptz),
  ('skills-on-the-claude-api', 'Claude API에서 스킬 쓰기, container와 code execution으로 붙인다', 'Messages API에 사전 제작 스킬과 직접 만든 스킬을 붙이는 방법을 TypeScript로 정리한다. 업로드, 버전 고정, 파일 내려받기까지 다룬다.', array['Claude', 'AI 에이전트', 'TypeScript']::text[], 'Claude 스킬 실전', 'https://2rangs.github.io/img/covers/skills-on-the-claude-api.png', $skill$
[4편](/blog/claude-code-skills-in-practice/)에서는 Claude Code에서 폴더에 SKILL.md를 두는 것만으로 스킬을 썼다. API는 다르다. 스킬을 서버에 올리고, 요청마다 어떤 스킬을 쓸지 지정하고, 스킬이 만든 파일은 따로 내려받아야 한다. [지난 편](/blog/skills-with-scripts/)에서 만든 스크립트가 든 스킬도 API에서는 정해진 실행 환경 안에서만 돈다.

이 글은 공식 문서 "Using Agent Skills with the API"와 Agent Skills 개요 문서를 기준으로, 2026년 6월에 확인한 내용을 TypeScript(`@anthropic-ai/sdk`) 예제로 정리한다. 예제 코드는 문서의 TypeScript 예제를 그대로 따랐다.

## 구조 한눈에 보기

API에서 스킬은 code execution 도구 위에서 돈다. 문서는 사전 제작 스킬이든 직접 올린 스킬이든 붙이는 방식이 같다고 설명한다. 두 가지만 기억하면 된다.

- 요청의 `container.skills`에 쓸 스킬을 나열한다. 항목마다 `type`, `skill_id`, 선택값 `version`을 넣는다.
- `tools`에 code execution 도구를 넣는다. 스킬은 이 도구의 컨테이너 안에서 실행된다.

스킬의 출처는 둘이다.

| 구분 | Anthropic 스킬 | 사용자 스킬 |
| --- | --- | --- |
| `type` | `anthropic` | `custom` |
| `skill_id` | `pptx`, `xlsx`, `docx`, `pdf` | `skill_01...` 형식의 생성 ID |
| `version` | `20251013` 같은 날짜 또는 `latest` | `skver_01...` 형식의 버전 ID 또는 `latest` |
| 범위 | 모든 사용자 | 내 워크스페이스 |

문서 기준으로 요청당 스킬은 최대 20개까지 붙일 수 있다. 붙인 스킬은 [점진적 공개](/blog/skills-progressive-disclosure/) 방식으로 로드된다. 이름과 설명이 시스템 프롬프트에 들어가고, 스킬 파일은 컨테이너의 `/skills/{skill-name}/`에 복사된다. 디렉터리 이름은 `skill_01...` ID가 아니라 스킬 이름이다. 전체 지시문은 필요할 때만 읽힌다.

## 사전 제작 스킬 쓰기

가장 단순한 예는 PowerPoint 스킬이다.

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-opus-5-5",
  max_tokens: 4096,
  container: {
    skills: [
      {
        type: "anthropic",
        skill_id: "pptx",
        version: "latest"
      }
    ]
  },
  messages: [
    {
      role: "user",
      content: "Create a presentation about renewable energy"
    }
  ],
  tools: [
    {
      type: "code_execution_20250825",
      name: "code_execution"
    }
  ]
});
```

개요 문서에 따르면 사전 제작 스킬은 PowerPoint(`pptx`), Excel(`xlsx`), Word(`docx`), PDF(`pdf`) 네 가지다. Claude Code에서는 이 문서 스킬을 쓸 수 없다는 점도 함께 적혀 있다.

## 생성된 파일 내려받기

스킬이 문서를 만들면 응답에는 파일 자체가 아니라 `file_id`가 담긴다. 문서는 이 ID가 code execution 도구 결과 블록 안에 들어 있으며, Files API로 내려받아야 한다고 설명한다.

```ts
import Anthropic from "@anthropic-ai/sdk";
import { writeFile } from "node:fs/promises";

const client = new Anthropic();

// 1. 스킬로 파일 만들기
const response = await client.messages.create({
  model: "claude-opus-5-5",
  max_tokens: 4096,
  container: {
    skills: [{ type: "anthropic", skill_id: "xlsx", version: "latest" }]
  },
  messages: [
    {
      role: "user",
      content: "Create an Excel file with a simple budget spreadsheet"
    }
  ],
  tools: [{ type: "code_execution_20250825", name: "code_execution" }]
});

// 2. 응답에서 file_id 모으기
const fileIds: string[] = [];
for (const block of response.content) {
  if (
    block.type === "bash_code_execution_tool_result" &&
    block.content.type === "bash_code_execution_result"
  ) {
    for (const outputBlock of block.content.content) {
      fileIds.push(outputBlock.file_id);
    }
  }
}

// 3. Files API로 내려받아 저장
for (const fileId of fileIds) {
  const fileMetadata = await client.files.retrieveMetadata(fileId);
  const fileResponse = await client.files.download(fileId);

  await writeFile(fileMetadata.filename, Buffer.from(await fileResponse.arrayBuffer()));
  console.log(`Downloaded: ${fileMetadata.filename}`);
}
```

반대로 스킬에 입력 파일을 주려면 `client.files.upload`로 먼저 올리고, 메시지 `content`에 `{ type: "container_upload", file_id: fileObject.id }` 블록을 텍스트와 함께 넣는다. 파일은 code execution 컨테이너 안으로 들어간다.

## 직접 만든 스킬 올리기

사용자 스킬은 Skills API(`/v1/skills`)로 올린다. SDK에서는 `client.skills`다. zip 하나로 올려도 되고 파일을 하나씩 올려도 된다. 파일은 첨부할 때 붙인 이름으로 식별된다.

```ts
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import fs from "node:fs";

const client = new Anthropic();

// 파일을 하나씩 올리기 (zip 하나를 toFile로 넘겨도 된다)
const skill = await client.skills.create({
  files: [
    await toFile(fs.createReadStream("financial_skill/SKILL.md"), "financial_skill/SKILL.md", {
      type: "text/markdown"
    }),
    await toFile(
      fs.createReadStream("financial_skill/analyze.py"),
      "financial_skill/analyze.py",
      { type: "text/x-python" }
    )
  ]
});

console.log(`Created skill: ${skill.id}`);
console.log(`Latest version: ${skill.latest_version_id}`);
```

문서의 업로드 요건은 다음과 같다.

- `SKILL.md`가 업로드 루트에, 또는 하나뿐인 최상위 폴더 바로 아래에 있어야 한다.
- 전체 크기는 압축을 푼 기준 30MB 미만이다.
- `name`은 64자 이하, 소문자·숫자·하이픈만, XML 태그와 예약어(`anthropic`, `claude`) 불가. `description`은 비어 있지 않은 1,024자 이하이며 XML 태그 불가.
- `display_name`은 선택이다. 생략하면 SKILL.md의 `name`에서 가져온다.

프론트매터에도 주의할 점이 있다. Claude Code 문서는 claude.ai 업로드와 Skills API에서 쓸 수 있는 필드가 `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools` 여섯 개이고, 그 밖의 필드가 있으면 업로드가 오류로 실패한다고 적는다. `disable-model-invocation` 같은 Claude Code 전용 필드를 쓰던 스킬은 API에 올리기 전에 정리해야 한다.

목록 조회는 `for await (const skill of client.skills.list())`로 하고, `source: "custom"`으로 사용자 스킬만 거를 수 있다. `client.skills.retrieve(id)`로 조회하고 `client.skills.delete(id)`로 지운다. 문서 기준으로 스킬을 지우면 모든 버전이 함께 지워진다.

## 버전 관리

스킬 파일을 고치면 새 버전을 만든다. 문서가 강조하는 점은 새 버전이 변경분이 아니라 **전체 스냅샷**이라는 것이다. 매번 전체 파일을 올려야 하고, 빠진 파일은 이어지지 않는다. 새 버전 SKILL.md의 `name`은 기존 스킬 이름과 같아야 한다.

```ts
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";

const client = new Anthropic();

const newVersion = await client.skills.versions.create("skill_01AbCdEfGhIjKlMnOpQrStUv", {
  files: [fs.createReadStream("financial_skill.zip")]
});

// 운영 환경에서는 버전을 고정한다
const container: Anthropic.ContainerParams = {
  skills: [
    {
      type: "custom",
      skill_id: "skill_01AbCdEfGhIjKlMnOpQrStUv",
      version: newVersion.id
    }
  ]
};
```

문서의 권장은 분명하다. 운영에서는 특정 버전을 고정하고, 개발 중에는 `latest`를 쓴다. `version`을 빼거나 `latest`로 두면 워크스페이스의 누군가가 새 버전을 올리는 순간 운영 에이전트의 동작이 바뀐다. 버전 ID는 숫자처럼 보여도 항상 문자열이다. 팀에서 디자인 시스템 패키지를 semver로 고정하듯 스킬도 고정한다고 생각하면 된다.

## 여러 턴과 오래 걸리는 작업

응답의 `container`에는 컨테이너 `id`가 있다. 다음 요청에 같은 ID를 넘기면 컨테이너를 이어 쓸 수 있고, 앞서 만든 파일도 남아 있다. 스킬이 오래 걸리는 작업을 하면 `stop_reason`이 `pause_turn`으로 올 수 있다. 문서 예제는 응답을 그대로 이어 붙여 다시 요청한다.

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const messages: Anthropic.MessageParam[] = [
  { role: "user", content: "Generate and process a large sample dataset" }
];
const maxRetries = 10;

let response = await client.messages.create({
  model: "claude-opus-5-5",
  max_tokens: 4096,
  container: {
    skills: [{ type: "custom", skill_id: "skill_01AbCdEfGhIjKlMnOpQrStUv", version: "latest" }]
  },
  messages,
  tools: [{ type: "code_execution_20250825", name: "code_execution" }]
});

for (let i = 0; i < maxRetries; i++) {
  if (response.stop_reason !== "pause_turn") {
    break;
  }

  messages.push({
    role: "assistant",
    content: response.content as Anthropic.ContentBlockParam[]
  });
  response = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4096,
    container: {
      id: response.container!.id,
      skills: [
        { type: "custom", skill_id: "skill_01AbCdEfGhIjKlMnOpQrStUv", version: "latest" }
      ]
    },
    messages,
    tools: [{ type: "code_execution_20250825", name: "code_execution" }]
  });
}
```

문서는 이어서 요청할 때 컨테이너 ID를 스킬 목록과 같은 `container` 객체에 넣으라고 한다. 빠뜨리면 새 컨테이너에서 실행되어 앞서 만든 파일을 잃는다.

## 운영 전에 확인할 것

- **워크스페이스 범위**: 사용자 스킬은 최종 사용자나 세션 단위가 아니라 워크스페이스 전체에 공개된다. 워크스페이스에 접근할 수 있는 API 키는 모든 사용자 스킬을 읽고, 사용하고, 지울 수 있다. 분리해야 하는 스킬은 별도 워크스페이스에 둔다.
- **실행 환경**: 네트워크 접근이 없고 실행 중 패키지 설치도 안 된다. 스크립트는 미리 설치된 라이브러리만으로 돌아야 한다.
- **프롬프트 캐싱**: 스킬 목록이 바뀌면 캐시가 깨진다. 목록과 순서를 요청마다 같게 유지한다.
- **필요한 스킬만**: 문서는 쓰지 않는 스킬을 붙이면 성능에 영향을 준다고 한다.
- **오류 처리**: 스킬 문제로 실패한 요청은 HTTP 400을 돌려준다. SDK에서는 `Anthropic.BadRequestError`로 잡는다.
- **데이터 보존**: 개요 문서 기준으로 Agent Skills는 ZDR 대상이 아니다.

> **참고** 문서에는 이전 베타 헤더 `skills-2025-10-02`에서 옮기는 방법이 따로 정리되어 있다. 확인 시점 문서 기준으로 Skills API는 베타 헤더 없이 `client.skills`로 쓰며, 응답 필드 이름(`display_name`, `latest_version_id` 등)이 베타 때와 다르다. 예전 코드를 옮길 때는 이 표부터 본다.

## 정리

- API에서 스킬은 `container.skills`로 지정하고 code execution 도구를 함께 넣는다.
- 사전 제작 스킬은 `type: "anthropic"`과 `pptx`/`xlsx`/`docx`/`pdf`, 사용자 스킬은 `type: "custom"`과 생성된 ID로 붙인다.
- 생성된 파일은 응답의 `file_id`로 Files API에서 내려받고, 입력 파일은 `container_upload`로 넣는다.
- 사용자 스킬은 `client.skills.create`로 올리고, 새 버전은 매번 전체 파일로 만든다. 운영에서는 버전을 고정한다.
- 여러 턴과 `pause_turn`에서는 컨테이너 ID를 이어 넘긴다.

다음 편에서는 프론트엔드 팀의 [디자인 시스템 규칙을 스킬로 옮기는](/blog/design-system-skill/) 실전 예시를 처음부터 끝까지 만든다.

## 참고

- https://platform.claude.com/docs/en/build-with-claude/skills-guide
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool
- https://platform.claude.com/docs/en/build-with-claude/files
- https://code.claude.com/docs/en/skills
$skill$, '2026-06-09T09:00:00+09:00'::timestamptz),
  ('design-system-skill', '디자인 시스템 규칙을 스킬로 만들기, SKILL.md 전체 예시', '프론트엔드 팀의 토큰, 컴포넌트 사용 규칙, 리뷰 체크리스트를 하나의 스킬로 묶는다. 실제로 쓸 수 있는 SKILL.md와 참고 파일 전체를 보여 준다.', array['디자인 시스템', 'Claude', '협업']::text[], 'Claude 스킬 실전', 'https://2rangs.github.io/img/covers/design-system-skill.png', $skill$
디자인 시스템을 운영하면 코드 리뷰 코멘트가 반복된다. "여기 `#1F2937` 대신 토큰 써 주세요", "버튼을 직접 만들지 말고 `Button` 쓰면 됩니다", "모달에 포커스 트랩이 빠졌어요". Claude에게 UI 코드를 맡기면 같은 코멘트를 Claude에게 다시 하게 된다. 반복해서 붙여 넣는 지시와 체크리스트는 스킬로 옮기기 좋은 대상이다.

이번 편은 연재에서 다룬 원칙을 한 스킬에 모아 본다. 토큰, 컴포넌트 사용 규칙, 리뷰 체크리스트를 담은 디자인 시스템 스킬의 SKILL.md와 참고 파일 전체를 보여 주고, 왜 그렇게 나눴는지 설명한다. 예시의 패키지 이름(`@example/ui`), 토큰 이름, 컴포넌트 목록은 설명을 위해 만든 것이다. 형식과 제약은 2026년 7월 기준 공식 문서로 확인했다.

## 무엇을 스킬에 넣고 무엇을 뺄까

Claude가 이미 아는 것(Vue의 `defineProps`, React의 `forwardRef`, WCAG의 일반 원리)은 빼고, **우리 팀에만 있는 결정**만 넣는다. 모범 사례 문서의 기본 가정대로 Claude는 이미 충분히 똑똑하다.

남는 것은 세 가지다.

- **토큰**: 어떤 토큰이 있고, 어떤 상황에 어떤 토큰을 쓰는지
- **컴포넌트 사용 규칙**: 무엇을 직접 만들지 말고 무엇을 가져다 쓰는지, 자주 틀리는 props
- **리뷰 체크리스트**: UI 변경을 검토할 때 확인하는 항목

"이 저장소는 pnpm을 쓴다" 같은 항상 참인 사실은 [1편](/blog/claude-skills-what-and-why/)에서 정리했듯 `CLAUDE.md`에 둔다. 토큰 표처럼 UI 작업에서만 필요한 긴 내용이 스킬의 몫이다.

## 폴더 구조

[점진적 공개](/blog/skills-progressive-disclosure/) 원칙에 따라 SKILL.md는 목차와 워크플로만 갖고, 긴 내용은 참고 파일로 뺀다. 참고 파일은 모두 SKILL.md에서 한 단계로 연결한다.

```text
design-system-rules/
├── SKILL.md
└── references/
    ├── tokens.md
    ├── components.md
    └── review-checklist.md
```

Claude Code라면 저장소의 `.claude/skills/design-system-rules/`에 두고 커밋해 팀이 함께 쓴다. 프론트매터는 `name`과 `description`만 쓴다. Claude Code 문서 기준으로 이 둘은 Agent Skills 표준 필드라서, 같은 폴더를 claude.ai나 API에 올려도 수정할 필요가 없다. 표준 명세는 `name`이 상위 디렉터리 이름과 같아야 한다고 정하므로 폴더 이름도 `design-system-rules`로 맞췄다.

## SKILL.md

````md
---
name: design-system-rules
description: 프론트엔드 디자인 시스템(@example/ui)의 토큰, 컴포넌트 사용 규칙, UI 리뷰 체크리스트를 적용한다. Vue 3 또는 React 컴포넌트를 만들거나 고칠 때, 색·간격·글꼴·그림자 값을 정할 때, UI 변경을 리뷰할 때 사용한다. design tokens, CSS variables, Storybook, Button, Modal, theme, dark mode가 언급될 때도 사용한다.
---

# 디자인 시스템 규칙

UI 코드는 항상 @example/ui 컴포넌트와 디자인 토큰으로 만든다.
Vue 3와 React 버전의 API는 같다. 차이는 components.md에 적었다.

## UI 코드를 작성할 때

1. 만들려는 요소가 이미 있는지 references/components.md에서 확인한다.
   있으면 그대로 쓰고, 없을 때만 새로 만든다.
2. 색, 간격, 반경, 글꼴, 그림자는 references/tokens.md의 토큰만 쓴다.
   hex, rgb, px 값을 직접 쓰지 않는다. 예외는 1px 테두리 하나뿐이다.
3. 새 컴포넌트를 만들면 같은 커밋에 Storybook story를 추가한다.
   story에는 기본, 비활성, 오류 상태와 다크 테마를 포함한다.

## UI 변경을 리뷰할 때

아래 체크리스트를 응답에 복사하고 항목마다 확인한다.

```text
UI 리뷰:
- [ ] 1. 하드코딩된 값 검색
- [ ] 2. 직접 만든 컴포넌트가 기존 컴포넌트와 겹치는지
- [ ] 3. references/review-checklist.md 항목
- [ ] 4. Storybook story 추가 또는 갱신 여부
```

1단계는 변경된 파일에 대해 다음을 실행한다.

```bash
rg -n '#[0-9a-fA-F]{3,8}\b|rgba?\(|[0-9]+px' <변경된 파일들>
```

검색 결과마다 tokens.md에서 대응하는 토큰을 찾아 제안한다.
대응하는 토큰이 없으면 임의로 만들지 말고 "토큰 없음"으로 보고한다.

## 참고 파일

- 토큰 목록과 고르는 기준: [references/tokens.md](references/tokens.md)
- 컴포넌트 목록, 자주 틀리는 사용법, Vue/React 차이: [references/components.md](references/components.md)
- 리뷰 체크리스트 상세: [references/review-checklist.md](references/review-checklist.md)
````

## references/tokens.md

````md
# 디자인 토큰

토큰은 CSS 변수로 노출된다. 이름 규칙은 `--ds-<분류>-<용도>-<변형>`이다.
다크 테마는 같은 변수 이름에 다른 값을 넣으므로 테마별로 분기하지 않는다.

## 색

| 토큰 | 쓰는 곳 |
| --- | --- |
| `--ds-color-bg-canvas` | 페이지 배경 |
| `--ds-color-bg-surface` | 카드, 패널, 모달 배경 |
| `--ds-color-bg-subtle` | 표 머리글, 비활성 영역 |
| `--ds-color-text-primary` | 본문 |
| `--ds-color-text-secondary` | 보조 설명, 캡션 |
| `--ds-color-border-default` | 구분선, 입력 테두리 |
| `--ds-color-accent-default` | 주요 동작, 링크 |
| `--ds-color-danger-default` | 오류, 삭제 동작 |

고르는 기준:
- 배경 위의 글자는 같은 계열의 `text-*`만 쓴다. `accent`를 본문 색으로 쓰지 않는다.
- 상태 색(`danger`)은 의미가 있을 때만 쓴다. 강조 목적으로 쓰지 않는다.

## 간격

`--ds-space-1`(4px)부터 `--ds-space-8`(32px)까지 4px 단위다.
컴포넌트 안쪽 여백은 `space-2`~`space-4`, 섹션 사이는 `space-6` 이상을 쓴다.

## 반경, 글꼴, 그림자

- 반경: `--ds-radius-sm`(입력, 뱃지), `--ds-radius-md`(카드, 버튼), `--ds-radius-full`(아바타)
- 글꼴: `--ds-font-body`, `--ds-font-label`, `--ds-font-heading-sm|md|lg`
- 그림자: `--ds-shadow-raised`(드롭다운), `--ds-shadow-overlay`(모달)

## 예전 방식

<details>
<summary>SCSS 변수 ($gray-900 등)</summary>

이전 버전은 SCSS 변수를 썼다. 새 코드에서는 쓰지 않는다.
기존 코드에서 보이면 같은 용도의 CSS 변수로 바꾸도록 제안한다.
</details>
````

## references/components.md

````md
# 컴포넌트 사용 규칙

전체 목록과 props는 Storybook이 기준이다. 여기에는 자주 틀리는 것만 적는다.

## 직접 만들지 않는 것

버튼, 링크 버튼, 입력, 선택, 체크박스, 모달, 토스트, 툴팁은 항상 가져다 쓴다.
`<button class="...">`이나 `<div role="dialog">`를 새로 만들지 않는다.

## Button

- `variant`: `primary` | `secondary` | `danger`. 한 화면에 `primary`는 하나만 둔다.
- 아이콘만 있는 버튼은 `aria-label`이 필수다.
- 로딩 중에는 `disabled` 대신 `loading`을 쓴다.

## Modal

- 열고 닫기는 Vue에서 `v-model:open`, React에서 `open`과 `onOpenChange`로 제어한다.
- 포커스 트랩과 Esc 닫기는 컴포넌트가 처리한다. 직접 구현하지 않는다.
- 제목은 `title` prop으로 넘긴다. 스크린 리더가 이 값을 읽는다.

## Vue 3와 React의 차이

| 항목 | Vue 3 | React |
| --- | --- | --- |
| import | `@example/ui/vue` | `@example/ui/react` |
| 양방향 값 | `v-model` | `value` + `onChange` |
| 슬롯 | 이름 있는 slot | `children`, `render*` props |

```vue
<script setup lang="ts">
import { Button, Modal } from "@example/ui/vue";
import { ref } from "vue";

const open = ref(false);
</script>

<template>
  <Button variant="primary" @click="open = true">저장</Button>
  <Modal v-model:open="open" title="변경 사항 저장" />
</template>
```

```tsx
import { Button, Modal } from "@example/ui/react";
import { useState } from "react";

export function SaveDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>저장</Button>
      <Modal open={open} onOpenChange={setOpen} title="변경 사항 저장" />
    </>
  );
}
```
````

## references/review-checklist.md

````md
# UI 리뷰 체크리스트

각 항목은 "통과", "수정 필요", "해당 없음" 중 하나로 답하고,
수정 필요면 파일과 줄 번호, 바꿀 토큰이나 컴포넌트를 함께 적는다.

## 토큰
- hex, rgb, px 값이 직접 쓰이지 않았다(1px 테두리 제외)
- 다크 테마에서 깨질 수 있는 고정 색이 없다

## 컴포넌트
- 기존 컴포넌트와 겹치는 마크업을 새로 만들지 않았다
- 한 화면에 primary 버튼이 하나다

## 접근성
- 아이콘만 있는 버튼에 aria-label이 있다
- 키보드만으로 모든 동작을 할 수 있다
- 포커스 표시를 제거하지 않았다

## 문서
- 새 컴포넌트나 새 variant에 Storybook story가 있다
- story에 기본, 비활성, 오류 상태와 다크 테마가 있다
````

## 설계에서 고민한 점

**description에 트리거 단어를 넣었다.** [2편](/blog/writing-skill-md/)에서 봤듯 Claude는 description을 보고 스킬을 쓸지 정한다. 무엇을 하는지와 언제 쓰는지를 함께 쓰고, 팀원들이 실제로 쓰는 말(토큰, Storybook, Modal, 다크 모드)을 넣었다. 모범 사례 문서의 권장대로 3인칭으로 썼다.

**Storybook을 기준으로 두고 중복을 줄였다.** 컴포넌트 props를 전부 옮기면 문서와 코드가 금방 어긋난다. components.md에는 자주 틀리는 것만 적고 전체 목록은 Storybook을 기준으로 한다고 밝혔다.

**예전 방식은 접어 뒀다.** 모범 사례 문서는 시간이 지나면 틀려지는 정보를 본문에 쓰지 말고 "old patterns" 절에 모으라고 한다. SCSS 변수 이야기를 `<details>`로 분리한 이유다.

**판단이 필요 없는 검사는 명령으로 고정했다.** 하드코딩 값 찾기는 [5편](/blog/skills-with-scripts/)에서 본 낮은 자유도 작업이라 `rg` 명령을 그대로 적었다. 반대로 "기존 컴포넌트와 겹치는가"는 판단이 필요해 체크리스트 항목으로 남겼다.

**모든 요청에서 반드시 지켜야 하는 규칙은 스킬만으로 부족하다.** Claude Code 문서는 매번 지켜야 하는 규칙을 Claude가 건너뛴다면 hook으로 옮기라고 안내한다. hex 값 금지가 정말 예외 없는 규칙이라면 스킬과 별도로 stylelint나 ESLint 규칙으로 CI에서도 막는 편이 확실하다. 스킬은 Claude가 처음부터 맞게 쓰도록 돕고, 린트는 마지막 안전망이 된다.

## 써 보며 다듬기

모범 사례 문서는 지시를 길게 쓰기 전에 평가부터 만들라고 권한다. 스킬 없이 대표 작업을 시켜 실패한 지점을 찾고, 시나리오를 세 개 만든 뒤 그 실패를 고칠 만큼만 쓴다. 이 스킬이라면 이렇다.

- "설정 화면에 저장 버튼과 확인 모달을 추가해 줘" → `Button`과 `Modal`을 쓰고 hex 값을 쓰지 않는가
- "이 PR의 UI 변경을 리뷰해 줘" → 체크리스트를 복사하고 `rg` 검색을 실행하는가
- "카드 배경을 조금 더 밝게" → 임의 색 대신 `bg-*` 토큰 중에서 고르는가

스킬을 불러온 새 세션에 실제 작업을 맡겨 관찰하고, 특정 참고 파일을 전혀 열지 않는다면 SKILL.md의 연결을 보강한다. 평가를 체계적으로 돌리는 방법은 [9편](/blog/testing-skills/)에서 다룬다.

## 정리

- 디자인 시스템 스킬에는 Claude가 모르는 팀의 결정만 넣는다. 토큰, 컴포넌트 사용 규칙, 리뷰 체크리스트가 핵심이다.
- SKILL.md는 워크플로와 목차만 갖고, 긴 내용은 한 단계 아래 참고 파일로 뺀다.
- description에는 무엇을 하는지와 언제 쓰는지, 팀이 실제로 쓰는 단어를 넣는다.
- 판단이 필요 없는 검사는 명령으로 고정하고, 예외 없는 규칙은 린트나 hook으로도 막는다.

## 참고

- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://code.claude.com/docs/en/skills
- https://agentskills.io/specification
$skill$, '2026-07-14T09:00:00+09:00'::timestamptz),
  ('skills-vs-mcp-subagents-claude-md', '스킬, MCP, 서브에이전트, CLAUDE.md, 슬래시 명령 중 무엇을 쓸까', 'Claude Code의 확장 수단 다섯 가지를 로딩 시점과 컨텍스트 비용으로 비교하고, 상황별로 무엇을 고를지 정리한다.', array['Claude', 'AI 에이전트', '아키텍처']::text[], 'Claude 스킬 실전', 'https://2rangs.github.io/img/covers/skills-vs-mcp-subagents-claude-md.png', $skill$
스킬을 몇 개 만들어 쓰다 보면 비슷한 질문을 자주 받는다. "그거 CLAUDE.md에 쓰면 되지 않나요?", "MCP 서버로 만들면 안 되나요?", "서브에이전트랑 뭐가 달라요?" 다섯 가지 모두 Claude에게 무언가를 더 알려 주거나 더 할 수 있게 해 준다는 점은 같다. 그래서 처음에는 어디에 무엇을 둬야 할지 헷갈린다.

이 글은 그 선택 기준을 정리한다. 결론부터 말하면 기준은 두 가지다. 언제 컨텍스트에 올라가는가, 그리고 무엇을 제공하는가(지식인가, 도구인가, 격리된 작업 공간인가). 내용은 작성 시점의 Claude Code 공식 문서, 특히 확장 기능 개요(Extend Claude Code) 페이지를 기준으로 한다.

## 다섯 가지를 한 줄씩

공식 문서의 정의를 짧게 옮기면 다음과 같다.

- **CLAUDE.md(메모리)**: 매 세션 시작 때 읽는 지속 컨텍스트. 빌드 명령, 코딩 규칙처럼 "항상 이렇게 하라"는 내용.
- **스킬**: 필요할 때 불러오는 지식과 워크플로. `SKILL.md` 하나로 시작하고, `/스킬이름`으로 직접 부르거나 Claude가 description을 보고 알아서 불러온다.
- **MCP**: 외부 서비스와 도구를 연결하는 프로토콜. 이슈 트래커, 데이터베이스, 브라우저 같은 시스템을 Claude가 직접 읽고 조작하게 해 준다.
- **서브에이전트**: 자기 컨텍스트 창에서 따로 일하고 요약만 돌려주는 작업자. 별도 시스템 프롬프트, 도구 제한, 권한을 가진다.
- **슬래시 명령**: `/이름`으로 실행하는 명령. 문서 기준으로 사용자 정의 명령은 이제 스킬로 합쳐졌다. `.claude/commands/`의 파일은 계속 동작하지만, 새로 만든다면 스킬로 만드는 쪽이 권장된다.

마지막 항목은 [Claude Code에서 스킬 만들고 쓰기](/blog/claude-code-skills-in-practice/)에서도 다뤘다. `.claude/commands/deploy.md`와 `.claude/skills/deploy/SKILL.md`는 둘 다 `/deploy`가 되고, 이름이 겹치면 스킬이 이긴다. 스킬은 보조 파일을 함께 둘 수 있다는 점이 다르다. 그러니 "슬래시 명령이냐 스킬이냐"는 이제 거의 "직접 호출만 허용하는 스킬이냐, 자동 호출도 허용하는 스킬이냐"의 문제다. 이 차이는 frontmatter의 `disable-model-invocation: true` 한 줄로 정한다.

`/help`나 `/compact` 같은 내장 명령은 Claude Code에 정해진 동작이고, 우리가 만드는 확장과는 별개다. MCP 서버가 노출하는 프롬프트도 `/servername:promptname` 형태의 명령으로 나타나는데, 이 경우 명령의 출처는 MCP 서버다.

## 로딩 시점과 컨텍스트 비용

선택에서 가장 중요한 축은 컨텍스트 비용이다. 공식 문서의 표를 요약하면 다음과 같다.

| 기능 | 언제 올라가나 | 무엇이 올라가나 |
| - | - | - |
| CLAUDE.md | 세션 시작 | 파일 전체. 모든 요청에 포함 |
| 스킬 | 세션 시작 + 사용 시 | 시작 시 이름과 description, 사용 시 본문 |
| MCP 서버 | 세션 시작 | 도구 이름(전체 스키마는 필요할 때) |
| 서브에이전트 | 생성 시 | 메인과 분리된 새 컨텍스트 |

여기서 바로 실무 규칙 하나가 나온다. **모든 세션에 필요한 짧은 사실은 CLAUDE.md에, 가끔 필요한 긴 내용은 스킬에 둔다.** 문서는 CLAUDE.md를 파일당 200줄 아래로 유지하라고 권하고, 길어지면 참고 자료는 스킬로 옮기거나 `.claude/rules/`로 나누라고 한다. 스킬 문서도 같은 이야기를 한다. 같은 지시나 체크리스트를 대화에 계속 붙여 넣고 있거나, CLAUDE.md의 한 절이 사실이 아니라 절차가 되어 버렸다면 스킬로 만들 때라는 것이다.

`disable-model-invocation: true`를 붙인 스킬은 description조차 컨텍스트에 올라가지 않는다. 직접 부르기 전까지 비용이 0이다. 배포처럼 부작용이 있는 작업에는 이 설정이 비용 면에서도 안전 면에서도 낫다.

## CLAUDE.md vs 스킬

둘 다 "지시문을 담은 마크다운"이라 가장 많이 헷갈린다. 차이는 로딩 방식이다.

- CLAUDE.md는 항상 로드된다. `@path` 문법으로 다른 파일을 가져올 수 있지만, 가져온 파일도 함께 로드되므로 컨텍스트 비용은 줄지 않는다.
- 스킬은 필요할 때 로드된다. `/이름`으로 워크플로를 실행할 수도 있다.

디자인 시스템을 예로 들면 이렇게 나눌 수 있다.

```md
<!-- CLAUDE.md : 항상 필요한 사실 -->
- 패키지 매니저는 pnpm을 쓴다.
- 색상은 하드코딩하지 않고 디자인 토큰을 쓴다. 자세한 규칙은 design-system 스킬을 따른다.
- 커밋 전에 `pnpm lint`와 `pnpm test`를 실행한다.
```

토큰 전체 목록, 컴포넌트별 사용 규칙, 리뷰 체크리스트처럼 긴 내용은 [디자인 시스템 규칙을 스킬로 만들기](/blog/design-system-skill/)에서 만든 스킬에 둔다. CLAUDE.md에는 "이런 규칙이 있고 어디서 찾는다"만 남긴다.

중간 단계도 있다. `.claude/rules/`의 규칙 파일은 `paths` frontmatter로 특정 파일 패턴에만 걸 수 있다. 예를 들어 `src/components/**/*.vue`를 다룰 때만 올라가는 규칙을 만들 수 있다. 문서 기준으로 정리하면 이렇다. 프로젝트 전체에 필요한 내용은 CLAUDE.md, 특정 언어나 디렉터리에만 해당하는 지침은 rules, 가끔 필요한 참고 자료와 반복 워크플로는 스킬이다.

> **참고** CLAUDE.md와 스킬은 모두 Claude가 맥락으로 읽는 지시일 뿐 강제되는 설정이 아니다. "`.env`는 절대 수정하지 말 것"처럼 반드시 지켜져야 하는 규칙이라면 문서는 PreToolUse 훅으로 막으라고 권한다.

## MCP vs 스킬

이 둘은 경쟁 관계가 아니라 층이 다르다. 문서의 표현을 빌리면, MCP는 Claude를 외부 서비스에 연결하고, 스킬은 그 서비스를 잘 쓰는 법을 포함해 Claude가 아는 것을 늘린다.

- MCP가 주는 것: 도구와 데이터 접근. 연결과 인증은 서버가 처리한다.
- 스킬이 주는 것: 지식, 워크플로, 참고 자료.

판단 기준은 단순하다. **Claude가 볼 수 없는 시스템의 데이터를 계속 복사해서 붙여 넣고 있다면 MCP**, **Claude가 이미 쓸 수 있는 도구를 우리 팀 방식대로 쓰게 하고 싶다면 스킬**이다. 예를 들어 디자인 도구나 이슈 트래커 연결은 MCP 서버의 몫이다. 그 데이터를 받아서 "우리 팀은 이슈 본문에서 수용 기준을 이렇게 뽑고, 컴포넌트 이름은 이렇게 매핑한다"는 절차는 스킬에 쓴다.

MCP 서버는 범위(scope)에 따라 저장 위치가 다르다. 문서 기준으로 local(기본값, `~/.claude.json`의 해당 프로젝트 항목), project(프로젝트 루트의 `.mcp.json`, 버전 관리로 팀과 공유), user(`~/.claude.json`, 내 모든 프로젝트) 세 가지가 있다.

```bash
# 팀과 공유할 서버는 project 범위로 추가하면 .mcp.json에 기록된다
claude mcp add --transport http shared-server --scope project https://example.com/mcp
```

비용 면에서는 MCP도 가볍다. 문서에 따르면 도구 검색(tool search)이 기본으로 켜져 있어, 세션 시작 때는 도구 이름과 서버 지시만 올라가고 전체 JSON 스키마는 필요할 때 불러온다. 다만 문서는 서버를 연결하기 전에 신뢰할 수 있는지 확인하라고 경고한다. 외부 콘텐츠를 가져오는 서버는 프롬프트 인젝션의 통로가 될 수 있다.

## 서브에이전트 vs 스킬

스킬은 메인 대화의 컨텍스트에 내용을 더한다. 서브에이전트는 별도의 컨텍스트 창에서 일하고 요약만 돌려준다. 문서의 비교표에서 핵심 차이는 이것이다.

| | 스킬 | 서브에이전트 |
| - | - | - |
| 정체 | 재사용 가능한 지시, 지식, 워크플로 | 자기 컨텍스트를 가진 격리된 작업자 |
| 컨텍스트 영향 | 메인 창에 더해짐 | 별도 창 사용 |
| 잘 맞는 일 | 참고 자료, 호출형 워크플로 | 파일을 많이 읽는 조사, 병렬 작업 |

서브에이전트는 `.claude/agents/`(프로젝트)나 `~/.claude/agents/`(개인)에 마크다운 파일로 정의한다. frontmatter에서 `name`과 `description`이 필수이고, `tools`로 쓸 수 있는 도구를 제한할 수 있다. 본문은 그 에이전트의 시스템 프롬프트가 된다.

```md
---
name: a11y-auditor
description: 변경된 컴포넌트의 접근성 문제를 조사한다. 컴포넌트 수정 후 접근성 점검이 필요할 때 사용한다.
tools: Read, Grep, Glob
---

변경된 Vue/React 컴포넌트를 읽고 접근성 문제를 찾는다.
라벨 없는 입력, 키보드로 닿지 않는 인터랙션, 대비가 부족한 토큰 사용을 파일과 줄 번호로 보고한다.
```

언제 서브에이전트를 쓸지에 대해 문서가 주는 기준은 분명하다. 다시 참조하지 않을 검색 결과, 로그, 파일 내용으로 메인 대화가 넘칠 때, 도구 제한을 강제하고 싶을 때, 작업이 독립적이라 요약만 돌려받으면 될 때다. 반대로 주고받기가 잦거나, 계획과 구현과 테스트가 많은 맥락을 공유하거나, 빠르고 작은 수정이라면 메인 대화가 낫다.

### 둘을 함께 쓰는 두 방향

스킬과 서브에이전트는 조합할 수 있고, 방향이 두 가지다.

- **스킬에 `context: fork`**: 스킬 본문이 서브에이전트의 작업 지시가 된다. `agent` 필드로 에이전트 유형을 고르며, 생략하면 `general-purpose`다. 서브에이전트는 대화 기록을 보지 못하므로 스킬 지시가 그 자체로 완결되어야 한다. 문서는 "이 API 규칙을 따르라" 같은 지침만 있고 할 일이 없는 스킬에 `context: fork`를 쓰면 의미 있는 결과가 나오지 않는다고 경고한다.
- **서브에이전트에 `skills` 필드**: 나열한 스킬의 전체 내용이 서브에이전트 시작 시 주입된다. description만 올라가는 것이 아니다. 단, `disable-model-invocation: true`인 스킬은 미리 로드할 수 없다.

앞의 `a11y-auditor`라면 `skills: [design-system]`을 넣어 토큰 규칙을 미리 알고 시작하게 할 수 있다.

## 어떤 순서로 도입하나

문서는 처음부터 다 갖출 필요가 없다면서, 계기별로 무엇을 추가할지를 표로 제시한다. 프론트엔드 팀 상황에 맞게 옮기면 이렇다.

- Claude가 같은 규칙이나 명령을 두 번 틀리면 → CLAUDE.md에 추가
- 작업을 시작할 때마다 같은 프롬프트를 입력하면 → 사용자 호출형 스킬
- 같은 절차서를 세 번째 붙여 넣고 있으면 → 스킬
- Claude가 볼 수 없는 브라우저 탭에서 데이터를 계속 복사하고 있으면 → MCP 서버
- 곁가지 작업이 다시 보지 않을 출력으로 대화를 덮으면 → 서브에이전트
- 묻지 않아도 매번 일어나야 하는 일이 있으면 → 훅
- 두 번째 저장소에도 같은 구성이 필요해지면 → 플러그인

마지막 항목인 플러그인은 위의 것들을 하나로 묶어 배포하는 포장 단위다. 이 부분은 다음 글인 [팀과 스킬 공유하기](/blog/sharing-skills-with-plugins/)에서 다룬다.

## 정리

- 기준은 로딩 시점과 제공하는 것이다. 항상 필요한 짧은 사실은 CLAUDE.md, 가끔 필요한 지식과 반복 절차는 스킬, 외부 시스템 연결은 MCP, 컨텍스트 격리가 필요한 작업은 서브에이전트다.
- 사용자 정의 슬래시 명령은 스킬로 합쳐졌다. 직접 호출만 허용하려면 `disable-model-invocation: true`를 쓴다.
- MCP와 스킬은 층이 다르다. MCP가 연결을 주고, 스킬이 그 연결을 쓰는 우리 팀의 방식을 준다.
- 스킬과 서브에이전트는 `context: fork`와 `skills` 필드로 양방향으로 조합된다.
- CLAUDE.md도 스킬도 강제가 아니다. 반드시 지켜야 하는 규칙은 훅으로 만든다.

## 참고

- https://code.claude.com/docs/en/features-overview
- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/mcp
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/plugins
$skill$, '2026-08-11T09:00:00+09:00'::timestamptz),
  ('testing-skills', '스킬 테스트와 평가, 호출되는지와 결과가 맞는지 따로 재기', '스킬이 제때 호출되는지와 호출됐을 때 결과가 맞는지를 나눠서 평가 세트로 측정하고, 기준선과 비교하며 반복 개선하는 방법을 정리한다.', array['Claude', 'AI 에이전트']::text[], 'Claude 스킬 실전', 'https://2rangs.github.io/img/covers/testing-skills.png', $skill$
스킬을 만들고 한두 번 써 보면 "잘 되네" 싶은 순간이 온다. 문제는 그 판단이 대개 내가 방금 쓴 프롬프트, 그리고 스킬을 작성하면서 쌓인 대화 맥락 위에서 내려진다는 점이다. 팀원이 다른 말투로 요청하거나, 새 세션에서 요청하거나, 다른 모델로 돌리면 결과가 달라진다.

Claude Code 문서는 이 지점을 짧게 짚는다. 스킬이 트리거되는 것을 봤다는 건 Claude가 스킬을 찾았다는 뜻이지, 의도한 일을 했다는 뜻은 아니다. 그래서 두 가지를 따로 재야 한다. 호출되어야 할 프롬프트에서 호출되는가, 그리고 호출됐을 때 결과가 기대와 맞는가. 이 글은 작성 시점의 공식 문서(Claude Code 스킬 문서, Agent Skills 모범 사례, agentskills.io의 평가 가이드)를 바탕으로 그 방법을 정리한다.

## 평가를 먼저 만든다

모범 사례 문서는 순서를 뒤집으라고 권한다. 문서를 길게 쓰기 전에 평가부터 만들라는 것이다. 상상 속의 요구가 아니라 실제 문제를 풀고 있는지 확인하기 위해서다. 문서가 제시하는 평가 주도 개발의 흐름은 다음과 같다.

- **빈틈 찾기**: 스킬 없이 대표적인 작업을 Claude에게 시키고, 구체적인 실패나 빠진 맥락을 기록한다.
- **평가 만들기**: 그 빈틈을 겨냥한 시나리오를 세 개 만든다.
- **기준선 측정**: 스킬 없이 돌렸을 때의 성능을 잰다.
- **최소한의 지시 작성**: 빈틈을 메우고 평가를 통과할 만큼만 쓴다.
- **반복**: 평가를 돌리고, 기준선과 비교하고, 다듬는다.

[디자인 시스템 스킬](/blog/design-system-skill/)이라면 이렇게 시작할 수 있다. 스킬 없이 "버튼 컴포넌트에 위험 상태를 추가해 줘"라고 시켜 보면 색상을 hex 값으로 하드코딩하거나 이미 있는 토큰을 무시하는 실패가 나온다. 그 실패가 첫 평가 시나리오가 된다.

한 가지 짚어 둘 점이 있다. 모범 사례 문서는 이런 평가를 돌리는 내장 방법이 현재는 없다고 명시한다. 평가 체계는 직접 만들어야 하고, 그 평가가 스킬 효과를 판단하는 기준이 된다.

## 호출 평가, description이 제때 걸리는가

[SKILL.md 잘 쓰기](/blog/writing-skill-md/)에서 다뤘듯 스킬 호출은 description이 좌우한다. 에이전트는 시작할 때 각 스킬의 `name`과 `description`만 읽고, 요청이 description과 맞을 때 본문을 읽는다. 그러니 호출 평가는 곧 description 평가다.

### 질의 세트 설계

agentskills.io의 description 최적화 가이드는 호출되어야 하는 질의와 호출되면 안 되는 질의에 각각 라벨을 붙인 세트를 만들라고 한다. 규모는 20개 정도, 양쪽 8~10개씩을 권한다.

```json
[
  { "query": "Badge 컴포넌트에 warning 변형 추가해 줘. 색은 기존 거랑 맞추고", "should_trigger": true },
  { "query": "PR 올리기 전에 이 폼 컴포넌트가 우리 디자인 규칙 어긴 데 없는지 봐 줘", "should_trigger": true },
  { "query": "이 차트 데이터 변환 함수 단위 테스트 좀 써 줘", "should_trigger": false },
  { "query": "Tailwind 설정 파일에서 빌드 경고 나는 이유 알려 줘", "should_trigger": false }
]
```

호출되어야 하는 질의는 여러 축으로 변화를 준다. 격식 있는 말투와 편한 말투, 오타와 약어를 섞는다. 도메인을 직접 언급하는 질의("디자인 토큰 기준으로 봐 줘")와 필요만 설명하는 질의("색이 다른 화면이랑 안 맞아")를 섞는다. 짧은 요청과 파일 경로나 배경이 긴 요청도 섞는다. 가이드가 가장 유용하다고 꼽는 것은 스킬이 도움이 되지만 질의만 봐서는 연결이 분명하지 않은 경우다. 질의가 스킬 기능을 그대로 말하면 어떤 description이든 걸리기 때문이다.

호출되면 안 되는 질의에서 가치가 큰 것은 "아슬아슬하게 빗나가는" 질의다. 키워드나 개념은 겹치지만 실제로는 다른 일이 필요한 요청이다. 위 예시의 Tailwind 설정 질문처럼 스타일 관련 단어가 나오지만 디자인 시스템 규칙 검토와는 상관없는 요청이 여기에 해당한다. "날씨 알려 줘" 같은 무관한 질의는 아무것도 시험하지 못한다.

가이드는 단순한 한 단계 요청은 description이 완벽해도 스킬을 부르지 않을 수 있다고도 짚는다. 에이전트는 혼자 처리하기 어려운 작업에서 스킬을 찾는 경향이 있기 때문이다. 평가 질의는 스킬이 실제로 필요한 수준의 작업으로 만든다.

### 여러 번 돌려서 비율로 본다

모델의 동작은 비결정적이어서 같은 질의도 한 번은 호출되고 다음엔 안 될 수 있다. 가이드는 질의마다 여러 번(3회를 출발점으로) 돌려 호출 비율을 계산하라고 한다. 호출되어야 하는 질의는 비율이 임계값(기본 0.5)보다 높으면 통과, 호출되면 안 되는 질의는 낮으면 통과다. 20개 질의를 3번씩이면 60회라 스크립트로 돌리는 것이 현실적이다.

Claude Code에서는 비대화형 모드(`claude -p`)를 쓸 수 있다. `--output-format stream-json --verbose`로 실행하면 이벤트가 한 줄에 하나씩 JSON으로 나온다. 그 안에서 `Skill` 도구 호출을 찾으면 된다. agentskills.io 가이드의 예시 스크립트도 Claude Code의 JSON 출력에서 이름이 `Skill`인 `tool_use`를 찾는 방식이다. 다만 가이드는 이 판정 로직을 각자 쓰는 클라이언트에 맞게 바꾸라고 한다. 출력 형태는 직접 확인하고 맞추는 것이 안전하다.

### 과적합을 피한다

질의 전체에 맞춰 description을 고치면 그 문구에만 맞는 description이 된다. 가이드는 질의를 학습용(약 60%)과 검증용(약 40%)으로 나누고, 수정은 학습용 실패만 보고 하라고 한다. 최종 선택은 검증용 통과율로 한다. 마지막 버전이 최선이 아닐 수 있다. 실패한 질의의 단어를 description에 그대로 넣는 것도 과적합이다. 그 질의들이 대표하는 범주를 찾아서 써야 한다. description은 고칠수록 길어지기 쉬우니 1,024자 제한도 다시 확인한다.

## 결과 평가, 호출됐을 때 맞게 했는가

호출이 잘 되면 다음은 출력 품질이다. agentskills.io의 평가 가이드는 테스트 케이스를 세 부분으로 정의한다. 실제 사용자가 입력할 법한 프롬프트, 성공이 어떤 모습인지 사람이 읽을 수 있게 적은 기대 결과, 그리고 필요하면 입력 파일이다. 이것을 스킬 디렉터리의 `evals/evals.json`에 둔다.

```json
{
  "skill_name": "design-system",
  "evals": [
    {
      "id": 1,
      "prompt": "src/components/Badge.vue에 warning 변형을 추가해 줘. 기존 success, danger랑 같은 방식으로",
      "expected_output": "토큰만 사용한 warning 변형과 그에 맞는 스토리 또는 사용 예시",
      "files": ["evals/files/Badge.vue"],
      "assertions": [
        "변경된 코드에 hex, rgb 색상 리터럴이 없다",
        "warning 색상은 기존 시맨틱 토큰 이름 규칙을 따른다",
        "기존 variant prop의 타입 정의에 warning이 추가되어 있다"
      ]
    }
  ]
}
```

가이드는 처음에 2~3개로 시작하라고 한다. 첫 결과를 보기 전에 과하게 투자하지 말라는 것이다. 검증 항목(assertion)도 처음부터 다 정하지 말고, 첫 실행 결과를 보고 추가하라고 한다. 좋은 결과가 어떤 모습인지는 대개 스킬이 한 번 돌아 봐야 알기 때문이다.

### 기준선과 나란히 돌린다

핵심은 각 케이스를 두 번 돌리는 것이다. 한 번은 스킬을 켜고, 한 번은 끄고(또는 이전 버전으로). Claude Code 스킬 문서도 같은 방법을 제시한다. 현실적인 프롬프트를 몇 개 모아 각각 새 세션에서 스킬이 있을 때와 없을 때 돌려 비교하라는 것이다. 새 세션이 중요한 이유는 스킬을 작성하며 쌓인 맥락이 지시문의 빈틈을 가려 버리기 때문이다. 개인이나 프로젝트 스킬을 끄는 방법으로 문서는 설정의 `skillOverrides`에서 해당 스킬을 `"off"`로 두는 방법을 안내한다.

```json
{
  "skillOverrides": {
    "design-system": "off"
  }
}
```

이전 버전과 비교할 때는 수정 전에 스킬 디렉터리를 복사해 스냅숏을 남기고, 기준선 실행을 그 스냅숏에 연결한다.

### 채점

검증 항목은 확인할 수 있는 문장이어야 한다. "출력이 좋다"는 채점할 수 없다. 반대로 특정 문구가 정확히 들어가야 한다는 식의 항목은 너무 깨지기 쉽다. 표현만 다른 올바른 결과도 실패로 처리되기 때문이다. 가이드의 원칙은 두 가지다. 통과에는 구체적인 근거를 요구한다. 그리고 결과뿐 아니라 검증 항목 자체도 검토한다.

"색상 리터럴이 없다" 같은 기계적인 항목은 LLM 판단보다 스크립트가 더 믿을 만하고, 반복 실행에도 재사용할 수 있다.

```ts
// scripts/check-no-color-literals.ts
import { readFileSync } from "node:fs";

const file = process.argv[2];
const source = readFileSync(file, "utf8");
const pattern = /#[0-9a-fA-F]{3,8}\b|rgba?\(/g;
const hits = [...source.matchAll(pattern)].map((m) => m[0]);

console.log(JSON.stringify({
  text: "변경된 코드에 hex, rgb 색상 리터럴이 없다",
  passed: hits.length === 0,
  evidence: hits.length === 0 ? "리터럴 없음" : `발견: ${hits.join(", ")}`,
}));
```

"시맨틱 토큰 이름 규칙을 따른다"처럼 판단이 필요한 항목은 출력과 항목을 LLM에 주고 항목마다 통과 여부와 근거를 받는다. 디자인의 완성도처럼 통과와 실패로 쪼개기 어려운 품질은 사람이 검토한다.

### 숫자를 읽는 법

케이스별 통과율, 시간, 토큰을 스킬 있음과 없음으로 나눠 모으면 스킬이 무엇을 비용으로 치르고 무엇을 얻는지 보인다. 가이드가 짚는 패턴은 이렇다. 양쪽에서 항상 통과하는 항목은 모델이 스킬 없이도 잘하는 것이니 빼거나 바꾼다. 양쪽에서 항상 실패하는 항목은 항목이나 케이스가 잘못됐을 수 있다. 가장 들여다볼 곳은 스킬이 있을 때만 통과하는 항목이다. 거기가 스킬이 가치를 더하는 곳이고, 어떤 지시가 차이를 만들었는지 이해해야 한다.

## 반복 개선

실행 결과에서 얻는 신호는 세 가지다. 실패한 검증 항목, 사람의 피드백, 실행 기록이다. 실행 기록을 보면 왜 그렇게 됐는지 알 수 있다. 모범 사례 문서는 여기에 Claude가 스킬을 실제로 어떻게 탐색하는지 관찰하라고 덧붙인다. 예상하지 못한 순서로 파일을 읽는지, 중요한 참조 파일을 놓치는지, 특정 파일만 반복해서 읽는지, 한 번도 열지 않는 파일이 있는지를 본다. 반복해서 읽는 내용은 `SKILL.md` 본문으로 올리고, 아무도 열지 않는 파일은 지우거나 본문의 안내를 고친다.

문서가 권하는 작업 방식은 Claude 두 인스턴스를 쓰는 것이다. 한쪽(Claude A)과 함께 스킬을 설계하고 다듬고, 다른 쪽(Claude B, 스킬을 로드한 새 인스턴스)에 실제 작업을 시켜 본다. B가 헤매는 지점을 구체적으로 A에게 가져가 고친다. 고칠 때는 테스트 케이스에만 맞춘 좁은 수정보다 원인을 일반화한 수정을 하고, 지시는 가볍게 유지한다. 모든 테스트 실행이 비슷한 보조 스크립트를 각자 새로 짜고 있다면 그 스크립트를 스킬의 `scripts/`에 넣으라는 신호다. 이 부분은 [스킬에 스크립트 넣기](/blog/skills-with-scripts/)와 이어진다.

### 모델별로도 확인한다

스킬은 모델에 더해지는 것이라 효과가 모델에 따라 달라진다. 모범 사례 문서는 쓸 모델 모두로 테스트하라고 한다. Haiku에서는 안내가 충분한지, Sonnet에서는 명확하고 효율적인지, Opus에서는 과하게 설명하지 않는지를 본다. 문서의 공유 전 체크리스트에도 평가 세 개 이상, Haiku·Sonnet·Opus로 테스트, 실제 사용 시나리오로 테스트가 들어 있다.

> **참고** Anthropic의 `skill-creator` 스킬은 이 과정의 상당 부분을 자동화한다. 케이스별 독립 실행, 검증 항목 채점, 스킬 있음과 없음의 벤치마크, description 조정까지 다룬다. 다만 평가 파일 형식은 도구마다 다를 수 있으니 쓰는 도구의 문서를 기준으로 맞춘다.

## 정리

- 호출 평가와 결과 평가는 별개다. 트리거됐다는 것은 찾았다는 뜻일 뿐이다.
- 평가를 먼저 만든다. 스킬 없이 돌려 실패를 모으고, 그 실패를 겨냥한 시나리오로 시작한다.
- 호출 평가는 라벨 붙은 질의 약 20개로, 아슬아슬하게 빗나가는 질의를 포함하고, 여러 번 돌려 비율로 판정하며, 학습용과 검증용을 나눈다.
- 결과 평가는 새 세션에서 스킬 있음과 없음(또는 이전 버전)을 나란히 돌려 비교한다. 기계적인 검증은 스크립트로, 판단은 LLM과 사람으로 나눈다.
- 실행 기록과 Claude의 탐색 경로를 보고 고치며, 쓸 모델 모두로 확인한다.

## 참고

- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- https://code.claude.com/docs/en/skills
- https://agentskills.io/skill-creation/evaluating-skills
- https://agentskills.io/skill-creation/optimizing-descriptions
- https://code.claude.com/docs/en/headless
- https://github.com/anthropics/skills
$skill$, '2026-09-15T09:00:00+09:00'::timestamptz),
  ('sharing-skills-with-plugins', '팀과 스킬 공유하기, 저장소와 플러그인과 마켓플레이스', '스킬을 저장소에 커밋하는 방법부터 플러그인과 마켓플레이스로 배포하고 버전을 관리하는 방법, 신뢰할 수 있는 스킬만 쓰는 보안 수칙까지 정리한다.', array['Claude', '협업', '보안']::text[], 'Claude 스킬 실전', 'https://2rangs.github.io/img/covers/sharing-skills-with-plugins.png', $skill$
혼자 쓰는 스킬은 `~/.claude/skills/`에 두면 끝이다. 문제는 그 스킬이 쓸 만해졌을 때다. 디자인 시스템 리뷰 스킬을 팀원 모두가 같은 버전으로 쓰게 하고, 다른 저장소에서도 쓰고, 고친 내용이 각자의 컴퓨터에 반영되게 하려면 배포 방법을 정해야 한다.

이 연재의 마지막 글에서는 공유 방법을 범위가 좁은 것부터 차례로 정리한다. 저장소 커밋, 플러그인, 마켓플레이스, 버전 관리 순이다. 그리고 남이 만든 스킬을 들여올 때의 보안 수칙으로 마무리한다. 명령과 파일 형식은 작성 시점의 Claude Code 공식 문서를 기준으로 했다.

## 공유 범위는 세 단계

Claude Code 스킬 문서는 대상에 따라 세 가지 배포 범위를 제시한다.

- **프로젝트 스킬**: `.claude/skills/`를 버전 관리에 커밋한다.
- **플러그인**: 플러그인 안에 `skills/` 디렉터리를 만든다.
- **관리형(managed)**: 관리형 설정으로 조직 전체에 배포한다.

대부분의 팀은 첫 번째로 시작해서 두 번째로 넘어간다. 세 번째는 조직 관리자의 영역이라 이 글에서는 간단히만 다룬다.

## 저장소에 두기

가장 단순한 방법이다. [Claude Code에서 스킬 만들고 쓰기](/blog/claude-code-skills-in-practice/)에서 본 것처럼 프로젝트 스킬은 `.claude/skills/<skill-name>/SKILL.md`에 두고, 커밋하면 그 저장소에서 작업하는 모두가 같은 스킬을 받는다.

```text
frontend-app/
├── CLAUDE.md
└── .claude/
    ├── skills/
    │   ├── design-system/
    │   │   ├── SKILL.md
    │   │   └── tokens.md
    │   └── component-review/
    │       └── SKILL.md
    └── agents/
        └── a11y-auditor.md
```

장점은 별도 인프라가 없다는 것이다. 스킬 수정도 일반 코드처럼 PR로 리뷰하고, 변경 이력은 git에 남는다.

한계도 분명하다. 그 저장소 안에서만 쓸 수 있다. 같은 디자인 시스템을 쓰는 저장소가 셋이면 스킬도 세 벌이 되고, 언젠가 서로 달라진다. [스킬 vs MCP vs 서브에이전트](/blog/skills-vs-mcp-subagents-claude-md/)에서 인용한 문서의 도입 순서표에서도 "두 번째 저장소에 같은 구성이 필요해지면 플러그인"이라고 정리한다.

이름 충돌 규칙도 알아 두면 좋다. 같은 이름의 스킬이 여러 위치에 있으면 엔터프라이즈가 개인보다, 개인이 프로젝트보다 우선한다. 팀원 한 명의 `~/.claude/skills/design-system/`이 저장소의 같은 이름 스킬을 가릴 수 있다는 뜻이다. "내 컴퓨터에서는 되는데"가 생기면 먼저 여기를 확인한다.

## 플러그인으로 묶기

플러그인은 스킬, 서브에이전트, 훅, MCP 서버 등을 한 단위로 설치하고 로드하는 디렉터리다. 문서는 한 프로젝트나 나 혼자만 쓰는 동안은 단독 구성을 유지하고, 팀원과 공유하거나 여러 프로젝트에 설치하거나 버전이 붙은 릴리스를 내고 싶을 때 플러그인을 만들라고 한다.

구조는 이렇다. 매니페스트는 `.claude-plugin/plugin.json`이고, 구성 요소는 플러그인 루트에 둔다.

```text
fe-design-kit/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── design-system/
│   │   └── SKILL.md
│   └── component-review/
│       └── SKILL.md
└── agents/
    └── a11y-auditor.md
```

```json
{
  "name": "fe-design-kit",
  "description": "프론트엔드 팀 디자인 시스템 스킬 모음",
  "version": "1.0.0",
  "author": { "name": "Frontend Team" }
}
```

필수는 `name` 하나다. 이 이름이 플러그인 안 모든 스킬과 에이전트의 접두사가 되므로 공백을 넣지 않는다. 문서가 특히 강조하는 실수가 있다. `.claude-plugin/` 안에는 `plugin.json`만 둔다. 구성 요소를 그 안에 넣으면 로드되지 않는다.

플러그인 스킬은 네임스페이스가 붙는다. 위 플러그인의 `design-system` 스킬은 `/fe-design-kit:design-system`으로 실행된다. 덕분에 두 플러그인이 같은 이름의 스킬을 갖고 있어도 충돌하지 않는다. 대신 기존에 `/design-system`으로 쓰던 팀원에게는 이름이 바뀐다는 점을 알려야 한다.

### 기존 `.claude/` 구성을 옮기기

이미 저장소에 스킬과 에이전트가 있다면 다시 쓸 필요 없이 복사하면 된다. 문서의 절차를 요약하면 이렇다.

```bash
mkdir -p fe-design-kit/.claude-plugin
# plugin.json 작성 후
cp -r .claude/skills fe-design-kit/
cp -r .claude/agents fe-design-kit/

# 매니페스트와 SKILL.md frontmatter 검사
claude plugin validate ./fe-design-kit

# 설치 없이 이번 세션에만 로드해서 확인
claude --plugin-dir ./fe-design-kit
```

옮긴 뒤 원본을 `.claude/`에 그대로 두면 `/design-system`과 `/fe-design-kit:design-system`이 둘 다 뜬다. 스킬과 에이전트는 접두사 덕에 충돌하지 않지만, 훅은 접두사가 없어서 설정 파일과 플러그인 양쪽에 있으면 이벤트마다 두 번 실행된다. 플러그인이 잘 동작하는지 확인한 뒤 원본을 지운다.

## 마켓플레이스로 배포하기

마켓플레이스는 `.claude-plugin/marketplace.json` 파일이 있는 디렉터리나 저장소다. 플러그인 목록과 각 플러그인을 어디서 가져올지를 적은 카탈로그일 뿐, 호스팅되는 스토어가 아니다. 팀 마켓플레이스는 사내 git 저장소 하나로 충분하다.

```json
{
  "name": "acme-frontend-plugins",
  "description": "프론트엔드 팀 플러그인",
  "owner": { "name": "Frontend Team" },
  "plugins": [
    {
      "name": "fe-design-kit",
      "source": "./plugins/fe-design-kit",
      "description": "디자인 시스템 스킬 모음"
    }
  ]
}
```

필수 필드는 `name`, `owner`, `plugins`다. 각 항목에는 `name`과 `source`가 필요하다. 상대 경로 `source`는 `.claude-plugin/`이 아니라 그 바깥의 마켓플레이스 루트를 기준으로 쓰고, `..`는 쓸 수 없다. 문서가 새 마켓플레이스에서 설치가 실패하는 가장 흔한 원인으로 꼽는 것이 두 가지다. 잘못된 기준 디렉터리에서 쓴 상대 경로, 그리고 항목의 `name`과 플러그인 `plugin.json`의 `name`이 다른 경우다. 두 이름은 같게 맞춘다. 플러그인이 별도 GitHub 저장소에 있다면 `{ "source": "github", "repo": "your-org/fe-design-kit" }`처럼 소스 객체를 쓴다.

팀원 쪽 흐름은 두 명령이다.

```bash
claude plugin marketplace add your-org/acme-frontend-plugins
claude plugin install fe-design-kit@acme-frontend-plugins
```

설치 ID는 `<항목 이름>@<마켓플레이스 이름>`이다. 마켓플레이스 이름은 저장소 이름이 아니라 `marketplace.json`의 `name`에서 온다. 한 사용자가 같은 이름의 마켓플레이스 두 개를 동시에 등록할 수 없으니, 다른 팀과 겹치지 않을 이름을 고른다.

### 저장소 단위로 요구하기

특정 저장소에서 일하는 모두가 이 플러그인을 쓰게 하려면 그 저장소의 `.claude/settings.json`에 `extraKnownMarketplaces`와 `enabledPlugins`를 둔다.

```json
{
  "extraKnownMarketplaces": {
    "acme-frontend-plugins": {
      "source": { "source": "github", "repo": "your-org/acme-frontend-plugins" }
    }
  },
  "enabledPlugins": {
    "fe-design-kit@acme-frontend-plugins": true
  }
}
```

문서 기준으로 두 가지를 주의해야 한다. 마켓플레이스 등록은 팀원이 그 폴더의 작업 공간 신뢰 대화상자를 수락한 뒤에만 적용된다. 그리고 `enabledPlugins`를 적는다고 설치까지 되지는 않는다. 각자 `--scope project`로 한 번 설치해야 한다. 조직 전체에 강제하려면 같은 키를 관리형 설정에 넣으며, 이 부분은 관리자 문서를 따른다.

## 버전 관리

플러그인 업데이트가 사용자에게 언제 닿는지는 `version` 필드가 정한다. 문서의 규칙을 정리하면 이렇다.

- 사용자는 플러그인의 계산된 버전이 바뀔 때만 새 사본을 받는다. 버전은 `plugin.json`을 먼저 보고, 없으면 마켓플레이스 항목을 본다.
- **릴리스마다 `version`을 올리는 방식**: 문자열이 바뀌기 전까지 사용자는 캐시된 사본에 머문다. `"1.0.0"`으로 둔 채 커밋만 밀어 넣으면 아무도 받지 못한다.
- **`version`을 아예 빼는 방식**: 사용자가 커밋을 따라간다. 이때는 `plugin.json`과 마켓플레이스 항목 양쪽에서 모두 뺀다.
- 양쪽에 다 적지 않는다. 그러면 경고 없이 `plugin.json` 값이 쓰이고, `claude plugin validate`가 불일치를 보고한다.
- `version`은 semver로 검사되지 않는 문자열이다.

또 하나 알아 둘 점이 있다. 마켓플레이스의 백그라운드 자동 업데이트는 기본으로 꺼져 있고, `marketplace.json`에는 이를 켜는 필드가 없다. 각 사용자가 `/plugin`의 Marketplaces 탭에서 켜거나, 관리자가 관리형 설정에서 켠다. 꺼져 있으면 사용자가 `claude plugin update <plugin>@<marketplace>`를 실행할 때 반영된다. 버전을 올리기 전에는 [스킬 테스트와 평가](/blog/testing-skills/)의 평가 세트를 다시 돌린다.

> **참고** API로 올린 사용자 스킬은 버전 체계가 따로 있다. 프로덕션에서는 특정 버전을 고정하라는 것이 skills-guide 문서의 권장이다. `"latest"`를 쓰면 워크스페이스의 누군가가 올린 새 버전이 곧바로 동작을 바꾼다. 업로드 방법은 [Claude API에서 스킬 쓰기](/blog/skills-on-the-claude-api/)에서 다뤘다.

## 신뢰할 수 있는 스킬만 쓰기

공유가 쉬워질수록 들여오는 것도 쉬워진다. Agent Skills 개요 문서의 보안 항목은 첫 문장부터 분명하다. 스킬은 직접 만들었거나 Anthropic에서 받은 것처럼 신뢰할 수 있는 출처의 것만 쓰라는 것이다. 스킬은 지시와 코드로 Claude에게 능력을 주기 때문에, 악의적인 스킬은 겉으로 내세운 목적과 다르게 도구를 호출하거나 코드를 실행하게 만들 수 있다.

플러그인은 위험의 범위가 더 넓다. 플러그인 보안 문서에 따르면 설치한 플러그인은 사용자 권한으로 임의의 코드를 실행할 수 있다. 훅은 생명주기 시점마다 셸 명령으로 돌고, stdio MCP 서버는 로컬 프로세스로 뜨며, `bin/`의 실행 파일은 Bash 도구의 `PATH`에 추가된다. 그리고 권한 규칙과 샌드박스는 Claude의 도구 호출에 적용될 뿐, 플러그인이 스스로 실행하는 훅이나 서버 프로세스에는 적용되지 않는다.

문서 내용을 바탕으로 팀 수칙을 정리하면 이렇다.

- **모든 파일을 읽는다.** `SKILL.md`뿐 아니라 스크립트와 리소스까지 본다. 예상하지 못한 네트워크 호출, 목적과 맞지 않는 파일 접근을 찾는다. 플러그인이라면 `hooks/hooks.json`, `.mcp.json`, `bin/`을 반드시 연다. `/plugin` 상세 화면에는 훅이 있다는 것만 나오고 무엇을 실행하는지는 나오지 않는다.
- **설치 전에 구성 목록을 확인한다.** `claude plugin marketplace list`로 마켓플레이스의 출처를 확인한다. 설치 후에는 `claude plugin details <plugin>`으로 실제로 들어온 스킬, 에이전트, 훅, 서버 목록을 본다.
- **외부 URL에서 내용을 가져오는 스킬을 경계한다.** 가져온 내용에 악의적인 지시가 섞일 수 있다. 처음에 믿을 만했던 스킬도 외부 의존성이 바뀌면 오염될 수 있다.
- **`allowed-tools`를 리뷰한다.** 문서는 스킬이 스스로에게 넓은 도구 권한을 줄 수 있으니, 저장소에 커밋된 스킬의 `allowed-tools`를 확인한 뒤에 그 저장소에서 Claude Code를 실행하라고 한다. 스킬 PR 리뷰 체크리스트에 이 항목을 넣는다.
- **자동 업데이트의 의미를 안다.** 자동 업데이트가 켜져 있으면 검토한 파일이 디스크에서 바뀔 수 있다. 외부 마켓플레이스라면 자동 업데이트를 켜기 전에 한 번 더 생각한다. 마켓플레이스를 추가할 때 `your-org/your-marketplace#stable`처럼 `#<ref>`를 붙이면 카탈로그의 특정 브랜치나 태그를 받을 수 있다.
- **마켓플레이스 이름을 믿지 않는다.** 이름은 카탈로그를 누가 내는지 알려 줄 뿐, 각 플러그인이 무엇을 하는지는 알려 주지 않는다. 문서도 어느 마켓플레이스에서 왔든 설치 전에 검토하라고 한다.

## 정리

- 공유는 저장소 커밋, 플러그인, 관리형 배포 순으로 범위가 넓어진다. 한 저장소면 `.claude/skills/` 커밋으로 충분하다.
- 두 번째 저장소가 생기면 플러그인으로 묶는다. `.claude-plugin/`에는 `plugin.json`만 두고, 스킬 이름에 플러그인 접두사가 붙는다는 점을 팀에 알린다.
- 마켓플레이스는 `marketplace.json` 하나짜리 카탈로그다. 항목 이름과 매니페스트 이름을 맞추고, 저장소의 `.claude/settings.json`으로 팀원에게 요구할 수 있다.
- 업데이트는 `version`이 바뀔 때만 전달된다. 릴리스마다 올리거나 아예 빼고, 두 곳에 동시에 적지 않는다.
- 스킬과 플러그인은 소프트웨어 설치처럼 다룬다. 출처를 확인하고, 모든 파일을 읽고, `allowed-tools`와 훅을 리뷰한다.

## 참고

- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/plugins/create
- https://code.claude.com/docs/en/plugins/create-marketplace
- https://code.claude.com/docs/en/plugins/host-marketplace
- https://code.claude.com/docs/en/plugins/org
- https://code.claude.com/docs/en/plugins/security
- https://code.claude.com/docs/en/plugins/manifest-reference
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://platform.claude.com/docs/en/build-with-claude/skills-guide
$skill$, '2026-10-20T09:00:00+09:00'::timestamptz)
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  tags = excluded.tags,
  series = excluded.series,
  cover_url = excluded.cover_url,
  body_markdown = excluded.body_markdown,
  published_at = excluded.published_at;

select slug, series, published_at::date, reading_minutes, cover_url is not null as has_cover
from public.blog_posts where series = 'Claude 스킬 실전' order by published_at;
