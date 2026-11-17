-- "개발 이야기" 10편 (2025-12 ~ 2026-11). 여러 번 실행해도 결과가 같다.
-- 대표 이미지는 사이트에 함께 배포된 public/img/covers/<slug>.png 를 쓴다.
insert into public.blog_posts (slug, title, summary, tags, cover_url, body_markdown, published_at)
values
  ('korean-search-chosung', '한글 검색은 왜 이렇게 어려울까 (초성 검색)', '검색창에 ㄱㅊ만 쳐도 김치찌개가 나오게 하려면 한글 음절이 유니코드 안에서 어떻게 생겼는지부터 알아야 합니다.', array['JavaScript', 'Web API']::text[], 'https://2rangs.github.io/img/covers/korean-search-chosung.png', $dev$
연락처 앱에서 "ㄱㅇㄹ"만 쳐도 "김이랑"이 나옵니다.
너무 익숙해서 당연한 기능 같거든요.
그런데 막상 직접 만들려고 하면 손이 멈춥니다.
`'김이랑'.includes('ㄱ')`는 `false`니까요.

오늘은 한글 검색이 왜 까다로운지, 그리고 초성 검색을 어떻게 만드는지 정리해 보겠습니다.

## 한글 음절은 계산으로 만들어집니다

유니코드에는 완성된 한글 음절이 `U+AC00`(가)부터 `U+D7A3`(힣)까지 들어 있습니다.
모두 11,172자입니다.
이 순서는 아무렇게나 정해진 게 아닙니다.

한글 음절은 초성, 중성, 종성의 조합입니다.
초성은 19개, 중성은 21개, 종성은 "없음"을 포함해 28개입니다.
유니코드 표준은 이 조합을 순서대로 늘어놓았습니다.

- 음절 코드 = `0xAC00 + (초성 × 21 + 중성) × 28 + 종성`
- 19 × 21 × 28 = 11,172

그래서 거꾸로 계산하면 자모를 꺼낼 수 있습니다.
중성과 종성 조합이 21 × 28 = 588가지라서, 588로 나누면 초성 번호가 나옵니다.

```js
function decompose(ch) {
  const code = ch.codePointAt(0) - 0xAC00;
  if (code < 0 || code >= 11172) return null; // 완성형 한글이 아님

  return {
    cho: Math.floor(code / 588),         // 0 ~ 18
    jung: Math.floor((code % 588) / 28), // 0 ~ 20
    jong: code % 28,                     // 0 ~ 27, 0이면 받침 없음
  };
}

decompose('각'); // { cho: 0, jung: 0, jong: 1 }
decompose('힣'); // { cho: 18, jung: 20, jong: 27 }
```

`'각'`은 초성 ㄱ(0), 중성 ㅏ(0), 종성 ㄱ(1)입니다.
마지막 글자 `'힣'`은 각각 마지막 번호인 18, 20, 27이 나옵니다.
계산이 맞다는 뜻이죠.

## 초성만 뽑아 보기

초성 번호를 글자로 바꾸려면 표가 하나 필요합니다.
여기서 쓰는 `ㄱ`, `ㄴ` 같은 글자는 우리가 키보드로 치는 "호환용 자모"입니다.
유니코드 순서대로 19개를 적어 두면 됩니다.

```js
const CHO = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

function getChosung(str) {
  let result = '';
  for (const ch of str) {
    const code = ch.codePointAt(0) - 0xAC00;
    result += code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : ch;
  }
  return result;
}

getChosung('김이랑');      // 'ㄱㅇㄹ'
getChosung('React 훅');   // 'React ㅎ'
```

한글이 아닌 글자는 그대로 둡니다.
그래야 영어나 숫자가 섞인 이름도 자연스럽게 검색됩니다.

## 섞어서 쳐도 찾아 주기

사람들은 "ㄱㅊ"처럼 초성만 치기도 하고, "김ㅊ"처럼 섞어 치기도 합니다.
그래서 글자 하나씩 비교하는 편이 편합니다.
입력한 글자가 초성이면 대상 글자의 초성과, 아니면 글자 자체와 비교합니다.

```js
const isCho = (c) => CHO.includes(c);

function matches(target, query) {
  const t = [...target];
  const q = [...query];

  for (let start = 0; start + q.length <= t.length; start++) {
    const ok = q.every((c, i) =>
      isCho(c) ? getChosung(t[start + i]) === c : t[start + i] === c
    );
    if (ok) return true;
  }
  return false;
}

matches('김치찌개', 'ㄱㅊ'); // true
matches('김치찌개', '김ㅊ'); // true
matches('된장찌개', '김ㅊ'); // false
```

목록이 수천 개라면 매번 계산하지 말고, 초성 문자열을 미리 만들어 두는 게 좋습니다.
저도 처음엔 키 입력마다 전부 다시 계산했다가 입력이 버벅여서 고생했습니다.

## 같은 글자인데 비교가 안 될 때

여기까지 하면 끝일 것 같지만, 함정이 하나 더 있습니다.
화면에서는 똑같이 "한글"인데 `===`가 `false`인 경우가 있거든요.

유니코드에서 한글은 두 가지로 적을 수 있습니다.
"한"을 한 글자로 적는 완성형과, ㅎ·ㅏ·ㄴ 세 개의 자모를 이어 적는 조합형입니다.
보이는 건 같지만 들어 있는 코드는 다릅니다.

이럴 때 쓰는 게 `String.prototype.normalize()`입니다.
`'NFC'`는 분해한 뒤 다시 합치고, `'NFD'`는 분해만 합니다.
인자를 생략하면 `'NFC'`가 쓰입니다.

```js
const nfd = '한글'.normalize('NFD');

nfd.length;                      // 6 (자모 6개)
'한글'.length;                   // 2
nfd === '한글';                  // false
nfd.normalize('NFC') === '한글'; // true
```

조합형으로 들어온 글자는 `0xAC00` 계산식에 걸리지 않습니다.
그래서 검색 전에 대상과 입력을 모두 `normalize()`로 맞춰 두는 게 안전합니다.
파일 이름이나 다른 시스템에서 넘어온 텍스트를 다룰 때 특히 그렇습니다.

> **참고** 위 `matches` 예시는 이해를 돕기 위한 단순한 버전입니다. 쌍자음 받침이나 "갑ㅅ"처럼 받침이 다음 초성으로 넘어가는 입력까지 처리하려면 종성을 다시 쪼개는 규칙이 더 필요합니다.

## 정리

한글 초성 검색의 핵심은 `0xAC00`과 588, 28 세 숫자입니다.
여기에 `normalize()`로 형태를 맞춰 주면 대부분의 경우를 다룰 수 있습니다.
생각보다 계산 몇 줄이면 되니, 한 번 직접 만들어 보시는 건 어떨까요?

## 참고

- [Unicode Standard, Chapter 3.12 Conjoining Jamo Behavior](https://www.unicode.org/versions/latest/core-spec/chapter-3/)
- [MDN, String.prototype.normalize()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize)
- [MDN, String.prototype.codePointAt()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt)
$dev$, '2025-12-08T09:00:00+09:00'::timestamptz),
  ('web-font-flash', '웹폰트는 왜 늦게 뜰까 (font-display와 서브셋)', '페이지를 열면 글자가 안 보이거나 갑자기 바뀌는 이유와, font-display, preload, 서브셋으로 줄이는 방법을 정리했습니다.', array['CSS', '웹 성능']::text[], 'https://2rangs.github.io/img/covers/web-font-flash.png', $dev$
새로 만든 페이지를 열었습니다.
레이아웃은 다 떴는데 글자만 안 보입니다.
잠시 뒤 글자가 "톡" 하고 나타납니다.
반대로 기본 글꼴로 먼저 보였다가 갑자기 모양이 바뀌는 경우도 있죠.

둘 다 웹폰트가 아직 도착하지 않아서 생기는 일입니다.
흔히 앞의 경우를 FOIT(Flash of Invisible Text), 뒤의 경우를 FOUT(Flash of Unstyled Text)라고 부릅니다.

## 브라우저는 폰트를 기다려 줍니다

브라우저는 웹폰트를 쓰는 글자를 만나면 폰트를 내려받기 시작합니다.
이때부터 타이머가 돕니다.
MDN은 이 시간을 세 구간으로 설명합니다.

- **block 구간**: 폰트가 아직 없으면 글자를 *보이지 않는* 대체 글꼴로 그립니다.
- **swap 구간**: 폰트가 아직 없으면 보이는 대체 글꼴로 그립니다. 그사이 폰트가 오면 바꿔 끼웁니다.
- **failure 구간**: 폰트를 포기하고 대체 글꼴을 계속 씁니다.

block 구간이 FOIT, swap 구간에서 바뀌는 순간이 FOUT인 셈입니다.
web.dev에 따르면 Chromium 계열과 Firefox는 기본적으로 최대 3초까지 글자를 숨기고, Safari는 무기한 숨깁니다.
폰트가 무거우면 빈 화면을 오래 보게 되는 거죠.

## font-display로 기다리는 방식 고르기

`@font-face` 안의 `font-display`로 이 구간 길이를 정할 수 있습니다.

| 값 | block 구간 | swap 구간 |
|---|---|---|
| `auto` | 브라우저가 정함 | 브라우저가 정함 |
| `block` | 짧음 | 무한 |
| `swap` | 아주 짧음 | 무한 |
| `fallback` | 아주 짧음 | 짧음 |
| `optional` | 아주 짧음 | 없음 |

MDN은 정확한 밀리초 대신 "짧음", "아주 짧음" 정도로만 설명합니다. 실제 길이는 브라우저마다 다를 수 있습니다.

```css
@font-face {
  font-family: "MyFont";
  src: url("/fonts/my-font.woff2") format("woff2");
  font-weight: 400;
  font-display: swap;
}
```

본문처럼 빨리 읽혀야 하는 글자는 `swap`이 무난합니다.
글자는 바로 보이지만, 나중에 폰트가 바뀌면서 레이아웃이 살짝 흔들릴 수 있습니다.
흔들림이 싫다면 `optional`도 있습니다.
폰트가 늦게 오면 이번 방문에서는 그냥 기본 글꼴로 갑니다.
web.dev는 성능만 보면 `optional`을 권하고, 로고처럼 꼭 그 폰트여야 하는 곳엔 `swap`을 섞어 쓰는 방법도 소개합니다.

## preload로 일찍 부르기

폰트는 CSS를 읽고, 그 폰트를 쓰는 글자를 발견한 뒤에야 요청됩니다.
꽤 늦게 출발하는 셈이죠.
꼭 필요한 폰트 하나는 `<link rel="preload">`로 미리 부를 수 있습니다.

```html
<link
  rel="preload"
  href="/fonts/my-font.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>
```

여기서 `crossorigin`을 빼먹기 쉽습니다.
MDN에 따르면 폰트는 같은 출처여도 익명 CORS 모드로 가져오기 때문에, preload에도 `crossorigin`을 붙여야 나중 요청과 짝이 맞습니다.
짝이 안 맞으면 미리 받아 둔 파일을 제대로 써먹지 못할 수 있습니다.
저도 이 속성 하나 빼먹고 "preload 했는데 왜 그대로지?" 하며 반나절을 날린 적이 있습니다.

다만 preload는 다른 리소스와 대역폭을 나눠 씁니다.
여러 개를 걸면 오히려 느려질 수 있으니 정말 첫 화면에 필요한 것만 고르는 게 좋습니다.

## 한글 폰트가 유독 무거운 이유

web.dev에 따르면 라틴 폰트는 보통 글리프가 100~1,000개 정도인데, CJK 폰트는 10,000자가 넘기도 합니다.
한글 완성형 음절만 해도 11,172자니까요.
그래서 한글 폰트는 같은 굵기 하나만 해도 파일이 큽니다.

가장 먼저 할 일은 WOFF2로 바꾸는 것입니다.
web.dev는 WOFF2가 WOFF보다 30% 정도 더 잘 압축된다고 설명합니다.

그다음은 **서브셋**입니다.
안 쓰는 글자를 빼서 파일을 줄이는 방법이죠.
자주 쓰는 한글 음절만 남기거나, 사이트에서 실제로 쓰는 글자만 남길 수 있습니다.
폰트 라이선스가 서브셋을 허용하는지는 꼭 먼저 확인해야 합니다.

## unicode-range로 쪼개서 필요한 만큼만

서브셋을 한 단계 더 밀고 나가면, 폰트를 여러 조각으로 나누고 조각마다 `unicode-range`를 붙이는 방법이 있습니다.
흔히 동적 서브셋이라고 부릅니다.

```css
@font-face {
  font-family: "MyFont";
  src: url("/fonts/my-font.latin.woff2") format("woff2");
  unicode-range: U+0000-00FF;
  font-display: swap;
}

@font-face {
  font-family: "MyFont";
  src: url("/fonts/my-font.hangul-1.woff2") format("woff2");
  unicode-range: U+AC00-B9FF;
  font-display: swap;
}

@font-face {
  font-family: "MyFont";
  src: url("/fonts/my-font.hangul-2.woff2") format("woff2");
  unicode-range: U+BA00-D7A3;
  font-display: swap;
}
```

MDN에 따르면 페이지에 그 범위의 글자가 하나도 없으면 해당 파일은 받지 않습니다.
한 글자라도 있으면 그 조각 전체를 받습니다.
그래서 조각을 잘게 나눌수록 실제로 쓰는 만큼에 가깝게 받게 됩니다.
위 예시는 이해를 위해 범위를 크게 나눴고, 실제로는 자주 쓰는 글자 순서로 더 잘게 나누는 경우가 많습니다.

> **참고** web.dev에 따르면 preload는 `unicode-range`를 무시하고 지정한 파일을 그대로 받습니다. 조각 폰트를 쓴다면 preload는 꼭 필요한 한두 개에만 거는 게 좋습니다.

## 정리

웹폰트가 늦게 뜨는 건 대부분 "파일이 크고, 늦게 출발해서"입니다.
`font-display`로 기다리는 방식을 정하고, preload로 일찍 출발시키고, 서브셋으로 짐을 줄이면 됩니다.
한글 사이트라면 마지막 단계의 효과가 특히 크더라고요.

## 참고

- [MDN, font-display](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display)
- [MDN, unicode-range](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range)
- [MDN, rel=preload](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/preload)
- [web.dev, Best practices for fonts](https://web.dev/articles/font-best-practices)
$dev$, '2026-01-26T09:00:00+09:00'::timestamptz),
  ('dark-mode-flash', '다크 모드인데 하얀 화면이 번쩍이는 이유', '다크 모드로 설정했는데 새로고침할 때마다 화면이 한 번 하얗게 번쩍인다면, 테마를 너무 늦게 정하고 있는 겁니다.', array['CSS', 'JavaScript']::text[], 'https://2rangs.github.io/img/covers/dark-mode-flash.png', $dev$
밤에 불 끄고 블로그를 엽니다.
다크 모드로 설정해 뒀으니 안심하고 있었는데, 새로고침하는 순간 화면이 하얗게 번쩍입니다.
눈이 꽤 아픕니다.
그러고 나서야 어두운 화면으로 바뀌죠.

다크 모드를 직접 붙여 본 분이라면 한 번쯤 겪어 보셨을 거예요.
원인은 생각보다 단순합니다.
**테마를 정하는 시점이 첫 화면을 그린 뒤**라서 그렇습니다.

## 브라우저는 기다려 주지 않습니다

브라우저는 HTML을 받으면 위에서부터 읽으면서 최대한 빨리 화면을 그립니다.
그런데 흔히 테마를 이렇게 정합니다.

```js
// 앱 번들 안 어딘가
useEffect(() => {
  const saved = localStorage.getItem('theme');
  document.documentElement.dataset.theme = saved ?? 'light';
}, []);
```

이 코드는 번들을 받고, 실행하고, 컴포넌트가 화면에 붙은 다음에야 돕니다.
그사이 브라우저는 이미 기본 테마, 보통은 밝은 화면으로 한 번 그려 버립니다.
그게 바로 번쩍임입니다.

해결 방향은 하나입니다.
**첫 페인트 전에 테마를 정하는 것**이죠.

## head에 아주 짧은 스크립트 하나

MDN에 따르면 `async`나 `defer`가 없는 일반 `<script>`는 실행이 끝날 때까지 HTML 읽기를 멈춥니다.
보통은 성능 때문에 피하는 성질인데, 여기서는 이게 오히려 도움이 됩니다.
본문을 그리기 전에 테마를 확실히 정할 수 있으니까요.

```html
<head>
  <script>
    (function () {
      var theme = 'light';
      try {
        var saved = localStorage.getItem('theme');
        if (saved === 'light' || saved === 'dark') {
          theme = saved;
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          theme = 'dark';
        }
      } catch (e) {}
      document.documentElement.dataset.theme = theme;
    })();
  </script>
  <link rel="stylesheet" href="/styles.css" />
</head>
```

순서는 이렇습니다.

- 사용자가 직접 고른 값이 있으면 그걸 씁니다.
- 없으면 운영체제 설정(`prefers-color-scheme`)을 따릅니다.
- 그것도 안 되면 밝은 테마로 갑니다.

`try`로 감싼 데는 이유가 있습니다.
MDN에 따르면 `localStorage`는 사용자가 저장을 막아 두었거나 `file:` 같은 출처에서는 `SecurityError`를 던질 수 있습니다.
이 스크립트가 터지면 테마가 아예 안 정해지니, 실패해도 기본값으로 넘어가게 해 둡니다.

이 스크립트는 번들에 넣지 말고 HTML에 직접 인라인으로 두는 게 핵심입니다.
외부 파일로 빼면 그 파일을 받는 시간만큼 또 늦어지거든요.
그래서 몇 줄 안 되게 짧게 유지합니다.

## CSS는 data-theme만 보면 됩니다

이제 CSS는 `<html>`의 속성만 보고 색을 고릅니다.

```css
:root {
  --bg: #ffffff;
  --fg: #1a1a1a;
  color-scheme: light;
}

:root[data-theme="dark"] {
  --bg: #121212;
  --fg: #eaeaea;
  color-scheme: dark;
}

body {
  background: var(--bg);
  color: var(--fg);
}
```

토글 버튼을 누를 때도 같은 속성을 바꾸고 저장만 하면 됩니다.

```js
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch (e) {}
}
```

## color-scheme도 같이 챙기기

위 CSS에 슬쩍 넣은 `color-scheme`도 중요합니다.
MDN에 따르면 이 속성은 캔버스 배경, 스크롤바, 폼 컨트롤 같은 브라우저 기본 UI의 색을 바꿉니다.
이걸 빼먹으면 페이지는 어두운데 스크롤바나 `<input>`만 하얗게 남는 일이 생깁니다.

HTML에도 같은 뜻을 미리 적어 둘 수 있습니다.

```html
<meta name="color-scheme" content="light dark" />
```

MDN은 이 태그를 CSS보다 앞, `<head>`에 넣어 두면 페이지를 불러올 때의 원치 않는 번쩍임을 막는 데 도움이 된다고 설명합니다.
`light dark`처럼 두 개를 적으면 앞의 것을 더 선호하지만 사용자가 원하면 뒤의 것도 괜찮다는 뜻입니다.

> **참고** 사용자가 운영체제 테마를 바꾸는 순간도 따라가고 싶다면 `matchMedia()`가 돌려주는 `MediaQueryList`의 `change` 이벤트를 들으면 됩니다. 다만 사용자가 직접 고른 값이 저장돼 있다면 그쪽을 우선하는 게 자연스럽습니다.

## 프레임워크를 써도 원리는 같습니다

React든 Vue든 서버에서 HTML을 만들든, 결국 브라우저가 받는 건 HTML 한 장입니다.
그 HTML의 `<head>`에 테마 스크립트가 먼저 들어 있기만 하면 됩니다.
프레임워크 쪽 상태는 그 뒤에 `<html>`의 `data-theme`을 읽어서 맞춰 주면 됩니다.

저도 처음엔 상태 관리 라이브러리에서 테마를 정하느라 이 번쩍임을 한참 못 잡았습니다.
결국 답은 `<head>`에 있는 열 줄짜리 스크립트였죠.

## 정리

하얀 번쩍임은 "테마를 너무 늦게 정해서" 생깁니다.
`<head>`의 짧은 인라인 스크립트로 먼저 정하고, `color-scheme`으로 브라우저 UI까지 맞춰 주면 됩니다.
밤에 블로그 읽는 분들 눈을 지켜 주는 작은 배려 아닐까요?

## 참고

- [MDN, script 요소](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script)
- [MDN, prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [MDN, color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
- [MDN, meta name="color-scheme"](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/color-scheme)
- [MDN, Window.matchMedia()](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)
- [MDN, Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
$dev$, '2026-02-23T09:00:00+09:00'::timestamptz),
  ('million-markers-on-map', '지도에 마커 10만 개를 찍으면 생기는 일', '마커 몇 개일 땐 멀쩡하던 지도가 데이터가 늘자 멈춰 버리는 이유와, 클러스터링과 WebGL 레이어로 푸는 방법을 정리했습니다.', array['지도', '웹 성능']::text[], 'https://2rangs.github.io/img/covers/million-markers-on-map.png', $dev$
지도에 매장 위치 몇십 개를 찍었습니다.
잘 됩니다.
그런데 데이터가 전국 단위로 늘어나자 이야기가 달라집니다.
지도를 끌면 뚝뚝 끊기고, 줌을 바꾸면 잠깐 멈춥니다.

왜 그럴까요? 대부분은 **마커를 그리는 방식** 때문입니다.

## 마커 하나가 DOM 요소 하나일 때

지도 라이브러리의 기본 마커는 보통 HTML 요소입니다.
MapLibre GL JS의 `Marker`도 `getElement()`로 꺼내 보면 `HTMLElement`가 나옵니다.

```js
import { Marker } from 'maplibre-gl';

stores.forEach((store) => {
  new Marker().setLngLat([store.lng, store.lat]).addTo(map);
});
```

몇십 개일 땐 CSS로 꾸미기도, 클릭 이벤트 붙이기도 아주 편합니다.

문제는 지도가 움직일 때입니다.
지도를 끌거나 줌할 때마다 모든 마커의 화면 위치를 다시 계산해서 옮겨야 합니다.
요소가 수만 개면 그 일을 매 프레임 수만 번 하는 셈이죠.
DOM 요소는 하나하나가 스타일과 레이아웃을 가진 무거운 객체라서, 개수가 늘수록 브라우저가 버거워합니다.

저도 처음엔 아이콘 용량부터 줄였는데, 문제는 이미지가 아니라 개수였습니다.

## 클러스터링으로 개수 줄이기

첫 번째 방법은 **보이는 개수를 줄이는 것**입니다.
멀리서 볼 때는 가까운 점들을 묶어서 "128" 같은 원 하나로 보여 주고, 확대하면 풀어 줍니다.
이걸 클러스터링이라고 합니다.

자바스크립트에서는 `supercluster` 라이브러리가 많이 쓰입니다.
GeoJSON 포인트 배열을 넣고, 지금 보이는 범위와 줌을 주면 묶인 결과를 돌려줍니다.

```js
import Supercluster from 'supercluster';

const index = new Supercluster({ radius: 40, maxZoom: 16 });
index.load(points); // GeoJSON Point Feature 배열

function render() {
  const b = map.getBounds();
  const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  const features = index.getClusters(bbox, Math.floor(map.getZoom()));

  // features 안에는 묶인 클러스터와 낱개 포인트가 섞여 있습니다.
  // 여기서 화면에 보일 몇백 개만 그리면 됩니다.
}

map.on('moveend', render);
```

README 기준으로 `radius` 기본값은 40(픽셀), `maxZoom` 기본값은 16입니다.
`getClusters`의 bbox는 `[서경, 남위, 동경, 북위]` 순서입니다.
한 번 `load()`한 인덱스는 바뀌지 않으니, 데이터가 바뀌면 새로 만들어야 합니다.

## 지도 엔진에 맡기는 방법

MapLibre를 쓴다면 굳이 따로 계산하지 않아도 됩니다.
GeoJSON 소스에 `cluster: true`만 주면 엔진이 직접 묶어 줍니다.
그리고 마커를 DOM이 아니라 **레이어**로 그립니다.

```js
map.addSource('stores', {
  type: 'geojson',
  data: '/stores.geojson',
  cluster: true,
  clusterRadius: 50,
  clusterMaxZoom: 14,
});

map.addLayer({
  id: 'clusters',
  type: 'circle',
  source: 'stores',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': '#3b82f6',
    'circle-radius': ['step', ['get', 'point_count'], 16, 100, 24, 1000, 32],
  },
});

map.addLayer({
  id: 'store-points',
  type: 'circle',
  source: 'stores',
  filter: ['!', ['has', 'point_count']],
  paint: { 'circle-color': '#ef4444', 'circle-radius': 5 },
});

map.on('click', 'clusters', async (e) => {
  const feature = e.features[0];
  const zoom = await map
    .getSource('stores')
    .getClusterExpansionZoom(feature.properties.cluster_id);
  map.easeTo({ center: feature.geometry.coordinates, zoom });
});
```

묶인 점에는 `point_count`, `cluster_id` 같은 속성이 붙습니다.
그래서 `filter`로 클러스터와 낱개를 나눠 그릴 수 있습니다.
최신 MapLibre에서는 `getClusterExpansionZoom`이 Promise를 돌려주니 `await`로 받으면 됩니다.

레이어로 그린 점은 DOM 요소가 아니라 지도와 같은 WebGL 캔버스에 그려집니다.
그래서 지도를 움직여도 요소를 하나하나 옮길 일이 없습니다.

## 묶지 않고 전부 보여 줘야 할 때

가끔은 클러스터링이 답이 아닐 때도 있습니다.
분포 자체를 보여 줘야 하는 시각화가 그렇죠.
이럴 땐 점을 GPU로 한꺼번에 그리는 방법을 씁니다.

`deck.gl`은 이런 대용량 시각화를 위한 WebGL 기반 라이브러리입니다.
MapLibre와 함께 쓸 때는 `@deck.gl/maplibre`의 `MapLibreOverlay`를 지도 컨트롤로 붙입니다.

```js
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { ScatterplotLayer } from '@deck.gl/layers';

const overlay = new MapLibreOverlay({
  interleaved: true,
  layers: [
    new ScatterplotLayer({
      id: 'stores',
      data: stores,
      getPosition: (d) => [d.lng, d.lat],
      getRadius: 4,
      radiusUnits: 'pixels',
      getFillColor: [239, 68, 68],
      pickable: true,
    }),
  ],
});

map.addControl(overlay);
```

`interleaved: true`면 deck.gl 레이어가 MapLibre의 WebGL 컨텍스트 안에서 함께 그려져서, 지도 라벨 아래에 끼워 넣을 수도 있습니다.
`pickable: true`를 주면 클릭이나 호버로 어떤 점인지 알아낼 수 있습니다.

> **참고** WebGL로 그리면 빨라지는 대신, 마커 안에 버튼이나 복잡한 HTML을 넣는 건 어려워집니다. 그런 정보는 클릭했을 때 팝업 하나로 보여 주는 편이 낫습니다.

## 무엇을 고를까

- 몇십~몇백 개, 마커마다 모양이 복잡함: DOM 마커
- 많지만 멀리서 묶여도 괜찮음: 클러스터링
- 많고 전부 보여야 함: WebGL 레이어

몇 개부터 느려지는지는 기기와 마커 모양마다 다르니, 직접 넣어 보고 성능 탭으로 확인하는 게 제일 확실합니다.

## 정리

지도가 느려지는 건 대부분 "점이 많아서"가 아니라 "점 하나하나를 DOM으로 그려서"입니다.
보이는 개수를 줄이거나, 그리는 방식을 바꾸면 됩니다.

## 참고

- [supercluster README](https://github.com/mapbox/supercluster)
- [MapLibre Style Spec, Sources](https://maplibre.org/maplibre-style-spec/sources/)
- [MapLibre GL JS, Create and style clusters](https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/)
- [MapLibre GL JS, GeoJSONSource](https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/)
- [MapLibre GL JS, Marker](https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/)
- [deck.gl, Using with MapLibre](https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre)
- [deck.gl, ScatterplotLayer](https://deck.gl/docs/api-reference/layers/scatterplot-layer)
$dev$, '2026-03-30T09:00:00+09:00'::timestamptz),
  ('canvas-svg-dom-boxes', '이미지 위에 박스 수천 개 그리기 (Canvas vs SVG vs DOM)', '이미지 위에 탐지 결과 박스를 그릴 때 DOM, SVG, Canvas 중 무엇을 고를지, 클릭 판정과 선명도까지 함께 정리했습니다.', array['Web API', '웹 성능']::text[], 'https://2rangs.github.io/img/covers/canvas-svg-dom-boxes.png', $dev$
사진 한 장 위에 사람, 자동차, 신호등을 표시하는 화면을 만든다고 해 보겠습니다.
객체 탐지 모델이 돌려준 결과를 네모 박스로 그리는 거죠.
박스가 열 개면 아무 방법이나 됩니다.
그런데 수천 개가 되면 고민이 시작됩니다.

웹에서 이런 박스를 그리는 방법은 크게 셋입니다.
DOM, SVG, Canvas.
하나씩 써 보면서 차이를 보겠습니다.

## DOM으로 그리기

가장 익숙한 방법입니다.
이미지를 감싼 요소를 `position: relative`로 두고, 박스마다 `div`를 절대 위치로 올립니다.

```html
<div class="stage">
  <img src="/photo.jpg" alt="" />
  <div class="box" style="left: 120px; top: 40px; width: 80px; height: 160px"></div>
</div>
```

```css
.stage { position: relative; display: inline-block; }
.box { position: absolute; border: 2px solid #ef4444; box-sizing: border-box; }
```

장점이 많습니다.
CSS로 꾸미기 쉽고, `:hover`도 되고, 라벨 텍스트도 그냥 넣으면 됩니다.
스크린 리더나 키보드 접근성도 챙기기 쉽습니다.

단점은 개수입니다.
요소 하나하나가 스타일과 레이아웃을 가지니, 수천 개를 한꺼번에 움직이거나 확대하면 버거워집니다.

## SVG로 그리기

SVG는 박스를 `<rect>`로 그립니다.
`viewBox`를 원본 이미지 크기로 맞추면, 탐지 결과 좌표를 그대로 넣을 수 있다는 게 큰 장점입니다.

```html
<svg viewBox="0 0 1920 1080" style="width: 100%; height: auto">
  <image href="/photo.jpg" width="1920" height="1080" />
  <rect x="120" y="40" width="80" height="160"
        fill="none" stroke="#ef4444" stroke-width="2"
        vector-effect="non-scaling-stroke" />
</svg>
```

화면 크기가 바뀌어도 좌표를 다시 계산할 필요가 없습니다.
`vector-effect="non-scaling-stroke"`를 주면 확대해도 선 두께가 그대로라 보기 좋습니다.
각 `<rect>`가 DOM 요소라 클릭 이벤트도 바로 붙습니다.

하지만 SVG 요소도 결국 DOM 요소입니다.
개수가 아주 많아지면 DOM 방식과 비슷한 부담이 생깁니다.

## Canvas로 그리기

Canvas는 요소가 아니라 픽셀을 그립니다.
박스가 몇 개든 화면에 있는 건 `<canvas>` 하나뿐입니다.

```js
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

function draw(boxes) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const b of boxes) {
    ctx.rect(b.x, b.y, b.w, b.h);
  }
  ctx.stroke();
}
```

모든 박스를 경로 하나에 모은 뒤 `stroke()`를 한 번만 부르는 게 요령입니다.
MDN의 캔버스 최적화 문서도 그리기 호출을 묶으라고 권합니다.
같은 문서에서 정수 좌표를 쓰고, `shadowBlur`는 되도록 피하라고도 합니다.

대신 잃는 것도 있습니다.
박스는 그냥 픽셀이라, 어떤 박스를 클릭했는지 브라우저가 알려 주지 않습니다.
접근성도 직접 챙겨야 합니다.

## 클릭한 박스 찾기

DOM과 SVG는 이벤트의 `target`이 곧 박스입니다.
Canvas는 직접 계산해야 합니다.
네모 박스라면 단순한 범위 비교로 충분합니다.

```js
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // 위에 그린 박스부터 확인
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      console.log('선택', b);
      break;
    }
  }
});
```

여기서 `boxes`의 좌표는 화면(CSS 픽셀) 기준이라고 가정했습니다.
원본 이미지 좌표라면 표시 크기에 맞게 비율을 곱해 줘야 합니다.

다각형처럼 모양이 복잡하면 `Path2D`와 `isPointInPath()`를 쓸 수 있습니다.
MDN에 따르면 `isPointInPath(path, x, y)`의 x, y는 컨텍스트의 현재 변환과 상관없는 좌표입니다.
즉 캔버스의 실제 픽셀 좌표를 넘겨야 합니다.
아래에서 볼 `devicePixelRatio`까지 곱해야 한다는 뜻이라, 여기서 한 번씩 헷갈리곤 합니다.

박스가 수만 개라 순회도 느리다면, 화면을 격자로 나눠 칸마다 박스 목록을 들고 있는 식으로 후보를 줄이면 됩니다.

## 흐릿한 캔버스와 devicePixelRatio

Canvas로 바꿨더니 선이 뿌옇게 보인다면 `devicePixelRatio` 문제일 가능성이 큽니다.
MDN에 따르면 이 값은 CSS 픽셀 하나에 실제 화면 픽셀이 몇 개 들어가는지를 나타냅니다.
고해상도 화면에서는 1보다 크죠.

그래서 캔버스의 내부 크기는 키우고, 보이는 크기는 CSS로 맞춥니다.

```js
function setupCanvas(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 이후 그리기는 CSS 픽셀 기준
  return ctx;
}
```

MDN 예시는 `ctx.scale(dpr, dpr)`를 씁니다.
여기서는 `setTransform`을 썼는데, 창 크기가 바뀌어 다시 호출해도 배율이 겹쳐 쌓이지 않아서입니다.

> **참고** 브라우저 창을 다른 모니터로 옮기거나 확대 비율을 바꾸면 `devicePixelRatio`도 바뀔 수 있습니다. 그럴 땐 캔버스를 다시 설정하고 다시 그려야 선명함이 유지됩니다.

## 무엇을 고를까

- 박스가 적고 라벨, 버튼, 접근성이 중요함: DOM
- 원본 좌표를 그대로 쓰고 싶고 개수가 적당함: SVG
- 박스가 아주 많거나 자주 다시 그림: Canvas

섞어 쓰는 것도 좋은 방법입니다.
박스 수천 개는 Canvas로 그리고, 선택한 박스 하나의 라벨과 버튼만 DOM으로 올리는 식이죠.
저는 이 조합이 가장 손이 덜 가더라고요.

## 정리

세 방식의 차이는 결국 "박스 하나가 요소인가, 픽셀인가"입니다.
요소는 편하지만 무겁고, 픽셀은 가볍지만 할 일이 늘어납니다.
데이터 양을 보고 고르면 됩니다.

## 참고

- [MDN, Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [MDN, Window.devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
- [MDN, CanvasRenderingContext2D.isPointInPath()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInPath)
- [MDN, vector-effect](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/vector-effect)
$dev$, '2026-04-27T09:00:00+09:00'::timestamptz),
  ('works-on-my-machine-node', '같은 코드인데 내 컴퓨터에서만 되는 이유', 'lockfile, npm ci, Node 버전 고정으로 "제 컴퓨터에선 되는데요"를 줄이는 방법을 정리했습니다.', array['JavaScript', '협업']::text[], 'https://2rangs.github.io/img/covers/works-on-my-machine-node.png', $dev$
"제 컴퓨터에선 잘 되는데요?"

개발하다 보면 한 번쯤 해 본 말이고, 한 번쯤 들어 본 말입니다. 같은 저장소를 받았는데 동료 컴퓨터에서는 빌드가 깨집니다. CI에서만 테스트가 떨어지기도 하고요.

코드는 똑같은데 왜 결과가 다를까요? 대부분은 코드가 아니라 **코드를 둘러싼 환경**이 달라서입니다. 오늘은 그 환경을 맞추는 방법을 하나씩 보겠습니다.

## 범위로 적은 버전

`package.json`의 의존성은 보통 이렇게 적혀 있습니다.

```json
{
  "dependencies": {
    "react": "^19.2.0"
  }
}
```

`^19.2.0`은 "19.2.0 이상, 20 미만이면 아무거나"라는 뜻입니다. 정확한 버전이 아니라 범위예요.

그래서 제가 지난달에 설치한 버전과 동료가 오늘 설치한 버전이 다를 수 있습니다. 직접 쓰는 패키지만 그런 게 아닙니다. 그 패키지가 쓰는 패키지, 또 그 아래 패키지까지 전부 범위로 풀립니다. 어디선가 작은 버전 하나만 달라져도 결과가 달라질 수 있는 거죠.

## lockfile이 하는 일

이 문제를 막으려고 있는 게 `package-lock.json`입니다.

npm 공식 문서에 따르면 이 파일은 실제로 만들어진 의존성 트리를 그대로 기록합니다. 그래서 다음 설치 때도 같은 트리를 만들 수 있어요. 문서에서도 **저장소에 커밋하라고** 안내합니다.

가끔 lockfile이 길고 충돌도 잘 나서 `.gitignore`에 넣는 경우를 봅니다. 저도 예전에 그랬습니다. 그런데 그러면 팀원마다 다른 트리를 받게 되니, 문제를 스스로 만드는 셈이더라고요.

lockfile 충돌이 나면 손으로 고치기보다 `package.json`을 먼저 정리하고 `npm install`로 다시 만드는 편이 안전합니다.

## npm install 대신 npm ci

lockfile이 있어도 `npm install`은 상황에 따라 lockfile을 **고쳐 씁니다.** `package.json`과 lockfile이 어긋나 있으면 맞추려고 하거든요.

CI나 배포처럼 "기록된 그대로만 설치해 줘"가 필요한 곳에서는 `npm ci`를 씁니다. 공식 문서에 적힌 차이는 이렇습니다.

- `package-lock.json`(또는 `npm-shrinkwrap.json`)이 꼭 있어야 합니다.
- lockfile과 `package.json`이 맞지 않으면 lockfile을 고치지 않고 **에러로 끝냅니다.**
- `node_modules`가 이미 있으면 지우고 처음부터 설치합니다.
- `package.json`이나 lockfile을 절대 쓰지 않습니다.
- 패키지 하나만 추가하는 용도로는 쓸 수 없습니다.

```bash
# CI나 배포에서
npm ci

# 새 패키지를 추가할 때는 평소처럼
npm install dayjs
```

에러로 끝난다는 점이 오히려 장점입니다. 누군가 `package.json`만 고치고 lockfile을 커밋하지 않았다면 CI에서 바로 드러나니까요.

> **참고** lockfile을 만들 때 `--legacy-peer-deps` 같은 플래그를 썼다면 `npm ci`에도 같은 플래그가 필요하다고 공식 문서에 적혀 있습니다. 프로젝트의 `.npmrc`에 설정을 넣고 커밋해 두면 실수가 줄어요.

## Node 버전도 맞추기

패키지 버전을 맞춰도 Node 버전이 다르면 또 어긋납니다. 저는 Node 메이저 버전이 달라서 네이티브 모듈 빌드가 깨지는 바람에 반나절을 날린 적이 있습니다.

가장 흔한 방법은 프로젝트 루트에 `.nvmrc`를 두는 겁니다.

```bash
echo "24" > .nvmrc
nvm use
```

nvm 문서에 따르면 버전을 따로 주지 않으면 `nvm use`, `nvm install`이 이 파일을 읽습니다. 숫자 대신 `lts/*` 같은 별칭도 쓸 수 있고요.

GitHub Actions의 `actions/setup-node`도 이 파일을 읽을 수 있습니다.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-node@v7
    with:
      node-version-file: '.nvmrc'
  - run: npm ci
  - run: npm test
```

이렇게 하면 로컬과 CI가 같은 파일을 보고 버전을 정합니다. 버전을 두 군데에 따로 적지 않아도 돼요.

## engines와 devEngines

`package.json`에도 버전을 적을 수 있습니다. 다만 두 필드의 성격이 꽤 다릅니다.

`engines`는 문서상 **권고**에 가깝습니다. `engine-strict` 설정을 켜지 않으면 경고만 하고, 그것도 주로 이 패키지가 다른 프로젝트의 의존성으로 설치될 때 의미가 있어요. 라이브러리를 배포할 때 쓰는 필드라고 보면 됩니다.

팀 안에서 개발 환경을 맞추고 싶다면 `devEngines`가 목적에 더 맞습니다. 이 필드는 `install`, `ci`, `run` 전에 검사하고, `onFail`을 적지 않으면 에러로 처리합니다.

```json
{
  "devEngines": {
    "runtime": {
      "name": "node",
      "version": ">=24",
      "onFail": "error"
    },
    "packageManager": {
      "name": "npm",
      "onFail": "error"
    }
  }
}
```

비교적 최근에 생긴 필드라서, 팀이 쓰는 npm 버전이 지원하는지 먼저 확인해 보시길 권합니다.

## 패키지 매니저와 corepack

npm, pnpm, Yarn이 섞이면 lockfile 자체가 달라집니다. 한 명은 `pnpm-lock.yaml`, 한 명은 `package-lock.json`을 만들면 곤란하죠.

이럴 때 `packageManager` 필드와 Corepack을 같이 씁니다.

```json
{
  "packageManager": "pnpm@9.15.0"
}
```

Corepack은 이 필드를 보고 정해진 버전의 pnpm이나 Yarn을 대신 실행해 줍니다. 버전 뒤에 해시를 붙여 검증할 수도 있어요.

다만 상태가 조금 복잡합니다. Corepack 공식 문서에 따르면 Node.js 14.19.0부터 25.0.0 이전까지만 기본으로 함께 배포됩니다. Node.js 문서에서도 실험적 기능으로 표시돼 있고, v25부터는 빠진다고 안내하고 있어요. 그 이후 버전에서는 `npm install -g corepack`으로 따로 설치해야 합니다.

```bash
# Node 25 이상이라면 먼저 설치
npm install -g corepack

corepack enable
```

## 정리

- lockfile은 커밋합니다.
- CI와 배포에서는 `npm ci`를 씁니다.
- Node 버전은 `.nvmrc` 같은 파일 하나로 정하고 CI도 그 파일을 읽게 합니다.
- 팀의 도구 버전은 `devEngines`나 `packageManager`로 적어 둡니다.

"제 컴퓨터에선 되는데요"는 사실 "제 환경에선 되는데요"라는 뜻이었던 것 같습니다. 환경을 파일로 남겨 두면 그 말을 할 일이 확실히 줄어듭니다.

## 참고

- [npm ci | npm Docs](https://docs.npmjs.com/cli/v11/commands/npm-ci)
- [package-lock.json | npm Docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json)
- [package.json (engines, devEngines) | npm Docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)
- [config (engine-strict) | npm Docs](https://docs.npmjs.com/cli/v11/using-npm/config)
- [nvm README (.nvmrc)](https://github.com/nvm-sh/nvm#nvmrc)
- [actions/setup-node](https://github.com/actions/setup-node)
- [Corepack | Node.js Documentation](https://nodejs.org/docs/latest-v24.x/api/corepack.html)
- [nodejs/corepack](https://github.com/nodejs/corepack)
$dev$, '2026-06-22T09:00:00+09:00'::timestamptz),
  ('url-fragment-scroll', '주소에 #을 붙이면 왜 그 위치로 갈까', 'URL fragment가 스크롤을 만드는 원리와 고정 헤더, 텍스트 프래그먼트, SPA에서 해시 스크롤이 안 되는 이유를 다룹니다.', array['CSS', 'Web API']::text[], 'https://2rangs.github.io/img/covers/url-fragment-scroll.png', $dev$
문서 사이트에서 목차를 누르면 그 제목으로 휙 내려갑니다. 주소창 끝에는 `#설치-방법` 같은 게 붙어 있고요.

그런데 직접 만든 사이트에서는 이게 잘 안 될 때가 있습니다. 제목이 고정 헤더 밑에 숨기도 하고, 아예 맨 위에 멈춰 있기도 하죠. 오늘은 `#`이 어떻게 동작하는지부터 차근차근 보겠습니다.

## #부터는 서버로 가지 않습니다

주소에서 `#` 뒤쪽을 fragment라고 부릅니다.

```text
https://example.com/docs/guide?lang=ko#install
```

MDN에 따르면 fragment는 **서버로 보내지 않습니다.** 브라우저가 문서를 받은 다음 스스로 처리하는 부분이에요. 서버 입장에서는 `/docs/guide?lang=ko`만 요청받은 겁니다.

HTML 문서에서 브라우저는 fragment와 같은 `id`를 가진 요소를 찾아 그 위치로 스크롤합니다.

```html
<h2 id="install">설치 방법</h2>
```

`#install`로 들어오면 이 제목이 화면 맨 위로 옵니다. 이 요소를 **타깃 요소**라고 부릅니다.

> **참고** `#top`이나 빈 `#`은 페이지 맨 위로 가는 링크로 HTML 표준에 정해져 있습니다. 그래서 "맨 위로" 버튼은 `href="#top"`만으로도 충분해요.

## 고정 헤더에 가려질 때

상단에 `position: fixed` 헤더가 있으면 문제가 생깁니다. 브라우저는 제목을 화면 맨 위에 맞추는데, 그 자리를 헤더가 덮고 있거든요.

예전에는 제목 위에 빈 요소를 하나 더 두는 방법을 많이 썼습니다. 지금은 CSS 한 줄이면 됩니다.

```css
h2,
h3 {
  scroll-margin-top: 72px;
}
```

`scroll-margin-top`은 요소를 화면 안으로 스크롤할 때 위쪽에 여백을 둡니다. 원래 CSS Scroll Snap 명세에 속한 속성이에요. 그런데 명세에서 스냅과 상관없이 요소를 화면 안으로 데려오는 동작(scroll-into-view)에도 쓰인다고 정하고 있습니다.

반대로 스크롤 컨테이너 쪽에 한 번만 주는 방법도 있습니다.

```css
html {
  scroll-padding-top: 72px;
}
```

`scroll-padding-top`은 "화면 위쪽 72px은 가려져 있으니 그 아래를 기준으로 보여 줘"라는 뜻입니다. 헤더 높이가 하나로 정해져 있다면 이쪽이 더 간단합니다.

## :target으로 표시하기

어디로 왔는지 눈에 보이면 더 친절하겠죠. `:target` 가상 클래스는 지금 fragment가 가리키는 요소를 고릅니다.

```css
:target {
  background: var(--color-bg-highlight);
  border-radius: 4px;
}
```

한 가지 함정이 있습니다. MDN에 따르면 타깃 요소는 문서를 불러올 때와 `history.back()`, `forward()`, `go()` 때 정해집니다. 하지만 `history.pushState()`나 `replaceState()`로 주소를 바꿀 때는 **바뀌지 않아요.** 라우터가 `pushState`로 주소를 바꾸면 `:target`은 그대로 남아 있습니다.

## 아이디 없이 문장으로 가기

남의 문서에는 내가 원하는 `id`가 없을 때가 많습니다. 이럴 때 쓰는 게 텍스트 프래그먼트입니다.

```text
https://example.com/docs#:~:text=설치%20방법
```

`#:~:text=` 뒤에 찾을 문장을 적으면, 지원하는 브라우저는 그 문장으로 스크롤하고 강조해 줍니다. MDN에 정리된 규칙을 몇 가지 옮기면 이렇습니다.

- 문자열은 퍼센트 인코딩합니다. 공백은 `%20`이 되고, `-`도 인코딩하라고 명세에 적혀 있어요.
- 대소문자는 구분하지 않습니다.
- `text=시작,끝`으로 범위를, `앞-,문장,-뒤`로 앞뒤 문맥을 지정할 수 있습니다.
- 맞는 문장이 없거나 지원하지 않는 브라우저라면 그냥 문서 맨 위가 열립니다.

강조 모양은 `::target-text`로 바꿀 수 있습니다. 지원 여부는 `document.fragmentDirective`가 있는지로 확인할 수 있고요. 브라우저별 지원 현황은 계속 바뀌니 MDN 호환성 표를 직접 보시는 게 좋습니다.

재밌는 점은 `:~:` 뒤쪽이 페이지를 불러오면서 **주소에서 빠진다**는 겁니다. 그래서 페이지 스크립트의 `location.hash`로는 읽을 수 없습니다.

## SPA에서 해시 스크롤이 안 되는 이유

이제 처음 질문으로 돌아가 보겠습니다. React나 Vue로 만든 사이트에서 `#install`로 들어왔는데 맨 위에 멈춰 있다면, 대부분 순서 문제입니다.

1. 브라우저가 HTML을 받습니다. 안에는 빈 `<div id="root">`만 있습니다.
2. 브라우저는 HTML을 읽는 동안 `id="install"`을 찾아봅니다. 아직 없습니다.
3. 자바스크립트가 실행되고, 데이터를 받아 와서 글을 그립니다.
4. 이제 제목이 생겼지만, HTML 파싱이 끝난 뒤라 브라우저는 더 찾지 않습니다.

HTML 표준을 보면 브라우저는 파서가 문서를 다 읽고 나면 fragment 찾기를 멈춥니다. 글 내용을 API로 받아 오는 블로그라면 거의 항상 이렇게 돼요. 저도 처음엔 이것 때문에 꽤 헤맸습니다.

해결은 간단합니다. 내용을 다 그린 다음 직접 스크롤해 주면 됩니다.

```ts
export function scrollToHash() {
  const raw = location.hash.slice(1);
  if (!raw) return;

  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // 잘못된 인코딩이면 원래 값을 그대로 씁니다
  }

  document.getElementById(id)?.scrollIntoView();
}
```

`decodeURIComponent`를 꼭 거쳐야 합니다. 한글 아이디는 `location.hash`에서 `%EC%84%A4...`처럼 인코딩된 상태로 들어오거든요.

React라면 데이터를 받은 뒤에 부르면 됩니다.

```tsx
useEffect(() => {
  if (post) scrollToHash();
}, [post]);
```

`scrollIntoView()`도 scroll-into-view 동작이라 앞에서 준 `scroll-margin-top`이 그대로 적용됩니다.

라우터가 해시를 경로로 쓰는 경우도 조심해야 합니다. `/#/posts/1` 같은 해시 라우터에서는 `#` 자리를 라우터가 차지하고 있어서, 문서 안 이동용 fragment와 겹칩니다. 목차 링크가 많은 사이트라면 해시 라우터는 피하는 편이 마음 편합니다.

## 정리

`#`은 서버가 아니라 브라우저의 일입니다. 브라우저는 문서를 읽는 동안만 찾아보고 끝내요. 그래서 내용을 나중에 그리는 SPA에서는 "다 그렸으니 이제 찾아봐"를 직접 말해 줘야 합니다.

## 참고

- [URI fragment | MDN](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment)
- [Text fragments | MDN](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment/Text_fragments)
- [:target | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:target)
- [scroll-margin-top | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-margin-top)
- [scroll-padding-top | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-padding-top)
- [Element.scrollIntoView() | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView)
- [CSS Scroll Snap Module Level 1](https://drafts.csswg.org/css-scroll-snap-1/)
- [HTML Standard, scrolling to a fragment](https://html.spec.whatwg.org/multipage/browsing-the-web.html#scrolling-to-a-fragment)
- [Text Fragments | web.dev](https://web.dev/articles/text-fragments)
$dev$, '2026-07-27T09:00:00+09:00'::timestamptz),
  ('color-token-naming', '색 이름을 blue-500 대신 primary로 지어야 하는 이유', '원시 토큰과 의미 토큰을 나누면 다크 모드와 리브랜딩이 쉬워집니다. CSS 변수로 직접 만들어 봅니다.', array['CSS', '디자인 시스템']::text[], 'https://2rangs.github.io/img/covers/color-token-naming.png', $dev$
어느 날 디자이너가 말합니다. "브랜드 색을 파란색에서 초록색으로 바꾸기로 했어요."

코드를 검색해 봅니다. `--blue-500`이 300군데에 나옵니다. 그런데 전부 바꾸면 안 됩니다. 그중 일부는 브랜드 색이 아니라 그냥 "정보" 표시용 파란색이거든요. 하나하나 열어서 이게 어떤 파란색인지 확인해야 합니다.

이런 일이 생기는 이유는 간단합니다. 이름이 **어떻게 생겼는지**만 말하고, **무엇에 쓰는지**는 말하지 않아서예요.

## 두 종류의 이름

디자인 시스템에서는 색 이름을 보통 두 층으로 나눕니다.

**원시 토큰**은 팔레트 그 자체입니다. "이런 색이 있다"만 말해요.

```css
:root {
  --blue-500: #2f6fed;
  --blue-600: #2459c7;
  --green-500: #1f9d63;
  --gray-50: #f7f8fa;
  --gray-900: #16181d;
}
```

**의미 토큰**은 역할을 말합니다. "이 색은 주요 버튼 배경에 쓴다"처럼요.

```css
:root {
  --color-bg-primary: var(--blue-500);
  --color-bg-primary-hover: var(--blue-600);
  --color-bg-surface: var(--gray-50);
  --color-text-default: var(--gray-900);
}
```

컴포넌트는 의미 토큰만 씁니다. 원시 토큰은 의미 토큰을 정의할 때만 등장하고요.

```css
.button-primary {
  background: var(--color-bg-primary);
  color: white;
}

.button-primary:hover {
  background: var(--color-bg-primary-hover);
}
```

이제 브랜드 색을 바꾸려면 어디를 고치면 될까요? 의미 토큰 두 줄입니다.

```css
:root {
  --color-bg-primary: var(--green-500);
}
```

버튼 코드는 한 글자도 바뀌지 않습니다. 정보 표시용 파란색은 따로 이름이 있으니 건드릴 일도 없고요.

## 다크 모드에서 진가가 나옵니다

다크 모드를 생각해 보면 차이가 더 분명해집니다.

`--gray-50`은 아주 밝은 회색입니다. 다크 모드에서 이 값을 어두운 색으로 바꾸면 어떻게 될까요? 이름은 "밝은 회색"인데 실제로는 어두운 색이 됩니다. 코드를 읽는 사람이 헷갈리기 시작하죠.

의미 토큰은 이런 문제가 없습니다. `--color-bg-surface`는 "표면 배경"이라는 뜻이라, 라이트에서는 밝고 다크에서는 어두워도 이름이 거짓말을 하지 않아요.

```css
:root {
  color-scheme: light dark;
  --color-bg-surface: var(--gray-50);
  --color-text-default: var(--gray-900);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-surface: var(--gray-900);
    --color-text-default: var(--gray-50);
  }
}

body {
  background: var(--color-bg-surface);
  color: var(--color-text-default);
}
```

원시 토큰은 그대로 두고 연결만 바꿨습니다. 팔레트는 하나, 연결표는 테마마다 하나인 셈입니다.

사용자가 직접 테마를 고르는 사이트라면 속성 선택자를 하나 더 둡니다.

```css
:root[data-theme="dark"] {
  --color-bg-surface: var(--gray-900);
  --color-text-default: var(--gray-50);
}
```

## CSS 변수라서 되는 일

이 구조가 깔끔하게 돌아가는 건 CSS 사용자 정의 속성이 **상속**되기 때문입니다. MDN에 따르면 `--`로 만든 사용자 정의 속성은 캐스케이드를 따르고 부모 값을 물려받습니다.

그래서 특정 영역에만 다른 값을 줄 수도 있어요.

```css
.promo-banner {
  --color-bg-primary: var(--green-500);
}
```

이 배너 안에 있는 버튼만 초록색이 됩니다. 버튼 컴포넌트에 `variant` 속성을 하나 더 만들지 않아도 됩니다.

`var()`의 두 번째 인자로 대체 값도 줄 수 있습니다.

```css
.card {
  border-color: var(--color-border-subtle, #e3e5e8);
}
```

토큰이 아직 정의되지 않은 환경에서도 깨지지 않게 하는 안전장치입니다. 다만 대체 값이 많아지면 진짜 값이 어디서 오는지 찾기 어려워지니 꼭 필요한 곳에만 쓰는 게 좋습니다.

> **참고** `--`로 만든 사용자 정의 속성은 이름의 대소문자를 구분합니다. `--Color-Primary`와 `--color-primary`는 다른 변수예요. 팀에서 소문자와 하이픈으로 통일해 두면 실수가 줄어듭니다.

## 이름 짓는 규칙

의미 토큰은 이름이 길어지기 쉽습니다. 그래서 규칙을 먼저 정해 두는 게 좋아요. 제가 자주 쓰는 순서는 이렇습니다.

```text
--color-{용도}-{역할}-{상태}

--color-bg-primary
--color-bg-primary-hover
--color-text-muted
--color-border-danger
```

몇 가지 기준도 같이 둡니다.

- **용도**는 `bg`, `text`, `border`, `icon`처럼 어디에 칠하는지입니다.
- **역할**은 `primary`, `danger`, `success`, `muted`처럼 왜 이 색인지입니다.
- **상태**는 `hover`, `active`, `disabled`처럼 필요할 때만 붙입니다.
- 이름에 색 이름(`blue`, `red`)을 넣지 않습니다. 넣는 순간 원시 토큰이 됩니다.
- 컴포넌트 이름(`button`, `modal`)은 정말 그 컴포넌트에만 쓰일 때만 넣습니다.

`danger`가 빨간색이 아닐 날이 올까 싶지만, 다크 모드에서는 같은 빨강이라도 더 밝은 값을 써야 할 때가 많습니다. 이름이 역할만 말하고 있으면 그런 조정이 쉬워요.

## 주의할 점

모든 색을 의미 토큰으로 만들 필요는 없습니다. 한 번만 쓰이는 일러스트 색까지 이름을 붙이면 토큰 목록만 길어지고 아무도 안 씁니다.

반대로 의미 토큰을 너무 잘게 쪼개도 곤란합니다. `--color-bg-card-header-left` 같은 이름이 보이기 시작하면 한 번 멈추고 정리할 때입니다.

저는 "이 색이 바뀔 때 같이 바뀌어야 하는 곳이 두 군데 이상인가?"를 기준으로 삼습니다. 그렇다면 이름을 붙일 가치가 있다고 보는 거죠.

## 정리

`blue-500`은 색이 어떻게 생겼는지 말하고, `primary`는 색이 무슨 일을 하는지 말합니다. 생김새는 바뀌어도 역할은 잘 안 바뀝니다. 그래서 컴포넌트는 역할의 이름을 알고 있어야 합니다.

## 참고

- [Using CSS custom properties | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties)
- [var() | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/var)
- [prefers-color-scheme | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme)
- [color-scheme | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme)
$dev$, '2026-08-31T09:00:00+09:00'::timestamptz),
  ('spa-404-on-github-pages', '깃허브 페이지에 React를 올리면 새로고침할 때 404가 나는 이유', '정적 호스팅과 클라이언트 라우팅이 어긋나는 지점, 그리고 404.html, 해시 라우터, 프리렌더 세 가지 해결법을 비교합니다.', array['JavaScript', 'HTTP']::text[], 'https://2rangs.github.io/img/covers/spa-404-on-github-pages.png', $dev$
React로 만든 사이트를 깃허브 페이지에 올렸습니다. 첫 화면도 잘 뜨고, 메뉴를 눌러 `/about`으로 가는 것도 잘 됩니다.

그런데 `/about`에서 새로고침을 누르면 404가 뜹니다. 주소를 복사해서 친구에게 보내도 404고요. 방금까지 잘 보이던 페이지인데 말이죠.

이건 React나 깃허브 페이지의 버그가 아닙니다. **페이지를 누가 찾아 주는지**가 상황에 따라 달라서 생기는 일이에요.

## 두 가지 길 찾기

깃허브 공식 문서는 깃허브 페이지를 **정적 사이트 호스팅 서비스**라고 소개합니다. 저장소에 있는 HTML, CSS, 자바스크립트 파일을 그대로 보여 주는 곳이에요.

정적 호스팅은 주소를 파일 경로로 바꿔서 찾습니다.

```text
/             → index.html
/about/       → about/index.html
/style.css    → style.css
```

그런데 React 앱을 빌드하면 보통 HTML 파일이 하나뿐입니다. `index.html` 하나에 자바스크립트가 붙어 있고, 화면 전환은 브라우저 안에서 라우터가 처리해요.

메뉴를 눌러 이동할 때는 서버에 묻지 않습니다. 라우터가 History API의 `pushState()`로 주소만 바꾸고 화면을 다시 그립니다. 그래서 잘 됩니다.

새로고침은 다릅니다. 브라우저가 서버에 `/about`을 달라고 다시 요청합니다. 서버는 `about/index.html`을 찾지만 그런 파일은 없습니다. 그래서 404를 돌려줍니다.

정리하면 이렇습니다.

- 앱 안에서 이동할 때는 **브라우저의 라우터**가 길을 찾습니다.
- 새로고침이나 직접 접속은 **서버**가 길을 찾습니다.

둘이 아는 지도가 달라서 생기는 문제입니다.

일반 서버라면 "모르는 주소는 전부 `index.html`을 줘"라고 설정하면 끝납니다. 깃허브 페이지는 그런 설정을 할 수 없으니 다른 방법을 써야 해요.

## 404.html 트릭

깃허브 공식 문서에 따르면 저장소 게시 경로 맨 위에 `404.html`을 두면, 없는 주소로 들어왔을 때 그 페이지를 보여 줍니다.

여기서 아이디어가 나옵니다. **`404.html`을 `index.html`과 똑같이 만들면** 어떨까요? 없는 주소로 와도 결국 같은 앱이 뜨고, 라우터가 주소를 보고 알맞은 화면을 그립니다.

```bash
npm run build
cp dist/index.html dist/404.html
```

`package.json`의 빌드 스크립트에 붙여 두면 잊어버릴 일이 없습니다.

```json
{
  "scripts": {
    "build": "vite build && cp dist/index.html dist/404.html"
  }
}
```

가장 간단하지만 단점이 분명합니다. 화면은 잘 뜨지만 **응답 상태 코드는 여전히 404**입니다. 직접 `curl`로 확인해 봐도 404가 찍혀요.

사람 눈에는 문제없어 보여도 검색 엔진이나 링크 미리보기 도구는 "없는 페이지"로 받아들일 수 있습니다. 개인 도구나 관리자 화면이라면 괜찮지만, 검색에 노출돼야 하는 블로그라면 아쉽습니다.

> **참고** 저장소 이름이 들어가는 프로젝트 사이트(`<owner>.github.io/<repo>/`)라면 Vite의 `base`를 `'/<repo>/'`로 맞춰야 한다고 Vite 문서에 나와 있습니다. 라우터에도 같은 `basename`을 주지 않으면 경로가 하나씩 어긋납니다.

## 해시 라우터

두 번째 방법은 경로를 `#` 뒤로 옮기는 겁니다.

```text
https://example.github.io/#/about
```

`#` 뒤쪽은 서버로 보내지 않습니다. 서버는 늘 `/`만 요청받으니 항상 `index.html`을 주고, 라우터가 `#/about`을 읽어 화면을 그립니다. 새로고침해도 404가 날 수가 없어요.

React Router에서는 `createHashRouter`를 쓰면 됩니다.

```tsx
import { createHashRouter, RouterProvider } from "react-router";
import Home from "./pages/Home";
import About from "./pages/About";

const router = createHashRouter([
  { path: "/", element: <Home /> },
  { path: "/about", element: <About /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
```

설정은 제일 쉽지만 주소가 조금 어색합니다. 그리고 `#` 자리를 라우터가 차지하니, 글 안 제목으로 이동하는 `#설치-방법` 같은 링크와 부딪힙니다.

## 빌드할 때 페이지를 미리 만들기

세 번째는 서버의 지도에 맞춰 주는 방법입니다. 서버가 `about/index.html`을 찾는다면, **그 파일을 실제로 만들어 두면** 됩니다.

빌드가 끝난 뒤 라우트마다 HTML을 하나씩 만드는 걸 프리렌더라고 부릅니다.

```text
dist/
  index.html
  about/index.html
  posts/hello-world/index.html
  404.html
```

이제 `/about/`으로 들어오면 진짜 파일이 있으니 200으로 응답합니다. 제 블로그에서 확인해 보니 끝에 `/`가 없는 `/blog`로 들어와도 깃허브 페이지가 `/blog/`로 301 리다이렉트해 주더라고요.

미리 만든 HTML에 글 제목과 본문까지 들어 있으면 좋은 점이 더 있습니다. 자바스크립트가 뜨기 전에도 내용이 보이고, 링크 미리보기에도 제목이 제대로 나옵니다.

대신 할 일이 늘어납니다.

- 빌드 때 어떤 라우트가 있는지 알아야 합니다. 글 목록을 API로 받는다면 빌드 스크립트에서도 받아 와야 해요.
- 새 글을 쓰면 다시 빌드하고 배포해야 페이지가 생깁니다.
- 미리 만든 HTML과 앱이 그린 화면이 다르면 깜빡임이 생길 수 있습니다.

그리고 정말 없는 주소를 위해 `404.html`은 여전히 둡니다. 이번에는 앱 복사본이 아니라 진짜 "페이지를 찾을 수 없어요" 화면으로요.

## 무엇을 고를까

- 빨리 띄워 보는 개인 프로젝트라면 **404.html 복사**로 충분합니다.
- 주소 모양이 상관없고 설정을 최소로 하고 싶다면 **해시 라우터**입니다.
- 검색에 노출돼야 하는 블로그나 문서라면 **프리렌더**가 맞습니다.

결국 새로고침 404는 "앱은 주소를 아는데 서버는 모른다"는 신호입니다. 서버에게 알려 주거나, 서버가 몰라도 되게 하거나, 둘 중 하나를 고르면 됩니다.

## 참고

- [What is GitHub Pages? | GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Creating a custom 404 page for your GitHub Pages site | GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site)
- [History API | MDN](https://developer.mozilla.org/en-US/docs/Web/API/History_API)
- [URI fragment | MDN](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment)
- [createHashRouter | React Router](https://reactrouter.com/api/data-routers/createHashRouter)
- [Deploying a Static Site, GitHub Pages | Vite](https://vite.dev/guide/static-deploy)
$dev$, '2026-10-05T09:00:00+09:00'::timestamptz),
  ('service-worker-push', '탭을 닫았는데 알림이 오는 이유 (Service Worker)', '페이지가 닫혀 있어도 웹 푸시 알림이 오는 원리를 서비스 워커 생명주기, Push API, Notification 권한으로 풀어 봅니다.', array['Web API', 'JavaScript']::text[], 'https://2rangs.github.io/img/covers/service-worker-push.png', $dev$
쇼핑몰 탭을 닫은 지 한참 지났습니다. 그런데 화면 구석에 "장바구니에 담은 상품이 할인 중이에요" 알림이 뜹니다.

분명히 탭은 닫았습니다. 페이지의 자바스크립트도 다 멈췄을 텐데, 누가 이 알림을 띄운 걸까요?

답은 **서비스 워커**입니다. 페이지와 따로 사는 작은 스크립트예요. 오늘은 이 스크립트가 어떻게 살고, 무엇을 할 수 있는지 보겠습니다.

## 페이지 밖에 사는 스크립트

MDN에 따르면 서비스 워커는 워커 컨텍스트에서 돌아갑니다.

- DOM에 접근할 수 없고, `localStorage` 같은 Web Storage도 쓸 수 없습니다.
- 페이지의 메인 스크립트와 다른 스레드에서 돌아갑니다.
- HTTPS 같은 보안 컨텍스트에서만 동작합니다. 개발용으로 `http://localhost`는 예외예요.

가장 중요한 점은 **페이지가 없어도 브라우저가 깨워서 실행할 수 있다**는 겁니다.

## 생명주기

페이지에서 `navigator.serviceWorker.register("/sw.js")`로 등록하면 다운로드, 설치(`install`), 활성화(`activate`) 순서를 거칩니다. 설치 때는 보통 캐시를 준비하고, 활성화 때는 이전 버전이 남긴 캐시를 정리합니다.

헷갈리는 건 새 버전을 배포할 때입니다. MDN에 따르면 새 버전은 백그라운드에서 설치만 되고 **대기 상태**로 남습니다. 예전 버전을 쓰는 페이지가 모두 닫혀야 활성화돼요. "배포했는데 왜 그대로지?"의 정체가 대부분 이겁니다.

`skipWaiting()`과 `clients.claim()`으로 바로 교체할 수도 있지만, 열려 있던 페이지가 중간에 새 워커를 만나게 되니 신중하게 쓰는 게 좋아요.

또 MDN은 서비스 워커가 **할 일이 없으면 언제든 종료될 수 있다**고 설명합니다. 이벤트가 오면 다시 시작되고요. 그래서 전역 변수에 상태를 들고 있으면 안 됩니다.

## 알림이 도착하기까지

푸시 알림은 서비스 워커, Push API, Notifications API가 함께 일합니다.

1. 사용자가 알림을 허락합니다.
2. 페이지가 `pushManager.subscribe()`로 구독을 만듭니다. 푸시 서비스 주소(endpoint)와 암호화 키가 들어 있어요.
3. 이 구독 정보를 우리 서버에 저장합니다.
4. 알릴 일이 생기면 서버가 그 endpoint로 메시지를 보냅니다.
5. 브라우저가 메시지를 받고 서비스 워커를 깨워 `push` 이벤트를 보냅니다.
6. 서비스 워커가 `showNotification()`으로 알림을 띄웁니다.

탭이 닫혀 있어도 되는 이유가 5번입니다. 메시지를 받는 건 페이지가 아니라 브라우저예요.

## 권한 묻고 구독하기

권한 요청은 꼭 **버튼 클릭 같은 사용자 동작** 안에서 합니다. MDN도 그렇게 권하고 있어요.

```js
// main.js
const VAPID_PUBLIC_KEY = "서버에서 만든 공개 키";

document.querySelector("#subscribe").addEventListener("click", async () => {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY,
  });

  await fetch("/api/push-subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
});
```

`userVisibleOnly: true`는 "푸시를 받으면 반드시 사용자에게 보이게 하겠다"는 약속입니다. MDN에 따르면 Chrome, Edge 같은 브라우저는 이 값이 `true`가 아니면 구독을 거절합니다.

`applicationServerKey`는 VAPID 공개 키입니다. 서버는 짝이 되는 개인 키로 서명해서 메시지를 보냅니다.

> **참고** MDN에 따르면 endpoint 주소만 알면 누구든 그 구독으로 메시지를 보낼 수 있습니다. 구독 정보는 비밀번호처럼 서버에만 안전하게 보관하세요.

## 서비스 워커에서 알림 띄우기

```js
// sw.js
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};

  event.waitUntil(
    self.registration.showNotification(data.title ?? "새 소식", {
      body: data.body,
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

여기서 `event.waitUntil()`이 아주 중요합니다. MDN에 따르면 이 메서드는 "아직 할 일이 있으니 종료하지 말라"고 브라우저에 알립니다. 빠뜨리면 알림을 띄우기 전에 워커가 멈출 수 있어요.

web.dev 문서에 따르면 Chrome은 `waitUntil()`에 넘긴 작업이 끝났는데도 알림이 없으면 "This site has been updated in the background." 같은 기본 알림을 대신 띄웁니다. 저도 프로미스 하나를 놓쳐서 이 알림을 한참 구경했습니다.

## 할 수 있는 것과 없는 것

페이지가 닫혀 있어도 알림을 띄우고, 누르면 원하는 페이지를 열 수 있습니다. 대신 조심할 것도 많아요.

- 사용자가 거절하면(`denied`) 알림을 띄울 수 없습니다. 다시 허용하려면 보통 사용자가 브라우저 설정에서 직접 바꿔야 하니, 처음 묻는 타이밍이 중요해요.
- 알림 없는 조용한 푸시는 마음대로 쓸 수 없습니다. 앞에서 본 `userVisibleOnly` 외에도, MDN에 따르면 Firefox는 알림을 띄우지 않는 메시지에 횟수 제한을 둡니다.
- 브라우저 프로세스가 완전히 꺼져 있을 때도 알림이 오는지는 브라우저와 운영체제에 따라 다릅니다.

iOS는 특히 조건을 잘 봐야 합니다. WebKit 공식 블로그에 따르면 iOS와 iPadOS 16.4부터 **홈 화면에 추가한 웹 앱**에서 웹 푸시를 지원합니다. 권한 요청도 사용자 동작에 대한 응답이어야 하고요. 일반 사파리 탭에서 바로 되는 기능으로 생각하면 안 되고, 세부 지원 범위는 바뀔 수 있으니 공식 문서를 꼭 확인하세요.

## 정리

탭을 닫아도 알림이 오는 건 페이지가 살아 있어서가 아닙니다. 브라우저가 메시지를 받고, 잠들어 있던 서비스 워커를 잠깐 깨워 알림을 띄우는 거예요. 그 힘이 큰 만큼 권한은 꼭 필요할 때, 사용자가 직접 눌렀을 때만 묻는 게 예의 아닐까요?

## 참고

- [Service Worker API | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [ExtendableEvent.waitUntil() | MDN](https://developer.mozilla.org/en-US/docs/Web/API/ExtendableEvent/waitUntil)
- [Push API | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [PushManager.subscribe() | MDN](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)
- [Using the Notifications API | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API)
- [Handling push messages | web.dev](https://web.dev/articles/push-notifications-handling-messages)
- [Web Push for Web Apps on iOS and iPadOS | WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
$dev$, '2026-11-10T09:00:00+09:00'::timestamptz)
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  tags = excluded.tags,
  cover_url = excluded.cover_url,
  body_markdown = excluded.body_markdown,
  published_at = excluded.published_at;

select slug, published_at::date, reading_minutes, cover_url is not null as has_cover
from public.blog_posts where cover_url like '%/img/covers/%' and series is null order by published_at;
