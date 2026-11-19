
지금까지 세 편에 걸쳐 스킬의 개념, `SKILL.md` 쓰는 법, 점진적 공개를 다뤘다. 이번에는 직접 만들어 본다. 프론트엔드 팀에서 스킬을 가장 먼저 쓰게 되는 곳은 대개 Claude Code다. API처럼 업로드할 필요가 없고, 저장소에 폴더를 하나 커밋하면 팀 전체가 같은 스킬을 쓴다.

이 글은 Claude Code 문서(Extending Claude Code with Skills)를 기준으로 스킬을 어디에 두는지, 어떻게 호출되는지, 잘 동작하는지 어떻게 확인하는지를 정리한다. 2026년 4월 기준으로 문서에서 확인한 내용만 다룬다. Claude Code는 업데이트가 잦으니 세부 동작은 쓰는 버전의 문서로 함께 확인하자.

## 스킬을 두는 위치

Claude Code의 스킬은 파일 시스템 기반이다. 개요 문서 설명대로 API로 올릴 필요 없이 디렉터리에 `SKILL.md`를 두면 된다. 위치에 따라 적용 범위가 달라진다.

| 위치 | 경로 | 적용 범위 |
|---|---|---|
| 개인 | `~/.claude/skills/<skill-name>/SKILL.md` | 이 컴퓨터의 모든 프로젝트 |
| 프로젝트 | `.claude/skills/<skill-name>/SKILL.md` | 이 저장소의 세션. 커밋하면 팀과 공유된다 |
| 하위 디렉터리 | `<subdir>/.claude/skills/<skill-name>/SKILL.md` | `<subdir>` 안이나 그 아래에서 시작한 세션 |
| 플러그인 | `<plugin>/skills/<skill-name>/SKILL.md` | 플러그인이 켜진 곳. `/plugin-name:skill-name` 형태 |
| 엔터프라이즈 | 관리 설정 디렉터리 안의 `.claude/skills/<skill-name>/SKILL.md` | 조직이 배포한 컴퓨터의 모든 사용자 |

실무 기준으로는 이렇게 나누면 된다.

- **개인 스킬**에는 나만의 작업 습관을 둔다. 커밋 메시지 형식이나 자주 쓰는 리팩터링 절차 같은 것이다.
- **프로젝트 스킬**에는 팀 규칙을 둔다. 디자인 토큰 추가 절차, 컴포넌트 리뷰 체크리스트처럼 이 저장소에서만 의미 있는 내용이다. 코드 리뷰를 거쳐 함께 다듬을 수 있다는 장점도 있다.
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

문서에 따르면 필드 이름은 정확히 일치해야 하고, 모르는 필드는 경고 없이 무시된다. 오타가 나도 오류가 나지 않으니 주의한다. 또 YAML이 파싱되지 않으면 스킬은 필드가 하나도 없는 상태로 로드된다. 이 경우 `/new-component`로 직접 부를 수는 있지만 Claude가 `description`과 요청을 비교할 수 없어 자동 호출은 되지 않는다.

## 자동 호출과 직접 호출

스킬이 쓰이는 길은 두 가지다.

- **자동 호출**: 요청이 `description`과 맞으면 Claude가 스스로 스킬을 불러온다. "Badge 컴포넌트 하나 만들어 줘"라고 하면 위 스킬이 로드될 수 있다.
- **직접 호출**: `/new-component Badge`처럼 슬래시와 이름으로 부른다. 문서에 따르면 메시지 맨 앞에 이름을 써야 직접 호출이 된다. 평범한 문장 뒤에 `/deploy`를 쓰면 Claude는 그 스킬을 실행해도 된다는 허락으로만 받아들이고 바로 실행하지는 않는다.

### 인자 넘기기

직접 호출할 때 이름 뒤에 쓴 내용은 본문의 자리표시자로 들어간다.

| 자리표시자 | 들어가는 값 |
|---|---|
| `$ARGUMENTS` | 입력한 인자 전체 |
| `$ARGUMENTS[N]` 또는 `$N` | 0부터 세는 위치의 인자. `$0`, `$1` 등 |
| `${CLAUDE_SKILL_DIR}` | `SKILL.md`가 있는 디렉터리 |

문서의 예시처럼 `Migrate the $0 component from $1 to $2.`라고 쓰고 `/migrate-component SearchBar JavaScript TypeScript`로 부르면 세 값이 모두 채워진다. 여러 단어로 된 인자는 따옴표로 묶는다. 본문에 자리표시자가 없는데 인자를 넘기면 Claude Code가 `ARGUMENTS: <값>`을 덧붙인다.

`${CLAUDE_SKILL_DIR}`는 스킬에 스크립트를 넣을 때 유용하다. 스킬이 개인, 프로젝트, 플러그인 중 어디에 설치되어 있든 경로가 맞게 풀린다.

## 호출을 제어하는 필드

모든 스킬이 자동으로 불려야 하는 것은 아니다. 문서는 두 필드로 누가 부를 수 있는지 정한다.

| 프론트매터 | 사용자 호출 | Claude 호출 | 설명이 컨텍스트에 |
|---|---|---|---|
| 기본값 | 가능 | 가능 | 들어감 |
| `disable-model-invocation: true` | 가능 | 불가 | 들어가지 않음 |
| `user-invocable: false` | 불가 | 가능 | 들어감 |

`disable-model-invocation: true`는 부작용이 있는 작업에 쓴다. 배포, 릴리스 태그 만들기, 디자인 토큰 패키지 배포처럼 Claude가 스스로 "지금이 적절하다"고 판단해 실행하면 곤란한 일이다. 이 필드를 켜면 설명이 컨텍스트에 아예 들어가지 않으므로 [3편](/blog/skills-progressive-disclosure/)에서 말한 1단계 예산도 아낄 수 있다.

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

헷갈리기 쉬운 점이 두 가지 있다. 첫째, 이 필드는 나열한 도구를 미리 승인할 뿐 다른 도구를 막지는 않는다. 나열하지 않은 도구에는 평소 권한 설정이 그대로 적용된다. 둘째, 문서는 Claude Code가 신뢰하지 않은 폴더에서도 프로젝트 스킬의 승인을 적용하므로, 남의 저장소에서 Claude Code를 실행하기 전에 그 저장소 스킬의 `allowed-tools`를 검토하라고 경고한다. 팀 저장소에 스킬을 추가하는 PR이라면 리뷰할 때 이 필드를 꼭 본다.

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

마지막으로 알아 둘 동작이 하나 있다. 문서에 따르면 스킬이 호출되면 그 내용은 이후 턴에도 대화에 남아 있고, Claude Code는 파일을 다시 읽지 않는다. 그래서 문서는 스킬을 한 번만 할 단계가 아니라 계속 지킬 지침으로 쓰라고 권한다. "테스트를 실행한다"보다 "수정할 때마다 테스트를 실행한다"처럼 작업 전체에 걸리는 문장으로 쓰는 식이다. 반드시 매번 지켜야 하는 규칙이라면 스킬보다 훅으로 강제하는 편이 맞다고 문서는 설명한다. 이 구분은 [8편](/blog/skills-vs-mcp-subagents-claude-md/)에서 더 자세히 다룬다.

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
