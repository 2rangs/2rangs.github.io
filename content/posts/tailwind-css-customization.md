---
legacy_id: 6
slug: tailwind-css-customization
title: Tailwind CSS 입문 (2) 다크 모드와 테마, 사용자 정의 스타일
summary: Tailwind CSS의 다크 모드, 테마 커스터마이징, 임의 값, @layer를 이용한 사용자 정의 스타일을 정리하고 v4 방식과 비교한다.
tags: [Tailwind CSS, CSS]
series: Tailwind CSS 입문
cover: https://2rangs.github.io/img/covers/tailwind-css-customization.png
date: 2024-12-13T07:27:36.910Z
comment_term: posts/TailwindCSS%EC%97%90-%EB%8C%80%ED%95%B4-%EB%98%90-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90
---

Tailwind CSS 입문 시리즈의 두 번째 글이다. [첫 번째 글](/blog/tailwind-css-basics/)에서 설치와 유틸리티 우선, 상태·반응형 접두사를 다뤘다면, 이번에는 다크 모드와 프로젝트에 맞게 Tailwind를 확장하는 방법을 정리한다.

프레임워크를 쓸 때 가장 곤란한 순간은 프레임워크가 제공하지 않는 것이 필요할 때다. Tailwind는 처음부터 확장을 염두에 두고 설계되어서, 디자인 토큰을 바꾸고, 필요하면 제약을 벗어나고, 직접 CSS를 추가하는 방법이 모두 마련되어 있다. 본문은 작성 당시 최신이던 v3 기준이며, v4에서 달라진 부분은 따로 적었다.

## 다크 모드

요즘은 웬만한 웹사이트가 다크 모드를 지원한다. Tailwind에서는 `dark:` 접두사를 붙여 다크 모드일 때만 적용할 스타일을 지정한다.

```html
<div class="rounded-lg bg-white px-6 py-8 shadow-xl ring-1 ring-slate-900/5 dark:bg-slate-800">
  <h3 class="text-base font-medium tracking-tight text-slate-900 dark:text-white">
    Writes Upside-Down
  </h3>
  <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
    The Zero Gravity Pen can be used to write in any orientation, including upside-down.
  </p>
</div>
```

`bg-white dark:bg-slate-800`처럼 라이트 모드 값을 기본으로 두고, 다크 모드에서 바뀌는 값만 `dark:`로 덮어쓴다.

### 다크 모드를 켜는 기준

기본적으로 `dark:`는 운영체제 설정을 따르는 `prefers-color-scheme: dark` 미디어 쿼리로 동작한다. 사이트에 다크 모드 토글 버튼을 두려면 클래스 기준으로 바꿔야 한다. v3에서는 설정 파일에서 지정한다.

```js
// tailwind.config.js
module.exports = {
  darkMode: 'class', // v3.4.1부터는 'selector'도 사용 가능
  // ...
};
```

이제 `<html class="dark">`처럼 상위 요소에 `dark` 클래스가 있을 때 `dark:` 스타일이 적용된다. v4에서는 설정 파일 대신 CSS에서 `dark` 변형을 재정의한다.

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

## 테마 커스터마이징

색상 팔레트, 간격, 글꼴, 브레이크포인트 같은 디자인 토큰은 v3에서 `tailwind.config.js`의 `theme`에서 바꾼다. `theme` 바로 아래에 쓴 키는 기본값을 **통째로 교체**하고, `theme.extend` 아래에 쓴 키는 기본값에 **추가**된다는 데 주의한다.

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js}'],
  theme: {
    // 기본 브레이크포인트·색상·글꼴을 모두 교체
    screens: {
      sm: '480px',
      md: '768px',
      lg: '976px',
      xl: '1440px',
    },
    colors: {
      blue: '#1fb6ff',
      pink: '#ff49db',
      orange: '#ff7849',
      green: '#13ce66',
      'gray-dark': '#273444',
      gray: '#8492a6',
      'gray-light': '#d3dce6',
    },
    fontFamily: {
      sans: ['Graphik', 'sans-serif'],
      serif: ['Merriweather', 'serif'],
    },
    // 기본값은 유지하고 추가
    extend: {
      spacing: {
        128: '32rem',
        144: '36rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
};
```

위 설정에서는 `colors`를 교체했기 때문에 `bg-blue-500` 같은 기본 색상 클래스는 더 이상 생성되지 않고, 대신 `bg-blue`, `text-gray-dark`를 쓸 수 있다. 반면 `spacing`은 `extend`에 넣었으므로 기존 간격 스케일에 `w-128`, `p-144`가 추가된다.

### v4의 @theme

v4에서는 같은 설정을 CSS 변수로 선언한다. `@theme` 안의 변수 이름 접두사(`--color-*`, `--font-*`, `--breakpoint-*` 등)가 어떤 유틸리티를 만들지 결정한다.

```css
@import "tailwindcss";

@theme {
  --breakpoint-sm: 30rem;
  --breakpoint-lg: 61rem;

  --color-*: initial; /* 기본 색상 팔레트 제거 */
  --color-blue: #1fb6ff;
  --color-pink: #ff49db;
  --color-gray-dark: #273444;

  --font-sans: Graphik, sans-serif;
  --font-serif: Merriweather, serif;

  --radius-4xl: 2rem;
}
```

변수를 그냥 추가하면 v3의 `extend`처럼 동작하고, `--color-*: initial;`처럼 네임스페이스를 초기화하면 v3에서 `theme.colors`를 교체한 것과 같다. 테마 값은 실제 CSS 변수로도 노출되므로 `var(--color-pink)`처럼 일반 CSS나 JavaScript에서 바로 참조할 수 있다. 또 v4는 간격 유틸리티가 `--spacing` 기본 단위의 배수로 계산되어서 `w-128` 같은 값을 따로 등록하지 않아도 쓸 수 있다.

기존 JavaScript 설정 파일을 계속 쓰고 싶다면 `@config "./tailwind.config.js";`로 불러올 수 있다.

## 임의 값 사용하기

정해진 디자인 토큰만으로 대부분의 화면을 만들 수 있지만, 가끔은 픽셀 단위로 정확한 값이 필요하다. 이때 대괄호 표기법으로 임의 값(arbitrary value)을 넣으면 그 자리에서 클래스가 생성된다.

```html
<div class="top-[117px]"></div>
```

v3에서는 `theme()` 함수로 설정 파일의 값을 참조할 수 있다.

```html
<div class="grid grid-cols-[fit-content(theme(spacing.32))]"></div>
```

v4에서는 `theme()` 대신 간격 값을 계산하는 `--spacing()` 함수나 테마 변수를 쓴다.

```html
<div class="grid grid-cols-[fit-content(--spacing(32))]"></div>
```

### CSS 변수

v3.3 이상에서는 대괄호 안에 CSS 변수 이름만 쓰면 `var()`로 감싸 준다. v4에서는 대괄호 대신 소괄호를 쓰는 문법으로 바뀌었다.

```html
<!-- v3 -->
<div class="bg-[--my-color]"></div>

<!-- v4 -->
<div class="bg-(--my-color)"></div>
```

`bg-[var(--my-color)]`처럼 `var()`를 직접 쓰는 방식은 두 버전 모두에서 동작한다.

### 임의 속성

Tailwind에 유틸리티가 없는 CSS 속성은 대괄호 안에 `속성:값`을 통째로 쓴다. 상태·반응형 접두사도 그대로 붙일 수 있고, CSS 변수 값을 화면 크기별로 바꾸는 데도 쓸 수 있다.

```html
<div class="[mask-type:luminance] hover:[mask-type:alpha]"></div>

<div class="[--scroll-offset:56px] lg:[--scroll-offset:44px]"></div>
```

### 공백과 밑줄

클래스 이름에는 공백을 쓸 수 없으므로, 임의 값 안의 공백은 밑줄(`_`)로 적는다. Tailwind가 빌드할 때 공백으로 바꿔 준다. URL처럼 밑줄이 의미를 갖는 곳에서는 변환하지 않는다.

```html
<div class="grid grid-cols-[1fr_500px_2fr]"></div>

<div class="bg-[url('/what_a_rush.png')]"></div>
```

밑줄을 정말 밑줄로 쓰고 싶다면 `\_`처럼 백슬래시로 이스케이프한다. JSX에서는 백슬래시가 JavaScript 문자열 이스케이프로 먼저 처리되므로 `String.raw`로 감싼다.

```jsx
<div className={String.raw`before:content-['hello\_world']`}></div>
```

## 사용자 정의 CSS와 레이어

### Tailwind가 스타일을 레이어로 나누는 이유

CSS에서 두 선택자의 명시도(specificity)가 같으면 스타일시트에서 나중에 나온 규칙이 이긴다.

```css
.btn {
  background: blue;
}

.bg-black {
  background: black;
}
```

```html
<button class="btn bg-black">...</button>
<button class="bg-black btn">...</button>
```

`class` 속성 안의 순서는 상관없다. `.bg-black`이 CSS에서 뒤에 있으므로 두 버튼 모두 검은색이 된다. 이 순서를 예측 가능하게 관리하기 위해 Tailwind는 생성하는 스타일을 세 레이어로 나눈다. ITCSS에서 널리 알려진 개념이다.

| 레이어 | 용도 |
| --- | --- |
| `base` | 리셋 규칙, HTML 요소의 기본 스타일 |
| `components` | 유틸리티로 덮어쓸 수 있는 클래스 기반 컴포넌트 스타일 |
| `utilities` | 단일 목적의 작은 클래스. 항상 가장 우선한다 |

`@layer` 지시문으로 직접 작성한 스타일을 원하는 레이어에 넣으면, 코드를 어디에 쓰든 최종 선언 순서는 레이어 순서를 따른다. v3에서는 Tailwind가 빌드 시점에 순서를 맞춰 주는 방식이고, v4는 브라우저의 네이티브 캐스케이드 레이어(`@layer`)를 그대로 사용한다.

### 기본 스타일 추가하기

페이지 전체의 글자색, 배경색, 글꼴 정도라면 `html`이나 `body`에 클래스를 붙이는 것이 가장 간단하다. 스타일 결정을 별도 파일에 숨기지 않고 마크업에 함께 둘 수 있다.

```html
<!doctype html>
<html lang="ko" class="bg-gray-100 font-serif text-gray-900">
  <!-- ... -->
</html>
```

특정 HTML 요소의 기본 스타일은 `base` 레이어에 추가한다. 테마 값을 쓰려면 `@apply`나 `theme()` 함수를 활용한다.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  h1 {
    @apply text-2xl;
  }
  h2 {
    @apply text-xl;
  }
}
```

### 컴포넌트 클래스 추가하기

여러 곳에서 반복되는 묶음은 `components` 레이어에 클래스로 정의한다. 같은 요소에 유틸리티를 함께 붙이면 유틸리티가 이긴다.

```css
@layer components {
  .card {
    background-color: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
  }
}
```

### 유틸리티 추가하기

Tailwind에 없는 유틸리티는 v3에서 `utilities` 레이어에 추가한다. 이렇게 넣은 클래스에도 `hover:`, `lg:` 같은 접두사를 붙일 수 있다.

```css
@layer utilities {
  .content-auto {
    content-visibility: auto;
  }
}
```

v4에서는 `@layer utilities` 대신 `@utility` 지시문을 쓴다. 지시문을 쓰는 쪽이 Tailwind가 유틸리티로 인식해 접두사 지원과 정렬을 처리해 준다.

```css
@import "tailwindcss";

@utility content-auto {
  content-visibility: auto;
}
```

`@layer base`와 `@layer components`는 v4에서도 그대로 쓸 수 있다.

## 정리

- 다크 모드는 `dark:` 접두사로 지정한다. 기본은 OS 설정을 따르고, 토글을 만들려면 v3는 `darkMode: 'class'`, v4는 `@custom-variant dark`로 클래스 기준으로 바꾼다.
- 테마는 v3에서 `theme`(교체)과 `theme.extend`(추가)로, v4에서 `@theme`의 CSS 변수로 커스터마이징한다.
- 토큰으로 부족할 때는 `top-[117px]`, `[mask-type:luminance]` 같은 임의 값과 임의 속성을 쓴다. 공백은 `_`로 쓴다.
- 직접 쓴 CSS는 `@layer base`, `@layer components`에 넣어 우선순위를 관리하고, 유틸리티는 v4에서 `@utility`로 추가한다.

여기까지 알면 일상적인 작업은 대부분 해낼 수 있다. [다음 글](/blog/tailwind-css-v4/)에서는 v4 출시와 함께 달라진 점을 정리한다.

## 참고

- [Dark mode](https://tailwindcss.com/docs/dark-mode)
- [Theme variables](https://tailwindcss.com/docs/theme)
- [Adding custom styles](https://tailwindcss.com/docs/adding-custom-styles)
- [Tailwind CSS v4 업그레이드 가이드](https://tailwindcss.com/docs/upgrade-guide)
