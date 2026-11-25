
밤에 불 끄고 블로그를 엽니다. 다크 모드로 설정해 뒀으니 안심하고 있었는데, 새로고침하는 순간 화면이 하얗게 번쩍이고 나서야 어두운 화면으로 바뀝니다. 눈이 꽤 아픕니다.

다크 모드를 직접 붙여 본 분이라면 한 번쯤 겪어 보셨을 거예요. 원인은 **테마를 정하는 시점이 첫 화면을 그린 뒤**라는 데 있습니다.

## 브라우저는 기다려 주지 않습니다

브라우저는 HTML을 받으면 위에서부터 읽으면서 최대한 빨리 화면을 그립니다. 그런데 흔히 테마를 이렇게 정합니다.

```js
// 앱 번들 안 어딘가
useEffect(() => {
  const saved = localStorage.getItem('theme');
  document.documentElement.dataset.theme = saved ?? 'light';
}, []);
```

이 코드는 번들을 받고, 실행하고, 컴포넌트가 화면에 붙은 다음에야 돕니다. 그사이 브라우저는 이미 기본 테마, 보통은 밝은 화면으로 한 번 그려 버립니다. 이것이 번쩍임입니다. 그러니 **첫 페인트 전에 테마를 정하면** 됩니다.

## head에 아주 짧은 스크립트 하나

MDN에 따르면 `async`나 `defer`가 없는 일반 `<script>`는 실행이 끝날 때까지 HTML 읽기를 멈춥니다. 보통은 성능 때문에 피하는 성질이지만, 여기서는 오히려 도움이 됩니다. 본문을 그리기 전에 테마를 확실히 정할 수 있으니까요.

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

사용자가 직접 고른 값이 있으면 그걸 쓰고, 없으면 운영체제 설정(`prefers-color-scheme`)을 따르고, 그것도 안 되면 밝은 테마로 갑니다.

`try`로 감싼 데는 이유가 있습니다. MDN에 따르면 `localStorage`는 사용자가 저장을 막아 두었거나 `file:` 같은 출처에서는 `SecurityError`를 던질 수 있습니다. 이 스크립트에서 에러가 나면 테마가 아예 안 정해지니, 실패해도 기본값으로 넘어가게 해 둡니다.

이 스크립트는 번들에 넣지 말고 HTML에 직접 인라인으로 둡니다. 외부 파일로 빼면 그 파일을 받는 시간만큼 또 늦어지거든요. 그래서 몇 줄 안 되게 짧게 유지합니다.

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

위 CSS에 슬쩍 넣은 `color-scheme`도 빠뜨리면 안 됩니다. MDN에 따르면 이 속성은 캔버스 배경, 스크롤바, 폼 컨트롤 같은 브라우저 기본 UI의 색을 바꿉니다. 이걸 빼먹으면 페이지는 어두운데 스크롤바나 `<input>`만 하얗게 남는 일이 생깁니다.

HTML에도 같은 뜻을 미리 적어 둘 수 있습니다.

```html
<meta name="color-scheme" content="light dark" />
```

MDN은 이 태그를 CSS보다 앞, `<head>`에 넣어 두면 페이지를 불러올 때의 원치 않는 번쩍임을 막는 데 도움이 된다고 설명합니다. `light dark`처럼 두 개를 적으면 앞의 것을 더 선호하지만 사용자가 원하면 뒤의 것도 괜찮다는 뜻입니다.

사용자가 운영체제 테마를 바꾸는 순간도 따라가고 싶다면 `matchMedia()`가 돌려주는 `MediaQueryList`의 `change` 이벤트를 들으면 됩니다. 다만 사용자가 직접 고른 값이 저장돼 있다면 그쪽을 우선하는 게 자연스럽습니다.

## 프레임워크를 써도 원리는 같습니다

React든 Vue든 서버에서 HTML을 만들든, 결국 브라우저가 받는 건 HTML 한 장입니다. 그 HTML의 `<head>`에 테마 스크립트가 먼저 들어 있기만 하면 됩니다. 프레임워크 쪽 상태는 그 뒤에 `<html>`의 `data-theme`을 읽어서 맞춰 주면 됩니다.

저도 처음엔 상태 관리 라이브러리에서 테마를 정하느라 이 번쩍임을 한참 못 잡았습니다. 결국 답은 `<head>`에 있는 열 줄짜리 스크립트였죠.

## 참고

- [MDN, script 요소](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script)
- [MDN, prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [MDN, color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
- [MDN, meta name="color-scheme"](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/color-scheme)
- [MDN, Window.matchMedia()](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)
- [MDN, Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
