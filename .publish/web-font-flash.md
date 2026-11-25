
새로 만든 페이지를 열었습니다. 레이아웃은 다 떴는데 글자만 안 보이다가, 잠시 뒤 글자가 "톡" 하고 나타납니다. 반대로 기본 글꼴로 먼저 보였다가 갑자기 모양이 바뀌는 경우도 있죠.

둘 다 웹폰트가 아직 도착하지 않아서 생기는 일입니다. 흔히 앞의 경우를 FOIT(Flash of Invisible Text), 뒤의 경우를 FOUT(Flash of Unstyled Text)라고 부릅니다.

## 브라우저는 폰트를 기다려 줍니다

브라우저는 웹폰트를 쓰는 글자를 만나면 폰트를 내려받기 시작하고, 이때부터 타이머가 돕니다. MDN은 이 시간을 세 구간으로 설명합니다.

- **block 구간**: 폰트가 아직 없으면 글자를 *보이지 않는* 대체 글꼴로 그립니다.
- **swap 구간**: 폰트가 아직 없으면 보이는 대체 글꼴로 그립니다. 그사이 폰트가 오면 바꿔 끼웁니다.
- **failure 구간**: 폰트를 포기하고 대체 글꼴을 계속 씁니다.

block 구간에서 생기는 것이 FOIT, swap 구간에서 폰트가 바뀌는 순간이 FOUT입니다. web.dev에 따르면 Chromium 계열과 Firefox는 기본적으로 최대 3초까지 글자를 숨기고, Safari는 무기한 숨깁니다. 폰트가 무거우면 빈 화면을 오래 보게 되는 거죠.

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

본문처럼 빨리 읽혀야 하는 글자는 `swap`이 무난합니다. 글자는 바로 보이지만, 나중에 폰트가 바뀌면서 레이아웃이 살짝 흔들릴 수 있습니다. 흔들림이 싫다면 `optional`도 있습니다. 폰트가 늦게 오면 이번 방문에서는 그냥 기본 글꼴로 갑니다. web.dev는 성능만 보면 `optional`을 권하고, 로고처럼 꼭 그 폰트여야 하는 곳엔 `swap`을 섞어 쓰는 방법도 소개합니다.

## preload로 일찍 부르기

폰트는 CSS를 읽고, 그 폰트를 쓰는 글자를 발견한 뒤에야 요청됩니다. 꽤 늦게 출발하는 거죠. 꼭 필요한 폰트 하나는 `<link rel="preload">`로 미리 부를 수 있습니다.

```html
<link
  rel="preload"
  href="/fonts/my-font.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>
```

여기서 `crossorigin`을 빼먹기 쉽습니다. MDN에 따르면 폰트는 같은 출처여도 익명 CORS 모드로 가져오기 때문에, preload에도 `crossorigin`을 붙여야 나중 요청과 짝이 맞습니다. 짝이 안 맞으면 미리 받아 둔 파일을 쓰지 못할 수 있습니다. 저도 이 속성 하나 빼먹고 "preload 했는데 왜 그대로지?" 하며 반나절을 날린 적이 있습니다.

다만 preload는 다른 리소스와 대역폭을 나눠 씁니다. 여러 개를 걸면 오히려 느려질 수 있으니 첫 화면에 꼭 필요한 것만 고르세요.

## 한글 폰트가 유독 무거운 이유

web.dev에 따르면 라틴 폰트는 보통 글리프가 100~1,000개 정도인데, CJK 폰트는 10,000자가 넘기도 합니다. 한글 완성형 음절만 해도 11,172자니까요. 그래서 한글 폰트는 같은 굵기 하나만 해도 파일이 큽니다.

가장 먼저 WOFF2로 바꿉니다. web.dev는 WOFF2가 WOFF보다 30% 정도 더 잘 압축된다고 설명합니다.

그다음은 서브셋, 안 쓰는 글자를 빼서 파일을 줄이는 방법입니다. 자주 쓰는 한글 음절만 남기거나, 사이트에서 실제로 쓰는 글자만 남길 수 있습니다. 폰트 라이선스가 서브셋을 허용하는지는 꼭 먼저 확인해야 합니다.

## unicode-range로 쪼개서 필요한 만큼만

서브셋에서 한 단계 더 나아가면, 폰트를 여러 조각으로 나누고 조각마다 `unicode-range`를 붙이는 방법이 있습니다. 흔히 동적 서브셋이라고 부릅니다.

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

MDN에 따르면 페이지에 그 범위의 글자가 하나도 없으면 해당 파일은 받지 않고, 한 글자라도 있으면 그 조각 전체를 받습니다. 그래서 조각을 잘게 나눌수록 실제로 쓰는 만큼에 가깝게 받게 됩니다. 위 예시는 이해를 위해 범위를 크게 나눴고, 실제로는 자주 쓰는 글자 순서로 더 잘게 나누는 경우가 많습니다.

이때 preload와 함께 쓰는 건 조심해야 합니다. web.dev에 따르면 preload는 `unicode-range`를 무시하고 지정한 파일을 그대로 받습니다. 조각 폰트를 쓴다면 preload는 꼭 필요한 한두 개에만 거는 게 좋습니다.

웹폰트가 늦게 뜨는 건 대부분 파일이 크고 늦게 출발해서입니다. `font-display`로 기다리는 방식을 정하고, preload로 일찍 출발시키고, 서브셋으로 짐을 줄이면 됩니다. 한글 사이트라면 마지막 단계의 효과가 특히 크더라고요.

## 참고

- [MDN, font-display](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display)
- [MDN, unicode-range](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range)
- [MDN, rel=preload](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/preload)
- [web.dev, Best practices for fonts](https://web.dev/articles/font-best-practices)
