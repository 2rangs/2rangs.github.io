
디자인 시안의 버튼이 복잡해서 기본 버튼 스타일을 걷어 내기 귀찮았습니다.
그래서 이렇게 만들었습니다.

```jsx
<div className="card-action" onClick={handleDelete}>
  삭제
</div>
```

마우스로 눌러 보면 잘 됩니다.
QA도 통과했습니다.

그런데 키보드만 쓰는 사용자는 Tab을 아무리 눌러도 이 "버튼"에 도착하지 못합니다.
스크린 리더 사용자는 "삭제"라는 글자는 듣지만 누를 수 있는 요소인지 모릅니다.
음성으로 화면을 조작하는 사용자가 "삭제 버튼 클릭"이라고 말해도 반응이 없습니다.
마우스를 쓰는 사람에게만 보이는 버튼이 됐습니다.

## button이 기본으로 해 주는 일

같은 일을 `<button>`으로 하면 이렇게 됩니다.

```jsx
<button type="button" className="card-action" onClick={handleDelete}>
  삭제
</button>
```

이 한 줄로 브라우저가 해 주는 일은 생각보다 많습니다.

- **포커스**: Tab 순서에 자동으로 들어갑니다. 포커스되면 기본 포커스 표시도 그려집니다.
- **키보드 동작**: Enter와 Space로 누를 수 있고, 이때 `click` 이벤트가 발생합니다. 그래서 `onClick` 하나로 마우스·키보드·터치를 모두 처리할 수 있습니다.
- **역할(role)**: 접근성 트리에 "button"으로 노출됩니다. 스크린 리더는 "삭제, 버튼"이라고 읽고, 사용자는 버튼 목록만 모아 보는 기능으로 찾을 수 있습니다.
- **접근 가능한 이름**: 안의 텍스트 "삭제"가 버튼의 이름이 됩니다.
- **disabled**: `disabled` 속성 하나로 클릭이 막히고, Tab 순서에서 빠지고, 스크린 리더에 "사용할 수 없음"이 전달됩니다. CSS에서 `:disabled`로 스타일을 줄 수도 있습니다.
- **폼 연동**: 폼 안에서 제출 버튼으로 동작할 수 있고, `form`, `formaction` 같은 속성도 씁니다.
- **고대비 모드**: Windows의 고대비 같은 강제 색상 모드(forced colors)에서도 버튼으로 보이게 시스템 색이 적용됩니다.

다만 키보드로 `click`이 발생하는 건 **버튼이나 링크 같은 요소에서만**입니다.
`div`에서 Enter를 눌러도 `click`은 발생하지 않습니다.
`onClick`이 "마우스 클릭"이 아니라 "활성화"를 뜻하게 되는 이유는 요소가 `button`이기 때문입니다.

## div로 흉내 내려면 필요한 것

그래도 `div`를 써야 한다면 무엇이 필요할까요.
먼저 역할과 포커스를 붙입니다.

```jsx
<div
  role="button"
  tabIndex={0}
  onClick={handleDelete}
  onKeyDown={(event) => {
    if (event.key === 'Enter') {
      handleDelete();
    }
    if (event.key === ' ') {
      event.preventDefault(); // 페이지가 스크롤되지 않게
    }
  }}
  onKeyUp={(event) => {
    if (event.key === ' ') {
      handleDelete();
    }
  }}
>
  삭제
</div>
```

- `role="button"`: 스크린 리더에 버튼이라고 알립니다. 하지만 **역할만 알릴 뿐 동작은 하나도 추가하지 않습니다.**
- `tabIndex={0}`: Tab 순서에 넣습니다. 0보다 큰 값은 문서 순서를 깨뜨리니 쓰지 않습니다.
- 키 이벤트: 네이티브 버튼은 Enter는 누르는 순간, Space는 뗄 때 동작합니다. 이를 흉내 내려고 `keydown`과 `keyup`을 나눴습니다. Space의 기본 동작인 페이지 스크롤도 막아야 합니다.

여기서 흔한 오해가 드러납니다.
**ARIA `role`은 기능이 아니라 약속입니다.**
`role="button"`은 "버튼처럼 동작합니다"라고 보조 기술에 약속할 뿐이고, 그 약속을 지키는 일은 전부 개발자 몫입니다.
역할만 붙이고 키보드 처리를 빼먹으면 스크린 리더는 "버튼"이라고 안내하는데 Enter를 눌러도 반응이 없습니다. 아무것도 안 붙였을 때보다 더 혼란스럽습니다.

## 그래도 부족한 점

위 코드까지 써도 아직 빠진 부분이 있습니다.

- **disabled**: `div`에는 `disabled`가 없습니다. `aria-disabled="true"`를 붙이고, 클릭·키 핸들러에서 직접 막고, 스타일도 따로 줘야 합니다. Tab 순서에서 뺄지도 정해야 합니다.
- **폼 제출**: 폼 안에서 제출하려면 `form.requestSubmit()`을 직접 불러야 합니다.
- **포커스 스타일**: 기본 포커스 표시는 그려지지만 디자인에 맞게 `:focus-visible` 스타일을 따로 챙겨야 합니다.
- **고대비 모드**: 시스템이 버튼으로 인식하지 않으니 강제 색상 모드에서 테두리가 사라져 그냥 글자처럼 보일 수 있습니다.
- **반복**: 이 모든 것을 버튼이 필요한 곳마다 해야 합니다. 하나라도 빠지면 그 버튼만 고장 납니다.

W3C의 "Using ARIA" 문서는 첫 번째 규칙으로, 필요한 의미와 동작을 이미 가진 네이티브 HTML 요소가 있다면 ARIA로 다른 요소를 고쳐 쓰지 말고 그 요소를 쓰라고 합니다.
`div`에 역할을 붙여 버튼을 만들면 이미 있는 기능을 다시 구현하는 셈이고, 대개 원래 버튼보다 빠진 곳이 많습니다.

### 스타일이 문제라면

`div`를 쓰는 이유는 대부분 기본 스타일입니다.
버튼의 기본 스타일은 몇 줄이면 걷어 낼 수 있습니다.

```css
.reset-button {
  appearance: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
}

.reset-button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
```

`all: unset`으로 한 번에 지우는 방법도 자주 보이는데, 포커스 표시까지 같이 사라지니 `:focus-visible` 스타일을 꼭 다시 줘야 합니다.
`outline: none`만 쓰고 대체 표시를 두지 않으면 키보드 사용자는 지금 어디에 있는지 알 수 없습니다.

## button과 a는 어떻게 고를까

"그럼 클릭 가능한 건 다 `button`인가요?"라는 질문이 이어집니다.
기준은 간단합니다.

- **다른 곳으로 이동**하면 `<a href>`: 다른 페이지, 같은 페이지의 다른 위치, 파일 다운로드.
- **현재 페이지에서 무언가를 실행**하면 `<button>`: 모달 열기, 삭제, 토글, 폼 제출.

둘은 키보드 동작부터 다릅니다.
링크는 Enter로만 열리고 Space로는 열리지 않습니다(Space는 페이지를 스크롤합니다).
링크는 새 탭에서 열기, 주소 복사, 방문 기록처럼 브라우저가 붙여 주는 기능이 있고, 스크린 리더는 링크 목록을 따로 모아 보여 줍니다.

그래서 이런 코드는 둘 다 어색합니다.

```html
<!-- 이동인데 button: 새 탭에서 열기, 주소 복사가 안 된다 -->
<button onclick="location.href='/settings'">설정</button>

<!-- 실행인데 a: href가 없으면 포커스도 받지 못한다 -->
<a onclick="openModal()">자세히</a>
```

`href` 없는 `<a>`는 링크가 아니라 자리 표시자일 뿐이라 포커스를 받지 못하고, 링크 역할도 갖지 않습니다.
`href="#"`을 넣어 해결하는 경우도 많은데, 그러면 "이동하지 않는 링크"가 되어 같은 혼란이 생깁니다.
React Router나 Next.js의 `Link`는 내부적으로 `<a href>`를 그리므로 이동에는 그대로 쓰면 됩니다.

## type="button"을 빼먹는 함정

`<button>`을 쓰기 시작하면 한 번쯤 만나는 버그가 있습니다.

```html
<form onsubmit="save(event)">
  <input name="title" />
  <button onclick="addTag()">태그 추가</button>
  <button>저장</button>
</form>
```

"태그 추가"를 눌렀는데 폼이 제출됩니다.
`<button>`의 `type` 기본값이 `submit`이기 때문입니다.
폼 안의 버튼은 `type`을 적지 않으면 전부 제출 버튼입니다.

입력창에서 Enter를 눌러도 비슷한 일이 생깁니다.
브라우저는 Enter를 누르면 폼의 **첫 번째 제출 버튼**을 누른 것처럼 처리합니다(암묵적 제출).
위 폼에서는 "태그 추가"가 첫 번째 제출 버튼이라, Enter를 누르면 `addTag()`가 실행되고 폼까지 제출됩니다.

그래서 규칙은 이렇습니다.
**제출이 아닌 버튼에는 항상 `type="button"`을 적습니다.**
제출 버튼에도 `type="submit"`을 명시해 두면 코드를 읽는 사람이 헷갈리지 않습니다.
폼 밖에 있는 버튼은 `type`이 없어도 제출할 폼이 없으니 당장은 문제가 없지만, 나중에 누군가 폼 안으로 옮기는 순간 버그가 됩니다. 버튼 컴포넌트를 만든다면 기본값을 `type="button"`으로 두는 편이 안전합니다.

## 아이콘 버튼에는 이름이 필요합니다

글자 없이 아이콘만 있는 버튼은 접근 가능한 이름이 비어 있기 쉽습니다.

```jsx
<button type="button" onClick={close}>
  <svg viewBox="0 0 24 24">...</svg>
</button>
```

스크린 리더는 이 버튼을 그냥 "버튼"이라고 읽습니다.
무슨 버튼인지 알 방법이 없습니다.
이름을 주는 방법은 두 가지입니다.

```jsx
// 1. aria-label
<button type="button" aria-label="닫기" onClick={close}>
  <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>
</button>

// 2. 화면에는 숨기고 보조 기술에는 읽히는 텍스트
<button type="button" onClick={close}>
  <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>
  <span className="visually-hidden">닫기</span>
</button>
```

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
```

장식용 아이콘에는 `aria-hidden="true"`를 붙여 이름 계산에서 빼 줍니다.
`display: none`은 보조 기술에서도 숨겨지므로 이름용 텍스트를 숨기는 데 쓰면 안 됩니다.
`title` 속성은 마우스를 올려야 보이고, 키보드와 터치 사용자에게는 보이지 않으며, 보조 기술마다 읽는 방식도 달라서 이름을 주는 주된 수단으로는 부족합니다.

이름은 동작을 짧게 말해야 합니다.
"X 아이콘"이 아니라 "닫기", "휴지통"이 아니라 "삭제"입니다.
목록의 각 행마다 삭제 버튼이 있다면 "삭제"만으로는 어느 행인지 모르니 "보고서 3 삭제"처럼 대상을 함께 넣는 것도 방법입니다.

## 스크린 리더로 직접 확인하기

접근성은 코드를 읽기보다 직접 써 보면 훨씬 빨리 이해됩니다.

- **키보드만 쓰기**: 마우스를 치우고 Tab, Shift+Tab, Enter, Space만으로 화면을 써 봅니다. 도착하지 못하는 요소, 포커스가 보이지 않는 곳, Enter가 먹지 않는 버튼이 바로 드러납니다.
- **macOS VoiceOver**: Cmd+F5로 켜고 끕니다. Safari와 함께 쓸 때 가장 안정적입니다.
- **Windows NVDA**: 무료 스크린 리더입니다. Windows에 기본으로 들어 있는 내레이터(Ctrl+Win+Enter)로도 기본적인 확인은 할 수 있습니다.
- **Chrome DevTools**: Elements 패널의 Accessibility 탭에서 선택한 요소의 역할과 이름, 그 이름이 어디서 계산됐는지를 볼 수 있습니다. 아이콘 버튼의 이름이 비어 있는지 확인하기에 가장 간편합니다.

처음 스크린 리더를 켜면 생각보다 많은 내용을 읽어서 당황스럽습니다.
처음에는 Tab으로 이동하면서 각 버튼을 뭐라고 읽는지만 들어 봐도 충분합니다.
`div` 버튼과 `button`을 나란히 두고 들어 보면 차이가 분명하게 들립니다.

## 정리

- `<button>`은 포커스, Enter·Space 동작, 버튼 역할, 이름, `disabled`, 폼 연동, 고대비 모드 지원을 기본으로 줍니다.
- `role="button"`은 기능이 아니라 약속입니다. `div`로 흉내 내려면 `tabIndex`, 키 이벤트, `aria-disabled`까지 모두 직접 챙겨야 하고, 그래도 빠지는 부분이 있습니다.
- 스타일 때문이라면 버튼의 기본 스타일을 걷어 내세요. 포커스 표시는 꼭 다시 줍니다.
- 이동은 `<a href>`, 실행은 `<button>`입니다.
- 폼 안의 버튼은 기본이 `submit`입니다. 제출이 아닌 버튼에는 `type="button"`을 적습니다.
- 아이콘 버튼에는 `aria-label`이나 숨긴 텍스트로 이름을 주고, 아이콘은 `aria-hidden`으로 감춥니다.

## 참고

- [MDN - The Button element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button)
- [W3C - Using ARIA](https://www.w3.org/TR/using-aria/)
- [WAI-ARIA Authoring Practices - Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
- [web.dev - Learn Accessibility](https://web.dev/learn/accessibility)
