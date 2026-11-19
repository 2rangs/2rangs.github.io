
디자인 시스템을 운영하다 보면 같은 코드 리뷰 코멘트를 반복하게 된다. "여기 `#1F2937` 대신 토큰 써 주세요", "버튼을 직접 만들지 말고 `Button` 쓰면 됩니다", "모달에 포커스 트랩이 빠졌어요". Claude에게 UI 코드를 맡기면 같은 코멘트를 Claude에게 다시 하게 된다. 반복해서 붙여 넣는 지시와 체크리스트는 스킬로 옮기기 좋은 대상이다.

이번 편은 연재에서 다룬 원칙을 한 스킬에 모아 본다. 토큰, 컴포넌트 사용 규칙, 리뷰 체크리스트를 담은 디자인 시스템 스킬의 SKILL.md와 참고 파일 전체를 보여 주고, 왜 그렇게 나눴는지 설명한다. 예시의 패키지 이름(`@example/ui`), 토큰 이름, 컴포넌트 목록은 설명을 위해 만든 것이다. 형식과 제약은 2026년 7월 기준 공식 문서로 확인했다.

## 무엇을 스킬에 넣고 무엇을 뺄까

Claude가 이미 아는 것(Vue의 `defineProps`, React의 `forwardRef`, WCAG의 일반 원리)은 빼고, **우리 팀에만 있는 결정**만 넣는다. 모범 사례 문서의 기본 전제대로 Claude는 일반적인 지식은 이미 갖추고 있다.

남는 것은 세 가지다.

- **토큰**: 어떤 토큰이 있고, 어떤 상황에 어떤 토큰을 쓰는지
- **컴포넌트 사용 규칙**: 무엇을 직접 만들지 말고 무엇을 가져다 쓰는지, 자주 틀리는 props
- **리뷰 체크리스트**: UI 변경을 검토할 때 확인하는 항목

"이 저장소는 pnpm을 쓴다" 같은 항상 참인 사실은 [1편](/blog/claude-skills-what-and-why/)에서 정리했듯 `CLAUDE.md`에 둔다. 토큰 표처럼 UI 작업에서만 필요한 긴 내용은 스킬에 둔다.

## 폴더 구조

[점진적 공개](/blog/skills-progressive-disclosure/) 원칙에 따라 SKILL.md에는 목차와 워크플로만 두고, 긴 내용은 참고 파일로 뺀다. 참고 파일은 모두 SKILL.md에서 한 단계로 연결한다.

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

**예전 방식은 접어 뒀다.** 모범 사례 문서는 시간이 지나면 틀려지는 정보를 본문에 쓰지 말고 "old patterns" 절에 모으라고 한다. 그래서 SCSS 변수 이야기를 `<details>`로 분리했다.

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
- SKILL.md에는 워크플로와 목차만 두고, 긴 내용은 한 단계 아래 참고 파일로 뺀다.
- description에는 무엇을 하는지와 언제 쓰는지, 팀이 실제로 쓰는 단어를 넣는다.
- 판단이 필요 없는 검사는 명령으로 고정하고, 예외 없는 규칙은 린트나 hook으로도 막는다.

## 참고

- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://code.claude.com/docs/en/skills
- https://agentskills.io/specification
