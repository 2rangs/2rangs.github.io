
모달을 띄웠는데 위쪽 헤더가 모달을 덮고 있습니다.
모달의 `z-index`는 1000이고 헤더는 10입니다.
숫자를 9999로 올려 봅니다. 그대로입니다.
99999로 올려도 그대로입니다.

이쯤 되면 CSS가 고장 난 것 같지만, 브라우저는 규칙대로 그리고 있습니다.
`z-index`는 페이지 전체에서 비교되는 숫자가 아니기 때문입니다.

## z-index는 같은 맥락 안에서만 비교됩니다

브라우저는 요소를 그릴 때 페이지를 여러 개의 층 묶음으로 나눕니다.
이 묶음을 쌓임 맥락(stacking context)이라고 부릅니다.

규칙은 두 가지입니다.

1. `z-index`는 **같은 쌓임 맥락 안에서만** 비교됩니다.
2. 쌓임 맥락은 바깥에서 볼 때 **하나의 층**으로 취급됩니다. 안쪽 요소가 아무리 큰 `z-index`를 가져도 그 맥락 밖으로 나가 다른 맥락의 요소와 겨루지 못합니다.

폴더 번호로 생각하면 쉽습니다.
2번 폴더 안의 999번 문서는 3번 폴더 안의 1번 문서보다 앞에 올 수 없습니다.
폴더끼리 순서가 먼저 정해지고, 문서 번호는 폴더 안에서만 의미가 있습니다.

```html
<header class="header">로고</header>
<main class="main">
  <div class="modal">모달</div>
</main>
```

```css
.header {
  position: sticky;
  top: 0;
  z-index: 10;
}

.main {
  position: relative;
  z-index: 1; /* 여기서 쌓임 맥락이 생긴다 */
}

.modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
}
```

`.modal`의 9999는 `.main` 안에서만 의미가 있습니다.
루트에서 겨루는 것은 `.header`(10)와 `.main`(1)입니다.
`.main`이 지기 때문에 그 안의 모든 것이 헤더 아래에 그려집니다.
`position: fixed`로 화면 전체를 덮어도 그리는 순서는 여전히 `.main`에 묶여 있습니다.

## 쌓임 맥락이 생기는 조건

까다로운 점은 `z-index`를 직접 쓰지 않아도 쌓임 맥락이 생긴다는 것입니다.
자주 만나는 조건을 추리면 다음과 같습니다. 전체 목록은 MDN에 있습니다.

- 문서 루트(`html`)
- `position`이 `relative`나 `absolute`이고 `z-index`가 `auto`가 아닌 요소
- `position`이 `fixed`나 `sticky`인 요소 (`z-index`가 없어도)
- flex나 grid 컨테이너의 자식이면서 `z-index`가 `auto`가 아닌 요소
- `opacity`가 1보다 작은 요소
- `transform`, `filter`, `backdrop-filter`, `perspective`, `clip-path`, `mask`가 `none`이 아닌 요소 (`translate`, `rotate`, `scale` 개별 속성도 포함)
- `mix-blend-mode`가 `normal`이 아닌 요소
- `isolation: isolate`인 요소
- `will-change`에 위 속성 중 하나를 지정한 요소
- `contain`에 `layout`이나 `paint`가 포함된 요소, `container-type`이 `size`나 `inline-size`인 요소

목록을 보면 왜 이 버그가 어느 날 갑자기 생기는지 알 수 있습니다.
레이아웃 때문에 넣은 `transform: translateX(-50%)`, 페이드 인 애니메이션의 `opacity`, 성능 때문에 넣은 `will-change: transform`, 컨테이너 쿼리를 위한 `container-type: inline-size`.
어느 것도 겹침 순서를 바꾸려는 의도가 없었지만, 모두 쌓임 맥락을 만듭니다.
그래서 어제까지 멀쩡하던 드롭다운이 오늘은 옆 카드 밑에 깔립니다.

`transform`, `filter`, `perspective`, `contain: paint` 같은 속성에는 부작용이 하나 더 있습니다.
자손 중 `position: fixed`인 요소의 기준(containing block)이 뷰포트가 아니라 이 요소로 바뀝니다.
화면 전체를 덮어야 할 모달이 부모 박스 크기에 갇혀 보인다면 이것이 원인입니다.

반대 방향의 오해도 있습니다.
`position`이 `static`인 일반 요소에 `z-index`를 주면 아무 효과가 없습니다. flex나 grid의 자식만 예외입니다.
"z-index를 줬는데 안 먹는다"의 상당수는 이 경우이고, 나머지 대부분이 쌓임 맥락 문제입니다.

## 원인 찾기

모달이 깔렸다면 모달에서 위로 올라가며 쌓임 맥락을 만드는 조상을 찾으면 됩니다.
DevTools에서 조상을 하나씩 눌러 Computed 스타일을 봐도 되지만, 콘솔에서 확인하는 편이 빠릅니다.

```js
function findStackingAncestors(element) {
  const found = [];
  for (let node = element.parentElement; node; node = node.parentElement) {
    const s = getComputedStyle(node);
    const reasons = [];
    if (s.position === 'fixed' || s.position === 'sticky') reasons.push(`position: ${s.position}`);
    else if (s.position !== 'static' && s.zIndex !== 'auto') reasons.push(`z-index: ${s.zIndex}`);
    if (Number(s.opacity) < 1) reasons.push(`opacity: ${s.opacity}`);
    if (s.transform !== 'none') reasons.push('transform');
    if (s.filter !== 'none') reasons.push('filter');
    if (s.isolation === 'isolate') reasons.push('isolation');
    if (/transform|opacity|filter/.test(s.willChange)) reasons.push(`will-change: ${s.willChange}`);
    if (reasons.length) found.push({ node, reasons });
  }
  return found;
}

findStackingAncestors(document.querySelector('.modal'));
```

모든 조건을 확인하지는 않지만, 실무에서 만나는 경우는 대부분 여기서 잡힙니다.
목록에서 가장 바깥쪽 조상이 형제들과 어떤 순서로 겨루는지 보면 모달이 왜 졌는지가 나옵니다.

## 해결 1. 겹쳐야 할 요소를 맥락 밖으로 꺼낸다

모달, 토스트, 드롭다운 메뉴, 툴팁처럼 무엇보다 위에 떠야 하는 요소는 애초에 깊은 곳에 두지 않는 것이 가장 확실합니다.
DOM에서 `body` 바로 아래로 옮기면 루트 맥락에서 헤더와 직접 겨루게 됩니다.

React에서는 `createPortal`이 이 일을 합니다.

```jsx
import { createPortal } from 'react-dom';

function Modal({ children }) {
  return createPortal(
    <div className="modal">{children}</div>,
    document.body
  );
}
```

컴포넌트 트리에서는 원래 자리에 있어서 props와 context를 그대로 받고, DOM에서는 `body` 아래에 그려집니다.

한 가지 주의할 점은 이벤트입니다.
포털 안에서 일어난 이벤트는 DOM 구조가 아니라 **React 트리**를 따라 버블링됩니다.
포털을 감싼 부모 컴포넌트의 `onClick`이 모달 안의 클릭에도 반응할 수 있으니, 바깥 클릭 시 닫기 같은 로직을 짤 때 염두에 둬야 합니다.

앱의 루트 요소에 `isolation: isolate`를 걸어 두는 것도 함께 쓰면 좋은 습관입니다.
앱 전체가 하나의 맥락으로 묶이기 때문에, `body` 아래에 포털로 붙인 요소는 앱 안의 어떤 `z-index`와도 겨루지 않고 그 위에 그려집니다.

```css
#root {
  isolation: isolate;
}
```

### 브라우저의 최상위 층(top layer)

`<dialog>`를 `showModal()`로 열거나 `popover` 속성을 쓴 요소를 열면, 브라우저가 그 요소를 최상위 층(top layer)에 올립니다.
최상위 층은 문서의 모든 쌓임 맥락보다 위에 그려지고 `z-index`와 상관이 없습니다.
DOM 어디에 있든 헤더 위에 뜹니다.

```html
<dialog id="confirm">
  <p>삭제할까요?</p>
  <form method="dialog"><button>닫기</button></form>
</dialog>
<script>
  document.getElementById('confirm').showModal();
</script>
```

`showModal()`은 뒤쪽 콘텐츠를 비활성(inert)으로 만들고 Esc 키로 닫기도 기본으로 처리해 줍니다.
포커스 관리까지 직접 짜야 했던 모달 기능을 상당 부분 대신해 주니, 새로 만든다면 먼저 고려해 볼 만합니다.
`dialog.show()`로 열면 모달이 아니어서 최상위 층에 올라가지 않는다는 점은 헷갈리기 쉽습니다.

## 해결 2. isolation: isolate로 맥락을 의도적으로 만든다

쌓임 맥락은 버그의 원인이지만 잘 쓰면 도구가 됩니다.
컴포넌트 안에서 쓰는 `z-index`가 바깥으로 새어 나가지 않게 가둘 수 있기 때문입니다.

제목 글자 뒤에 형광펜 같은 밑줄을 깔기 위해 `z-index: -1`을 쓰는 경우를 봅시다.

```css
.highlight {
  position: relative;
}

.highlight::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0.1em;
  height: 0.4em;
  background: #fde68a;
  z-index: -1; /* 글자 뒤로 보내고 싶다 */
}
```

흰 배경의 페이지에서는 잘 보입니다.
그런데 배경색이 있는 섹션 안에 넣으면 밑줄이 사라집니다.
`.highlight`는 쌓임 맥락이 아니므로 `::after`는 `.highlight`를 지나 바깥 맥락(대개 루트)의 음수 층까지 내려갑니다.
음수 층은 맥락 안의 일반 블록보다 먼저 그려지므로, 섹션의 배경이 그 위를 덮어 버립니다.

`.highlight`에 한 줄을 추가하면 해결됩니다.

```css
.highlight {
  position: relative;
  isolation: isolate;
}
```

이제 `.highlight`가 맥락이 되고, `::after`의 `-1`은 이 맥락 안에서만 의미가 있습니다.
맥락 안에서 음수 층은 맥락을 만든 요소의 배경 위, 글자 아래에 그려집니다.
섹션 배경이 무엇이든 밑줄은 글자 바로 뒤에 보입니다.

`isolation: isolate`는 시각적 부작용 없이 쌓임 맥락만 만드는 속성입니다.
`z-index: 0`으로도 맥락을 만들 수 있지만 `position` 값이 필요하고, 숫자만 보고는 의도를 알기 어렵습니다.
`transform: translateZ(0)`을 쓰면 앞에서 본 것처럼 `position: fixed` 자손의 기준까지 바뀝니다.
"이 컴포넌트의 z-index는 이 안에서만 의미가 있다"는 의도를 가장 정확하게 표현하는 것이 `isolation: isolate`입니다.

## z-index를 숫자 대신 이름으로 관리하기

프로젝트가 커지면 `z-index: 9999`, `z-index: 10000`, `z-index: 99999`가 경쟁하듯 늘어납니다.
지금 가장 큰 숫자가 무엇인지 아무도 모르니 일단 크게 쓰고 봅니다.

층의 종류를 미리 정하고 이름을 붙이면 이 경쟁이 멈춥니다.

```css
:root {
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-overlay: 300;
  --z-modal: 400;
  --z-popover: 500;
  --z-toast: 600;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
}

.modal {
  position: fixed;
  z-index: var(--z-modal);
}
```

간격을 100씩 두면 나중에 층을 끼워 넣기 쉽습니다.
디자인 시스템이 있다면 색상이나 간격 토큰과 같은 곳에서 관리하고, JS에서 쓰는 값도 같은 출처에서 가져오게 하면 한 군데만 보면 됩니다.

다만 토큰은 **같은 쌓임 맥락 안에 있을 때만** 의미가 있습니다.
`--z-modal`을 쓴 모달이 `transform`이 걸린 부모 안에 있으면 토큰을 아무리 잘 정해도 소용없습니다.
그래서 토큰은 "전역 층에 올라가는 요소는 포털로 `body` 아래에 둔다"는 규칙과 함께 써야 효과가 있습니다.
컴포넌트 내부에서 쓰는 1, 2, -1 같은 작은 값은 토큰으로 만들지 말고 `isolation: isolate`로 가둬 두는 편이 깔끔합니다.
전역 층은 토큰으로, 지역 층은 격리로 나눕니다.

## 정리

- `z-index`는 전역 숫자가 아닙니다. 같은 쌓임 맥락 안에서만 비교되고, 맥락은 바깥에서 하나의 층으로 취급됩니다.
- 쌓임 맥락은 `position`과 `z-index`뿐 아니라 `opacity`, `transform`, `filter`, `will-change`, `position: fixed`·`sticky`, `container-type` 등으로도 생깁니다. 의도하지 않은 맥락이 대부분의 원인입니다.
- 모달처럼 무조건 위에 떠야 하는 요소는 포털로 `body` 아래에 두거나, `<dialog>`의 `showModal()`이나 `popover`로 최상위 층에 올립니다.
- `isolation: isolate`는 부작용 없이 맥락을 만들어 컴포넌트 내부의 `z-index`를 가둡니다.
- 전역 층은 이름 있는 토큰으로 관리해서 숫자를 키우는 경쟁을 멈춥니다.

## 참고

- [MDN - Stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context)
- [MDN - z-index](https://developer.mozilla.org/en-US/docs/Web/CSS/z-index)
- [MDN - isolation](https://developer.mozilla.org/en-US/docs/Web/CSS/isolation)
- [MDN - Top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer)
- [MDN - The Dialog element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog)
- [React - createPortal](https://react.dev/reference/react-dom/createPortal)
- [Josh W. Comeau - What The Heck, z-index??](https://www.joshwcomeau.com/css/stacking-contexts/)
