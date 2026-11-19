
스킬을 처음 만들면 대개 본문부터 공들인다. 절차를 꼼꼼히 적고 예시도 넣는다. 그런데 막상 써 보면 Claude가 그 스킬을 쓰지 않는다. 본문이 나빠서가 아니다. Claude가 본문을 읽을 기회를 얻지 못했기 때문이다.

[지난 편](/blog/claude-skills-what-and-why/)에서 본 것처럼 평소 컨텍스트에 들어가는 것은 스킬의 `name`과 `description`뿐이다. 이번 글은 Anthropic의 스킬 작성 모범 사례 문서(Skill authoring best practices)를 기준으로 프론트매터와 본문을 쓰는 방법을 정리한다. 2026년 2월 기준으로 확인한 내용이다.

## 프론트매터 규칙

개요 문서와 모범 사례 문서 모두 `SKILL.md` 프론트매터에 두 필드를 요구한다.

- `name`은 최대 64자, 소문자와 숫자와 하이픈만 쓴다. XML 태그와 예약어(`anthropic`, `claude`)는 쓸 수 없다.
- `description`은 비어 있으면 안 되고 최대 1,024자이며 XML 태그를 쓸 수 없다. 스킬이 무엇을 하는지와 언제 써야 하는지를 담아야 한다.

오픈 표준 명세(agentskills.io)는 `name`에 몇 가지를 더 요구한다. 하이픈으로 시작하거나 끝나면 안 되고, 하이픈을 연달아 쓸 수 없으며, 상위 디렉터리 이름과 같아야 한다. 여러 제품에서 같은 스킬을 쓸 생각이라면 처음부터 이 규칙에 맞춰 두는 편이 낫다.

## 이름에는 하는 일이 드러나게

모범 사례 문서는 이름에 동명사 형태(동사 + -ing)를 권한다. 스킬이 제공하는 활동이 이름에서 바로 보이기 때문이다.

- 권장: `processing-pdfs`, `analyzing-spreadsheets`, `testing-code`, `writing-documentation`
- 허용: `pdf-processing` 같은 명사구, `process-pdfs` 같은 동작형
- 피할 것: `helper`, `utils`, `tools`처럼 모호한 이름, `documents`, `data`처럼 지나치게 넓은 이름, 예약어를 포함한 이름

문서는 한 컬렉션 안에서 패턴을 섞지 말라고도 강조한다. 프론트엔드 팀이라면 `reviewing-components`, `adding-design-tokens`, `writing-storybook-stories`처럼 한 가지 형태로 맞춰 두면 문서와 대화에서 부르기 쉽다.

## description이 호출을 좌우하는 까닭

모범 사례 문서는 Claude가 많게는 100개가 넘는 스킬 가운데 맞는 것을 고를 때 `description`을 쓴다고 설명한다. 개요 문서도 Claude가 요청을 이 설명과 비교해 스킬을 쓸지 정한다고 적는다. 설명이 모호하면 스킬이 있어도 쓰이지 않고, 설명이 너무 넓으면 엉뚱한 요청에 끼어든다.

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

문서는 구체적인 키워드와 상황을 넣으라고 한다. PDF 예시가 "PDFs, forms, document extraction"을 나열하는 것도 그래서다. 프론트엔드 팀의 컴포넌트 리뷰 스킬이라면 이런 식이 된다.

```yaml
name: reviewing-components
description: Reviews Vue and React components against the team design system rules, including token usage, accessibility, and prop naming. Use when the user asks for a component review, mentions design tokens, or opens a pull request that touches UI components.
```

"component review", "design tokens", "pull request" 같은 단어는 팀원이 실제로 요청할 때 쓰는 말이다. Claude Code 문서의 문제 해결 항목도 스킬이 호출되지 않으면 먼저 설명에 사용자가 자연스럽게 말할 키워드가 들어 있는지 확인하라고 한다. 반대로 너무 자주 호출되면 설명을 더 구체적으로 좁히라고 한다.

> **참고** Claude Code 문서 기준으로 스킬 목록에서 `description`은 길이 상한에서 잘릴 수 있고, 스킬이 많으면 일부 설명이 목록에서 빠질 수도 있다. 문서는 핵심 사용 사례를 앞에 두라고 권한다. 1,024자를 다 채우기보다 앞 문장에 핵심을 담는 편이 안전하다.

## 본문은 짧게, Claude가 모르는 것만

모범 사례 문서의 첫 원칙은 "간결함"이다. 문서는 컨텍스트 창을 공공재에 비유한다. 스킬 본문은 시스템 프롬프트, 대화 기록, 다른 스킬의 메타데이터, 사용자의 요청과 같은 공간을 나눠 쓴다.

기본 전제는 Claude가 이미 많이 안다는 것이다. 문서는 각 문단에 세 가지 질문을 던지라고 한다. Claude에게 이 설명이 정말 필요한가, 이미 알고 있다고 가정해도 되는가, 이 문단이 토큰 비용을 정당화하는가. 문서의 예시에서 PDF가 무엇인지부터 설명하는 장황한 버전은 약 150토큰, 라이브러리와 코드 몇 줄만 남긴 버전은 약 50토큰이다.

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

이 틀에 담긴 문서의 권고를 하나씩 보면 다음과 같다.

- **복잡한 작업은 단계로 나누고 체크리스트를 준다.** 문서는 Claude가 응답에 복사해 하나씩 체크할 수 있는 체크리스트를 권한다. 검증 단계를 건너뛰지 않게 해 준다.
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
