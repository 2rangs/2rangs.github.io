---
legacy_id: 22
slug: tailwind-css-v4
title: Tailwind CSS 입문 (3) v4에서 달라진 것과 마이그레이션
summary: 2025년 1월 출시된 Tailwind CSS v4의 CSS 우선 설정, 새 엔진, 이름이 바뀐 유틸리티와 v3에서 옮겨 가는 방법을 정리한다.
tags: [Tailwind CSS, CSS]
series: Tailwind CSS 입문
cover: https://2rangs.github.io/img/covers/tailwind-css-v4.png
date: 2025-03-14T08:51:50.153Z
comment_term: posts/Tailwindcss-V4%EA%B0%80-%EB%82%98%EC%99%94%EC%8A%B5%EB%8B%88%EB%8B%A4
---

v3 프로젝트를 v4로 올리고 나면 `tailwind.config.js`가 무시되고, `shadow`를 쓴 카드의 그림자가 에러 없이 작아지고, `dark` 클래스를 붙여도 다크 모드가 켜지지 않는 일을 겪는다. Tailwind CSS v4.0은 2025년 1월에 정식 출시됐고, 클래스 문법은 대부분 그대로지만 설정 방식과 내부 엔진은 새로 만들어졌다. 설정의 중심이 JavaScript 파일에서 CSS로 옮겨 갔다. [첫 번째](/blog/tailwind-css-basics/)와 [두 번째](/blog/tailwind-css-customization/) 글은 v3 기준으로 쓰고 v4 차이를 덧붙였고, 여기에는 v4에서 무엇이 왜 바뀌었는지와 옮겨 가는 방법을 모았다.

## 무엇이 바뀌었나

### 설정이 CSS로 옮겨 왔다

v3에서는 `tailwind.config.js`가 필수였고 CSS에는 `@tailwind` 지시문 세 줄을 썼다. v4에서는 CSS 파일 하나에서 시작한다.

```css
/* v3 */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```css
/* v4 */
@import "tailwindcss";

@theme {
  --font-display: "Satoshi", sans-serif;
  --color-primary: #1e40af;
  --color-secondary: #9333ea;
  --breakpoint-3xl: 120rem;
}
```

`@theme` 안에 선언한 변수는 이름의 네임스페이스에 따라 유틸리티가 된다. 위 설정만으로 `font-display`, `bg-primary`, `text-secondary`, `3xl:` 접두사를 쓸 수 있다. 테마 값은 `:root`의 CSS 변수로도 노출되므로 일반 CSS나 인라인 스타일에서 `var(--color-primary)`로 참조할 수 있다.

### content 설정이 필요 없다

v3에서는 `content` 배열에 템플릿 경로를 빠짐없이 적어야 했고, 빠뜨리면 클래스가 생성되지 않는 문제가 자주 생겼다. v4는 프로젝트 파일을 자동으로 탐색하며 `.gitignore`에 있는 경로와 바이너리 파일은 제외한다. 자동 탐색에서 빠지는 경로(예를 들어 `node_modules` 안의 UI 라이브러리)는 `@source`로 추가한다.

```css
@import "tailwindcss";
@source "../node_modules/@my-company/ui-lib";
```

### 새 엔진과 빌드 도구 통합

엔진이 성능을 중심으로 다시 작성됐다. 공식 발표에 따르면 전체 빌드는 최대 5배, 증분 빌드는 100배 이상 빨라졌다. 내부적으로 Lightning CSS를 사용해 `@import` 처리, 벤더 프리픽스, 최신 문법 변환을 직접 처리하므로 `postcss-import`나 `autoprefixer`를 따로 설치할 필요가 없다.

빌드 도구별 통합 패키지도 나뉘었다.

| 환경 | 패키지 |
| --- | --- |
| Vite | `@tailwindcss/vite` |
| PostCSS | `@tailwindcss/postcss` |
| CLI | `@tailwindcss/cli` |

Vite 프로젝트라면 플러그인을 추가하는 것으로 끝난다.

```js
// vite.config.js
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
});
```

### 최신 CSS 기능 기반

v4는 브라우저의 최신 기능을 적극적으로 사용한다. 네이티브 캐스케이드 레이어(`@layer`)로 우선순위를 관리하고, `@property`로 커스텀 속성에 타입을 지정하며, 투명도 수정자(`bg-black/50`)는 `color-mix()`로 구현한다. 기본 색상 팔레트는 OKLCH 색 공간으로 다시 정의되어 지원하는 디스플레이에서 더 선명한 색을 보여 준다.

이 때문에 지원 브라우저 하한도 올라갔다. Safari 16.4, Chrome 111, Firefox 128 이상이 필요하다. 더 오래된 브라우저를 지원해야 한다면 v3.4를 유지하는 것이 공식 권장이다.

### 새로 들어온 기능들

컨테이너 쿼리가 내장되어 플러그인 없이 부모에 `@container`, 자식에 `@sm:`, `@md:` 같은 접두사를 쓴다. 간격은 `--spacing` 기본 단위의 배수로 계산되어 `w-29`, `mt-17` 같은 값을 설정 없이 쓸 수 있고, `grid-cols-15`처럼 그리드 열 수도 마찬가지다. `starting:`(`@starting-style`), `not-*`, `inert:` 같은 변형이 추가됐고, 그라디언트는 `bg-gradient-to-r`이 `bg-linear-to-r`로 이름이 바뀌면서 `bg-linear-45` 같은 각도 지정과 `bg-radial`, `bg-conic`이 생겼다.

```html
<div class="@container">
  <div class="grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-4">
    <!-- 화면 폭이 아니라 부모 컨테이너 폭에 따라 열 수가 바뀐다 -->
  </div>
</div>
```

## 호환성에서 주의할 점

클래스 문법이 비슷하다 보니 업그레이드 후 "어딘가 미묘하게 달라진" 화면을 만나기 쉽다. 자주 마주치는 변경은 아래와 같다.

### 이름이 바뀐 유틸리티

스케일 이름을 일관되게 맞추면서 접미사 없는 기본값이 한 단계씩 밀렸다.

| v3 | v4 |
| --- | --- |
| `shadow-sm` | `shadow-xs` |
| `shadow` | `shadow-sm` |
| `rounded-sm` | `rounded-xs` |
| `rounded` | `rounded-sm` |
| `blur-sm` | `blur-xs` |
| `blur` | `blur-sm` |
| `outline-none` | `outline-hidden` |
| `ring` | `ring-3` |

v3의 `shadow`를 v4에서 그대로 쓰면 에러 없이 다른 크기의 그림자가 나오므로 특히 조심해야 한다.

### 제거된 유틸리티

- `bg-opacity-*`, `text-opacity-*`, `border-opacity-*` 등 투명도 유틸리티는 제거됐다. `bg-black/50` 같은 투명도 수정자를 쓴다.
- `flex-shrink-*`, `flex-grow-*`는 `shrink-*`, `grow-*`로 대체됐다. v3에서도 이미 짧은 이름이 권장되던 것이다.

### 기본값 변경

- `border`의 기본 색이 `gray-200`에서 `currentColor`로 바뀌었다. 색을 지정하지 않은 테두리는 글자색을 따라간다.
- `ring`의 기본 두께가 3px에서 1px로, 기본 색이 `blue-500`에서 `currentColor`로 바뀌었다.
- 버튼의 기본 커서가 `pointer`에서 브라우저 기본값(`default`)으로 바뀌었다.
- `hover:`는 hover를 지원하는 기기(`@media (hover: hover)`)에서만 적용된다.

### 문법 변경

- 변형을 겹칠 때 적용 순서가 오른쪽에서 왼쪽이 아니라 왼쪽에서 오른쪽으로 바뀌었다(`*:first:` 같은 조합에 영향).
- CSS 변수를 쓰는 임의 값은 `bg-[--brand]` 대신 `bg-(--brand)`로 쓴다.
- `!important` 수정자는 `!flex` 대신 `flex!`처럼 뒤에 붙이는 것이 새 문법이다.

### 다크 모드

다크 모드가 "자동으로 켜졌다"는 설명을 종종 보는데, 정확하지 않다. v3도 v4도 기본 `dark:`는 OS 설정(`prefers-color-scheme`)을 따른다. 달라진 것은 클래스로 전환하는 방법이다. v3에서는 `darkMode: 'class'`를 설정했지만, v4에서는 CSS에서 변형을 재정의한다.

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

이 설정이 없으면 `<html class="dark">`를 붙여도 `dark:` 스타일은 OS 설정만 따른다.

## v3에서 마이그레이션하기

공식 업그레이드 도구가 의존성 갱신, 설정 파일의 CSS 변환, 템플릿 안의 클래스 이름 변경을 대부분 자동으로 처리한다. Node.js 20 이상이 필요하다.

```bash
npx @tailwindcss/upgrade
```

변경 범위가 넓으므로 새 브랜치에서 실행하고, diff를 꼼꼼히 확인한 뒤 화면을 직접 비교해 보는 것이 좋다. 도구가 처리하지 못한 부분은 위의 호환성 항목을 기준으로 손본다.

설정 파일을 당장 옮기기 어렵다면 기존 `tailwind.config.js`를 그대로 불러올 수도 있다. 다만 `corePlugins`, `safelist`, `separator` 옵션은 v4에서 지원하지 않는다.

```css
@import "tailwindcss";
@config "../tailwind.config.js";
```

## v4 방식으로 다시 써 보기

### 런타임 테마 전환

v4의 유틸리티는 테마 값을 CSS 변수로 참조한다. 그래서 `@theme`에 정의한 변수를 특정 선택자 아래에서 다시 정의하면, 클래스를 바꾸지 않고도 테마를 전환할 수 있다.

```css
@import "tailwindcss";

@theme {
  --color-primary: #1e40af;
  --color-secondary: #9333ea;
}

@layer base {
  [data-theme="light"] {
    --color-primary: #3b82f6;
    --color-secondary: #a855f7;
  }
}
```

```html
<section data-theme="light">
  <div class="bg-primary p-4 text-white">
    <p class="text-secondary">data-theme만 바꾸면 색이 바뀐다</p>
  </div>
</section>
```

v3에서 같은 일을 하려면 `bg-[var(--theme-primary)]`처럼 임의 값을 쓰거나 설정 파일에서 색을 CSS 변수로 연결해야 했다. v4에서는 `bg-primary`라는 의미 있는 이름을 그대로 쓴다.

### 사용자 정의 유틸리티

v3에서는 `@layer utilities`나 JavaScript 플러그인의 `addUtilities`로 유틸리티를 추가했다. v4에서는 `@utility` 지시문을 쓴다. 이렇게 정의한 유틸리티에도 `hover:`, `lg:` 같은 접두사가 그대로 붙는다.

```css
@utility text-stroke {
  -webkit-text-stroke: 1px black;
}
```

기존 JavaScript 플러그인은 `@plugin`으로 불러온다.

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

### @apply와 @reference

`@apply`는 v4에서도 쓸 수 있다. 메인 CSS 파일에서는 그대로 쓰면 된다.

```css
@import "tailwindcss";

@theme {
  --color-primary: #1e40af;
}

@layer components {
  .btn-primary {
    @apply rounded-lg bg-primary px-4 py-2 font-bold text-white;
  }
}
```

다만 Vue나 Svelte 컴포넌트의 `<style>` 블록, CSS 모듈처럼 별도로 처리되는 스타일시트에서는 테마 정보를 알 수 없다. 이때는 `@reference`로 메인 CSS를 참조해야 한다. 참조는 스타일을 중복 출력하지 않는다.

```vue
<style scoped>
@reference "../assets/main.css";

h1 {
  @apply text-2xl font-bold text-primary;
}
</style>
```

## 참고

- [Tailwind CSS v4.0 발표](https://tailwindcss.com/blog/tailwindcss-v4)
- [Upgrade guide](https://tailwindcss.com/docs/upgrade-guide)
- [Theme variables](https://tailwindcss.com/docs/theme)
- [Functions and directives](https://tailwindcss.com/docs/functions-and-directives)
