
> **참고** 이 글은 "Meta Astryx 완전 가이드" 10부작의 10편입니다. Astryx v0.7.16(2026년 11월) 공식 저장소의 문서와 소스를 읽고 정리했습니다. Astryx는 베타라서 이후 버전에서 달라질 수 있습니다.

디자인 시스템 문서를 아홉 편째 읽고 나면 손이 근질거립니다.
`npm install` 한 줄이면 되고, 마침 내 프로젝트는 React 19입니다.
그런데 설치 명령을 치기 전에 물어야 할 것이 있습니다.
"이 프로젝트에 이게 필요한가, 들이면 무엇이 깨지는가."

마지막 편은 그 질문을 이 블로그 자체에 던집니다.
Astryx는 Meta가 공개한 오픈소스 React 디자인 시스템입니다.
지금 읽고 계신 이 사이트(2rangs.github.io)의 코드를 근거로, Astryx를 들인다면 어떤 순서로 무엇을 할지 계획을 세웁니다.

미리 밝혀 둡니다. **아직 적용하지 않았습니다.**
이 글은 결과 보고가 아니라 도입 전 검토입니다.
블로그 쪽 사실은 저장소 코드에서, Astryx 쪽 사실은 공식 저장소의 문서와 소스에서 확인한 것만 적었습니다.
직접 돌려 보지 않은 부분은 "확인할 것"으로 남겼습니다.

## 한눈에 보기

- 이 블로그는 React 19.2와 Vite 7로 만든 정적 사이트라서 Astryx의 요구 사항(React 19 이상)을 이미 충족한다.
- Astryx는 미리 빌드된 CSS를 배포하므로, 이 블로그에서는 CSS 세 개를 import하고 `Theme`으로 감싸면 된다. Vite 플러그인은 필요 없다.
- 이 블로그의 `site.css`는 캐스케이드 레이어 밖에 있다. Astryx 문서 기준으로 레이어 밖 스타일은 Astryx의 모든 레이어를 이기므로, 전역 초기화 규칙을 `reset` 레이어로 옮기는 일이 첫 작업이다.
- Astryx의 최상위 `Theme`은 `<html>`의 `data-theme` 속성을 직접 쓰고 지운다. 이 블로그도 같은 속성으로 어두운 테마를 고정하고 있어서, `mode="dark"`를 명시하지 않으면 둘이 충돌한다.
- Astryx의 `Markdown` 컴포넌트는 제목 id를 영문 소문자와 숫자로만 만든다. 한글 제목은 `section`, `section-1`이 되므로, 이 블로그의 글 본문 렌더러를 통째로 바꾸는 것은 맞지 않다.
- 바꿀 만한 곳은 글쓰기 화면의 폼과 목록 화면의 검색·태그 필터다. 별자리 배경과 홈 화면, 본문 타이포그래피는 그대로 둔다.
- 관제·대시보드 같은 업무용 화면이라면 판단이 반대로 기운다.

## 지금 이 블로그는 어떻게 만들어져 있나

저장소의 `package.json`, `vite.config.js`, `src/`를 읽은 그대로입니다.

| 항목 | 현재 구성 |
| --- | --- |
| 프레임워크 | React 19.2, Vite 7, `@vitejs/plugin-react` |
| 라우팅 | 라우터 없음. `src/main.tsx`가 주소를 해석해 화면 모듈을 `import()`로 따로 불러온다 |
| 스타일 | `src/site.css` 한 파일(800줄 남짓). CSS 변수와 클래스. CSS-in-JS, Tailwind 없음 |
| 글꼴 | Pretendard Variable(`pretendard` 패키지의 dynamic subset CSS) |
| 글 본문 | `react-markdown` + `remark-gfm`, 코드 강조는 `lowlight`(highlight.js 문법) |
| 글쓰기 | Tiptap 에디터, Supabase에 마크다운으로 저장 |
| 빌드 | `vite build` 뒤에 `scripts/prerender.mjs`가 주소마다 HTML을 만든다 |
| 배포 | GitHub Actions → GitHub Pages(정적 호스팅) |

몇 가지는 뒤의 판단에 직접 영향을 주니 조금 더 적습니다.

**미리 렌더링.**
`scripts/prerender.mjs`는 Vite의 `ssrLoadModule`로 `src/prerender.tsx`를 불러오고, 화면 컴포넌트를 `renderToStaticMarkup`으로 문자열로 만듭니다.
그 HTML을 `dist/index.html`의 `<!--app-->` 자리에 끼워 주소별 `index.html`을 씁니다.
검색엔진과 링크 미리보기가 자바스크립트 없이 내용을 읽게 하려는 것입니다.
브라우저에서는 `main.tsx`가 `createRoot().render()`로 화면을 다시 그립니다. `hydrateRoot`가 아닙니다.
같은 `Markdown` 컴포넌트의 출력이 `rss.xml`에도 들어갑니다.

**테마.**
`site.css`의 `:root`에는 밝은 값이 있고, `:root[data-theme="dark"]`와 `prefers-color-scheme` 규칙에 어두운 값이 있습니다.
그런데 `index.html`이 `<html lang="ko" data-theme="dark">`로 고정되어 있고 전환 버튼은 없습니다.
지금 이 사이트는 어두운 테마만 씁니다.

**글 본문.**
`src/components/Markdown.tsx`는 직접 만든 rehype 플러그인 두 개로 코드 블록에 색을 입히고 `h2`, `h3`에 id와 `#` 링크를 붙입니다.
id는 `\p{L}\p{N}`을 남기는 방식이라 한글 제목이 `#한눈에-보기`처럼 읽을 수 있는 주소가 됩니다.
`src/components/Article.tsx`가 그 제목들을 DOM에서 읽어 목차와 읽기 진행 막대를 만듭니다.
홈 화면에는 코드로 그린 밤하늘(`NightSky.tsx`)과 물병자리 모양의 메뉴가 있습니다.

## 도입 전에 따질 것

### 이 블로그에 디자인 시스템이 필요한가

꼭 필요하지는 않습니다.

디자인 시스템이 푸는 문제는 "여러 사람이 여러 화면을 만들 때 생기는 불일치"입니다.
이 블로그는 한 사람이 만들고, 화면은 몇 종류뿐이고, 스타일은 한 파일에 있습니다.

그래도 얻는 것이 있습니다. 상호작용 컴포넌트의 품질입니다.
글쓰기 화면의 입력창, 버튼, 알림은 지금 맨 HTML에 클래스를 붙인 것입니다. 오류 상태, 비활성 이유, 화면 낭독기 알림 같은 것은 직접 만들지 않았습니다. 이 부분은 [9편](/blog/astryx-a11y-i18n-motion/)에서 본 것처럼 Astryx가 공을 들인 곳입니다.

잃는 것도 분명합니다.

- **의존성.** `@astryxdesign/core`, 테마 패키지, `@stylexjs/stylex`가 추가됩니다. 지금 이 블로그의 UI 의존성은 React와 마크다운·에디터 라이브러리뿐입니다.
- **베타의 비용.** 공식 문서는 Astryx 패키지를 모두 같은 릴리스로 함께 올리라고 하고, 버전 사이의 변경은 `astryx upgrade --apply` 코드모드로 옮기게 합니다. 코드모드가 준비되어 있다는 것은 깨지는 변경이 있다는 뜻이기도 합니다. 여섯 시간마다 자동으로 빌드되는 블로그가 버전을 올린 뒤 경고 없이 깨지면 곤란합니다.

### 번들 크기는 재 봐야 안다

지금 `dist/assets`를 보면(압축 전 기준) 공통 스크립트가 약 200KB, CSS가 약 95KB입니다.
글 화면에서만 받는 마크다운 묶음이 약 230KB, 글쓰기 화면에서만 받는 에디터 묶음이 약 490KB입니다.

Astryx를 들이면 CSS와 JS가 모두 늘어납니다.
`astryx.css`는 컴포넌트 스타일을 미리 빌드한 파일이라, 컴포넌트를 두 개만 써도 그대로 들어온다고 보고 재야 합니다. 크기는 직접 확인하지 않았으니 숫자를 적지 않습니다.
JS는 `@astryxdesign/core/Button`처럼 컴포넌트별 진입점에서 import하게 되어 있어 쓴 만큼만 들어옵니다. 다만 `Theme`을 앱 뿌리에 두면 그 코드는 모든 화면의 공통 묶음에 들어갑니다.

확인 방법은 단순합니다.
도입 전에 `npm run build`가 출력하는 파일별 크기(gzip 포함)를 적어 두고, 1단계만 적용한 뒤 다시 빌드해 공통 CSS와 JS가 얼마나 늘었는지 비교합니다.
글 화면의 첫 로딩이 눈에 띄게 무거워진다면 Astryx를 글쓰기 화면에서만 불러오는 쪽으로 계획을 바꿉니다.

### 이미 있는 디자인과의 관계

흔한 오해가 하나 있습니다.
"디자인 시스템을 들이면 사이트 전체가 그 시스템의 모양이 된다"는 생각입니다.

Astryx의 구조는 그렇지 않습니다.
컴포넌트는 CSS 변수(토큰)를 읽을 뿐이고, 그 값은 [5편](/blog/astryx-theme-tokens/)에서 본 `defineTheme`으로 이 블로그의 색과 글꼴로 채울 수 있습니다.
Astryx 컴포넌트를 쓰지 않는 영역에는 Astryx가 그리는 것도 없습니다.

그러니 별자리 배경과 홈 화면은 건드릴 이유가 없습니다.
디자인 시스템에는 반복되는 부품을 맡기고, 사이트 고유의 디자인은 직접 가집니다.

## Astryx 요구 사항과 이 블로그의 궁합

React는 19.2라서 `react`, `react-dom` 19.0.0 이상이라는 조건을 충족합니다.
새로 설치할 것은 peer 의존성인 `@stylexjs/stylex`입니다.

core 패키지 README의 Vite 항목은 Next.js와 같은 CSS import와 프로바이더를 쓰고, 미리 빌드되어 배포되므로 빌드 플러그인이 필요 없다고 적고 있습니다.

여기서 헷갈리기 쉬운 것이 저장소의 `apps/example-vite` 예제입니다.
이 예제의 `vite.config.ts`에는 `astryxStylex()` 플러그인이 들어 있습니다.
예제 README가 밝히듯 그 앱은 Astryx를 **소스에서 빌드하는 다른 경로**를 보여 주는 참고용이고, 대부분의 앱에는 필요 없습니다. 설정 경로의 차이는 [2편](/blog/astryx-getting-started/)에 정리해 두었습니다.

브라우저 쪽은 따져 볼 것이 있습니다.
Astryx 토큰은 CSS의 `light-dark()` 함수를 씁니다.
같은 예제 README는 이 함수가 들어간 버전으로 Chrome 123, Firefox 120, Safari 17.5를 적고 있습니다.
지금 `site.css`는 `light-dark()`를 쓰지 않으니, 도입하면 지원 범위가 그만큼 좁아집니다.

## 단계별 도입 계획

네 단계로 나눕니다.
앞 단계만 하고 멈춰도 사이트가 온전하도록 순서를 잡았습니다.

### 1단계: CSS 세 개와 Theme, 그리고 레이어

설치는 공식 문서 기준으로 이렇습니다.

```bash
npm install @astryxdesign/core @astryxdesign/theme-neutral @stylexjs/stylex
npm install -D @astryxdesign/cli
```

CSS는 `src/main.tsx`의 맨 위, 기존 `site.css`보다 앞에 넣습니다.

```tsx
// src/main.tsx (계획)
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import '@astryxdesign/core/reset.css'           // @layer reset
import '@astryxdesign/core/astryx.css'          // @layer astryx-base
import '@astryxdesign/theme-neutral/theme.css'  // @layer astryx-theme
import './site.css'
```

세 파일은 각각 `reset`, `astryx-base`, `astryx-theme` 레이어에 들어갑니다.
`reset.css`가 이 순서를 스스로 선언하므로 불러오는 순서와 상관없이 유지된다고 파일 주석에 적혀 있습니다.

문제는 `site.css`입니다.
이 파일은 레이어를 쓰지 않고, 맨 위에 `a { color: inherit }`, `button, input, textarea { font: inherit; color: inherit }`, `:focus-visible { outline: … }` 같은 전역 규칙이 있습니다.

레이어가 없는 세계에서 이런 규칙은 약합니다.
요소 선택자라서 클래스 하나만 붙어도 집니다.
하지만 레이어가 끼면 규칙이 달라집니다.
**레이어 밖의 스타일은 명시도와 상관없이 모든 레이어를 이깁니다.**

Astryx의 마이그레이션 문서는 이것을 도입이 깨지는 가장 흔한 원인으로 꼽습니다. 오류도 경고도 없이 초기화 규칙이 컴포넌트 스타일을 덮어씁니다.
이 블로그라면 `button { color: inherit }`가 Astryx `Button`의 글자색을, `:focus-visible` 규칙이 Astryx의 포커스 링과 모서리를 덮게 됩니다.

문서가 권하는 해법은 앱의 기존 초기화 규칙을 가장 낮은 `reset` 레이어로 옮기는 것입니다.
이 블로그라면 `site.css` 앞부분의 요소 선택자 규칙만 감싸면 됩니다.

```css
/* src/site.css (계획): 전역 초기화만 레이어로 */
@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
  a { color: inherit; text-decoration: none; }
  button, input, textarea { font: inherit; color: inherit; }
  ul, ol { padding: 0; list-style: none; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
  /* … */
}

/* .site-header, .prose, .post-row 같은 클래스 규칙은 지금처럼 레이어 밖에 둔다 */
```

클래스 규칙은 레이어 밖에 그대로 둡니다. 블로그의 화면 스타일이 Astryx보다 우선하는 것은 의도한 동작입니다.
`reset.css`의 주석도 "사용자 스타일(레이어 없음)은 항상 Astryx의 모든 레이어를 이긴다"고 설명합니다.

프로바이더는 어디에 둘까요.
이 블로그는 화면을 브라우저의 `src/main.tsx`와 빌드 때의 `src/prerender.tsx` 두 군데에서 그립니다.
두 파일을 따로 고치기보다 모든 화면이 공통으로 쓰는 `src/components/Layout.tsx` 안에서 감싸는 편이 안전합니다.

```tsx
// src/components/Layout.tsx (계획)
import { Theme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'

export function Layout({ section, footer = true, children }: Props) {
  return (
    <Theme theme={neutralTheme} mode="dark">
      {/* 기존 머리말, main, 꼬리말 */}
    </Theme>
  )
}
```

`mode="dark"`를 적는 이유는 다크 모드 절에서 설명합니다.

하나 더 알아 둘 것이 있습니다.
`Theme.tsx` 소스를 보면 `Theme`이 그리는 감싸는 `div`는 `display: contents`이면서 `color`와 `font-family`를 토큰 값으로 지정합니다.
이 블로그는 글꼴과 글자색을 `:root`에 한 번 지정하고 상속에 기대고 있습니다.
`Theme`으로 감싸는 순간, 안쪽 요소들은 `:root`가 아니라 이 `div`의 값을 물려받습니다.
neutral 테마를 그대로 쓰면 본문 글꼴이 Pretendard에서 테마가 이름 붙인 Figtree 쪽으로 바뀐다는 뜻입니다.
그래서 1단계와 2단계는 사실상 한 번에 해야 합니다.

### 2단계: 블로그 색을 Astryx 테마로 옮기기

`site.css`의 CSS 변수를 Astryx 토큰에 대응시킵니다.
토큰 이름은 `astryx docs tokens/tokens-color`의 원본 문서에서 확인한 것입니다.

| 블로그 변수 | 밝은 값 / 어두운 값 | Astryx 토큰 | 메모 |
| --- | --- | --- | --- |
| `--bg` | `#ffffff` / `#161616` | `--color-background-body` | 페이지 바탕 |
| `--raised` | `#ffffff` / `#202020` | `--color-background-surface`, `--color-background-card` | 카드, 입력창 |
| `--surface` | `#f7f7f7` / `#1b1b1b` | `--color-background-muted` | 알림 상자, 꼬리말 |
| `--text` | `#1c1c1c` / `#d6d6d6` | `--color-text-primary` | |
| `--muted` | `#4f4f4f` / `#a0a0a0` | `--color-text-secondary` | |
| `--faint` | `#6b6b6b` / `#868686` | 대응 없음 | 블로그 변수로 남긴다 |
| `--line` | `#e0e0e0` / `#2f2f2f` | `--color-border` | |
| `--accent` | `#1b1b1b` / `#e4e4e4` | `--color-accent` | `--color-on-accent`와 짝 |
| `--accent-ink` | `#111111` / `#ececec` | `--color-text-accent` | |
| `--accent-soft` | `#e9e9e9` / `#2e2e2e` | `--color-accent-muted` | |
| `--code-bg` | `#f7f7f7` / `#1b1b1b` | `--color-syntax-background` | |
| `--danger` | `#c62828` / `#ff7b72` | `--color-text-error` | |
| `--radius-sm`, `--radius` | 6px, 10px | `--radius-inner`, `--radius-element`, `--radius-container` | 기본값은 4, 8, 12px |
| `--syn-*` | GitHub 색 | `--color-syntax-*` | keyword, string, comment 등 |

대응이 깔끔하지 않은 곳이 둘 있습니다.

첫째, `--faint`입니다.
Astryx의 글자색 토큰은 primary, secondary, disabled, accent와 상태 색이라 "세 번째로 옅은 글자색"이 없습니다. 억지로 맞추지 말고 블로그 변수로 남겨 둡니다.

둘째, 강조색입니다.
이 블로그의 어두운 테마 강조색은 `#e4e4e4`, 거의 흰색입니다.
Astryx의 `--color-on-accent`(강조색 위에 올라가는 글자색) 기본값은 두 모드 모두 `#FFFFFF`입니다.
`--color-accent`만 바꾸면 흰 버튼 위에 흰 글자가 됩니다.
마이그레이션 문서도 정확히 이 실수를 경고합니다. 강조색을 손으로 쓰면 그 위의 글자색도 직접 책임져야 합니다.

테마 정의의 초안은 이렇습니다. 공식 문서의 `defineTheme` 예시를 바탕으로 썼고, 실행해 본 코드는 아닙니다.

```ts
// src/theme/blogTheme.ts (초안)
import { defineTheme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral'

export const blogTheme = defineTheme({
  name: 'blog',
  extends: neutralTheme,
  typography: {
    body: {
      family: 'Pretendard Variable',
      fallbacks: 'Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
    },
  },
  tokens: {
    '--color-background-body': ['#ffffff', '#161616'],
    '--color-background-surface': ['#ffffff', '#202020'],
    '--color-text-primary': ['#1c1c1c', '#d6d6d6'],
    '--color-text-secondary': ['#4f4f4f', '#a0a0a0'],
    '--color-border': ['#e0e0e0', '#2f2f2f'],
    '--color-accent': ['#1b1b1b', '#e4e4e4'],
    '--color-on-accent': ['#ffffff', '#161616'],
  },
})
```

값을 `[밝은 값, 어두운 값]` 쌍으로 쓰면 `light-dark()`로 컴파일됩니다.
Astryx는 글꼴 이름만 지정하고 파일은 불러오지 않습니다. 이 블로그는 이미 `pretendard` 패키지의 CSS를 불러오고 있으니 추가로 할 일이 없습니다.

이 테마는 빌드해서 씁니다.

```bash
npx @astryxdesign/cli theme build src/theme/blogTheme.ts
```

문서에 따르면 CSS, JS, 타입 선언 파일이 나오고, 빌드된 테마에는 `__built: true` 표시가 붙어 `Theme`이 실행 중에 `<style>`을 끼워 넣지 않습니다. 빌드가 필요한 이유는 미리 렌더링 절에서 이어집니다.

### 3단계: 화면별로 바꿀 후보

**글 본문 전체를 `Markdown` 컴포넌트로: 바꾸지 않는다.**

Astryx에는 마크다운 문자열을 받아 제목, 목록, 표, 코드 블록을 그려 주는 `Markdown`이 있습니다.
지금의 `react-markdown` 묶음을 통째로 대신할 수 있어 보이지만 세 가지가 걸립니다.

- **제목 id.** `Markdown`의 파서 소스에서 id를 만드는 `slugify`는 소문자로 바꾼 뒤 `[^a-z0-9]+`를 하이픈으로 바꿉니다. 한글은 전부 지워지고, 빈 결과는 `section`으로 대체됩니다. `## 한눈에 보기`의 id가 `section`이 되는 것입니다. 이 블로그는 `#한눈에-보기`처럼 읽을 수 있는 주소를 일부러 만들었고, 이미 공유된 링크도 있습니다.
- **본문에 넣은 이미지.** 문서에 따르면 `Markdown`은 링크와 이미지의 `data:` 주소를 모두 거부하고 원문 텍스트로 보여 줍니다. 이 블로그의 `Markdown.tsx`는 예전 글 때문에 `data:image/…;base64` 주소를 일부러 허용하고 있습니다.
- **RSS.** 같은 렌더러의 출력이 `rss.xml`에 들어갑니다. Astryx 컴포넌트의 마크업은 Astryx CSS와 함께 있을 때 뜻이 있고, RSS 리더에는 그 CSS가 없습니다.

`Markdown` 문서가 권하는 쓰임새는 사용자 생성 콘텐츠와 AI 응답입니다. 한글 글을 정적으로 내보내는 블로그와는 용도가 다릅니다.

**코드 블록을 `CodeBlock`으로: 조건부 후보.**

`CodeBlock`은 `code`와 `language`를 받고, 언어 이름표와 복사 버튼을 기본으로 보여 줍니다. 지금 `Markdown.tsx` 안의 작은 `CodeBlock` 함수와 하는 일이 겹칩니다.
내장 언어에는 sql, python, go 등이 있어서, 문법을 일곱 개만 넣은 탓에 색 없이 보이던 `sql` 코드는 나아집니다. 반대로 지금 색을 입히는 `vue`는 내장 목록에 없습니다.

`react-markdown`의 `components.pre`에서 Astryx `CodeBlock`을 그리면 나머지는 그대로 둘 수 있습니다.
다만 `.prose pre`, `.prose code` 같은 레이어 밖 규칙이 `CodeBlock` 내부에도 닿으니 선택자를 좁혀야 합니다.
또 소스를 보면 기본 모드에서는 CSS Custom Highlight API가 있으면 그것으로, 없거나 Safari이면 `span`으로 색을 입힙니다. 미리 만든 HTML이 어떻게 나오는지는 빌드 결과를 열어 확인해야 합니다.

**인용과 표를 `Blockquote`, `Table`로: 바꾸지 않는다.**

`Blockquote`는 왼쪽 선과 보조 글자색으로 인용문을 그립니다. 지금 `.prose blockquote`와 같은 모양입니다.
이 블로그는 `> **참고** …`로 시작하는 인용을 덧붙임 상자로 보여 주는데, `Blockquote` 문서는 안내 상자 용도로는 `Banner`를 쓰라고 합니다. 그런데 `Banner`는 사용자가 조치할 때까지 보여야 하는 메시지용이라 글 속의 덧붙임과는 성격이 다릅니다.
`Table`은 `data`와 `columns`를 받아 정렬, 선택, 페이지 나누기를 붙이는 데이터 표입니다. 글 속의 세 줄짜리 비교표에 필요한 것은 `border-bottom` 하나입니다.
CSS 몇 줄로 되어 있는 것을 컴포넌트로 바꿀 이유가 없습니다.

**목차를 `Outline`으로: 가장 그럴듯한 후보.**

`Outline`은 제목 목록(`{id, label, level}`)을 받아 목차를 그리고, 스크롤 위치에 따라 지금 읽는 항목을 표시합니다. 고정 머리말 높이를 넘기는 `offset`도 있습니다.
`Article.tsx`가 직접 하고 있는 일과 거의 같습니다.

제목이 마크다운 문자열이 아니라 이미 DOM에 있을 때 쓰는 `useOutlineFromDOM` 훅도 있습니다.
이 훅은 id를 만들지 않고 제목이 이미 가진 id를 읽기만 하므로, 한글 id를 그대로 살릴 수 있습니다.

```tsx
// src/components/Article.tsx (계획)
import { Outline, useOutlineFromDOM } from '@astryxdesign/core/Outline'

const items = useOutlineFromDOM(body)   // body는 본문을 감싼 div의 ref
return <Outline items={items} label="목차" offset={60} />
```

주의할 점이 하나 있습니다.
문서에 따르면 항목의 `label`은 제목의 텍스트입니다.
이 블로그는 제목 끝에 `#` 링크를 붙이므로 목차에 "한눈에 보기#"가 나올 수 있습니다.
또 훅은 `h1`부터 `h6`까지 읽는데 지금 목차는 `h2`, `h3`만 보여 줍니다.
읽기 진행 막대는 `Outline`에 없으니 그 코드는 남습니다.

**목록 화면의 검색과 태그 필터: 후보.**

`src/pages/Blog.tsx`의 검색창은 `<input type="search">`이고, 태그는 `aria-pressed`를 쓰는 버튼 묶음입니다.
`TextInput`은 `type="search"`와 지우기 버튼(`hasClear`)을 지원하고, 켜고 끄는 선택에는 `ToggleButton`이 있습니다.
지금 구현도 접근성 속성은 갖추고 있어서 이득은 작습니다. 글쓰기 화면을 옮긴 뒤 같은 부품을 재사용하는 정도가 맞습니다.

**글쓰기 화면의 폼: 가장 먼저 옮길 곳.**

`src/pages/Write.tsx`는 제목, 주소, 요약, 태그 입력과 발행·초안 저장·삭제 버튼, 상태 알림으로 되어 있습니다. 여기가 Astryx와 가장 잘 맞습니다.

- 입력창은 `TextInput`. 레이블, 설명(`description`), 상태(`status`)를 prop으로 받습니다. 지금은 주소 형식이 틀리면 폼 아래 알림에 문장으로 나오는데, 필드 옆에 붙일 수 있습니다.
- 마크다운 원문은 `TextArea`.
- 배치는 `FormLayout`. 문서는 `<form>`은 Astryx에 대체물이 없으니 그대로 두라고 합니다.
- 저장 결과는 `Banner`, 버튼은 `Button`.

이 화면은 로그인한 한 사람만 쓰고, 미리 만든 HTML도 비어 있어서 깨져도 독자에게 보이지 않습니다.
Tiptap 에디터 본체와 `/` 메뉴는 건드리지 않습니다.

### 4단계: 바꾸지 않을 것

| 대상 | 이유 |
| --- | --- |
| 홈 화면(밤하늘, 별자리 메뉴, 명함) | 사이트 고유의 디자인이고 반복되는 부품이 아니다 |
| 본문 타이포그래피(`.prose`) | 한글 긴 글에 맞춰 줄 간격과 크기를 조정해 둔 값이다 |
| 마크다운 렌더러 | 한글 제목 id, `data:` 이미지, RSS 출력 |
| 머리말과 꼬리말 | `AppShell`, `TopNav`는 앱 틀용이다. 링크 세 개짜리 머리말에는 과하다 |

기준은 하나입니다.
**상태와 상호작용이 있는 부품은 맡기고, 글과 배치는 직접 가진다.**

## 미리 렌더링, 정적 호스팅과 맞는가

GitHub Pages는 파일을 내려 주기만 하고 Astryx는 서버 기능을 요구하지 않으니, 호스팅에는 걸릴 것이 없습니다.
따질 것은 빌드 때의 `renderToStaticMarkup`입니다.

**"서버 안전"이라는 말부터 구분합니다.**
저장소의 `serverSafeComponents.test.ts`는 이름과 달리 React 서버 컴포넌트(RSC) 경계를 검사하는 테스트입니다.
컴포넌트의 import 그래프를 따라가서, 클라이언트 전용 React API가 필요 없는 컴포넌트에 `'use client'`가 남아 있지 않은지, 반대로 지시문이 없는 컴포넌트가 클라이언트 전용 코드를 끌어오지 않는지를 검사합니다.

이 블로그는 RSC를 쓰지 않습니다.
`'use client'`가 붙은 컴포넌트도 `react-dom/server`로는 평범하게 그려집니다.
그래서 이 테스트의 "서버 안전" 여부는 이 블로그의 미리 렌더링과 직접 관계가 없습니다.
저장소에는 `CodeBlock`의 서버 출력이나 `Markdown` 제목 id의 하이드레이션 일치를 확인하는 테스트도 따로 있습니다. 서버 출력을 신경 쓴다는 증거이지만, 모든 컴포넌트에 대한 보증은 아닙니다.

**테마는 빌드된 것을 써야 합니다.**
`Theme.tsx`를 보면 빌드되지 않은 테마는 `useInsertionEffect`에서 `<style>`을 문서에 끼워 넣습니다.
이펙트는 `renderToStaticMarkup`에서 실행되지 않습니다.
미리 만든 HTML에는 그 스타일이 없고, 자바스크립트가 실행된 뒤에야 생깁니다.
빌드된 테마는 CSS 파일이 페이지와 함께 오니 이 문제가 없습니다.
neutral 테마를 그대로 쓴다면 `/built`와 `theme.css`가 이미 빌드된 것이고, 2단계의 `blogTheme`은 `theme build`를 거쳐야 합니다.

**확인할 것.**
`prerender.mjs`의 SSR 모듈 로더에서 `@astryxdesign/core`가 문제없이 불러와지는지는 돌려 봐야 압니다.
이 블로그는 `createRoot`로 다시 그리므로 서버 출력과 달라도 오류는 나지 않지만, 화면이 한 번 튈 수 있으니 눈으로 확인합니다.

## 다크 모드와 첫 화면 깜빡임

이 블로그에서 가장 조심할 부분입니다.

`Theme.tsx`의 소스와 주석에 따르면, 트리에서 가장 바깥의 `Theme`은 `<html>`에 속성 두 개를 맞춥니다.

- `data-theme`: `mode`가 `light`나 `dark`이면 그 값을 쓰고, `system`이면 **속성을 지운다.** `reset.css`가 이 속성을 `color-scheme`으로 연결한다.
- `data-astryx-theme`: 테마 이름. 테마 CSS가 이 속성 범위로 묶여 있어서, 포털처럼 감싸는 `div` 밖에 그려지는 요소에도 테마가 닿게 한다.

그런데 이 블로그도 `<html data-theme="dark">`를 씁니다.
같은 속성을 양쪽에서 함께 쓰게 됩니다.

`mode`를 생략하면 기본값은 `system`입니다.
그러면 화면이 뜨는 순간 Astryx가 `<html>`의 `data-theme`을 지웁니다.
`site.css`에는 `:root:not([data-theme="light"])`를 `prefers-color-scheme: dark` 안에서 거는 규칙이 남아 있으니, 운영체제가 어두운 모드인 독자는 차이를 못 느낍니다.
밝은 모드인 독자는 어둡게 뜬 화면이 자바스크립트가 실행되자마자 밝게 뒤집힙니다.
"어두운 테마만 쓴다"는 지금의 결정이 깨집니다.

해법은 `mode="dark"`를 명시하는 것입니다.
그러면 Astryx가 쓰는 값과 `index.html`에 이미 있는 값이 같아집니다.
`Theme.tsx`의 주석이 깜빡임을 피하는 방법으로 권하는 것이 `<html data-theme="dark">`를 정적으로 넣어 두는 것인데, 이 블로그는 이미 그렇게 되어 있습니다.

`data-astryx-theme`도 같은 방식으로 다룹니다.
미리 만든 HTML에서 `Theme`의 `div`는 이 속성을 갖고 나오지만 `<html>`에는 스크립트가 실행된 뒤에 붙습니다.
`index.html`의 `<html>`에 `data-astryx-theme="blog"`를 미리 적어 두면 그 틈이 없어집니다.

Astryx 문서의 금지 항목에 "Theme과 어긋나는 두 번째 다크 모드 장치를 따로 돌리지 말 것"이 있습니다.
나중에 밝은 테마 전환 버튼을 되살린다면, `data-theme`을 직접 고치는 코드를 쓰지 말고 `Theme`의 `mode`를 상태로 들고 있어야 합니다.

## 에이전트와 함께 작업하기

이 블로그는 코딩 에이전트와 함께 만들어 왔습니다.
[8편](/blog/astryx-ai-agents/)에서 본 것처럼 Astryx가 에이전트를 1급 사용자로 대하는 점은 이 저장소에 실제로 쓸모가 있습니다.

```bash
npx @astryxdesign/cli init
```

문서에 따르면 `init`은 묻는 것 없이 실행되고, 컴포넌트 색인이 담긴 관리 블록을 `AGENTS.md`와 Claude Code용 파일에 씁니다.
블록 바깥의 글은 바꾸지 않는다고 되어 있습니다.
지금 이 저장소 루트에는 `AGENTS.md`도 `CLAUDE.md`도 없으니, 실행 뒤 `git status`로 어떤 파일이 생겼는지 확인하고 커밋합니다.
되돌릴 때는 `init --remove-agents`가 관리 블록만 지웁니다.

그 뒤 에이전트에게 일을 맡길 때는 이 글의 판단을 같이 적어 둡니다.
색인만 있으면 에이전트는 "마크다운을 그리니 `Markdown` 컴포넌트를 쓰자"고 할 가능성이 높습니다.
무엇을 쓰지 않기로 했는지는 사람이 적어야 합니다.
`CLAUDE.md`의 관리 블록 바깥에 세 줄이면 됩니다.

- 글 본문은 `src/components/Markdown.tsx`를 유지한다(한글 제목 id, RSS).
- `Theme`은 항상 `mode="dark"`로 쓴다.
- Astryx 컴포넌트는 `/write/` 화면부터 쓴다.

## 되돌리기 쉬운 순서와 확인 목록

계획의 순서는 "되돌리는 비용이 싼 것부터"입니다.

1. 브랜치를 만들고 도입 전 빌드 크기를 기록한다.
2. 패키지를 설치하고 CSS 세 개를 import한다. `site.css`의 전역 초기화를 `@layer reset`으로 옮긴다. 이 시점에 화면은 전과 같아야 한다.
3. `blogTheme`을 정의하고 빌드한다. `Layout`을 `Theme`으로 감싼다. 이 시점에도 화면은 전과 같아야 한다.
4. `/write/` 화면의 폼을 옮긴다.
5. 목차를 `Outline`으로, 검색과 태그 필터를 Astryx 입력으로 바꿔 본다. 마음에 들지 않으면 그 커밋만 되돌린다.

단계마다 커밋을 나누면 어느 단계에서든 `git revert` 하나로 물러날 수 있습니다.
2번과 3번에서 화면이 전과 같은지 확인하는 것이 핵심입니다. 컴포넌트를 올린 뒤에는 원인을 가르기 어렵습니다.

단계마다 볼 것입니다.

- [ ] `dist/blog/<글>/index.html`을 자바스크립트를 끈 브라우저로 열었을 때 전과 같게 보인다.
- [ ] 운영체제를 밝은 모드로 두고 열어도 화면이 밝게 뒤집히지 않는다.
- [ ] 본문 글꼴이 여전히 Pretendard다.
- [ ] 기존 제목 주소(`/blog/<글>/#한글-제목`)가 그대로 동작한다.
- [ ] `dist/rss.xml`의 본문에 Astryx 클래스가 섞여 들어가지 않았다.
- [ ] `npx @astryxdesign/cli doctor`가 설정 문제를 보고하지 않는다.

## 관제·대시보드 화면이었다면

같은 질문을 지도 관제 화면, 운영 관리자, 검수 도구 같은 업무용 화면에 던지면 답이 달라집니다.

| 기준 | 이 블로그 | 업무용 화면 |
| --- | --- | --- |
| 화면의 주인공 | 글 | 표, 폼, 필터, 대화 상자 |
| 만드는 사람 | 한 명 | 여러 명, 오래 |
| 접근성·키보드 조작 | 링크와 제목이면 충분 | 격자 탐색, 포커스 가두기, 알림이 필요 |

블로그에서 "과하다"고 접어 둔 것들이 여기서는 본론이 됩니다.
`Table`의 정렬·선택·가상 스크롤 플러그인, `AppShell`과 `SideNav`, 대시보드와 설정 페이지 템플릿은 [3편](/blog/astryx-components-api/)과 [4편](/blog/astryx-layout-templates/)에서 다뤘습니다.

도입 순서도 바뀝니다.
마이그레이션 문서는 테마와 앱 틀을 먼저 세우고 화면을 하나씩 옮기라고 권합니다.
블로그에서는 틀을 건드리지 않고 가장자리부터 들어갔지만, 업무용 화면은 틀이 먼저입니다.
베타라는 위험은 똑같이 남지만, 배포 주기를 팀이 쥐고 있고 테스트가 있으니 감당할 방법이 있습니다.

## 자주 묻는 질문

### 기존 CSS가 있는 프로젝트에 넣으면 무엇이 가장 먼저 깨지나요?

전역 초기화 규칙입니다.
Astryx의 스타일은 `reset`, `astryx-base`, `astryx-theme` 레이어에 들어가고, 레이어 밖의 스타일은 명시도와 상관없이 이 레이어들을 이깁니다.
`button { color: inherit }` 같은 규칙이 레이어 밖에 있으면 Astryx 컴포넌트 스타일을 덮습니다.
마이그레이션 문서는 기존 초기화 규칙을 `reset` 레이어로 옮기라고 안내합니다.

### Astryx의 Theme은 `<html>` 요소를 건드리나요?

건드립니다.
가장 바깥의 `Theme`은 `<html>`에 `data-astryx-theme`(테마 이름)을 쓰고, `mode`가 `light`나 `dark`이면 `data-theme`을 쓰며, `system`이면 `data-theme`을 지웁니다.
안쪽에 중첩된 `Theme`은 `<html>`을 바꾸지 않습니다.
이미 `data-theme` 속성을 쓰는 사이트라면 충돌 여부를 먼저 확인해야 합니다.

### Astryx Markdown 컴포넌트로 한글 블로그 글을 그려도 되나요?

그릴 수는 있지만 제목 주소에 주의해야 합니다.
v0.7.16 기준 소스에서 제목 id는 영문 소문자와 숫자만 남기는 방식으로 만들어지고, 남는 글자가 없으면 `section`이 됩니다.
한글 제목은 `section`, `section-1`처럼 순번이 붙은 id를 갖습니다.
읽을 수 있는 한글 주소가 필요하다면 기존 렌더러를 유지하고, 목차만 `useOutlineFromDOM`으로 연결하는 방법이 있습니다.

### 정적 사이트(미리 렌더링)에서 테마가 번쩍이지 않게 하려면 어떻게 하나요?

빌드된 테마를 씁니다. 공식 테마 패키지는 `/built`와 `theme.css`를 제공하고, 직접 만든 테마는 `astryx theme build`로 만듭니다.
빌드되지 않은 테마는 브라우저에서 `<style>`을 끼워 넣기 때문에 미리 만든 HTML에는 스타일이 없습니다.
색 모드는 `<html>`에 `data-theme`을 정적으로 넣어 둡니다.

### 개인 블로그에 Astryx를 쓰는 것을 권하나요?

글을 보여 주는 것이 전부라면 권하지 않습니다. 얻는 것보다 의존성과 베타 추적 비용이 큽니다.
글쓰기 도구나 관리 화면처럼 폼과 상호작용이 있는 부분이 있다면 그 부분에만 들이는 것은 해 볼 만합니다.

## 10부작을 마치며

1. [Meta Astryx란 무엇인가](/blog/astryx-overview/): Meta 안에서 8년 자란 디자인 시스템이 MIT 라이선스로 공개됐다. 지금은 베타다.
2. [Astryx 설치와 첫 화면](/blog/astryx-getting-started/): CSS 세 개와 `Theme` 하나.
3. [Astryx 컴포넌트 150개를 읽는 법](/blog/astryx-components-api/): 이름 규칙을 알면 처음 보는 컴포넌트도 읽힌다.
4. [Astryx 레이아웃과 템플릿](/blog/astryx-layout-templates/): 페이지는 템플릿에서 시작한다.
5. [Astryx 테마와 디자인 토큰](/blog/astryx-theme-tokens/): 컴포넌트는 토큰을 읽고, 값은 `defineTheme`이 정한다.
6. [Astryx 스타일링](/blog/astryx-styling-tailwind-swizzle/): 레이어 순서가 누가 이기는지를 정한다.
7. [Astryx CLI 완전 정복](/blog/astryx-cli/): 문서는 CLI에서 찾는다.
8. [Astryx는 왜 '에이전트 대응'인가](/blog/astryx-ai-agents/): 사람과 에이전트가 같은 문서를 읽는다.
9. [Astryx의 접근성, 국제화, 모션](/blog/astryx-a11y-i18n-motion/): 보이지 않는 품질.
10. 이 글: 도입은 설치가 아니라 판단이다.

## 정리

- 이 블로그는 React 19와 Vite라서 Astryx의 요구 사항을 충족한다. 하지만 요구 사항을 충족하는 것과 필요한 것은 다른 문제다.
- 기존 CSS가 있는 프로젝트에서 첫 작업은 컴포넌트가 아니라 캐스케이드 레이어다. 레이어 밖 초기화 규칙을 `reset` 레이어로 옮긴다.
- `Theme`은 `<html>`의 `data-theme`을 관리하고, 감싸는 요소에 글꼴과 글자색을 지정한다. 같은 속성과 상속에 기대는 사이트는 `mode`와 테마 값을 함께 맞춰야 한다.
- 글 본문 렌더러는 유지한다. Astryx `Markdown`은 한글 제목 id를 만들지 못하고 `data:` 이미지를 거부한다.
- 먼저 옮길 곳은 독자에게 보이지 않는 글쓰기 화면의 폼이다. 그다음이 목차다.
- 같은 검토를 업무용 화면에 하면 결론이 뒤집힌다. 디자인 시스템의 값은 화면에 상태와 상호작용이 얼마나 많은가에 달려 있다.

## 참고

- [@astryxdesign/core README (Quick Start, Vite)](https://github.com/meta/astryx/blob/main/packages/core/README.md)
- [apps/example-vite README](https://github.com/meta/astryx/blob/main/apps/example-vite/README.md)
- [reset.css](https://github.com/meta/astryx/blob/main/packages/core/src/reset.css)
- [Theme.tsx](https://github.com/meta/astryx/blob/main/packages/core/src/theme/Theme.tsx)
- [use-a-theme.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/use-a-theme.doc.mjs)
- [author-a-theme.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/author-a-theme.doc.mjs)
- [migration-setup.doc.mjs (레이어 점검)](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/migration-setup.doc.mjs)
- [Markdown.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Markdown/Markdown.doc.mjs)
- [Markdown parser.ts (slugify)](https://github.com/meta/astryx/blob/main/packages/core/src/Markdown/parser.ts)
- [CodeBlock.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/CodeBlock/CodeBlock.doc.mjs)
- [Outline.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Outline/Outline.doc.mjs)
- [serverSafeComponents.test.ts](https://github.com/meta/astryx/blob/main/packages/core/src/serverSafeComponents.test.ts)
