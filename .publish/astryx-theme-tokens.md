
> **참고** 이 글은 "Meta Astryx 완전 가이드" 10부작의 5편입니다. Astryx v0.7.16(2026년 11월) 공식 저장소의 문서와 소스를 읽고 정리했습니다. Astryx는 베타라서 이후 버전에서 달라질 수 있습니다.

디자인 시스템을 가져다 쓰면 며칠 안에 같은 요청을 받습니다.
"버튼 색만 우리 브랜드 색으로 바꿔 주세요."

방법은 대개 둘 중 하나입니다.
`Button`을 감싼 `BrandButton`을 만들거나, 라이브러리의 클래스 이름을 찾아 CSS로 덮어씁니다.
앞의 것은 감싼 컴포넌트가 계속 늘어나고, 뒤의 것은 라이브러리 버전을 올릴 때마다 불안합니다.
다크 모드가 붙으면 색을 두 벌씩 관리하게 됩니다.

Astryx는 Meta가 공개한 오픈소스 React 디자인 시스템으로, 이 요청을 "테마" 한 겹으로 해결합니다.
컴포넌트는 그대로 두고, 컴포넌트가 읽는 값만 바꿉니다.
이 편은 그 값의 이름표인 디자인 토큰(design token)과, 값을 바꾸는 묶음인 테마(theme)를 다룹니다.

## 한눈에 보기

- Astryx의 테마는 CSS 사용자 정의 속성(custom property)을 재정의하는 묶음입니다. 컴포넌트를 감싸거나 포크하지 않고, `Theme` 컴포넌트에 테마 객체를 넘기고 그 테마의 CSS를 불러오면 적용됩니다.
- Astryx의 디자인 토큰은 문서 생성 스크립트 기준으로 15개 범주 286개입니다. 색 98개, 데이터 시각화 56개, 구문 강조 19개이고 나머지가 간격, 크기, 반경, 그림자, 모션, 타이포그래피입니다.
- Astryx의 색 토큰은 라이트와 다크를 이름 하나로 다룹니다. `[라이트, 다크]` 쌍으로 적은 값은 CSS `light-dark()`로 컴파일되고, `Theme`의 `mode`(기본값 `'system'`)가 어느 쪽을 쓸지 정합니다.
- Astryx가 제공하는 테마 패키지는 Neutral, Butter, Chocolate, Gothic, Matcha, Stone, Y2K 7종입니다. 이 가운데 Gothic은 다크 전용입니다.
- 나만의 Astryx 테마는 `defineTheme()`으로 만듭니다. 기존 테마를 `extends`로 이어받고 바꿀 토큰만 적는 것이 공식 문서가 권하는 기본 경로입니다.
- `astryx theme build`는 테마 소스를 `.css`, `.js`, `.d.ts` 파일로 컴파일합니다. 빌드된 테마 객체에는 `__built: true`가 붙고, `Theme`은 이 표시를 보면 런타임 스타일 주입을 건너뜁니다.
- Astryx 테마는 글꼴의 이름만 정합니다. 글꼴 파일을 불러오는 일은 테마 패키지의 글꼴 스타일시트나 앱이 따로 맡습니다.
- Astryx는 `light-dark()`를 지원하지 않는 브라우저를 위한 대체 수단을 싣지 않습니다. 그런 브라우저에서는 테마 색이 보장되지 않습니다.

## 테마는 CSS 변수를 덮어쓰는 한 겹입니다

테마 패키지 README는 테마를 "a CSS custom property override layer"라고 한 줄로 정의합니다.

Astryx 컴포넌트의 스타일에는 색이나 간격의 실제 값이 들어 있지 않습니다.
`var(--color-accent)`, `var(--spacing-4)` 같은 변수를 읽습니다.
테마는 그 변수에 값을 다시 넣는 CSS입니다.
그래서 컴포넌트 코드가 한 줄도 바뀌지 않아도 화면 전체의 색과 글꼴과 모서리가 바뀝니다.

스타일시트 세 장을 불러오는 순서가 이 구조를 그대로 보여 줍니다.

```css
@import '@astryxdesign/core/reset.css';
@import '@astryxdesign/core/astryx.css';
@import '@astryxdesign/theme-neutral/theme.css';
```

core README에 따르면 이 순서는 CSS 계단식 레이어(cascade layer) 순서와 같습니다.
`reset.css`가 `@layer reset`, 컴포넌트 스타일인 `astryx.css`가 `@layer astryx-base`, 테마가 `@layer astryx-theme`입니다.
테마가 가장 위 레이어에 있으니 컴포넌트 기본값을 이깁니다.
설치와 import 순서의 나머지는 [Astryx 설치와 첫 화면](/blog/astryx-getting-started/)에서 다뤘습니다.

테마 CSS는 페이지 전체에 뿌려지지 않습니다.
`data-astryx-theme` 속성이 붙은 요소 아래에만 적용됩니다.
`Theme` 컴포넌트는 자식을 `display: contents`인 요소로 감싸고 거기에 `data-astryx-theme="테마 이름"`을 붙입니다.
토큰 재정의는 이 속성 선택자에 사용자 정의 속성으로 들어가고, 컴포넌트별 재정의는 `@scope ([data-astryx-theme="테마 이름"])` 규칙 안에 들어갑니다.
`defineTheme`의 `name`이 곧 이 속성 값입니다.

이렇게 설계해서 얻는 이점은 네 가지입니다.

- 브랜드를 입히려고 컴포넌트를 감싸거나 포크하지 않습니다. 업그레이드 경로가 그대로 남습니다.
- 여러 테마의 CSS를 한 페이지에 함께 실을 수 있습니다. 범위가 테마 이름으로 묶여 있어서 서로 섞이지 않고, 전환은 활성 이름만 바꾸면 됩니다.
- 화면의 한 구역만 다른 테마나 다른 색 모드로 둘 수 있습니다.
- 컴포넌트가 테마를 알려고 React 컨텍스트를 읽지 않습니다. 재정의는 순수한 CSS이고, 컴포넌트는 안정된 클래스와 `data-*` 속성만 내보냅니다.

대가도 있습니다.
CSS 변수는 CSS가 닿는 곳에서만 풀립니다.
캔버스나 차트 라이브러리처럼 자바스크립트로 색을 넘겨야 하는 곳에서는 값을 따로 풀어 와야 합니다(뒤에서 다룹니다).

## 디자인 토큰 체계

### 이름은 생김새가 아니라 역할을 말합니다

Astryx 토큰 이름에는 `blue-500` 같은 원색 이름이 거의 없습니다.
`--color-text-primary`, `--radius-container`처럼 쓰임을 말합니다.
설계 문서(`theme-tokens.md`)는 이것을 불변 조건으로 적어 두었습니다.
컴포넌트는 역할 이름을 읽고, 어떤 색이 그 역할을 맡을지는 테마가 정합니다.

토큰의 원본은 `packages/core/src/theme/tokens.stylex.ts` 한 곳입니다.
CLI의 테마 템플릿과 토큰 문서는 그 파일에서 만들어진 사본이고, 어긋나면 검사가 실패합니다.

### 색 토큰 98개

색 이름은 다섯 가지 꼴 중 하나를 따릅니다.

1. `--color-<속성>-<역할>`: 속성은 `text`, `icon`, `background`, `border` 중 하나입니다.
2. `--color-<의도>`: 의도는 `accent`, `neutral`, `info`, `success`, `warning`, `error`입니다.
3. 위 이름에 변형 접미사 하나: `-muted`(옅은 꼴), `-emphasized`(강한 꼴), `-hover`, `-pressed`, `-inverted`.
4. `--color-on-<채움>`: 어떤 채움색 위에 올라가는 글자와 아이콘의 색입니다.
5. `--color-data-*`, `--color-syntax-*`: 도메인 층입니다.

토큰 참조 문서에 나온 색 토큰을 묶으면 이렇습니다.

| 묶음 | 토큰 |
| --- | --- |
| 강조 | `--color-accent`, `--color-accent-muted`, `--color-on-accent`, `--color-neutral` |
| 배경 | `--color-background-body`, `--color-background-surface`, `--color-background-card`, `--color-background-popover`, `--color-background-muted`, `--color-background-inverted`, `--color-background-error-inverted` |
| 텍스트 | `--color-text-primary`, `--color-text-secondary`, `--color-text-disabled`, `--color-text-accent`, `--color-on-dark`, `--color-on-light` |
| 아이콘 | `--color-icon-primary`, `--color-icon-secondary`, `--color-icon-disabled`, `--color-icon-accent` |
| 테두리 | `--color-border`, `--color-border-emphasized` |
| 오버레이와 효과 | `--color-overlay`, `--color-overlay-hover`, `--color-overlay-pressed`, `--color-skeleton`, `--color-track`, `--color-shadow`, `--color-tint-hover` |
| 상태색 | `info`, `success`, `warning`, `error` 각각 일곱 개 (아래 표) |
| 색상 팔레트 | `blue`, `cyan`, `gray`, `green`, `orange`, `pink`, `purple`, `red`, `teal`, `yellow` 각각 `--color-background-<색>`, `--color-border-<색>`, `--color-icon-<색>`, `--color-text-<색>` |

배경은 층이 있습니다.
`color` 문서는 body → surface → card → popover 순서로 한 층씩 위에 놓인다고 설명합니다.
Core 기본값으로 보면 `--color-background-body`가 라이트 `#F1F4F7` / 다크 `#111112`, `--color-background-surface`가 `#FFFFFF` / `#1F1F22`, `--color-background-popover`가 `#FFFFFF` / `#28292C`입니다.

상태색은 "빨강 하나"가 아닙니다.
어느 표면에 놓이느냐에 따라 역할이 나뉩니다.

| 상태 역할 (`<status>`는 info, success, warning, error) | 쓰는 곳 | 짝 |
| --- | --- | --- |
| `--color-text-<status>` | 페이지나 카드 위의 상태 글자 (4.5:1 이상) | |
| `--color-icon-<status>` | 페이지나 카드 위의 상태 아이콘. 기본값은 글자색 | |
| `--color-border-<status>` | 잘못된 입력란 같은 상태 테두리. 기본값은 글자색 | |
| `--color-<status>` | Badge 같은 진한 상태 채움 | `--color-on-<status>` |
| `--color-on-<status>` | 진한 채움 위의 글자와 아이콘 (4.5:1 이상) | `--color-<status>` |
| `--color-<status>-muted` | Banner 같은 옅은 상태 채움 | `--color-on-<status>-muted` |
| `--color-on-<status>-muted` | 옅은 채움 위의 글자와 아이콘 (4.5:1 이상) | `--color-<status>-muted` |

진한 채움색을 그대로 글자색으로 쓰면 대비가 모자라기 쉽습니다.
그래서 채움과 글자를 다른 토큰으로 나눴습니다.
테마가 채움색만 정하고 나머지를 비워 두면, 컴파일러가 대비 기준에 맞춰 `--color-on-<status>`와 `--color-text-<status>`를 유도합니다.

폼 컨트롤 전용 테두리 역할 `--color-border-control`(3:1 이상)은 설계 문서에 2026년 11월 13일 결정으로 올라 있지만, 토큰 참조 표에는 아직 없습니다. 쓰기 전에 `astryx docs tokens/tokens-color` 출력으로 확인하세요.

### 간격, 크기, 테두리, focus, 반경

| 범주 | 토큰과 Core 기본값 |
| --- | --- |
| 간격 (15개) | `--spacing-0` 0rem, `--spacing-0-5` 0.125rem, `--spacing-1` 0.25rem, `--spacing-1-5` 0.375rem, `--spacing-2` 0.5rem, `--spacing-3` 0.75rem, `--spacing-4` 1rem, `--spacing-5` 1.25rem, `--spacing-6` 1.5rem, `--spacing-7` 1.75rem, `--spacing-8` 2rem, `--spacing-9` 2.25rem, `--spacing-10` 2.5rem, `--spacing-11` 2.75rem, `--spacing-12` 3rem |
| 크기 (3개) | `--size-element-sm` 28px, `--size-element-md` 32px, `--size-element-lg` 36px |
| 테두리 (1개) | `--border-width` 1px |
| focus (4개) | `--focus-outline-width` 2px, `--focus-outline-style` solid, `--focus-outline-color` var(--color-accent), `--focus-outline-offset` 3px |
| 반경 (7개) | `--radius-none` 0px, `--radius-inner` 4px, `--radius-element` 8px, `--radius-container` 12px, `--radius-page` 28px, `--radius-chat` 28px, `--radius-full` 9999px |

간격은 4px 단위지만 값은 `rem`으로 적혀 있습니다.
`--spacing-4`는 `1rem`이고, 루트 글자 크기가 16px일 때 16px입니다.
읽는 사람이 브라우저 글자 크기를 키우면 여백도 같이 커지게 하려는 결정입니다.

여기서 흔한 실수가 하나 나옵니다.
자바스크립트에서 간격 토큰을 읽어 `parseInt`로 픽셀 숫자처럼 쓰는 코드입니다.
`--spacing-4`의 값은 `1rem`이라서 `1`이 나옵니다.
픽셀이 필요하면 루트 글자 크기를 기준으로 값을 환산해야 한다고 설계 문서에 적혀 있습니다.

`--size-element-*`는 버튼, 입력란, 선택기의 높이입니다.
focus 토큰 네 개는 focus 링을 그리는 모든 컴포넌트가 함께 읽으므로, 여기만 바꾸면 시스템 전체의 focus 모양이 바뀝니다.

반경은 `inner → element → container → page` 순으로 쓰임이 정해져 있습니다.
`shape` 문서의 권고는 컨트롤(버튼, 입력란)에 `--radius-element`, 카드와 패널과 다이얼로그에 `--radius-container`, 알약 모양에 `--radius-full`입니다.
둥근 컨테이너 안에 둥근 요소를 넣을 때는 바깥 반경에서 안쪽 여백을 뺀 값을 써야 곡선이 나란해집니다.

```css
.inner {
  border-radius: max(0px, calc(var(--radius-container) - var(--spacing-4)));
}
```

### 그림자와 높이

그림자 토큰은 여덟 개입니다.
높이용이 `--shadow-low`, `--shadow-med`, `--shadow-high`이고, 입력 상태 링용이 `--shadow-inset-hover`, `--shadow-inset-selected`, `--shadow-inset-success`, `--shadow-inset-warning`, `--shadow-inset-error`입니다.

`elevation` 문서의 기준은 분명합니다.
그림자를 얼마나 넣고 싶은지가 아니라, 표면이 페이지에서 얼마나 떠 있는지로 단계를 고릅니다.

| 단계 | 언제 | 예 |
| --- | --- | --- |
| `none` | 페이지에 박혀 있는 평평한 표면. ChatComposer를 뺀 모든 표면의 기본값 | 그리드 안의 Card, 인라인 Banner |
| `low` | 흐름 안에 있지만 배경과 구분돼야 할 때 | 강조한 Card, ChatComposer |
| `med` | 같은 페이지의 다른 콘텐츠 위에 뜰 때 | Popover, 떠 있는 Banner |
| `high` | UI 전체 위에 놓일 때 | 모달 Dialog |

Card, Button, Banner 같은 표면은 `elevation` prop으로 이 단계를 받습니다.
Dialog, Popover, Tooltip, Toast처럼 원래 떠 있는 것들은 높이가 내장돼 있어 prop이 없습니다.

### 타이포그래피와 타입 스케일

글꼴 토큰은 세 층입니다.

| 층 | 토큰 |
| --- | --- |
| 글꼴 패밀리 (3개) | `--font-family-body`, `--font-family-heading`, `--font-family-code` |
| 글자 크기 (12개) | `--font-size-4xs` 0.375rem, `--font-size-3xs` 0.4375rem, `--font-size-2xs` 0.5rem, `--font-size-xs` 0.625rem, `--font-size-sm` 0.75rem, `--font-size-base` 0.875rem, `--font-size-lg` 1.0625rem, `--font-size-xl` 1.25rem, `--font-size-2xl` 1.5rem, `--font-size-3xl` 1.8125rem, `--font-size-4xl` 2.1875rem, `--font-size-5xl` 2.625rem |
| 글꼴 굵기 (4개) | `--font-weight-normal` 400, `--font-weight-medium` 500, `--font-weight-semibold` 600, `--font-weight-bold` 700 |
| 타입 스케일 (42개) | `--text-<역할>-size`, `--text-<역할>-weight`, `--text-<역할>-leading`. 역할은 `heading-1`~`heading-6`, `body`, `large`, `label`, `code`, `supporting`, `display-1`~`display-3` |

글자 크기는 기하급수 스케일입니다.
문서의 식은 `round(14 × 1.2^step)`이고 기준인 `--font-size-base`가 14px입니다.

타입 스케일(type scale)은 크기, 굵기, 줄 높이를 한 벌로 묶은 의미 토큰입니다.
예를 들어 `--text-heading-1-size`의 기본값은 `var(--font-size-2xl)`, `--text-body-weight`는 `var(--font-weight-normal)`입니다.
`Heading`과 `Text` 컴포넌트가 이 세 값을 읽으므로, 문서는 글꼴 토큰을 직접 조합하지 말고 컴포넌트 prop을 쓰라고 권합니다.

줄 높이는 손으로 정하지 않습니다.
20px 미만은 1.5, 20~31px은 1.4, 32px 이상은 1.25를 목표로 계산한 뒤 4px 격자에 맞춥니다.
`display-1`~`display-3`은 `heading-1`보다 큰 단계로, 히어로 배너나 숫자 강조용입니다.

### 모션: duration과 ease

| 범주 | 토큰과 Core 기본값 |
| --- | --- |
| duration (10개) | `--duration-fast-min` 130ms, `--duration-fast` 175ms, `--duration-fast-max` 230ms, `--duration-medium-min` 310ms, `--duration-medium` 410ms, `--duration-medium-max` 550ms, `--duration-slow-min` 730ms, `--duration-slow` 975ms, `--duration-slow-max` 1300ms, `--duration-exit` var(--duration-fast) |
| ease (4개) | `--ease-standard`, `--ease-entrance`, `--ease-move` 모두 cubic-bezier(0.24, 1, 0.4, 1), `--ease-exit` cubic-bezier(0.3, 0, 0.6, 0.6) |

duration은 세 대역입니다. fast는 미세한 상호작용, medium은 등장과 퇴장, slow는 연속 동작입니다.
ease는 일의 이름을 따릅니다. 도착하는 것은 `--ease-entrance`, 화면 안에서 움직이는 것은 `--ease-move`, 떠나는 것은 `--ease-exit`입니다.

### 도메인 토큰

두 묶음은 따로 떨어진 층입니다.
구문 강조용 `--color-syntax-*` 19개(`--color-syntax-keyword`, `--color-syntax-string`, `--color-syntax-background` 등)는 CodeBlock이 읽습니다.
차트용 `--color-data-*` 56개는 계열 하나에 하나씩 쓰는 `--color-data-categorical-blue` 같은 범주색, 라벨과 기준선용 `--color-data-neutral`, 그리고 5(가장 진함)에서 1(가장 옅음)까지의 순차 램프(`--color-data-blue-5` ~ `--color-data-blue-1` 등)로 이뤄집니다.

## 토큰을 내 코드에서 쓰는 법

가장 단순한 길은 CSS에서 변수 이름을 그대로 쓰는 것입니다.

```css
.panel {
  padding: var(--spacing-4);
  color: var(--color-text-primary);
  background-color: var(--color-background-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-container);
  box-shadow: var(--shadow-low);
}
```

값을 하드코딩하지 않았으니 테마를 바꾸거나 다크 모드로 넘어가도 이 패널은 따라옵니다.
Tailwind를 쓴다면 토큰을 유틸리티로 이어 주는 브리지가 있고, 그 내용은 [Astryx 스타일링](/blog/astryx-styling-tailwind-swizzle/)에서 다룹니다.

StyleX로 스타일을 쓴다면 `@astryxdesign/core/theme/tokens.stylex`에서 `colorVars`, `spacingVars`, `radiusVars` 같은 타입 붙은 변수 객체를 가져와 `spacingVars['--spacing-4']`처럼 씁니다.

CSS가 닿지 않는 곳에서는 값을 풀어 옵니다.
React 안에서는 `useTheme()`이 가장 가까운 테마의 `mode`와 `tokens`를 돌려주고, `tokens['--color-text-primary']`처럼 읽습니다.
React 밖(서버, 빌드 도구)에서는 `@astryxdesign/core/theme/tokens`의 `resolveThemeTokens(theme, {mode: 'light'})`를 씁니다.
Panda나 Emotion 같은 다른 스타일 라이브러리 설정에 변수 참조를 넘길 때는 같은 경로의 `tokenVar('--color-text-primary')`가 있습니다.
문서는 일반 스타일링에는 CSS 변수를 쓰고, 훅은 캔버스나 차트처럼 구체적인 색 값이 필요한 곳에만 쓰라고 권합니다.

## 기본 제공 테마 7종

| 테마 | 패키지 | 성격 | 글꼴 |
| --- | --- | --- | --- |
| Neutral | `@astryxdesign/theme-neutral` | 절제된 회색조, 미니멀. 문서가 "좋은 출발점"으로 꼽는 테마 | Figtree (본문과 제목), 코드는 시스템 모노스페이스 |
| Butter | `@astryxdesign/theme-butter` | 버터색 표면에 파란 강조 | Sarina (디스플레이), Outfit (제목과 본문) |
| Chocolate | `@astryxdesign/theme-chocolate` | 갈색과 베이지의 따뜻한 톤 | Fraunces (제목), Albert Sans (본문) |
| Gothic | `@astryxdesign/theme-gothic` | 다크 전용. 짙은 청회색 표면과 파스텔 범주색 | Manufacturing Consent (제목), Fustat (본문) |
| Matcha | `@astryxdesign/theme-matcha` | 흙빛 도는 녹색 | Playwrite US Trad (제목), DM Sans (본문) |
| Stone | `@astryxdesign/theme-stone` | 돌과 슬레이트의 따뜻한 무채색 | Montserrat (제목), Figtree (본문) |
| Y2K | `@astryxdesign/theme-y2k` | 연보라 바탕, 차콜 강조, 홀로그램풍 범주색 | Poppins (본문과 제목), Crimson Text (디스플레이) |

일곱 패키지 모두 아이콘으로 Lucide(`lucide-react`)를 씁니다.
각 패키지는 같은 모양으로 내보냅니다.
빌드된 테마 객체가 `@astryxdesign/theme-<이름>/built`, 프로덕션 CSS가 `/theme.css`, 글꼴 로딩 CSS가 `/fonts.css`입니다.

## Theme 컴포넌트로 테마 적용하기

공식 문서가 권하는 경로는 CLI입니다.

```bash
npm install @astryxdesign/theme-neutral
npx @astryxdesign/cli theme add neutral
```

`theme add`는 테마 소스를 복사하지 않습니다.
설치된 패키지의 테마를 앱에 등록하고 `src/astryx-themes.ts`(또는 `.js`)를 생성합니다.
이 모듈은 빌드된 테마 모듈, 프로덕션 CSS, 글꼴 CSS를 import하고 `themes`와 `defaultThemeSlug`를 내보냅니다.
앱은 이것을 한 번만 연결합니다.

```tsx
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from './astryx-themes';

function App() {
  return (
    <Theme theme={themes[defaultThemeSlug]}>
      <YourApp />
    </Theme>
  );
}
```

`theme use <slug>`가 기본 테마를 바꾸고, `theme remove <slug>`가 테마를 뺍니다.
생성된 모듈은 손으로 고치지 않습니다. 명령이 통째로 다시 만듭니다.
CLI 없이 `import {neutralTheme} from '@astryxdesign/theme-neutral/built'`로 직접 넘기는 방법도 테마 README에 그대로 있습니다.

`Theme`의 prop은 `theme`(필수), `mode`(`'light'`, `'dark'`, `'system'` 중 하나이고 기본은 `'system'`), `children` 세 개뿐입니다.

`Theme`이 DOM에 남기는 속성은 두 가지입니다.

- `data-astryx-theme`: 테마 이름입니다. 테마 CSS의 범위가 이 속성에 걸립니다.
- `data-theme`: `light` 또는 `dark`입니다. `mode`가 `'system'`이면 붙지 않습니다. `reset.css`가 이 속성을 `color-scheme`으로 옮겨서 스크롤바와 네이티브 폼 컨트롤까지 모드를 따르게 합니다.

트리에서 가장 바깥의 `Theme`은 이 두 속성을 `<html>`에도 씁니다.
포털이나 토스트처럼 감싼 요소 바깥에 그려지는 것들에 테마 CSS가 닿게 하기 위해서입니다.
중첩된 `Theme`은 `<html>`을 건드리지 않습니다.
번들러 없이 CDN으로 쓰는 예제가 `<html data-astryx-theme="neutral">`을 직접 적는 이유도 같습니다. 이 속성이 없으면 불러온 테마 대신 내장 기본값으로 그려집니다.

## 라이트/다크 모드는 토큰 하나로 처리합니다

다크 모드를 구현할 때 흔히 색을 두 벌 만듭니다.
`--bg-light`와 `--bg-dark`를 두거나, `.dark` 클래스 아래에 변수를 전부 다시 선언합니다.
Astryx는 이렇게 하지 않습니다. 설계 문서의 표현으로는 모드에 따라 달라지는 역할도 "토큰 하나"로 남습니다.

테마를 정의할 때 값을 `[라이트, 다크]` 쌍으로 적습니다.

```ts
'--color-accent': ['#0064E0', '#2694FE'],
//                   라이트     다크
```

이 쌍은 CSS `light-dark()` 함수로 컴파일됩니다.
`light-dark()`는 요소에 적용된 `color-scheme`을 보고 두 색 중 하나를 고릅니다.
그래서 모드를 바꿀 때는 변수 값을 갈아 끼우지 않고 `color-scheme`만 바꿉니다.
`Theme`의 `mode`가 하는 일이 이것입니다.

- `mode="light"` 또는 `"dark"`: 감싼 요소의 `color-scheme`을 그 값으로 고정합니다.
- `mode="system"`(기본): 페이지가 쓰는 색 구성을 따릅니다. `reset.css`를 불러왔다면 그것은 읽는 사람의 OS 설정입니다.

이 원리에서 주의할 점이 세 가지 나옵니다.

첫째, `light-dark()`는 색만 받습니다.
그라디언트 전체를 쌍으로 감싸면 그 토큰을 쓰는 곳에서 값이 무효가 되는데, `theme build`는 경고하지 않습니다.
색 정지점 하나하나에 `light-dark()`를 써야 합니다.

둘째, 서버 렌더링에서는 첫 화면이 잘못된 모드로 깜빡일 수 있습니다.
`Theme` 소스의 주석은 루트 서버 레이아웃의 `<html>`에 `data-theme`을 직접 적어 두라고 안내합니다.

셋째, 색 모드가 하나뿐인 테마가 있습니다.
Gothic은 모든 토큰이 단일 값이고 출력 CSS에 `light-dark()`가 없습니다.
이런 테마는 소스에서 `colorModes`를 내보내고, `theme add`가 그것을 읽어 `themeModes`에 기록합니다. CLI가 안내하는 연결 코드는 `mode={themeModes[defaultThemeSlug] ?? 'system'}`입니다.

자바스크립트에서 현재 모드가 필요하면 `useTheme().mode`를 읽습니다.
이 값은 언제나 풀린 결과인 `'light'` 또는 `'dark'`이고, `'system'`이 그대로 나오지 않습니다.

## 중첩 테마와 MediaTheme

`Theme` 안에 `Theme`을 또 둘 수 있습니다. 가장 가까운 것이 이깁니다.

```tsx
<Theme theme={lightTheme} mode="light">
  <Layout
    start={
      <Theme theme={darkTheme} mode="dark">
        <LayoutPanel>{/* 어두운 사이드바 */}</LayoutPanel>
      </Theme>
    }
    content={<LayoutContent>{/* 밝은 본문 */}</LayoutContent>}
  />
</Theme>
```

한계도 문서에 적혀 있습니다.
일반적인 React 포털은 컨텍스트를 유지하므로 문제가 없습니다.
하지만 별도의 React 루트로 그려지는 내용은 `<html>`에 적힌 루트 테마만 따라갈 수 있고, 중첩된 테마는 되찾지 못합니다.

비슷해 보이지만 용도가 다른 것이 `MediaTheme`입니다.
이미지 위의 글자, 토스트, 툴팁처럼 주변과 명암이 뒤집힌 표면을 위한 컴포넌트로, 테마는 그대로 두고 그 표면의 `color-scheme`만 뒤집습니다.
앱 전체의 다크 모드에는 `MediaTheme`이 아니라 `Theme`의 `mode`를 쓰라고 문서는 분명히 적어 둡니다.
이런 표면 위에서의 모양은 `defineTheme`의 `onDark`, `onLight`로 따로 정할 수 있습니다.

## 나만의 테마 만들기

### 이어받기가 기본, 꺼내기는 포크

공식 문서는 순서를 정해 둡니다.
평범한 커스터마이징은 설치한 테마를 `extends`로 이어받습니다.
`theme eject`는 소스를 통째로 복사해 독립된 포크를 만들 때만 씁니다. 포크는 원래 패키지의 업데이트를 더는 받지 못합니다.

```ts
// src/themes/brand/brandTheme.ts
import {defineTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral';

export const brandTheme = defineTheme({
  name: 'brand',
  extends: neutralTheme,
  motion: {tempo: 0.85, character: 'crisp'},
  tokens: {
    '--color-accent': ['#0051a3', '#4aa3ff'],
    // 강조색을 바꾸면 그 위에 얹히는 글자색도 내가 책임진다
    '--color-on-accent': ['#FFFFFF', '#0A1317'],
  },
});
```

로컬 테마는 `src/themes/<slug>/` 폴더에 `<name>Theme.ts` 소스와 같은 이름의 `<name>Theme.doc.mjs` 설명 파일을 둡니다.
`theme add`와 `theme list`가 이 설명 파일을 읽습니다.

이어받을 때 필드마다 합쳐지는 방식이 다릅니다.

| 필드 | 합쳐지는 방식 |
| --- | --- |
| `tokens` | 기반 테마의 토큰을 복사한 뒤 자식 것이 덮어씁니다 |
| `components` | 깊은 병합. CSS 속성 하나만 다시 적어도 나머지는 남습니다 |
| `icons` | 얕은 병합. 같은 이름만 바뀝니다 |
| `motion` | 필드별 상속. 적지 않은 값은 기반 것을 유지합니다 |
| `typography`, `radius`, `color` | 통째로 교체됩니다. 값이 아니라 생성기의 입력이기 때문입니다 |

상속은 테마를 정의하는 순간에 풀립니다.
그래서 이어받은 테마도 상속이 모두 풀린 테마 하나가 되고, 빌드 결과도 자기 완결적입니다. 기반 테마의 CSS를 옆에 같이 불러올 필요가 없습니다.

### defineTheme에 적을 수 있는 것

필수는 `name` 하나입니다.
나머지는 크게 스케일 설정, 토큰 재정의, 컴포넌트 재정의로 나뉩니다.

| 설정 | 만들어 내는 것 | 인자 |
| --- | --- | --- |
| `typography.scale` | `--text-*`의 크기, 굵기, 줄 높이 | `base`(px), `ratio` |
| `typography.body` / `heading` / `code` | `--font-family-body`, `--font-family-heading`, `--font-family-code` | `family`, `fallbacks` 등 |
| `radius` | `--radius-inner`, `--radius-element`, `--radius-container`, `--radius-page`, `--radius-chat` | `base`(px), `multiplier`(0~2) |
| `motion` | 모든 `--duration-*`, `--ease-entrance`, `--ease-move` | `tempo`, `character`, 또는 `fast`, `medium`, `slow`, `ratio` |
| `color` | 강조색 하나에서 배경, 텍스트, 테두리까지 | `accent`, `neutralStyle`, `contrast` |

`color` 스케일은 기존 테마를 위한 호환 경로로 남아 있고, 새 팔레트의 출발점으로는 권하지 않는다고 템플릿에 적혀 있습니다.
새 테마는 아래의 팔레트 생성을 씁니다.

우선순위는 정해져 있습니다.
기반 테마, 스케일이 만든 값, 명시적 `tokens`, 컴포넌트 재정의 순으로 뒤의 것이 이깁니다.
명시적 토큰은 토큰 단위로 스케일 값을 이깁니다.

`components` 필드는 선택자가 아니라 의미 있는 키를 씁니다.
`button`의 `base`, `'variant:ghost'`, `':hover'`, `'@dark'` 같은 키에 `borderRadius`, `padding` 같은 표준 CSS 속성을 적습니다.
`--_`로 시작하는 Core의 비공개 변수를 직접 적으면 `theme build`가 거부합니다.
컴포넌트 재정의의 자세한 문법과 보장 범위는 [Astryx 스타일링](/blog/astryx-styling-tailwind-swizzle/)에서 이어집니다.

필드 전체를 주석과 함께 보려면 `astryx theme template`이 `theme.template.ts`를 프로젝트에 써 줍니다.

### 팔레트 생성

테마 하나에는 서로 어울리는 색이 수십 개 필요합니다.
`theme palette generate`는 씨앗 색 몇 개에서 라이트와 다크 램프를 만들어 냅니다.

```json
{"recipe": "astryx-oklch-v2", "families": [{"id": "ocean", "seed": "#0074e2"}]}
```

```bash
# 파일을 쓰지 않고 미리 보기
npx @astryxdesign/cli theme palette generate themes/ocean/palette.config.json

# 팔레트와 영수증(receipt) 쓰기
npx @astryxdesign/cli theme palette generate themes/ocean/palette.config.json \
  --out themes/ocean/tokens/ocean.palette.ts
```

결과 파일은 `black`, `white`, `palette`를 내보냅니다.
`palette`는 색 계열마다 `light`와 `dark` 각각 21단계(정지점 0~100)입니다.
옆에 생기는 `.receipt.json`은 씨앗과 설정을 기록해서 나중에 같은 팔레트를 다시 만들 수 있게 합니다.

테마 소스는 이 파일을 import해서 의미 토큰이 팔레트의 단계를 가리키게 합니다. 문서의 예로는 `'--color-accent': [palette.ocean.light['45'], palette.ocean.dark['70']]`입니다.
컴포넌트는 팔레트를 읽지 않고 토큰만 읽습니다.
팔레트를 다시 생성하면 그 단계를 가리키는 토큰이 함께 바뀝니다. 생성 명령이 테마 소스를 고쳐 쓰지는 않습니다.

### 빌드, 문서화, 배포

```bash
npx @astryxdesign/cli theme build src/themes/brand/brandTheme.ts
npx @astryxdesign/cli theme add brand
```

`theme build`가 소스 옆에 산출물을 쓰고, `theme add`가 그 로컬 테마를 앱 모듈에 등록합니다.
테마를 고치는 동안에는 `theme build --watch`로 산출물을 최신으로 유지하고, CI에서는 `theme build --check`로 소스와 산출물이 어긋났는지 확인합니다.

다른 팀과 나누려면 패키지로 싣습니다.
`integration add theme <slug>`가 `defineTheme` 뼈대와 설명 파일을 만들고 패키지 exports를 선언합니다.
패키지는 테마마다 빌드된 모듈을 `./themes/<slug>`, 스타일시트를 `./themes/<slug>.css`로 내보냅니다.
받는 쪽은 패키지를 설치하고 `theme add <slug> --package <패키지>`를 실행합니다.

테마 사용법은 `extends: 'theme'`인 문서 토픽으로 남깁니다.
그러면 그 패키지를 설치한 앱의 `astryx docs theme` 끝에 내 테마 안내가 붙습니다.

## 테마 컴파일이 실제로 하는 일

`theme build`의 산출물은 네 가지입니다.

| 파일 | 내용 |
| --- | --- |
| `<name>.css` | 토큰 재정의, 컴포넌트 재정의, 산문 요소 스타일이 `@scope` 규칙으로 들어 있는 CSS |
| `<name>.js` | `__built: true`와 미리 풀어 둔 토큰 값을 가진 테마 객체를 내보내는 ES 모듈 |
| `<name>.d.ts` | 테마와 아이콘 레지스트리의 타입 선언 |
| `<name>.variants.d.ts` | (있을 때만) 테마가 추가한 커스텀 prop 값의 모듈 보강 |

여기서 `theme.css`와 built 객체의 관계가 헷갈리기 쉽습니다.
**built 객체에는 스타일이 없습니다.**
화면을 바꾸는 것은 CSS 파일이고, 객체는 이름, 풀린 토큰 값, 아이콘 같은 데이터를 들고 있습니다.
`__built: true`는 `Theme`에게 "CSS는 이미 따로 실려 있으니 주입하지 말라"고 알리는 표시입니다.
그래서 `/built`만 import하고 CSS를 빼먹으면 컴포넌트 재정의가 적용되지 않습니다.

빌드하지 않은 테마를 넘기면 `Theme`이 `useInsertionEffect`에서 같은 CSS를 만들어 `<style>`로 주입합니다.

| | 런타임 (소스) | 빌드됨 |
| --- | --- | --- |
| 동작 | 하이드레이션 때 `<style>` 주입 | 미리 컴파일한 `.css`가 페이지와 함께 로드 |
| 컴포넌트 재정의 | 클라이언트에서만 주입 | 정적 CSS에 있어 SSR 때부터 존재 |
| SSR | 토큰은 안전, 컴포넌트 재정의는 하이드레이션 때 깜빡임 | 깜빡임 없음 |
| 맞는 용도 | `theme build`의 입력, 브라우저에서 만드는 동적 테마 | 개발과 프로덕션의 앱 연결 |

설계 문서(`theme-compilation.md`)가 내세우는 원칙은 "웹 컴파일러는 하나"입니다.
런타임 주입과 정적 빌드가 같은 코드로 CSS를 만들고, 같은 스코프와 `astryx-theme` 레이어를 씁니다.

한 가지 더 기억할 것이 있습니다.
런타임은 `__built: true`를 그대로 믿습니다.
Astryx를 올린 뒤에는 커스텀 테마를 다시 빌드해서 새 파일을 함께 배포해야 합니다. 옛 빌드의 CSS를 런타임이 고쳐 주지 않습니다.

## 타이포그래피는 테마의 것입니다

AST-102 명세의 제목은 "Typography stays theme-owned"입니다.
요구 사항은 단순합니다. Core와 Lab의 웹 컴포넌트는 자기가 그리는 글자의 글꼴, 크기, 줄 높이를 테마의 타이포그래피 토큰을 통해서만 정합니다.
컴포넌트가 플랫폼 글꼴을 직접 끼워 넣으면 그 표면만 테마에서 벗어나고, 제품이 그것을 보거나 조정할 수 없기 때문입니다.

이 결정에서 따라 나오는 점이 둘 있습니다.

하나는 글꼴 로딩입니다.
테마는 `--font-family-*`에 이름을 넣을 뿐이고 글꼴 파일을 불러오지 않습니다.
이름만 적고 파일을 싣지 않으면 아무 오류 없이 `fallbacks`의 글꼴로 그려집니다.
1차 테마 패키지는 `/fonts.css`를 내보내고 `theme add`가 그것을 import해 줍니다. README는 `<head>`에 넣을 Google Fonts 링크도 함께 안내합니다.

다른 하나는 읽는 사람이 정한 글자 크기입니다.
iOS의 Dynamic Type이나 브라우저 기본 글자 크기로 사용자가 크기를 정했다면, 모든 테마가 그 크기를 따릅니다. 글꼴 패밀리와 단계 사이의 순서는 테마 것을 유지합니다.
이를 켜는 테마 옵션이나 prop은 없습니다. 기본 동작입니다.

## 테마 모션

테마는 모션의 느낌을 손잡이 두 개로 정합니다. 앞의 `brandTheme` 예에 적은 `motion: {tempo: 0.85, character: 'crisp'}`가 그것입니다.

- `tempo`: 모든 duration 토큰에 곱해지는 배율입니다. 1이 Astryx 기본, 0.75가 가장 빠르고 1.5가 가장 느립니다. 범위를 벗어난 값은 잘립니다.
- `character`: `'crisp'`, `'standard'`, `'expressive'`. `--ease-entrance`와 `--ease-move` 곡선을 정합니다. `crisp`는 튀어 넘지 않고 감속하고, `expressive`는 살짝 넘어갔다 돌아옵니다. `--ease-exit`은 어느 쪽이든 같습니다.

`fast`, `medium`, `slow`, `ratio`로 적는 duration 스케일도 그대로 받습니다.
우선순위는 손잡이, duration 스케일, 명시적 `tokens` 순으로 뒤가 이깁니다.

손잡이를 따르지 않는 모션도 일부러 정해 두었습니다.
손가락을 따라가는 드래그, 스크롤 관성, 화면 키보드, 호버 의도 지연, Spinner와 Skeleton의 반복 주기, 그리고 동작 줄이기(Reduce Motion)의 200ms 상한입니다.

AST-108 명세의 세 번째 손잡이 `reducedMotion: 'always'`는 설계 문서에 "승인됐지만 출시되지 않음"으로 표시돼 있습니다. 지금은 모든 테마가 각 사용자의 설정을 따릅니다.
모션 전반은 [Astryx의 접근성, 국제화, 모션](/blog/astryx-a11y-i18n-motion/)에서 다룹니다.

## 아이콘 세트와 테마

Astryx 컴포넌트는 아이콘을 `close`, `chevronDown`, `check`, `search` 같은 의미 이름으로 요청합니다.
그 이름에 어떤 그림을 연결할지는 테마의 `icons` 필드가 정합니다. `icons: {close: <XMarkIcon />}`처럼 이름마다 React 노드를 적습니다.
그래서 아이콘 세트를 바꿔도 컴포넌트 코드는 그대로 두고 테마만 고치면 됩니다.
조회 범위도 활성 테마로 한정됩니다.
Neutral 테마의 `icons.tsx`가 좋은 예로, 의미 이름 29개를 Lucide 컴포넌트에 하나씩 연결합니다.

항목은 `{size, variant}`를 받는 순수 함수일 수도 있고, 지원하는 변형 이름은 `iconVariants`에 테마 단위로 한 번 적습니다.
빌드할 테마라면 아이콘 레지스트리를 테마 파일과 다른 모듈에 두고 이름 있는 import로 가져옵니다. 테마 파일 안에 직접 적은 함수 항목은 빌드가 실어 나르지 못해 실패합니다.

## 디자인 지침: 색 강조와 높이 위계

저장소의 `docs/design/`에는 토큰을 어떻게 써야 하는지에 대한 설계 기록이 있습니다.
여기서 다루는 두 문서는 아직 초안(draft)입니다.

**색 강조(color emphasis)** 문서의 원칙은 이렇습니다.

- 전경과 배경은 하나의 결정입니다. 색은 그것이 놓일 표면과 함께 평가합니다.
- 강조는 드물어야 합니다. 한 무리의 액션 안에서 주된 강조는 하나만 드러냅니다.
- 호버와 눌림 표시는 밑의 표면과 섞여 보여야 합니다. 관계없는 불투명 색으로 덮지 않습니다.
- 호버 색은 선택적인 피드백입니다. 터치와 키보드에서도 상태의 뜻이 남아야 합니다.

토큰 구조에도 이 원칙이 반영돼 있습니다.
`--color-on-accent`가 `--color-accent`와 짝을 이루는 것은 첫째 원칙을, `--color-overlay-hover`가 반투명 값인 것은 셋째 원칙을 따른 것입니다.

**높이 위계(elevation hierarchy)** 문서의 원칙은 이렇습니다.

- 높아 보이는 표면은 실제로도 위 레이어여야 합니다.
- 깊이는 조용해야 합니다. 그림자가 화면의 주인공이 되면 안 됩니다.
- 표면의 경계는 테두리나 부드러운 그림자 중 하나가 이끕니다. 둘 다 최대로 쓰지 않습니다.
- 상태 링은 높이가 아닙니다. 입력란의 focus 링이 "떠올랐다"는 인상을 주면 안 됩니다.

`--shadow-inset-*`를 높이용 그림자와 별도 토큰으로 둔 것은 마지막 원칙 때문입니다.

## 주의할 점

- **베타입니다.** 테마 관련 CLI는 최근까지도 바뀌었습니다. 이전 릴리스의 `theme add`는 소스를 복사했고, 지금 그 역할은 `theme eject`가 맡습니다. 이전 방식으로 복사해 둔 테마는 `astryx upgrade`가 설명 파일을 보태 로컬 테마로 바꿔 줍니다.
- **`light-dark()`가 전제입니다.** 브라우저 지원 문서는 이 함수의 대체 수단을 싣지 않는다고 밝힙니다. 지원 현황은 작성 시점 기준으로 MDN에서 확인하세요.
- **손으로 적은 쌍의 대비는 내 책임입니다.** 템플릿의 경고대로, 강조색만 바꾸고 `--color-on-accent`를 그대로 두거나 표면만 바꾸고 글자색을 그대로 두면 그 쌍의 대비는 직접 재야 합니다. 두 모드 모두에서 확인해야 합니다.

## 자주 묻는 질문

### Astryx에 브랜드 색을 입히려면 컴포넌트를 감싸야 하나요?

아닙니다. Astryx의 테마는 CSS 사용자 정의 속성을 재정의하는 층이라서 컴포넌트 코드를 건드리지 않습니다. 설치한 테마를 `defineTheme({extends: ...})`로 이어받아 `--color-accent` 같은 토큰만 바꾸고, `astryx theme build`로 빌드한 뒤 `Theme`에 넘기면 됩니다.

### Astryx에서 다크 모드는 어떻게 켜나요?

`Theme`의 `mode` prop으로 정합니다. 기본값 `'system'`은 페이지의 색 구성을 따르고, `'light'`나 `'dark'`를 주면 고정됩니다. 색 토큰이 `light-dark()`로 컴파일돼 있어서, 모드 전환은 토큰 값을 바꾸지 않고 `color-scheme`만 바꿉니다.

### `theme add`와 `theme eject`는 무엇이 다른가요?

`theme add`는 빌드된 테마를 앱에 등록하고 `astryx-themes` 모듈을 다시 생성합니다. 소스는 복사하지 않으므로 패키지 업데이트가 계속 앱에 닿습니다. `theme eject`는 테마 소스를 `src/themes` 아래로 복사해 독립된 포크를 만듭니다. 포크는 원래 패키지의 업데이트를 받지 못합니다.

### 런타임 테마와 빌드된 테마 중 무엇을 써야 하나요?

공식 문서는 개발과 프로덕션 모두 빌드된 테마를 연결하라고 권합니다. 런타임 테마는 하이드레이션 때 `<style>`을 주입하므로 SSR 앱에서 컴포넌트 재정의가 깜빡입니다. 런타임 테마는 `theme build`의 입력이거나, 테마 편집기처럼 브라우저에서 테마를 만드는 경우에 맞습니다.

### 테마에 적은 글꼴은 자동으로 로드되나요?

아닙니다. Astryx 테마는 `--font-family-*` 토큰에 글꼴 이름만 넣습니다. 1차 테마 패키지는 `/fonts.css`를 내보내고 `theme add`가 이를 import하지만, 직접 만든 테마라면 `<link>`나 `@font-face`로 글꼴을 싣고 `fallbacks`를 반드시 적어야 합니다. 빌드는 테마가 불러오지 않는 글꼴 이름이 있으면 경고합니다.

### 토큰 값을 자바스크립트에서 읽을 수 있나요?

읽을 수 있습니다. React 안에서는 `useTheme()`이 `mode`와 `tokens`를 돌려주고, React 밖에서는 `@astryxdesign/core/theme/tokens`의 `resolveThemeTokens()`를 씁니다. 다만 간격 토큰은 `rem` 값이므로 픽셀 숫자로 파싱하면 안 됩니다.

## 정리

- Astryx의 테마는 CSS 변수 재정의 묶음입니다. `data-astryx-theme` 속성으로 범위가 묶이고 `astryx-theme` 레이어에 놓여서, 컴포넌트를 감싸거나 포크하지 않고 브랜드를 입힙니다.
- 토큰 이름은 역할을 말합니다. 색은 다섯 가지 꼴의 문법을 따르고, 상태색은 표면에 따라 일곱 역할로 나뉩니다.
- 다크 모드는 색 두 벌이 아니라 토큰 하나와 `light-dark()`입니다. 모드를 바꾸는 것은 `color-scheme`입니다.
- 내 테마는 `extends`로 이어받고, 팔레트는 씨앗에서 생성해 검토하고, `theme build`로 CSS와 built 객체를 만듭니다. 스타일은 CSS에 있고 객체는 데이터입니다.
- 글꼴, 글자 크기, 모션의 빠르기, 아이콘 세트까지 테마가 정합니다. 컴포넌트는 토큰과 의미 이름만 읽습니다.
- 베타이고 `light-dark()`가 전제이며, 손으로 적은 색 쌍의 대비는 직접 확인해야 합니다.

## 참고

모두 [meta/astryx](https://github.com/meta/astryx) 저장소 main 브랜치의 파일입니다.

- 테마 패키지: [packages/themes/README.md](https://github.com/meta/astryx/blob/main/packages/themes/README.md), [neutral/README.md](https://github.com/meta/astryx/blob/main/packages/themes/neutral/README.md), [neutralTheme.ts](https://github.com/meta/astryx/blob/main/packages/themes/neutral/src/neutralTheme.ts), [gothic/README.md](https://github.com/meta/astryx/blob/main/packages/themes/gothic/README.md)
- 설계 문서: [theme-tokens.md](https://github.com/meta/astryx/blob/main/docs/architecture/theme-tokens.md), [theme-application.md](https://github.com/meta/astryx/blob/main/docs/architecture/theme-application.md), [theme-authoring-contract.md](https://github.com/meta/astryx/blob/main/docs/architecture/theme-authoring-contract.md), [theme-compilation.md](https://github.com/meta/astryx/blob/main/docs/architecture/theme-compilation.md), [component-theming-surface.md](https://github.com/meta/astryx/blob/main/docs/architecture/component-theming-surface.md), [docs/themes/README.md](https://github.com/meta/astryx/blob/main/docs/themes/README.md)
- 명세: [AST-050 app themes](https://github.com/meta/astryx/blob/main/docs/specs/AST-050-app-themes/spec.md), [AST-102 typography](https://github.com/meta/astryx/blob/main/docs/specs/AST-102-typography-theme-owned/spec.md), [AST-108 theme motion](https://github.com/meta/astryx/blob/main/docs/specs/AST-108-theme-motion/spec.md)
- 디자인 기록: [color-emphasis.md](https://github.com/meta/astryx/blob/main/docs/design/color-emphasis.md), [elevation-hierarchy.md](https://github.com/meta/astryx/blob/main/docs/design/elevation-hierarchy.md)
- 사용자 문서: [theme](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/theme.doc.mjs), [use-a-theme](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/use-a-theme.doc.mjs), [author-a-theme](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/author-a-theme.doc.mjs), [color](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/color.doc.mjs), [elevation](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/elevation.doc.mjs), [shape](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/shape.doc.mjs), [spacing](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/spacing.doc.mjs), [icons](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/icons.doc.mjs), [motion](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/motion.doc.mjs), [browser-support](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/browser-support.doc.mjs)
- 토큰 참조와 테마 제작 안내: [tokens-color](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/tokens-color.doc.mjs), [tokens-type-scale](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/tokens-type-scale.doc.mjs), [type-scale](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/type-scale.doc.mjs), [define-the-theme](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/define-the-theme.doc.mjs), [generate-a-palette](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/generate-a-palette.doc.mjs). 같은 폴더의 나머지 `tokens-*` 문서와 `add-a-theme`, `document-the-theme`, `use-a-theme-in-an-app`도 읽었습니다.
- 소스와 템플릿: [theme.template.ts](https://github.com/meta/astryx/blob/main/packages/cli/assets/theme.template.ts), [Theme.tsx](https://github.com/meta/astryx/blob/main/packages/core/src/theme/Theme.tsx), [Theme.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/theme/Theme.doc.mjs), [MediaTheme.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/theme/MediaTheme.doc.mjs)
- MDN: [light-dark()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark), [color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme), [@scope](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope)
