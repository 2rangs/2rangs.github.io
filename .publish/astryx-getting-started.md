
새 UI 라이브러리를 붙일 때 시간이 가장 많이 새는 곳은 대개 첫 30분입니다. 패키지는 설치했는데 버튼이 브라우저 기본 모양으로 나옵니다. 잘 되던 Tailwind 클래스가 갑자기 먹지 않습니다. `npx`로 CLI를 불렀더니 이름만 같은 다른 패키지가 내려받아집니다.

Astryx는 Meta가 공개한 오픈소스 React 디자인 시스템입니다. 스타일은 StyleX로 작성했지만, 쓰는 쪽에서는 미리 빌드된 CSS 파일을 import하면 됩니다. 그래서 설치 자체는 짧습니다. 패키지 몇 개, CSS 세 줄, 프로바이더 하나입니다.

다만 그 세 줄은 CSS 캐스케이드 레이어(cascade layer) 위에서 동작해서, 이 원리를 모르면 위 같은 증상을 만났을 때 원인을 찾기 어렵습니다. 아래는 설치부터 첫 화면까지를 Astryx v0.7.16(2026년 11월) 공식 README와 예제 앱 기준으로 따라가면서 각 줄이 왜 거기 있는지 짚은 기록입니다. Astryx는 베타라서 이후 버전에서 달라질 수 있습니다. Astryx가 어떤 배경에서 나왔는지는 [1편](/blog/astryx-overview/)에서 다뤘습니다.

## 설치 전에 확인할 것

| 항목 | 요구 사항 | 근거 |
| --- | --- | --- |
| React | `react`, `react-dom` 19.0.0 이상 | `@astryxdesign/core`의 peerDependencies |
| StyleX 런타임 | `@stylexjs/stylex` `^0.19.0` | 같은 곳 |
| Node.js | 22.13.0 이상 | `@astryxdesign/cli`의 `engines` (v0.7.16) |
| TypeScript | `moduleResolution`이 `bundler` 또는 `node16` 이상 | 마이그레이션 문서의 레이어 점검 목록 |
| 브라우저 | CSS `light-dark()`, Popover API, CSS 앵커 포지셔닝 | 브라우저 지원 문서 |

React 18 프로젝트에는 그대로 올릴 수 없습니다. 먼저 React를 올려야 합니다. Node 조건은 CLI 패키지에 적혀 있습니다. TypeScript 조건은 `@astryxdesign/core/reset.css` 같은 하위 경로(subpath) import를 풀기 위한 것입니다.

브라우저 쪽은 세 기능이 기준선을 정합니다. 공식 문서는 하나의 최저 버전을 못 박지 않고 등급(tier)으로 나눠 설명합니다. 메뉴나 툴팁을 띄우지 않는 화면이라면 `light-dark()`만 지원되면 됩니다.

## 패키지 설치

```bash
# npm
npm install @astryxdesign/core @stylexjs/stylex @astryxdesign/theme-neutral
npm install -D @astryxdesign/cli

# pnpm
pnpm add @astryxdesign/core @stylexjs/stylex @astryxdesign/theme-neutral
pnpm add -D @astryxdesign/cli

# yarn
yarn add @astryxdesign/core @stylexjs/stylex @astryxdesign/theme-neutral
yarn add -D @astryxdesign/cli
```

`@astryxdesign/core`에는 컴포넌트, `Theme` 프로바이더, 리셋과 컴포넌트 CSS가 들어 있고, `@stylexjs/stylex`는 Core의 peer dependency입니다. `@astryxdesign/theme-neutral`은 테마입니다. 공식 테마는 neutral, butter, chocolate, gothic(다크 전용), matcha, stone, y2k 일곱 가지이고 문서는 neutral을 출발점으로 권합니다. `@astryxdesign/cli`는 컴포넌트 문서, 템플릿, 테마 도구, 업그레이드 코드모드(codemod)를 담당합니다.

`@stylexjs/stylex`를 설치하니까 StyleX 빌드 설정도 해야 한다고 생각하기 쉽지만 그렇지 않습니다. 공식 문서의 표현으로는 Astryx 컴포넌트는 "pre-compiled"로 배포됩니다. `astryx.css` 한 파일에 컴포넌트 스타일이 모두 들어 있어서, 배포된 패키지를 쓰기만 한다면 StyleX 설정이 필요 없습니다. 컴파일러가 필요한 경우는 두 가지뿐입니다. 내 코드에서 `stylex.create()`를 직접 쓸 때, 그리고 `astryx swizzle`로 컴포넌트 소스를 앱 안으로 복사했을 때입니다.

버전은 한꺼번에 맞춥니다. 각 테마 패키지는 자신과 맞는 Core 버전을 정확히 하나로 지정합니다(예: `theme-neutral` 0.7.17의 peer는 `@astryxdesign/core` `0.7.17`). 그래서 Core만 올리면 테마가 맞지 않게 됩니다. 공식 문서는 업그레이드할 때 앱이 쓰는 `@astryxdesign/*` 패키지를 한 명령으로 같은 릴리스에 올리라고 안내합니다.

## CSS 세 줄과 캐스케이드 레이어

전역 CSS 파일에 세 줄을 넣습니다.

```css
@import '@astryxdesign/core/reset.css';
@import '@astryxdesign/core/astryx.css';
@import '@astryxdesign/theme-neutral/theme.css';
```

이 순서는 레이어 순서와 그대로 대응합니다.

| import | 레이어 | 하는 일 |
| --- | --- | --- |
| `reset.css` | `reset` | 브라우저 간 차이를 지우는 리셋. `:where()`로 감싸 명시도(specificity)가 0 |
| `astryx.css` | `astryx-base` | 사전 빌드된 컴포넌트 스타일 전체 |
| `theme.css` | `astryx-theme` | 테마의 디자인 토큰과 컴포넌트 재정의 |

캐스케이드 레이어에서는 두 가지 규칙이 명시도보다 먼저 적용됩니다.

- 나중에 선언된 레이어가 앞 레이어를 이깁니다.
- 레이어에 속하지 않은 스타일은 모든 레이어를 이깁니다.

그래서 `reset < astryx-base < astryx-theme < 내 CSS` 순서가 됩니다. 테마는 컴포넌트 기본값을 덮고, 내가 쓴 CSS는 `!important` 없이 둘 다 덮습니다.

### 순서를 바꾸면 깨질까

세 줄의 순서가 틀리면 레이어가 뒤집힌다고 걱정할 수 있습니다. README는 순서가 중요하다고 적고, 문서가 안내하는 순서를 그대로 따르는 것이 맞습니다. 다만 세 파일끼리의 우선순위는 import 순서만으로 정해지는 것이 아닙니다. `reset.css`를 열어 보면 첫 규칙이 이렇습니다.

```css
@layer reset, astryx-base, astryx-theme;
```

패키지 스타일시트의 계약을 적은 설계 문서(AST-080)는 리셋, 각 패키지의 스타일시트, 테마 출력이 모두 이 줄로 시작한다고 정합니다. 그래서 어느 파일이 먼저 로드되든 `reset < astryx-base < astryx-theme`이 유지됩니다.

실제로 설치를 망가뜨리는 것은 대개 Astryx 밖의 CSS입니다.

하나는 레이어 없는 기존 리셋입니다. `* { padding: 0 }` 같은 리셋은 레이어를 쓰지 않을 때는 클래스 선택자에 지지만, 레이어 밖에 있으면 모든 레이어를 이깁니다. 버튼의 패딩이 사라지는데 오류도 경고도 없습니다. 다른 하나는 Tailwind의 레이어입니다. Tailwind가 먼저 자기 레이어 이름을 등록하면 Astryx 레이어가 그 뒤에 붙어 유틸리티 클래스보다 강해집니다.

기존 리셋은 가장 낮은 레이어에 명시적으로 넣습니다.

```css
/* 전: @import "./legacy-reset.css";  레이어 밖이라 모든 레이어를 이긴다 */
@import "./legacy-reset.css" layer(reset);
```

마이그레이션 문서는 화면을 만들기 전에 버튼, 입력, 카드를 올린 점검용 페이지를 하나 띄워 보라고 권합니다. 버튼의 `padding-inline`이 `0px`이면 레이어 순서가 깨진 것입니다.

Core가 아닌 Astryx 패키지를 쓰면 그 패키지의 스타일시트를 `astryx.css` 다음에 한 줄 더 넣습니다(예: `@astryxdesign/charts/charts.css`. charts는 v0.7.16 기준 canary 태그로만 배포됩니다). 이들도 모두 `astryx-base`에 들어갑니다.

## Theme와 LinkProvider

### Theme

`<Theme>`은 하위 트리에 테마를 적용하는 프로바이더입니다. prop은 `theme`(필수), `mode`, `children` 셋입니다. `mode`는 `'light'`, `'dark'`, `'system'` 중 하나이고 기본값은 `'system'`입니다.

```tsx
import {Theme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';

<Theme theme={neutralTheme}>{children}</Theme>
```

테마 객체를 `/built`에서 가져오는 점을 눈여겨보세요. 공식 테마는 빌드된 테마 객체를 `/built`에, 프로덕션 CSS를 `/theme.css`에, 폰트 로딩 CSS를 `/fonts.css`에 내보냅니다. 문서는 `/built`를 CSS 파일 없이 쓰지 말라고 적습니다. 컴포넌트 재정의가 적용되지 않기 때문입니다. 패키지 루트(`@astryxdesign/theme-neutral`)에서 가져오는 런타임 테마는 하이드레이션 때 스타일을 주입하므로, SSR 프로덕션 앱에서는 쓰지 말라고 합니다.

CLI에 맡기는 방법도 있습니다. `astryx theme add neutral`을 실행하면 `src/astryx-themes.ts`가 생기고, 이 모듈이 빌드된 테마와 `theme.css`, 폰트 CSS를 대신 import합니다.

```tsx
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from './astryx-themes';

<Theme theme={themes[defaultThemeSlug]}><App /></Theme>
```

README와 예제 앱은 직접 import하는 방식을, CLI의 시작 문서는 `theme add` 방식을 씁니다. 테마를 고르고 만드는 이야기는 [5편](/blog/astryx-theme-tokens/)에서 이어집니다.

### LinkProvider

Astryx에서 링크를 그리는 컴포넌트는 기본적으로 `<a>`를 씁니다. 그대로 두면 Next.js 앱에서 링크를 누를 때마다 전체 페이지를 새로 불러옵니다.

`<LinkProvider component={Link}>`로 감싸면 하위 트리의 Astryx 링크가 넘겨준 컴포넌트로 그려집니다. 예제 README는 대상으로 Link, `href`가 있는 Button, TopNav, SideNav, Breadcrumbs, TabList를 듭니다. 개별 링크가 `as` prop을 지정하거나 더 가까운 `LinkProvider`가 있으면 그쪽이 우선합니다.

## 프레임워크별 설정

| 조합 | 전역 CSS | 빌드 설정 | 저장소 예제 |
| --- | --- | --- | --- |
| Next.js | 세 줄 | 없음 | `apps/example-nextjs` |
| Next.js + Tailwind v4 | `@layer` 선언 + Tailwind + 세 줄 + 브리지 | Tailwind 것만 | `apps/example-nextjs-tailwind` |
| Next.js + StyleX | 세 줄 + `@stylex;` | 내 코드용 StyleX 플러그인 | `apps/example-nextjs-stylex` |
| Vite | 세 줄 | 없음 | `apps/example-vite-tailwind` (Tailwind 포함) |
| CDN | `<link>` 세 개 | 없음 | `astryx template --cdn` |

`apps/example-vite`는 이름과 달리 소스 빌드 예제입니다. 사전 빌드본으로 시작한다면 참고 대상이 아닙니다.

### Next.js

`src/app/globals.css`에 세 줄을 넣고, 프로바이더를 클라이언트 컴포넌트로 분리합니다.

```tsx
// src/app/providers.tsx
'use client';

import Link from 'next/link';
import {Theme} from '@astryxdesign/core/theme';
import {LinkProvider} from '@astryxdesign/core/Link';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';

export function Providers({children}: {children: React.ReactNode}) {
  return (
    <Theme theme={neutralTheme}>
      <LinkProvider component={Link}>{children}</LinkProvider>
    </Theme>
  );
}
```

루트 레이아웃(`src/app/layout.tsx`)에서는 `./globals.css`를 import하고 `<body>` 안을 `<Providers>`로 감쌉니다. `'use client'`를 빼면 `createContext` 때문에 서버 컴포넌트 오류가 납니다.

webpack으로 빌드한다면(`next build --webpack`) 설정을 한 줄 더합니다. `next.config.mjs`의 `experimental.optimizePackageImports`에 `'@astryxdesign/core'`를 넣습니다. webpack에서는 서버 컴포넌트가 패키지 루트에서 import하면 모든 클라이언트 컴포넌트가 딸려 나가기 때문입니다. Next.js 16의 기본 번들러인 Turbopack에서는 필요 없고, 그대로 둬도 해롭지 않습니다.

### Next.js + Tailwind

Tailwind v4와 같이 쓸 때는 모든 레이어를 맨 위에서 한 번에 선언합니다.

```css
@layer reset, theme, base, astryx-base, astryx-theme, components, utilities;

@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/preflight.css' layer(base);
@import '@astryxdesign/core/reset.css';
@import '@astryxdesign/core/astryx.css';
@import '@astryxdesign/theme-neutral/theme.css';
@import '@astryxdesign/core/tailwind-theme.css';
@import 'tailwindcss/utilities.css' layer(utilities);
```

첫 줄이 없으면 Astryx 레이어가 Tailwind 레이어 뒤에 만들어져, 컴포넌트에 준 `className="bg-red-500"`이 먹지 않습니다. `tailwind-theme.css`는 Astryx 토큰을 Tailwind 유틸리티로 이어 주는 브리지입니다. `bg-surface`, `text-primary`, `rounded-lg` 같은 클래스가 테마 토큰을 읽습니다.

이 파일은 새 앱용입니다. 이미 Tailwind를 쓰는 앱이라면 자기 파일을 유지하고 두 군데만 고칩니다.

```css
@layer reset, theme, base, astryx-base, astryx-theme, components, utilities;

@import "tailwindcss"; /* 앱의 기존 진입점, 그대로 */
@import "@astryxdesign/core/reset.css";
@import "@astryxdesign/core/astryx.css";
@import "@astryxdesign/theme-neutral/theme.css";
```

주의할 점이 셋 있습니다.

- `@layer` 줄은 반드시 `@import "tailwindcss"` 위에 둡니다. `@layer` 문은 페이지가 아직 보지 못한 이름의 순서만 정합니다. 아래에 두면 Astryx 레이어가 `utilities` 뒤에 붙어 Astryx 리셋이 앱의 모든 유틸리티를 이깁니다. 빌드 오류도 콘솔 경고도 나지 않습니다.
- 기존 앱 레시피에는 `tailwind-theme.css`가 없습니다. 브리지는 `rounded-lg`, `shadow-md` 같은 Tailwind 기본 이름도 Astryx 토큰으로 바꾸므로 기존 화면의 모양이 달라질 수 있습니다. 문서는 브리지가 매핑하는 이름을 앱이 쓰지 않을 때만 넣으라고 권합니다.
- 레이어의 순위는 그 이름을 처음 언급한 스타일시트가 정합니다. `globals.css`를 루트 레이아웃의 첫 import로 둡니다. 그럴 수 없으면 `@layer` 줄만 `layers.css`로 떼어 가장 먼저 import합니다.

Tailwind v3는 `preflight.css`가 따로 없어 `@tailwind base`를 이름 있는 레이어로 감싸는 다른 레시피를 씁니다. Tailwind와 섞어 쓰는 방법은 [6편](/blog/astryx-styling-tailwind-swizzle/)에서 더 다룹니다.

### Next.js + StyleX

여기서 StyleX는 내 코드를 위한 것입니다. Astryx의 CSS는 여전히 `astryx.css`에서 옵니다. 전역 CSS는 같은 세 줄 뒤에 `@stylex;` 한 줄을 더한 모양입니다.

예제 앱은 `@stylexjs/babel-plugin`과 `@stylexjs/postcss-plugin`을 쓰고, PostCSS 플러그인의 `useCSSLayers.before`에 `reset`, `astryx-base`, `astryx-theme`을 적어 내 StyleX 레이어가 Astryx 레이어 뒤에 오게 합니다.

문서가 짚는 주의점은 둘입니다. StyleX 컴파일러의 입력에 `node_modules/@astryxdesign`을 넣지 않습니다. 그리고 Next.js에 Babel 설정을 추가하면 SWC 컴파일러가 꺼져 `next/font`를 쓸 수 없습니다. `next/font`를 지키려면 `@stylexswc/nextjs-plugin` 같은 SWC 기반 변환을 쓰라고 안내합니다.

### Vite

README의 Vite 항목은 짧습니다. 설치 명령은 같고, CSS import와 프로바이더도 위와 같으며, 빌드 플러그인은 필요 없다는 내용입니다. 저장소의 `example-vite-tailwind` 구조를 따르면 `src/index.css`에 같은 세 줄을 넣고, `src/main.tsx`에서 `./index.css`를 import하고, `App`을 `<Theme theme={neutralTheme}>`으로 감쌉니다. Vite에는 서버와 클라이언트의 경계가 없어 `'use client'`가 필요 없습니다.

### 빌드 없는 CDN 방식

프로토타입이나 임베드처럼 번들러가 없는 페이지에서는 CDN에서 ES 모듈로 불러옵니다. React 19가 UMD 빌드를 없앴기 때문에 `window.React`에 기대는 전역 스크립트 방식은 쓸 수 없고, import map으로 불러옵니다. CLI가 이 페이지를 설치된 버전에 고정해서 써 줍니다.

```bash
npx @astryxdesign/cli template --cdn   # cdn.template.html 을 쓴다
```

README에 실린 예시를 줄이면 다음과 같습니다(버전 0.4.1은 README의 고정 값이고, 렌더링 부분은 간추렸습니다).

```html
<!doctype html>
<html lang="en" data-astryx-theme="neutral">
  <head>
    <!-- Figtree 웹폰트, reset.css, astryx.css, theme.css 를 <link> 로 불러온다 (생략) -->
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react@19.2.0",
          "react/jsx-runtime": "https://esm.sh/react@19.2.0/jsx-runtime",
          "react-dom": "https://esm.sh/react-dom@19.2.0",
          "react-dom/client": "https://esm.sh/react-dom@19.2.0/client",
          "@astryxdesign/core": "https://esm.sh/@astryxdesign/core@0.4.1?external=react,react-dom"
        }
      }
    </script>
    <style>
      body { font-family: var(--font-family-body); }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      import * as React from 'react';
      import {createRoot} from 'react-dom/client';
      import {Card, Button} from '@astryxdesign/core';
      const e = React.createElement;
      createRoot(document.getElementById('root')).render(
        e(Card, {maxWidth: 480, elevation: 'low'},
          e(Button, {variant: 'primary', label: 'Try me'})),
      );
    </script>
  </body>
</html>
```

README는 이 레시피가 여섯 가지에 달려 있다고 정리합니다.

| 주의점 | 빠뜨리면 |
| --- | --- |
| `<html>`의 `data-astryx-theme` | 테마 CSS는 이 속성에 스코프되어 있어, 없으면 불러온 테마 대신 내장 기본값으로 그려진다 |
| `?external=react,react-dom` | esm.sh가 React를 따로 번들해 React가 두 벌이 되고, 훅마다 `Cannot read properties of null (reading 'useState')`가 난다 |
| import map의 `react/jsx-runtime` | 배포된 번들이 이것을 import하므로 `Failed to resolve module specifier`로 페이지가 죽는다 |
| `body`의 폰트 선언 | 세 스타일시트 어디에도 문서 폰트를 정하는 규칙이 없고 Button은 `font: inherit`이라, 라벨이 브라우저 기본 세리프로 나온다 |
| 웹폰트 `<link>` | 테마는 Figtree라는 이름만 적을 뿐 불러오지 않는다. 없으면 폰트 스택의 다음 글꼴로 경고 없이 넘어간다 |
| JSX 없음 | 이 파일을 컴파일하는 것이 없으므로 `React.createElement`로 만든다 |

버전은 전부 고정합니다. 버전 없는 CDN 주소는 최신 릴리스를 가리키고 캐시도 강하게 걸립니다. main 브랜치의 CLI 템플릿은 여기서 더 나아가 `htm`으로 JSX 비슷한 문법을 쓰고 테마 객체를 `<Theme>`에 넘깁니다. 템플릿의 주석에 따르면 `data-astryx-theme` 속성만으로는 스타일시트의 범위만 정해질 뿐 라이트/다크 모드를 전환할 수 없기 때문입니다.

## 첫 컴포넌트와 폰트

README의 첫 예제는 `<Button label="Hello Astryx" variant="primary" />` 한 줄입니다. 공식 예제들에 나오는 prop만으로 조금 더 살을 붙이면 이렇습니다.

```tsx
'use client';

import {useState} from 'react';
import {Stack} from '@astryxdesign/core/Stack';
import {Card} from '@astryxdesign/core/Card';
import {Text, Heading} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';

export default function Page() {
  const [email, setEmail] = useState('');

  return (
    <Stack padding={6} align="start">
      <Card maxWidth={480} elevation="low">
        <Stack gap={3} align="start">
          <Heading level={1}>Hello Astryx</Heading>
          <Text type="body" color="secondary">
            Default body text
          </Text>
          <TextInput
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={setEmail}
          />
          <Button label="Save" variant="primary" onClick={() => alert('Hi!')} />
        </Stack>
      </Card>
    </Stack>
  );
}
```

처음 보면 낯선 점이 몇 가지 있습니다. 컴포넌트는 `@astryxdesign/core/Button`처럼 각자 자기 진입점에서 import합니다. `astryx component <Name>`이 그 경로를 알려 줍니다. 번들을 작게 유지하기 위한 규칙이고, 서버 컴포넌트에서는 특히 지키라고 문서가 적습니다. Button의 글자는 `children`이 아니라 `label`로 넘깁니다. CLI 템플릿의 주석은 `label`이 필수이고 접근 가능한 이름(accessible name)이 된다고 설명합니다. `TextInput`의 `onChange`에는 `setEmail`을 그대로 넘깁니다. 예제 앱이 그렇게 씁니다. 간격은 숫자여서, `gap={3}`, `padding={6}`은 픽셀이 아니라 간격 토큰의 단계입니다.

이런 API 규칙은 [3편](/blog/astryx-components-api/)에서 정리합니다.

### 폰트 설정

Astryx의 폰트 역할은 body(UI 텍스트), heading(제목), code(고정폭) 셋입니다. 기본값에서는 body와 heading이 같은 시스템 폰트 스택을 쓰고, 테마가 역할별로 다른 글꼴을 지정할 수 있습니다.

문서에는 "Astryx never loads font files"라는 문장이 있습니다. `defineTheme`과 빌드된 CSS는 `font-family`만 정합니다. 테마가 웹폰트 이름을 적어 두어도 앱이 그 폰트를 불러오지 않으면 브라우저는 경고 없이 다음 글꼴로 넘어갑니다.

neutral 테마는 Figtree를 지정합니다. 불러오는 방법은 셋입니다.

```css
/* 1. 테마 패키지의 폰트 CSS (예제 앱의 방식) */
@import '@astryxdesign/theme-neutral/fonts.css';
```

두 번째는 문서 `<head>`에 Google Fonts `<link>`를 preconnect와 함께 직접 넣는 것이고, 세 번째는 `@font-face`로 직접 호스팅하는 것입니다.

`fonts.css`의 내용은 Google Fonts를 가리키는 `@import` 한 줄입니다. `astryx theme add`가 만드는 모듈도 이 파일을 import합니다. 간단한 대신, 문서는 호스팅된 `@import`가 preconnect를 건 `<link>`보다 로딩이 늦다는 점을 알고 고르라고 적습니다. 어느 쪽이든 대체 글꼴(fallback)은 반드시 같이 지정합니다.

## CLI 설치: 프로젝트, 전역, 둘 다

| 구성 | 얻는 것 | 치르는 것 | 맞는 경우 |
| --- | --- | --- | --- |
| 둘 다 (권장) | 프로젝트마다 고정된 버전 + 어느 폴더에서나 문서, 검색, 에이전트 가이드 | 두 설치를 최신으로 유지 | 대부분 |
| 프로젝트만 | 저장소에 고정된 버전. 팀과 CI가 같은 버전 | 프로젝트 밖에서는 `astryx` 명령 없음 | CI, 빌드 서버 |
| 전역만 | 어느 폴더에서나 문서와 검색 | 팀에 고정된 버전이 없음 | 프로토타입, 빠른 조회 |

```bash
# 프로젝트 폴더에서
npm install -D @astryxdesign/cli
npx @astryxdesign/cli init

# 컴퓨터에 한 번
npm i -g @astryxdesign/cli
```

둘은 충돌하지 않습니다. 전역에만 설치해도 동작은 하지만, 팀과 CI가 쓸 버전이 고정되지 않고 자체 CLI가 없는 프로젝트는 내가 실행한 전역 버전으로 응답을 받습니다. 프로젝트 안에서는 전역 `astryx`를 쳐도 프로젝트의 CLI에 실행을 넘깁니다. 인자, 입출력, 종료 코드가 그대로 전달됩니다. 전역 설치가 응답하는 곳은 프로젝트 밖뿐입니다. 전역 설치는 자기 자신이나 프로젝트를 스스로 업그레이드하지 않습니다.

CI에서는 CLI를 Core와 같은 버전의 devDependency로 두라고 문서가 권합니다. 그러면 저장소에 고정된 버전이 실행되고 실행 시점에 내려받는 것이 없습니다.

### init이 하는 일

`init`은 대화형 질문이 없는 명령이라 사람, 에이전트, CI에서 똑같이 동작합니다. 기본 실행이 쓰는 것은 에이전트용 문서입니다. `AGENTS.md`에 Astryx 블록을 쓰고, 프로젝트의 Claude Code 파일(`CLAUDE.md`, 없으면 `.claude/CLAUDE.md`)에도 씁니다. `GEMINI.md`에는 `AGENTS.md`를 import하는 한 줄을 넣고, 그다음 시작 단계를 출력합니다.

`--all`을 붙이면 theme과 template 기능까지 켭니다. theme 기능은 주석 달린 `theme.template.ts`를 쓰고, template 기능은 페이지를 만드는 명령을 출력만 합니다. 이름과 달리 패키지 설치나 CSS 연결을 대신 해 주는 명령은 아닙니다. 에이전트 문서의 내용과 쓰임새는 [8편](/blog/astryx-ai-agents/)에서 다룹니다.

### 스코프 없는 astryx 이름

README가 여러 번 강조하는 내용이 있습니다. 스코프 없는 `astryx`는 `@astryxdesign/cli`가 의존성에 들어오기 전까지 npm의 관련 없는 패키지로 풀립니다.

```bash
npx @astryxdesign/cli component Button   # 설치 전이든 후든 안전
pnpm exec astryx component Button        # CLI 를 설치한 뒤
npx astryx component Button              # 설치 전에는 다른 패키지가 받아진다
```

`astryx`라는 짧은 이름은 CLI 패키지가 등록하는 실행 파일(bin) 이름입니다. 그래서 프로젝트에 설치한 뒤 패키지 매니저의 실행기를 거칠 때에만 믿을 수 있습니다.

### package.json 스크립트로 고정하기

문서는 호출을 안정적으로 만들려면 스크립트를 하나 추가하라고 권합니다.

```json
"scripts": {
  "astryx": "node node_modules/@astryxdesign/cli/clients/cli/bin/astryx.mjs"
}
```

이렇게 하면 `npm run astryx -- component Button`이 이름 해석을 거치지 않고 설치된 CLI 파일을 바로 실행합니다. 명령 각각은 [7편](/blog/astryx-cli/)에서 봅니다.

### 모노레포

CLI는 현재 폴더에서 위로 올라가며 프로젝트를 찾습니다. `@astryxdesign/core`나 `@astryxdesign/cli`가 설치된 곳, 없으면 둘 중 하나를 선언한 가장 가까운 `package.json`을 저장소 루트까지 찾습니다.

- Astryx를 선언한 워크스페이스 멤버는 패키지가 루트로 호이스팅되어 있어도 그 자체로 하나의 프로젝트입니다. 루트에 설치된 CLI가 응답합니다.
- `src/`처럼 `package.json`이 없는 폴더는 위쪽 프로젝트에 속합니다.
- Yarn Plug'n'Play 프로젝트에서는 CLI가 프로젝트의 CLI를 찾지 못합니다. `yarn astryx`로 실행합니다.
- `init`은 에이전트 문서를 프로젝트 루트에 씁니다. `@astryxdesign` 패키지를 선언한 가장 가까운 `package.json`의 폴더이고, 탐색은 저장소 루트에서 멈춥니다.
- 템플릿의 누락 패키지 검사는 대상 폴더부터 워크스페이스 루트(`pnpm-workspace.yaml`이나 `workspaces` 필드가 있는 곳)까지의 모든 `package.json`을 합쳐서 봅니다.

버전 정렬은 모노레포에서 더 중요합니다. pnpm에서 새 릴리스를 일정 기간 묶어 두는 설정을 쓴다면 `@astryxdesign/*` 스코프 전체를 예외로 두라는 안내가 있습니다(`minimumReleaseAgeExclude: ['@astryxdesign/*']`). 일부만 예외로 두면 서로 다른 릴리스의 패키지가 나란히 설치됩니다. CLI와 Core의 버전이 다르면 `astryx doctor`가 경고하고 맞추는 명령을 출력합니다.

## 사전 빌드본과 소스 빌드

지금까지의 설정은 모두 사전 빌드본입니다. 소스 빌드는 `@astryxdesign/build`로 Astryx 패키지의 TypeScript와 StyleX 소스를 내 앱의 빌드에서 직접 컴파일하는 경로입니다.

| | 사전 빌드본 | 소스 빌드 |
| --- | --- | --- |
| CSS 출력 | 컴포넌트 스타일 전체 | import한 모듈의 스타일만 |
| 설정 | CSS import | Next.js는 `withAstryx()`, Vite는 `astryxStylex()` 등 |
| 빌드 시간 | 빠름 | 느림 (Astryx 소스를 Babel로 컴파일) |
| `astryx.css` | import한다 | import하지 않는다 |

`example-nextjs-source`의 README는 CSS 크기를 소스 빌드 약 22KB, 사전 빌드 약 77KB로 적습니다. 그 예제 앱에서의 수치입니다.

Turbopack에서의 설정은 세 군데입니다.

```js
// next.config.mjs
import {withAstryx} from '@astryxdesign/build/next';
export default withAstryx({/* 기존 Next.js 설정 */});
```

```js
// postcss.config.js
module.exports = {plugins: {'@astryxdesign/build/next/postcss': {}}};
```

```css
@import '@astryxdesign/core/reset.css';
@import '@astryxdesign/theme-neutral/theme.css';

@astryx;
```

달라진 곳은 `astryx.css`가 빠지고 `@astryx;`가 들어간 것입니다. 같은 패키지를 소스로 컴파일하면서 사전 빌드 스타일시트도 불러오는 구성은 문서화된 설정에 없습니다. Turbopack에서는 그렇게 하면 빌드가 실패합니다.

Vite에서는 `@astryxdesign/build/vite`의 `astryxStylex()`를 `plugins: [...astryxStylex(), react()]`처럼 `react()` 앞에 펼칩니다.

### 언제 소스 빌드를 고르나

설계 문서의 결정 기록은 이렇습니다. 대부분의 제품은 Astryx를 위한 컴파일러가 필요 없으므로 사전 빌드본이 기본이고, 실제로 싣는 모듈의 CSS만 원하는 제품이 소스 빌드를 고릅니다.

고르기 전에 알아 둘 점이 있습니다(v0.7.16 기준).

- webpack 경로에서 커스텀 Babel 설정은 SWC를 끕니다. `next/font`를 쓰면 `"next/font" requires SWC although Babel is being used`로 빌드가 실패합니다.
- 소스 빌드는 `browserslist`가 최신 브라우저를 향해야 합니다. 그렇지 않으면 `light-dark()`가 낮은 문법으로 변환되어 테마 색이 깨집니다.
- webpack과 Vite 경로는 설계 문서의 목표(Astryx 쪽 클래스에 `astryx` 접두사, 별도의 `product` 레이어 등)에 아직 맞춰지지 않았습니다. 맞춰지면 출력되는 클래스 이름과 레이어가 바뀐다고 합니다.
- Turbopack 경로의 속도 목표(개발 서버 첫 시작 +15%, 핫 업데이트 +10%, 빌드 +20% 이내)는 아직 강제가 아니라 보고 대상입니다.

레이어를 세밀하게 다뤄야 할 이유가 분명하지 않다면 사전 빌드본으로 시작하고, CSS 크기가 실제 문제가 될 때 옮기는 편이 안전합니다.

### build라는 이름 셋

이름이 비슷해서 헷갈리기 쉬운 것이 셋 있습니다. `@astryxdesign/build`는 위에서 본 소스 빌드용 npm 패키지이고, `astryx theme build`는 테마를 프로덕션용 CSS로 빌드하는 CLI 명령입니다. `astryx build`는 컴파일과 무관합니다. 만들고 싶은 화면을 자연어로 적으면 시작할 페이지 템플릿과 블록, 컴포넌트를 추천하는 CLI 명령입니다. 공식 블로그(2026-07-17)에 따르면 네트워크 호출도 모델도 없는 결정적인 순위 알고리즘입니다.

`astryx build`와 `astryx template`은 추천하거나 복사한 템플릿이 요구하는데 프로젝트에 없는 패키지를 알려 주고, 프로젝트의 패키지 매니저에 맞춘 설치 명령 하나를 같이 냅니다. 템플릿 소스가 StyleX를 쓰는데 컴파일러가 없으면 그 사실도 메모로 알려 줍니다.

## 흔한 설치 문제와 해결

공식 문서와 예제 README에 실린 것만 모았습니다.

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 버튼과 입력의 패딩, 테두리가 사라진다 | 레이어 없는 리셋이나 뒤쪽 레이어가 `astryx-base`를 덮는다 | 기존 리셋을 `layer(reset)`으로 import. 점검 페이지로 확인 |
| 컴포넌트에 준 Tailwind 클래스가 먹지 않는다 | `@layer` 선언이 없거나 Tailwind import 아래에 있다 | 선언을 파일 맨 위, Tailwind import 위에 둔다 |
| `createContext` 관련 서버 컴포넌트 오류 | 프로바이더 파일에 `'use client'`가 없다 | 프로바이더를 클라이언트 컴포넌트로 분리 |
| `Unexpected 'stylex.create' call at runtime` | swizzle한 컴포넌트나 StyleX를 쓰는 템플릿이 있는데 컴파일러가 없다 | 번들러에 맞는 StyleX 플러그인을 추가 |
| 글꼴이 테마와 다르다 | 테마는 글꼴 이름만 지정한다 | `fonts.css`나 `<link>`로 폰트를 불러온다 |
| 테마 색이 깨진다 (소스 빌드) | `light-dark()`가 낮은 문법으로 변환됐다 | `browserslist`를 최신 브라우저로 |
| `Cannot read properties of null (reading 'useState')` (CDN) | React가 두 벌 | esm.sh 주소에 `?external=react,react-dom` |
| `Error: Could not find @astryxdesign/core package` | 컴포넌트 명령은 Core를 읽는다 | 프로젝트에 `@astryxdesign/core`를 설치 |
| `npm i -g`가 `EACCES`로 실패 | 전역 폴더 권한 | `sudo`를 쓰지 않는다. Node 버전 관리자를 쓰거나 `npm config set prefix ~/.npm-global` 후 PATH에 추가 |
| `astryx: command not found` | 전역 bin 폴더가 PATH에 없다 | `npm prefix -g`로 위치 확인. pnpm은 `pnpm setup` |

Windows에서 npm은 `astryx.cmd`를 `%APPDATA%\npm`에 두므로 이 폴더가 PATH에 있어야 합니다. PowerShell이 스크립트 실행을 막으면 `astryx.cmd`로 실행합니다. Yarn 2 이상에는 `yarn global`이 없어 전역 설치는 `npm i -g`로 하라고 문서가 안내합니다. 어느 `astryx`가 실행되는지 헷갈리면 프로젝트 밖에서 `astryx doctor`를 실행합니다. PATH에 있는 모든 `astryx` 명령을 셸이 찾는 순서대로 보여 줍니다.

설치한 150여 개 컴포넌트를 어떻게 읽어야 하는지는 다음 편 [API 규칙과 컴포넌트 지도](/blog/astryx-components-api/)로 이어집니다.

## 참고

모두 공식 저장소 [meta/astryx](https://github.com/meta/astryx)의 파일입니다.

- README: [core](https://github.com/meta/astryx/blob/main/packages/core/README.md), [build](https://github.com/meta/astryx/blob/main/packages/build/README.md), [cli](https://github.com/meta/astryx/blob/main/packages/cli/README.md)
- 패키지 정의와 소스: [core package.json](https://github.com/meta/astryx/blob/main/packages/core/package.json), [theme-neutral package.json](https://github.com/meta/astryx/blob/main/packages/themes/neutral/package.json), [reset.css](https://github.com/meta/astryx/blob/main/packages/core/src/reset.css), [Theme.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/theme/Theme.doc.mjs), [LinkProvider.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Link/LinkProvider.doc.mjs), [cdn.template.html](https://github.com/meta/astryx/blob/main/packages/cli/assets/cdn.template.html)
- CLI 참고 문서: [getting-started](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/getting-started.doc.mjs), [styling-overview](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/styling-overview.doc.mjs), [use-a-theme](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/use-a-theme.doc.mjs), [browser-support](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/browser-support.doc.mjs), [tailwind](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/tailwind.doc.mjs), [migration-setup](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/migration-setup.doc.mjs), [tokens-and-setup](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/tokens-and-setup.doc.mjs), [font-setup](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/font-setup.doc.mjs)
- 전역 모드 문서: [project-global-or-both](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/project-global-or-both.doc.mjs), [install-once](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/install-once.doc.mjs), [monorepos](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/monorepos.doc.mjs), [ci-and-containers](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/ci-and-containers.doc.mjs), [problems](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/problems.doc.mjs)
- 명령 문서: [init](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/init.doc.mjs)
- 예제 앱: [example-nextjs](https://github.com/meta/astryx/blob/main/apps/example-nextjs/README.md), [example-nextjs-tailwind](https://github.com/meta/astryx/blob/main/apps/example-nextjs-tailwind/README.md), [example-nextjs-stylex](https://github.com/meta/astryx/blob/main/apps/example-nextjs-stylex/README.md), [example-nextjs-source](https://github.com/meta/astryx/blob/main/apps/example-nextjs-source/README.md), [example-vite](https://github.com/meta/astryx/blob/main/apps/example-vite/README.md), [example-vite-tailwind](https://github.com/meta/astryx/blob/main/apps/example-vite-tailwind/src/index.css)
- 설계 문서: [AST-080](https://github.com/meta/astryx/blob/main/docs/specs/AST-080-package-stylesheets/spec.md), [AST-048](https://github.com/meta/astryx/blob/main/docs/specs/AST-048-build-recommendation/spec.md)
- 공식 블로그: [AI is a copycat so we gave it good examples to copy](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/astryx-cli-build-command.md)
