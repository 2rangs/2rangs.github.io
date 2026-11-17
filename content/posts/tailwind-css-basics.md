---
legacy_id: 5
slug: tailwind-css-basics
title: Tailwind CSS 입문 (1) 설치, 유틸리티 우선, 상태와 반응형
summary: Tailwind CSS의 유틸리티 우선 철학과 설치, 상태·반응형 접두사, 빌드 최적화를 정리하고 v4에서 달라진 부분을 함께 짚는다.
tags: [Tailwind CSS, CSS]
series: Tailwind CSS 입문
date: 2024-12-12T06:26:11.958Z
comment_term: posts/TailwindCSS%EC%97%90-%EB%8C%80%ED%95%B4-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90
---

Tailwind CSS는 CSS 파일에 규칙을 따로 쓰는 대신, 미리 정의된 작은 클래스(유틸리티)를 HTML에 조합해 스타일을 완성하는 유틸리티 우선(utility-first) CSS 프레임워크다. 이 글은 Tailwind CSS 입문 시리즈의 첫 번째 글로, 설치부터 상태·반응형 스타일링, 빌드 최적화까지 기본기를 다룬다.

처음 이 글을 쓴 2024년 말에는 v3가 최신이었다. 2025년 1월 v4가 나오면서 설치와 설정 방식이 크게 바뀌었기 때문에, 본문은 v3 기준으로 설명하되 v4에서 달라진 부분은 각 섹션에 따로 적었다. v4 전체 변경 사항은 [시리즈 세 번째 글](/blog/tailwind-css-v4/)에서 정리한다.

## 기존 CSS와 무엇이 다른가

가로 그라디언트 배경을 가진 박스를 만든다고 해 보자. 일반적인 CSS라면 클래스를 하나 정의하고 스타일을 적는다.

```html
<style>
  .gradient-box {
    width: 100%;
    height: 100px;
    background: linear-gradient(to right, #facc15, #f87171);
  }
</style>

<div class="gradient-box">yellow to red</div>
```

Tailwind에서는 별도 CSS 없이 클래스만 조합한다.

```html
<div class="h-[100px] w-full bg-gradient-to-r from-yellow-400 to-red-400">
  yellow to red
</div>
```

`bg-gradient-to-r`은 방향, `from-*`과 `to-*`는 시작·끝 색이다. 클래스 이름이 곧 스타일이라 마크업만 읽어도 결과를 예상할 수 있다.

> v4에서는 그라디언트 유틸리티 이름이 `bg-linear-to-r`로 바뀌었다. `bg-linear-45` 처럼 각도 지정도 된다.

## 설치하기 (v3, Tailwind CLI)

빌드 도구 없이 Tailwind CLI만으로 시작하는 가장 단순한 방법이다. React, Vue 같은 프레임워크를 쓴다면 [공식 프레임워크 가이드](https://tailwindcss.com/docs/installation/framework-guides)를 따르는 편이 낫다.

먼저 패키지를 설치하고 설정 파일을 만든다.

```bash
npm install -D tailwindcss@3
npx tailwindcss init
```

프로젝트 루트에 `tailwind.config.js`가 생긴다. `content`에는 Tailwind 클래스를 쓰는 모든 템플릿 파일 경로를 적는다. Tailwind는 이 파일들을 스캔해서 실제로 쓰인 클래스만 CSS로 생성한다.

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

`src/input.css`를 만들고 Tailwind 지시문을 추가한다.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

CLI로 템플릿을 스캔해 CSS를 빌드한다. `--watch`를 붙이면 파일이 바뀔 때마다 다시 빌드한다.

```bash
npx tailwindcss -i ./src/input.css -o ./src/output.css --watch
```

생성된 CSS를 HTML에 연결하면 끝이다.

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link href="./output.css" rel="stylesheet" />
  </head>
  <body>
    <h1 class="text-3xl font-bold underline">Hello world!</h1>
  </body>
</html>
```

### v4에서 달라진 설치

v4는 설정 파일 없이 CSS에서 시작한다. `tailwind.config.js`와 `content` 배열이 필수가 아니며, 템플릿 파일은 자동으로 감지한다(`.gitignore`에 있는 경로는 제외). CLI도 별도 패키지로 분리됐다.

```bash
npm install tailwindcss @tailwindcss/cli
```

```css
/* src/input.css */
@import "tailwindcss";
```

```bash
npx @tailwindcss/cli -i ./src/input.css -o ./src/output.css --watch
```

세 줄짜리 `@tailwind` 지시문이 `@import "tailwindcss";` 한 줄로 대체된 것이 가장 눈에 띄는 차이다. Vite를 쓴다면 `@tailwindcss/vite` 플러그인을, PostCSS를 쓴다면 `@tailwindcss/postcss`를 설치한다.

## 유틸리티 우선이라는 철학

유틸리티 우선은 하나의 역할만 하는 작은 클래스를 조합해 디자인을 만드는 방식이다. 별도 CSS 파일을 오가거나 기존 스타일을 덮어쓰지 않고 마크업에서 바로 작업할 수 있다는 것이 핵심이다.

- **역할이 명확한 클래스**: `text-center`는 가운데 정렬, `pt-4`는 위쪽 패딩, `text-blue-500`은 글자색처럼 클래스 하나가 하나의 일만 한다.
- **빠른 프로토타이핑**: 클래스를 붙이는 즉시 결과가 보이므로, 클래스 이름 짓기나 파일 구조를 고민하지 않고 UI를 시험해 볼 수 있다.
- **일관성**: 간격·색상·글자 크기가 미리 정해진 스케일(디자인 토큰) 안에서 선택되므로, 프로젝트 전체의 값이 자연스럽게 통일된다. CSS 파일이 기능이 늘어날 때마다 커지지 않는다는 장점도 있다.
- **반응형과 상태**: `md:`, `hover:` 같은 접두사로 미디어 쿼리와 의사 클래스를 클래스 안에서 바로 표현한다.

```html
<div class="rounded-lg bg-gray-200 p-4 shadow-lg">
  <h1 class="text-2xl font-bold text-blue-500">안녕하세요, Tailwind CSS!</h1>
  <p class="mt-2 text-gray-700">
    유틸리티 클래스를 조합하면 빠르고 일관되게 작업할 수 있다.
  </p>
</div>
```

## 상태 기반 스타일링

마우스 오버, 포커스, 클릭처럼 요소의 상태에 따라 스타일을 바꾸려면 유틸리티 앞에 상태 접두사(variant)를 붙인다. CSS의 `:hover`, `:focus` 같은 의사 클래스를 클래스 이름으로 옮긴 것이다.

### hover, focus, active

```html
<!-- 마우스를 올리면 배경이 진해진다 -->
<button class="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700">
  Hover Me
</button>

<!-- 포커스를 받으면 테두리와 링 색이 바뀐다 -->
<input class="border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />

<!-- 누르고 있는 동안 적용된다 -->
<button class="rounded bg-blue-500 px-4 py-2 font-bold text-white active:bg-blue-800">
  Active State
</button>
```

### disabled

`disabled` 속성이 있는 요소에 적용된다.

```html
<button class="rounded bg-blue-500 px-4 py-2 font-bold text-white disabled:opacity-50" disabled>
  Disabled
</button>
```

### group-hover

부모에 `group` 클래스를 붙이면, 부모가 hover 상태일 때 자식의 스타일을 바꿀 수 있다. 카드 전체에 마우스를 올렸을 때 안쪽 제목 색만 바꾸는 식의 UI에 유용하다.

```html
<div class="group rounded-lg p-4">
  <div class="bg-gray-200 p-4 group-hover:bg-gray-400">
    부모에 마우스를 올리면 배경이 바뀐다
  </div>
</div>
```

### 그 밖의 상태 접두사

| 접두사 | 적용 조건 |
| --- | --- |
| `focus-visible:` | 키보드 탐색 등으로 포커스 표시가 필요할 때만 |
| `focus-within:` | 자식 중 하나가 포커스를 받았을 때 |
| `checked:` | 체크박스·라디오가 선택된 상태 |
| `first:`, `last:` | 형제 중 첫 번째·마지막 요소 |
| `odd:`, `even:` | 홀수·짝수 번째 요소 |

> v4에서 `hover:`는 `@media (hover: hover)` 안에서만 적용된다. 터치 기기에서 탭한 뒤 hover 스타일이 남는 문제를 막기 위한 변경이다.

## 반응형 디자인

Tailwind는 미디어 쿼리를 직접 쓰지 않고도 화면 크기별 스타일을 지정할 수 있게 반응형 접두사를 제공한다. 기본 브레이크포인트는 다음과 같다.

![Tailwind CSS v3 기본 브레이크포인트 표. sm 640px, md 768px, lg 1024px, xl 1280px, 2xl 1536px 이상에 각각 min-width 미디어 쿼리가 대응된다](/img/blog/post-5-1.png)

v4에서도 기준 폭은 같지만 단위가 rem으로 바뀌었다(`sm`은 40rem, `md`는 48rem 등).

중요한 점은 Tailwind가 **모바일 우선**이라는 것이다. 접두사가 없는 클래스는 모든 화면에 적용되고, `md:`는 "md 이상"에서 적용된다. 따라서 작은 화면 스타일을 먼저 쓰고, 큰 화면에서 바뀌는 부분만 접두사로 덮어쓴다.

```html
<p class="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl">
  반응형 텍스트 크기
</p>
```

기본은 `text-base`, 640px 이상에서 `text-lg`, 768px 이상에서 `text-xl`로 단계적으로 커진다. 레이아웃도 같은 방식으로 구성한다.

```html
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
  <div class="bg-blue-500 p-4">1</div>
  <div class="bg-blue-500 p-4">2</div>
  <div class="bg-blue-500 p-4">3</div>
  <div class="bg-blue-500 p-4">4</div>
</div>
```

기본 1열에서 시작해 sm 이상 2열, md 이상 3열, lg 이상 4열로 바뀐다.

### 브레이크포인트 추가하기

v3에서는 설정 파일에서 브레이크포인트를 바꾼다. `theme.screens`에 바로 쓰면 기본값을 **덮어쓰므로**, 기존 값을 유지하면서 하나만 추가하려면 `extend`를 쓰거나 전체 목록을 다시 적어야 한다. 여기서는 `xs`가 가장 작은 값이라 목록 맨 앞에 와야 하므로 전체를 다시 적었다.

```js
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
  },
};
```

이제 `xs:` 접두사로 480px 이상에서만 적용되는 스타일을 쓸 수 있다.

v4에서는 같은 작업을 CSS의 `@theme` 블록에서 한다. `--breakpoint-*` 변수를 추가하면 그에 맞는 접두사가 생긴다.

```css
@import "tailwindcss";

@theme {
  --breakpoint-xs: 30rem; /* 480px */
}
```

## 빌드 최적화

Tailwind는 템플릿에서 실제로 쓰인 클래스만 CSS로 생성한다. 공식 문서는 여기에 압축과 네트워크 압축(gzip, Brotli)을 더하면 대형 프로젝트에서도 보통 10kB 미만의 CSS가 나온다고 설명하며, 예시로 Netflix Top 10 사이트가 네트워크로 전송하는 CSS가 6.5kB라고 소개한다(작성 당시 기준). CSS가 이 정도로 작으면 페이지별 CSS 코드 분할 같은 복잡한 전략 없이, 파일 하나를 받아 다음 배포까지 캐시하면 충분하다.

Tailwind CLI를 쓴다면 `--minify` 플래그로 압축한다.

```bash
npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify
```

v3를 PostCSS 플러그인으로 쓴다면 프로덕션 빌드에서만 `cssnano`를 추가하는 방법이 있다(`cssnano`는 따로 설치해야 한다).

```js
// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {}),
  },
};
```

Vite, Next.js 같은 프레임워크는 프로덕션 빌드에서 CSS를 알아서 압축하므로 이 설정이 필요 없는 경우가 많다.

v4는 내부적으로 Lightning CSS를 사용해 벤더 프리픽스와 최신 문법 변환을 직접 처리한다. 그래서 `autoprefixer`나 `postcss-import`를 따로 둘 필요가 없고, PostCSS 설정도 `@tailwindcss/postcss` 하나면 된다. CLI에서 압축할 때는 `npx @tailwindcss/cli -i ./src/input.css -o ./dist/output.css --minify`처럼 같은 플래그를 쓴다.

## 정리

- Tailwind는 단일 역할의 유틸리티 클래스를 조합해 스타일을 만드는 유틸리티 우선 프레임워크다.
- `hover:`, `focus:`, `group-hover:` 같은 상태 접두사와 `sm:`, `md:` 같은 반응형 접두사로 의사 클래스와 미디어 쿼리를 클래스 안에서 표현한다. 반응형은 모바일 우선이다.
- 사용한 클래스만 생성하므로 결과 CSS가 작고, 압축까지 더하면 대부분의 프로젝트에서 CSS 크기를 크게 신경 쓸 필요가 없다.
- v4에서는 `@import "tailwindcss"`로 시작하고, 설정은 `tailwind.config.js` 대신 CSS의 `@theme`에서 한다.

[다음 글](/blog/tailwind-css-customization/)에서는 다크 모드와 테마 커스터마이징, 임의 값, 사용자 정의 스타일 추가 방법을 다룬다.

## 참고

- [Tailwind CSS 설치 가이드](https://tailwindcss.com/docs/installation)
- [Hover, focus, and other states](https://tailwindcss.com/docs/hover-focus-and-other-states)
- [Responsive design](https://tailwindcss.com/docs/responsive-design)
- [Tailwind CSS v4 업그레이드 가이드](https://tailwindcss.com/docs/upgrade-guide)
