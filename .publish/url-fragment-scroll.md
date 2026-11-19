
문서 사이트에서 목차를 누르면 그 제목으로 바로 내려갑니다. 주소창 끝에는 `#설치-방법` 같은 게 붙어 있고요.

그런데 직접 만든 사이트에서는 이 동작이 잘 안 될 때가 있습니다. 제목이 고정 헤더 밑에 숨기도 하고, 아예 맨 위에 멈춰 있기도 하죠. 오늘은 `#`이 어떻게 동작하는지부터 차근차근 보겠습니다.

## #부터는 서버로 가지 않습니다

주소에서 `#` 뒤쪽을 fragment라고 부릅니다.

```text
https://example.com/docs/guide?lang=ko#install
```

MDN에 따르면 fragment는 **서버로 보내지 않습니다.** 브라우저가 문서를 받은 다음 스스로 처리하는 부분이에요. 서버는 `/docs/guide?lang=ko`만 요청받습니다.

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

`scroll-margin-top`은 요소를 화면 안으로 스크롤할 때 위쪽에 여백을 둡니다. 원래 CSS Scroll Snap 명세에 속한 속성인데, 명세는 스냅과 상관없이 요소를 화면 안으로 데려오는 동작(scroll-into-view)에도 이 값을 쓰도록 정하고 있습니다.

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

남의 문서에는 내가 원하는 `id`가 없을 때가 많습니다. 이럴 때 텍스트 프래그먼트를 씁니다.

```text
https://example.com/docs#:~:text=설치%20방법
```

`#:~:text=` 뒤에 찾을 문장을 적으면, 지원하는 브라우저는 그 문장으로 스크롤하고 강조해 줍니다. MDN에 정리된 규칙을 몇 가지 옮기면 이렇습니다.

- 문자열은 퍼센트 인코딩합니다. 공백은 `%20`이 되고, `-`도 인코딩하라고 명세에 적혀 있어요.
- 대소문자는 구분하지 않습니다.
- `text=시작,끝`으로 범위를, `앞-,문장,-뒤`로 앞뒤 문맥을 지정할 수 있습니다.
- 맞는 문장이 없거나 지원하지 않는 브라우저라면 그냥 문서 맨 위가 열립니다.

강조 모양은 `::target-text`로 바꿀 수 있습니다. 지원 여부는 `document.fragmentDirective`가 있는지로 확인할 수 있고요. 브라우저별 지원 현황은 계속 바뀌니 MDN 호환성 표를 직접 확인하세요.

재밌게도 `:~:` 뒤쪽은 페이지를 불러오면서 **주소에서 빠집니다**. 그래서 페이지 스크립트의 `location.hash`로는 읽을 수 없습니다.

## SPA에서 해시 스크롤이 안 되는 이유

이제 처음 질문으로 돌아가 보겠습니다. React나 Vue로 만든 사이트에서 `#install`로 들어왔는데 맨 위에 멈춰 있다면, 대부분 순서 문제입니다.

1. 브라우저가 HTML을 받습니다. 안에는 빈 `<div id="root">`만 있습니다.
2. 브라우저는 HTML을 읽는 동안 `id="install"`을 찾아봅니다. 아직 없습니다.
3. 자바스크립트가 실행되고, 데이터를 받아 와서 글을 그립니다.
4. 이제 제목이 생겼지만, HTML 파싱이 끝난 뒤라 브라우저는 더 찾지 않습니다.

HTML 표준을 보면 브라우저는 파서가 문서를 다 읽고 나면 fragment 찾기를 멈춥니다. 글 내용을 API로 받아 오는 블로그라면 거의 항상 이렇게 돼요. 저도 처음엔 이것 때문에 꽤 헤맸습니다.

해결은 간단합니다. 내용을 다 그린 다음 직접 스크롤하면 됩니다.

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
