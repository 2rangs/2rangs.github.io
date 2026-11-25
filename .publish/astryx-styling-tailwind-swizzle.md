
디자인 시스템의 버튼 모서리를 조금 더 둥글게 하고 싶어서 `className="rounded-full"`을 붙였는데 화면은 그대로입니다. 개발자 도구를 열어 보니 라이브러리의 선택자가 내 클래스에 줄을 긋고 있습니다. 그래서 `!important`를 붙이고, 다음 사람은 그 위에 또 `!important`를 붙입니다. 컴포넌트 라이브러리를 써 본 사람이라면 한 번쯤 겪은 장면이고, 라이브러리가 고른 스타일링 도구와 내 프로젝트의 도구가 다르면 더 자주 겪습니다.

Astryx는 Meta가 공개한 오픈소스 React 디자인 시스템입니다(MIT 라이선스, React 19 이상 필요). README는 차별점 가운데 하나로 "스타일링 잠금 없음(No styling lock-in)"을 내세웁니다. 이 글은 그 말이 실제로 무엇을 보장하고 무엇을 보장하지 않는지를 v0.7.16(2026년 11월, 베타) 공식 저장소의 문서와 소스로 확인한 기록입니다. 베타라서 이후 버전에서 달라질 수 있습니다.

## StyleX는 안에서만 쓴다

StyleX는 Meta가 만든 스타일링 라이브러리입니다. 스타일을 자바스크립트 객체로 쓰지만 실행 중에 CSS를 만들지 않고, 빌드할 때 컴파일러가 `stylex.create()` 호출을 읽어 정적 CSS로 뽑아냅니다.

```tsx
import * as stylex from '@stylexjs/stylex';

const styles = stylex.create({
  card: { maxWidth: 400, marginBlock: 16 },
});

<div {...stylex.props(styles.card)} />
```

결과물은 원자적 CSS(atomic CSS)입니다. 선언 하나가 클래스 하나가 되고, 같은 선언은 어디서 쓰든 같은 클래스를 재사용합니다. `@astryxdesign/build` README는 이를 "same declaration = same class name"이라고 적습니다.

저장소 위키의 "Why StyleX" 문서가 꼽는 이유는 세 가지입니다. 토큰이 타입스크립트 값이라서 없는 토큰을 쓰면 컴파일되지 않습니다(위키의 표현으로는 디자인 시스템에서 "제약이 곧 제품"). 생성된 원자 클래스 이름은 구현 세부 사항이라 사용자가 거기에 기대지 않으니 Astryx가 내부를 자유롭게 고칠 수 있습니다. 같은 선언을 공유하므로 컴포넌트가 늘어도 CSS가 그만큼 늘지 않습니다. 같은 문서는 대가도 적어 둡니다. 기여자가 StyleX를 배워야 하고, Tailwind보다 문법이 장황하며, 부모와 자식 상태를 잇는 선택자가 번거롭고, 생태계가 작습니다.

이 선택은 쓰는 쪽에는 드러나지 않습니다. 위키에 따르면 초기의 Astryx는 사용자도 StyleX 빌드 플러그인을 돌려야 했고, 앱마다 Babel과 PostCSS 설정이 필요했으며, AI 도구가 StyleX를 잘 쓰지 못해 인라인 스타일로 빠지는 문제가 있었다고 합니다. 그래서 StyleX는 내부 작성 도구로 남기고 사용자에게는 컴파일된 CSS와 `className`을 주는 쪽으로 바꿨습니다. 지금의 설정은 CSS 세 줄입니다.

```css
@import "@astryxdesign/core/reset.css";
@import "@astryxdesign/core/astryx.css";
@import "@astryxdesign/theme-neutral/theme.css";
```

설치 과정은 [2편](/blog/astryx-getting-started/)에서 다뤘습니다. 다만 공식 설치 명령에는 어느 경로든 `@stylexjs/stylex` 패키지가 들어 있으니, "StyleX가 필요 없다"는 말은 StyleX **컴파일러 설정**이 필요 없다는 뜻으로 읽어야 합니다. StyleX 지식이 실제로 필요한 때는 `xstyle`과 `stylex.create()`를 직접 쓰거나, swizzle한 소스를 고치거나, Astryx 자체에 기여할 때입니다.

### CSS를 연결하는 세 경로

`astryx docs styling-overview`는 세 경로를 제시합니다.

| 경로 | 맞는 경우 | 추가 빌드 단계 |
| --- | --- | --- |
| 일반 CSS | 대부분의 앱. `className`, `xstyle`, 다른 CSS 라이브러리로 스타일링 | 없음 |
| Tailwind | Tailwind v4 앱. CSS 브리지가 유틸리티 클래스를 토큰에 연결 | Tailwind 자체 빌드뿐 |
| 내 코드에 StyleX | 직접 `stylex.create()`를 쓰거나 swizzle한 컴포넌트가 있을 때 | 내 코드용 StyleX 플러그인 |

세 경로 모두 같은 미리 빌드된 스타일시트를 읽고, 같은 디자인 토큰으로 귀결되며, 테마와 다크 모드를 지원합니다. 어느 경로도 Astryx 패키지 소스를 컴파일하지 않고, 한 앱에서 섞어 쓸 수 있습니다.

### xstyle, className, style은 합쳐진다

모든 컴포넌트의 기반 타입인 `BaseProps`에는 `xstyle`, `className`, `style`이 들어 있습니다. 공개 API 아키텍처 문서는 이 셋이 "서로를 대체하지 않고 문서화된 순서로 합쳐진다"는 것을 불변 조건으로 두고, 기여 가이드의 예시 코드가 그 순서를 보여 줍니다.

```tsx
<div
  ref={ref}
  {...mergeProps(
    themeProps('panel'),
    stylex.props(styles.root, xstyle),
    className,
    style,
  )}
  {...rest}>
```

`className`은 컴포넌트 자체 클래스 뒤에 덧붙고, `style`은 StyleX가 만든 인라인 스타일 뒤에 합쳐져 충돌하면 사용자 값이 이깁니다.

| 입력 | 받는 값 | 문서가 말하는 용도 |
| --- | --- | --- |
| `className` | 문자열 | Tailwind, CSS Modules, 일반 CSS 연결. 레이아웃과 래퍼 스타일 |
| `xstyle` | `stylex.create()`의 결과만 | 이미 StyleX를 쓰는 앱에서 컴포넌트 고유 값(padding, 색, 테두리) 재정의 |
| `style` | 인라인 객체 | 동적인 값, 일회성 조정 |

`xstyle`은 인라인 객체나 클래스 문자열을 받지 않고, 내 코드에 `stylex.create()`를 쓰려면 내 빌드에 StyleX 컴파일러가 있어야 합니다. StyleX를 쓰지 않는 앱이라면 `className`이 기본 경로입니다.

설계 문서 `AST-071`은 이 약속을 규칙으로 정합니다. 루트가 아닌 요소(파트)에 스타일 입력을 열 때는 `<part>Xstyle`, `<part>ClassName`, `<part>Style` 셋을 한 묶음으로 받아야 하고, StyleX 스타일만 받는 공개 prop은 허용하지 않습니다. Astryx는 StyleX를 쓰지 않는 제품에도 도입되는데 `xstyle`로만 닿는 파트는 그런 코드베이스에서 손댈 수 없기 때문입니다. 다만 같은 문서는 규칙에 맞지 않는 기존 prop으로 `ComplexSelector.contentXstyle`, `ContextMenu.triggerXstyle`, `BaseTypeahead.inputXStyle`을 꼽고, 이 규칙은 자동 검사 없이 API 리뷰로 지킨다고 적습니다.

## className이 `!important` 없이 이기는 원리

흔한 오해가 두 가지 있습니다. "class 속성에서 뒤에 쓴 클래스가 이긴다"는 틀렸습니다. CSS는 `class` 속성 안의 순서를 보지 않습니다. "선택자 명시도가 높은 쪽이 이긴다"도 캐스케이드 레이어(cascade layer)가 있으면 맞지 않습니다. 명시도보다 레이어가 먼저입니다.

Astryx 마이그레이션 문서는 규칙을 두 줄로 정리합니다. 레이어에 넣지 않은 스타일은 이름 붙은 모든 레이어를 이기고, 뒤에 선언된 레이어는 앞 레이어를 이깁니다. 둘 다 명시도와 무관합니다. Astryx의 스타일시트는 이렇게 레이어에 들어가 있습니다.

| import | 레이어 | 내용 |
| --- | --- | --- |
| `reset.css` | `reset` | 브라우저 간 리셋. `:where()`로 명시도 0 |
| `astryx.css` | `astryx-base` | 미리 빌드된 컴포넌트 스타일 |
| `theme.css` | `astryx-theme` | 디자인 토큰과 테마 재정의 |
| 내 CSS | 레이어 없음 | 위의 모든 레이어를 이김 |

그래서 아래처럼 써도 됩니다.

```css
/* 레이어에 넣지 않은 내 CSS */
.save-button {
  border-radius: 999px;
}
```

```tsx
<Button label="저장" variant="primary" className="save-button" />
```

컴포넌트 쪽 선택자가 아무리 길어도 `astryx-base` 안에 있는 한 레이어 밖의 `.save-button`을 이기지 못합니다. 문서 표현대로 재정의가 적용되느냐는 "소스 순서의 문제가 아니라 레이어의 문제"입니다.

이 원리는 반대 방향으로도 똑같이 작동합니다. 레이어가 없던 시절의 `* { padding: 0 }` 같은 리셋은 명시도가 0이라 무해했지만, 같은 리셋이 레이어 밖에 남아 있으면 이제 모든 컴포넌트 스타일을 이깁니다. 문서는 이것을 도입이 깨지는 가장 흔한 경로로 꼽고, 기존 리셋을 가장 낮은 레이어에 명시적으로 넣으라고 합니다.

```css
@import "./legacy-reset.css" layer(reset);
```

`!important`는 답이 아닙니다. CSS 표준에서 `!important` 선언은 레이어 순서가 뒤집혀 적용되므로 문제를 더 복잡하게 만들 뿐입니다. 스타일이 안 먹으면 레이어 순서부터 확인합니다.

## 커스터마이즈 다섯 단계

공식 블로그 "How Astryx works"는 단계적 경로를 이렇게 적습니다. 그대로 쓴다, 테마 토큰을 조정한다, 클래스 이름으로 내 스타일을 입힌다, 내 CSS로 안쪽에 닿는다, 소스를 꺼내 소유한다. 여기에 README가 말하는 "열린 내부(Open internals)", 곧 조각을 직접 조합하는 길을 더하면 다섯 단계가 됩니다. 단계마다 통제권이 늘고 책임도 늡니다.

| 단계 | 방법 | 고르는 때 | 따라오는 책임 |
| --- | --- | --- | --- |
| 1 | prop | 문서에 있는 변형, 크기, 상태로 충분할 때 | 없음 |
| 2 | 테마 토큰과 컴포넌트 재정의 | 앱 전체에서 일관되게 바꾸고 싶을 때 | 테마 관리 |
| 3 | `className`, `xstyle`, `style` | 한 곳의 여백, 너비, 배치를 고칠 때 | 그 규칙을 쓴 이유 |
| 4 | 조각 조합과 안정된 선택자 | 구조를 바꾸거나 외부 CSS로 특정 변형을 겨냥할 때 | 선택자 이름 변경 추적 |
| 5 | swizzle | 동작이나 마크업 자체를 바꿔야 할 때 | 복사본 전체 |

`<Button variant="primary" size="sm" />`처럼 prop으로 끝나면 가장 좋습니다. 코드 리뷰 가이드(`astryx docs is-my-code-good`)의 스타일링 기준도 "컴포넌트 prop과 디자인 토큰이 먼저, 커스텀 StyleX 선언과 인라인 스타일과 클래스는 그다음"입니다. prop 규칙은 [3편](/blog/astryx-components-api/)에 있습니다.

테마는 CSS 커스텀 프로퍼티 재정의와 컴포넌트 단위 재정의의 묶음입니다. `defineTheme`의 `components` 맵에 `'variant:primary'` 같은 키로 변형별 스타일을 넣거나 새 변형을 만들 수 있고, 자세한 내용은 [5편](/blog/astryx-theme-tokens/)에서 다뤘습니다. 3단계는 앞에서 본 세 입력이며, 여기서도 값은 토큰으로 쓰라고 문서는 말합니다(`var(--spacing-4)`, `var(--color-text-primary)`).

4단계에서 복합 컴포넌트는 조각마다 스타일 입력을 받습니다. 문서 표현으로 "하위 부분으로 파고드는 단일 prop은 없고" 각 조각을 그 자리에서 꾸밉니다. 조립 자체를 직접 할 수도 있습니다. `Table`은 `TableHeader`, `TableBody`, `TableRow`, `TableCell`을 직접 배치하는 children 모드가 있고, `Typeahead`는 `BaseTypeahead`를 `Field`로 감싼 것이라고 문서에 적혀 있습니다. 외부 CSS로 특정 변형을 겨냥해야 한다면 안정된 컴포넌트 클래스와 `data-*` 속성을 씁니다.

```css
.my-app .astryx-button[data-variant="primary"][data-size="sm"] {
  /* 이 앱의 작은 primary 버튼 */
}
```

`.astryx-button`이 컴포넌트를, `data-variant`와 `data-size`가 prop 값을 가리킵니다. StyleX가 만든 원자 클래스는 겨냥하지 않습니다. 이 단계에는 유지 비용이 따릅니다. 0.7에서 `.primary`, `.sm` 같은 맨 클래스와 일부 대상 이름이 제거되고 `data-*` 선택자로 바뀌었습니다. `astryx upgrade --from <0.6 버전> --apply --path .`가 CSS 선택자를 고쳐 주지만, 판단할 수 없는 곳에는 `TODO(astryx upgrade)`를 남기고 사람이 보라고 합니다. 5단계 swizzle은 아래에서 따로 다룹니다.

### className은 어느 요소에 붙나

컴포넌트가 요소 여러 개를 그리면 `className`이 어디에 붙는지가 문제입니다. 이 규칙을 다루는 `AST-089`(스타일링 대상, styling target)는 v0.7.16 기준 **초안(draft, proposed)**이라 방향만 적습니다. 컴포넌트가 접두사 없는 `ref`로 DOM 요소를 노출하면 `style`, `className`, `xstyle`은 그 `ref`가 가리키는 요소에 붙고, `ref`를 노출하지 않으면 컴포넌트가 소유한 가장 바깥 요소 하나에 붙습니다. 호출하는 쪽이 `ref`를 넘겼는지와는 무관합니다. 대상은 API가 정하고, 대상이 아직 렌더되지 않았다고 다른 요소로 옮겨 가지 않습니다. 기존 동작을 유지하는 예외 목록도 있어서, 예를 들어 `CheckboxInput`과 `Switch`는 스타일이 바깥 필드 전체에, `ref`는 안쪽 `input`에 붙습니다.

이미 현행 규칙인 예외도 있습니다. 입력 필드 계열은 루트 `className`을 받지 않는 쪽으로 가고 있습니다. `TextInput` 문서를 보면 `containerClassName`(레이블, 컨트롤, 상태를 모두 감싼 필드 컨테이너)과 `controlClassName`(테두리와 배경을 그리는 컨트롤 상자)을 받고, 루트 `xstyle`, `className`, `style`은 받지 않는다고 적혀 있습니다. `Selector`, `Typeahead` 등 일부는 아직 루트 스타일을 받으며 codemod로 옮길 예정이라고 계열 문서가 밝힙니다. "모든 컴포넌트가 `className`을 받는다"는 대체로 맞지만, 입력 필드에서는 컴포넌트 문서를 먼저 확인하는 편이 안전합니다.

## Tailwind와 함께 쓰기

### 새 앱의 globals.css

```css
@layer reset, theme, base, astryx-base, astryx-theme, components, utilities;

@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "@astryxdesign/core/reset.css";
@import "@astryxdesign/core/astryx.css";
@import "@astryxdesign/theme-neutral/theme.css";
@import "@astryxdesign/core/tailwind-theme.css";
@import "tailwindcss/utilities.css" layer(utilities);
```

예제 앱 `apps/example-vite-tailwind`와 `apps/example-nextjs-tailwind`의 CSS가 이 파일 그대로입니다. 첫 줄이 우선순위를 낮은 것부터 높은 것 순으로 정합니다. Astryx 리셋이 맨 아래, Tailwind preflight가 그 위, 컴포넌트와 테마가 가운데, Tailwind 유틸리티가 맨 위입니다. 그래서 `<Button className="rounded-full shadow-xl" />`이 컴포넌트 기본값을 이깁니다.

### 기존 Tailwind 앱의 globals.css

이미 Tailwind를 쓰는 앱은 파일을 통째로 바꾸지 않습니다.

```css
@layer reset, theme, base, astryx-base, astryx-theme, components, utilities;

@import "tailwindcss"; /* 앱의 기존 진입점, 그대로 */
@import "@astryxdesign/core/reset.css";
@import "@astryxdesign/core/astryx.css";
@import "@astryxdesign/theme-neutral/theme.css";

/* 앱의 @theme, :root 규칙은 아래에 그대로 둔다 */
```

새 앱과 달리 `@import "tailwindcss"`를 쪼개지 않고, `tailwind-theme.css`를 넣지 않습니다. 브리지는 `rounded-lg`, `shadow-md` 같은 Tailwind 기본 이름까지 Astryx 토큰에 연결하므로, 기존 앱에 넣으면 앱의 클래스가 그리는 결과가 달라집니다. 문서는 브리지가 연결하는 이름을 앱이 쓰지 않을 때만 추가하라고 합니다.

토큰 이름 충돌도 조심해야 합니다. 앱이 `@theme { --spacing-4: 1.5rem }`을 갖고 있으면 Astryx 값이 이겨서 앱의 `gap-4`는 16px로 남습니다(`@theme inline`으로 표시하면 앱 값이 유지됩니다). 앱이 `:root { --spacing-4: 1.5rem }`을 갖고 있으면 반대로 Astryx 컴포넌트의 간격이 24px로 벌어집니다. 문서는 이름이 겹치는 앱 토큰의 이름을 바꾸라고 권합니다.

### `@layer` 순서가 에러 없이 뒤집히는 두 경우

첫째는 `@layer` 줄을 Tailwind import 아래에 둔 경우입니다. `@layer` 문은 페이지가 아직 보지 못한 레이어 이름만 정렬합니다. `@import "tailwindcss"`가 먼저 로드되면 `theme`, `base`, `components`, `utilities`가 이미 자리를 잡고, 그 뒤의 `@layer` 줄은 `reset`, `astryx-base`, `astryx-theme`을 `utilities` **뒤**에 붙일 수밖에 없습니다. 그러면 Astryx 리셋이 앱의 모든 유틸리티를 이기고, 유틸리티가 준 테두리와 패딩이 사라집니다. 빌드와 콘솔에는 아무 메시지가 없고 소스의 `@layer` 줄도 멀쩡해 보여서, 렌더된 화면을 봐야만 알 수 있습니다.

둘째는 globals.css가 첫 번째 스타일시트가 아닌 경우입니다. 레이어의 순위는 그 이름을 처음 언급한 스타일시트가 정합니다. 테마 CSS를 import하는 모듈이 먼저 로드되면 순서가 어긋나서 preflight가 Astryx 기본 스타일을 덮습니다.

```tsx
import './globals.css'; // 가장 먼저: 레이어 순서를 선언한다

import {themes, defaultThemeSlug} from './astryx-themes';
```

globals.css를 맨 앞에 둘 수 없으면 `@layer` 줄만 `layers.css`로 떼어 그 파일을 먼저 import합니다. 문서가 권하는 확인 방법은 버튼, 입력, 카드 몇 개만 그린 점검 페이지를 만들고 버튼의 `paddingInline`이 `0px`인지 보는 것입니다. 0이면 레이어 밖의 리셋이나 뒤쪽 레이어가 컴포넌트 스타일을 덮고 있습니다. 입력 필드에 클래스가 안 먹는다면 루트 `className` 대신 `containerClassName`이나 `controlClassName`을 써야 하는지도 확인합니다.

Tailwind v3에는 `preflight.css`가 없어서 `@tailwind base`를 이름 붙은 레이어로 감싸는 별도 방법을 씁니다(`astryx docs migration`의 설정 가이드). 브리지는 Tailwind v4 이상이 필요하므로 v3에서는 브리지 클래스 없이 토큰을 `var(--...)`로 직접 씁니다.

### 브리지가 토큰을 유틸리티로 잇는 방식

`tailwind-theme.css`는 자바스크립트 없는 순수 CSS이고, 전체가 `@theme reference inline { ... }` 블록 하나입니다. 파일 주석에 따르면 `reference`는 Tailwind가 이 변수들을 런타임 선언으로 다시 내보내지 않게 하고, `inline`은 생성되는 유틸리티 안에 연결된 Astryx 커스텀 프로퍼티를 직접 넣습니다. `bg-surface`는 `var(--color-background-surface)`를 읽으므로 다크 모드나 테마 전환 때 따로 할 일이 없습니다.

```tsx
<section className="rounded-lg border border-border bg-surface p-4 text-primary shadow-md">
  <Button label="Save" variant="primary" />
</section>
```

| Tailwind 테마 변수 | Astryx 토큰 | 유틸리티 예 |
| --- | --- | --- |
| `--color-primary`, `--color-secondary` | `--color-text-primary`, `--color-text-secondary` | `text-primary` |
| `--color-surface`, `--color-body`, `--color-card` | `--color-background-surface` / `body` / `card` | `bg-surface` |
| `--color-border` | `--color-border` | `border-border` |
| `--color-error` 등 상태색 | `--color-error`(진한 채움) | `bg-error` |
| `--text-color-error` 등 | `--color-text-error`(본문용 상태색) | `text-error` |
| `--border-color-error` 등 | `--color-border-error` | `border-error` |
| `--color-blue-subtle` / `ring` / `vivid` (색상 10종) | `--color-background-blue` / `--color-border-blue` / `--color-text-blue` | `bg-blue-subtle` |
| `--spacing` | `--spacing-1` | `p-4`, `gap-3` |
| `--radius-sm` / `md` / `lg` / `xl` | `--radius-inner` / `element` / `container` / `page` | `rounded-lg` |
| `--shadow-sm` / `md` / `lg` | `--shadow-low` / `med` / `high` | `shadow-md` |
| `--font-sans` / `mono` / `heading` | `--font-family-body` / `code` / `heading` | `font-sans` |
| `--text-2xs` ~ `--text-5xl` | `--font-size-2xs` ~ `--font-size-5xl` | `text-sm` |

간격은 기본 단위 하나만 연결합니다. Tailwind v4는 `p-4`를 `calc(var(--spacing) * 4)`로 계산하므로, `--spacing`이 `--spacing-1`을 가리키면 전체 눈금이 Astryx와 맞습니다. 상태색은 쓰임에 따라 다른 토큰을 읽어서 `bg-error`는 진한 채움, `text-error`는 본문용 상태색, `border-error`는 테두리용 상태색입니다. `--color-accent`는 `--color-text-accent`에, 강조 채움색은 `--color-accent-bg`에 연결돼 있으니 이름만 보고 짐작하지 말고 파일을 확인하는 편이 좋습니다. 브리지에 없는 토큰은 `bg-[var(--color-background-surface)]`처럼 임의 값 문법으로 씁니다.

## 다른 스타일링 도구와 함께 쓰기

어떤 도구든 테마 값의 원본은 Astryx에 두고, 다른 도구의 토큰이나 테마 객체가 Astryx의 CSS 변수를 가리키게 합니다.

일반 CSS와 CSS Modules에서는 변수를 그대로 씁니다. CSS Modules는 클래스 이름만 격리하고, 토큰 변수는 전역으로 상속되는 값입니다.

```css
/* Card.module.css */
.card {
  background: var(--color-background-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-container);
  padding: var(--spacing-4);
}
```

Sass 변수는 컴파일 때 값이 고정되어 테마나 색 모드가 바뀌어도 따라오지 않으므로, 테마를 타야 하는 값은 CSS 커스텀 프로퍼티로 씁니다.

StyleX를 쓰는 앱이라면 `@astryxdesign/core/theme/tokens.stylex`의 타입 있는 토큰(`colorVars`, `spacingVars`, `radiusVars`)을 쓰면 자동완성과 오타 검사를 받습니다. 컴포넌트 재정의는 `xstyle`, 내 DOM 노드는 `stylex.props()`입니다. 예제 `apps/example-nextjs-stylex`는 StyleX의 `useCSSLayers.before`에 `['reset', 'astryx-base', 'astryx-theme']`를 넣어 내 StyleX 레이어가 Astryx 레이어 뒤에 오게 합니다.

Panda, Chakra, MUI, Emotion, styled-components, UnoCSS도 방법은 같습니다. 그 라이브러리의 의미 토큰이나 팔레트 칸에 hex 값을 복사하지 말고 `var(--color-text-primary)` 같은 참조를 넣습니다. 이름이 아니라 의도로 짝짓습니다(MUI의 `background.paper`는 `--color-background-surface`). 색 모드는 한 곳에서만 관리합니다. Astryx의 `Theme`은 `data-theme="light|dark"`를 쓰므로 다른 다크 모드 공급자와 어긋나지 않게 합니다.

캔버스나 차트 설정처럼 CSS가 아니라 문자열 값이 필요한 API에는 `resolveThemeTokens()`나 `useTheme()`으로 값을 꺼냅니다. 일반 DOM 스타일링에는 쓰지 않습니다.

## swizzle로 소스를 꺼내 소유하기

스위즐(swizzle)은 컴포넌트 소스를 패키지에서 프로젝트로 복사해 직접 고칠 수 있게 하는 명령입니다.

```bash
astryx swizzle --list        # 꺼낼 수 있는 컴포넌트 목록
astryx swizzle Button        # ./components/astryx 로 복사
astryx swizzle Card --output ./src/ui
```

CLI를 설치하지 않았다면 `npx @astryxdesign/cli swizzle Button`처럼 스코프 이름으로 실행합니다.

| 옵션 | 뜻 |
| --- | --- |
| `--output <dir>` | 출력 폴더. 기본값 `./components/astryx`. 프로젝트 밖 경로는 `ERR_PATH_TRAVERSAL` |
| `--package <pkg>` | 같은 이름을 여러 패키지가 제공할 때 소유 패키지 지정 |
| `--list` | 꺼낼 수 있는 Core 컴포넌트 목록 |
| `-f, --overwrite` | 그 컴포넌트의 기존 파일을 교체. 없으면 `ERR_FILE_EXISTS`로 실패하고 아무것도 쓰지 않음 |

프로젝트 밖에서는 아무것도 쓰지 않고 `ERR_CORE_NOT_FOUND`로 멈춥니다.

명령 문서 기준으로 복사본에서 패키지가 공개로 내보내는 것은 패키지 경로에서 import하고, 컴포넌트가 필요로 하는 내부 모듈은 패키지의 폴더 구조대로 옆에 복사되어 상대 경로로 import합니다. 테스트, 스토리, 문서는 복사하지 않고, 복사본이 import하는 npm 패키지를 버전 범위와 함께 알려 줍니다. 먼저 swizzle한 컴포넌트가 남긴 헬퍼가 같으면 재사용하고, 다르면 덮어쓰지 않고 버전 접미사를 붙여 새로 씁니다.

### StyleX 컴파일러가 필요하다

복사본은 컴파일된 CSS가 아니라 StyleX **소스**입니다. 빌드에 StyleX 컴파일러가 없으면 import하는 순간 `Unexpected 'stylex.create' call at runtime`으로 시작하는 에러가 나고 페이지가 렌더되지 않습니다.

| 번들러 | 플러그인 |
| --- | --- |
| Webpack | `@stylexjs/webpack-plugin` |
| Vite / Rollup | `@stylexjs/rollup-plugin` |
| Babel | `@stylexjs/babel-plugin` + `@stylexjs/postcss-plugin` |
| Next.js(`next/font` 유지) | `@stylexswc/nextjs-plugin` |

Next.js에서 Babel 설정을 추가하면 SWC가 꺼지고 `next/font`가 깨진다는 경고가 문서에 있습니다. 컴파일러는 내 소스에만 겨누고 `node_modules/@astryxdesign`에는 겨누지 않습니다.

### 복사본에도 테마가 닿으려면

토큰(CSS 변수)은 복사본도 그대로 읽습니다. 테마의 컴포넌트 재정의까지 닿느냐는 빌드 도구에 달려 있습니다. swizzle은 자기가 소유한 출력 폴더(새로 만든 폴더, 빈 폴더, 전에 표시한 폴더)에 `astryx-swizzle.json` 표식을 씁니다. `@astryxdesign/build`의 Babel, PostCSS, Vite 통합이나 webpack의 `withAstryx()`는 이 표식이 있는 폴더의 모듈을 Astryx 소스로 보고 `astryx-base` 레이어로 컴파일하므로, 테마의 컴포넌트 재정의가 패키지 컴포넌트와 똑같이 복사본에도 닿습니다.

반대로 기본 StyleX 플러그인이나 Turbopack에서는 복사본의 규칙이 내 스타일 쪽, 곧 `astryx-theme` 위에 놓여서 테마의 컴포넌트 재정의가 닿지 않습니다(v0.7.16 기준 Turbopack은 표식을 읽지 않습니다). 표식이 있는 폴더에는 swizzle한 복사본만 두고 제품 자체 컴포넌트는 넣지 않습니다.

### 업그레이드는 따라오지 않는다

설계 문서 `AST-110`은 swizzle의 계약을 적습니다. 같은 Core 버전과 StyleX 컴파일러가 있으면 복사본은 수정 없이 빌드되고, 같은 테마 대상과 클래스 이름에 반응하고, 고치기 전까지 패키지 컴포넌트와 똑같이 동작해야 합니다. 레이어 스택이나 모달 출구처럼 컴포넌트끼리 조율하는 상태는 버전 붙은 키로 문서당 하나만 두어서, 복사한 `Dialog`와 패키지의 `Popover`가 같은 스택을 씁니다.

같은 문서는 보장 범위도 분명히 정해 둡니다. 사용자가 고친 복사본을 이후 Core 릴리스와 맞추는 일은 범위 밖(Non-goal)이고, Core를 업그레이드한 뒤에도 남아 있는 복사본은 "수정 없이 빌드된다"와 "동작이 같다"는 보장 밖입니다. swizzle한 순간부터 그 컴포넌트의 버그 수정, 접근성 개선, 새 prop은 자동으로 들어오지 않습니다. 업그레이드 codemod(`astryx upgrade --apply`)는 `AST-040`에 따라 근거가 확인되는 곳만 고치고 나머지는 수동 검토 대상으로 보고할 뿐, 복사본을 새 버전 소스로 다시 맞춰 주지는 않습니다.

명령이 끝날 때 나오는 문구도 같은 이야기를 합니다. 컴포넌트를 커스터마이즈해야 했다면 디자인 시스템에 빈틈이 있다는 신호일 때가 많으니, 무엇이 필요했는지 메인테이너에게 알려 달라는 내용입니다. 스타일만 바꾸려고 swizzle하지 말고, 앞의 네 단계로 안 될 때 쓰는 편이 맞습니다.

### 확장할까, 교체할까

고친 컴포넌트를 팀 전체가 쓰게 하려면 새 이름으로 내놓거나, 통합(integration) 패키지에서 `replaces`로 Core 컴포넌트의 자리를 차지하게 할 수 있습니다. `replace-a-core-component` 문서는 대부분의 컴포넌트에는 `replaces`를 쓰지 말고 고유한 이름을 주라고 합니다.

| 교체(`replaces`)가 맞는 경우 | 맞지 않는 경우 |
| --- | --- |
| 특정 Core 컴포넌트와 같은 역할을 의도적으로 맡는다 | 대안, 변형, 래퍼, 제품 전용 확장이다 |
| 통합을 쓰는 모든 앱에서 기본이 되어야 한다 | 한 화면이나 한 흐름에서만 필요하다 |
| 교체본과 원본 접근을 모두 시험했다 | 우연한 이름 충돌을 풀고 싶을 뿐이다 |

교체는 swizzle에도 영향을 줍니다. `SideNav`를 교체한 통합이 있으면 `astryx swizzle SideNav`는 교체본을 복사하고, 원본은 `--package @astryxdesign/core`로 꺼냅니다. 문서 주제에도 같은 구분(`extends`와 `replaces`)이 있고, 거기 적힌 조언은 컴포넌트에도 그대로 적용됩니다. 고치거나 보탤 때는 확장하고, `replaces`로 만든 복사본은 원본의 수정을 더는 받지 못합니다.

## shadcn에서 넘어온다면

Astryx 컴포넌트는 기본적으로 npm 패키지 의존성으로 남고, 소스를 복사하는 것은 명시적으로 `astryx swizzle`을 실행했을 때뿐입니다. shadcn 호환 경로의 근거인 `shadcn-compatibility.doc.draft.mjs`와 블로그 글 "Meet people where they already build"는 둘 다 v0.7.16 기준 **초안**입니다(블로그 글의 프론트매터가 `draft: true`). 설치 명령의 주소도 `<registry-origin>`이라는 자리표시자로 적혀 있으니 바뀔 수 있는 설계로 읽어 주세요.

방향은 Astryx가 shadcn Registry 프로토콜을 호환 및 배포 경로로 지원해서 shadcn CLI로 Astryx 항목을 설치할 수 있게 하는 것입니다. 다만 복사되는 것이 shadcn과 다릅니다.

| 항목 | 설치되는 것 | 업데이트 주체 |
| --- | --- | --- |
| 컴포넌트, 훅 | Astryx 패키지 + 로컬 재수출 파일 한 줄 | Astryx(패키지) |
| 쇼케이스, 예제, 블록, 페이지 | 패키지를 import하는 편집 가능한 조합 코드 + `.astryx` 영수증 | 내 앱 |

컴포넌트 항목이 만드는 파일은 `export * from '@astryxdesign/core/Button';` 한 줄이고 구현 소스는 복사하지 않습니다. 초안에 따르면 조합은 복사하되 디자인 시스템은 복사하지 않고, 깊은 소스 수정은 `astryx swizzle`을 명시적으로 실행해야만 할 수 있습니다.

복사된 조합 옆의 영수증은 `astryx upgrade --registry`가 씁니다. 손대지 않은 파일은 갱신하고, 겹치지 않는 수정은 3방향 병합하고, 충돌하면 내 파일은 두고 `.astryx-conflict` 파일을 따로 씁니다. v0.7.16의 CLI README에도 `upgrade` 설명에 "ShadCN으로 복사한 컴포넌트 갱신"이 들어 있습니다.

스타일 쪽에서는 예제 앱 README가 한 가지를 확인해 줍니다. shadcn 방식의 Tailwind 컴포넌트는 Astryx 컴포넌트 옆에서 제대로 렌더되고, Astryx 리셋과 Tailwind preflight는 약 80%가 겹쳐 함께 써도 충돌하지 않습니다. 기존 앱이라면 앞에서 본 "기존 Tailwind 앱" 설정에서 시작하면 됩니다.

## 하지 말아야 할 것

`astryx docs styling`의 고급 가이드와 위 내용을 합친 점검 목록입니다.

- `!important`를 쓰지 않습니다. 안 먹으면 레이어 순서를 봅니다.
- 색과 간격을 하드코딩하지 않습니다(`#fff`, `16px`). `var(--color-*)`, `var(--spacing-*)`나 브리지 클래스를 씁니다.
- 여백 하나 때문에 컴포넌트를 `<div>`로 감싸지 않습니다. 컴포넌트의 스타일 입력을 씁니다.
- StyleX가 만든 원자 클래스를 선택자로 겨냥하지 않습니다. `.astryx-*` 클래스와 `data-*` 속성을 씁니다.
- `@layer` 줄을 Tailwind import 아래에 두지 않습니다.
- 기존 Tailwind 앱에 이름 충돌을 확인하지 않고 `tailwind-theme.css`를 넣지 않습니다.
- 다른 라이브러리의 테마 객체에 hex 값을 복사하지 않습니다. `var(...)` 참조를 넣습니다.
- StyleX 컴파일러를 `node_modules/@astryxdesign`에 겨누지 않습니다.
- 스타일만 바꾸려고 swizzle하지 않습니다.

스타일링 대상 규칙(`AST-089`)과 shadcn 호환은 아직 초안이므로, 실제로 도입할 때는 설치한 버전의 문서를 다시 확인해야 합니다. 여기서 쓴 `docs`, `upgrade`, `doctor` 같은 명령은 다음 편 [Astryx CLI 완전 정복](/blog/astryx-cli/)에서 차례로 다룹니다.

## 참고

공식 저장소(읽은 자료)

- [README.md](https://github.com/meta/astryx/blob/main/README.md)
- [packages/core/README.md](https://github.com/meta/astryx/blob/main/packages/core/README.md)
- [packages/build/README.md](https://github.com/meta/astryx/blob/main/packages/build/README.md)
- [packages/core/src/tailwind-theme.css](https://github.com/meta/astryx/blob/main/packages/core/src/tailwind-theme.css)
- [packages/core/src/BaseProps.ts](https://github.com/meta/astryx/blob/main/packages/core/src/BaseProps.ts)
- [packages/core/src/TextInput/TextInput.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/TextInput/TextInput.doc.mjs)
- [packages/cli/assets/docs/styling-overview.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/styling-overview.doc.mjs)
- [packages/cli/assets/docs/tree/styling-basics.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/styling-basics.doc.mjs)
- [packages/cli/assets/docs/tree/styling-advanced.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/styling-advanced.doc.mjs)
- [packages/cli/assets/docs/tree/tailwind.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/tailwind.doc.mjs)
- [packages/cli/assets/docs/tree/css-and-stylex.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/css-and-stylex.doc.mjs)
- [packages/cli/assets/docs/tree/other-libraries.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/other-libraries.doc.mjs)
- [packages/cli/assets/docs/tree/non-css-processing.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/non-css-processing.doc.mjs)
- [packages/cli/assets/docs/tree/migration-setup.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/migration-setup.doc.mjs)
- [packages/cli/assets/docs/tree/tokens-and-setup.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/tokens-and-setup.doc.mjs)
- [packages/cli/assets/docs/tree/replace-a-core-component.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/replace-a-core-component.doc.mjs)
- [packages/cli/assets/docs/tree/extend-or-replace.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/extend-or-replace.doc.mjs)
- [packages/cli/assets/docs/is-my-code-good.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/is-my-code-good.doc.mjs)
- [packages/cli/assets/docs/shadcn-compatibility.doc.draft.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/shadcn-compatibility.doc.draft.mjs) (초안)
- [packages/cli/clients/cli/commands/swizzle.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/swizzle.doc.mjs)
- [packages/cli/api/swizzle/swizzle.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/api/swizzle/swizzle.doc.mjs)
- [docs/architecture/public-component-api.md](https://github.com/meta/astryx/blob/main/docs/architecture/public-component-api.md)
- [docs/architecture/component-style-authoring.md](https://github.com/meta/astryx/blob/main/docs/architecture/component-style-authoring.md)
- [docs/contributing/api-conventions.md](https://github.com/meta/astryx/blob/main/docs/contributing/api-conventions.md)
- [docs/families/input-fields.md](https://github.com/meta/astryx/blob/main/docs/families/input-fields.md)
- [docs/specs/AST-071-styling-library-compat/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-071-styling-library-compat/spec.md)
- [docs/specs/AST-089-styling-target/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-089-styling-target/spec.md) (초안)
- [docs/specs/AST-110-swizzle-output/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-110-swizzle-output/spec.md)
- [docs/specs/AST-040-consumer-file-modification/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-040-consumer-file-modification/spec.md)
- [apps/docsite/src/content/blog/posts/how-astryx-works.md](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/how-astryx-works.md)
- [apps/docsite/src/content/blog/posts/meet-astryx-from-shadcn.md](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/meet-astryx-from-shadcn.md) (초안)
- [apps/example-vite-tailwind/src/index.css](https://github.com/meta/astryx/blob/main/apps/example-vite-tailwind/src/index.css)
- [apps/example-nextjs-tailwind/src/app/globals.css](https://github.com/meta/astryx/blob/main/apps/example-nextjs-tailwind/src/app/globals.css)
- [apps/example-nextjs-tailwind/README.md](https://github.com/meta/astryx/blob/main/apps/example-nextjs-tailwind/README.md)
- [apps/example-nextjs-stylex/README.md](https://github.com/meta/astryx/blob/main/apps/example-nextjs-stylex/README.md)
- [저장소 위키: Why StyleX](https://github.com/meta/astryx/wiki/Why-StyleX) (위키는 저장소 문서보다 갱신이 늦을 수 있습니다)

그 밖의 자료

- [StyleX 공식 사이트](https://stylexjs.com/)
- [MDN: @layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [shadcn Registry 문서](https://ui.shadcn.com/docs/registry)
