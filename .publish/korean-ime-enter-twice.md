
채팅 입력창을 만들었습니다. Enter를 누르면 메시지를 보내고 입력창을 비우는 흔한 구조입니다.

```js
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    send(input.value);
    input.value = '';
  }
});
```

영어로 테스트하면 완벽합니다. 그런데 한글로 `안녕`을 치고 Enter를 누르면 이상한 일이 생깁니다. `안녕`이 전송되고 곧이어 빈 메시지나 `녕`이 한 번 더 전송됩니다. 환경에 따라서는 전송은 한 번인데 입력창에 `녕`이 남아 있기도 합니다.

영어권 개발자가 만든 라이브러리나 예제를 가져다 쓰면 자주 만나는 버그입니다. 원인은 한글 입력에서 키 하나가 글자 하나로 바로 대응하지 않는다는 데 있습니다.

## 한글은 "조합"을 거쳐서 입력됩니다

영어 `a`는 키를 누르는 순간 확정된 글자입니다. 한글 `안`은 다릅니다. `ㅇ`을 누르면 `ㅇ`, `ㅏ`를 누르면 `아`, `ㄴ`을 누르면 `안`이 됩니다. 여기서 `ㄴ`은 아직 `안`의 받침인지, 다음 글자 `나`의 첫소리인지 정해지지 않았습니다. 다음 키가 `ㅕ`라면 `아` + `녀`로 바뀌어야 하기 때문입니다.

이렇게 글자를 확정하기 전까지 조립하는 과정을 **조합(composition)** 이라고 하고, 이 일을 맡는 프로그램을 IME(Input Method Editor)라고 부릅니다. 한글뿐 아니라 일본어, 중국어 입력도 IME를 거칩니다. 일본어는 변환 후보를 고르느라 조합 시간이 훨씬 길기도 합니다. 조합 중인 글자에 그어진 밑줄이 "아직 확정되지 않았다"는 표시입니다.

조합은 다음 글자를 시작하거나, 스페이스나 Enter 같은 키를 누르거나, 입력창 바깥을 클릭할 때 확정됩니다. 문제는 **Enter가 두 가지 일을 동시에 한다**는 데 있습니다. IME에게는 "조합을 확정하라"는 신호이고, 우리 코드에게는 "전송하라"는 신호입니다.

## 조합 과정에서 일어나는 이벤트

브라우저는 조합을 다음 이벤트로 알려 줍니다.

- `compositionstart`: 조합이 시작될 때
- `compositionupdate`: 조합 중인 글자가 바뀔 때
- `compositionend`: 조합이 확정되거나 취소될 때

그리고 조합 중에 일어나는 키 이벤트에는 표시가 붙습니다.

- `KeyboardEvent.isComposing`: 조합 중에 발생한 키 이벤트면 `true`
- `KeyboardEvent.keyCode`: 조합 중인 키 이벤트는 실제 키와 상관없이 `229`인 경우가 많습니다.

`keyCode`는 오래전에 폐기 예정(deprecated)으로 표시된 속성입니다. 그래도 IME 처리에서는 `229` 값이 여전히 유용한 신호라서 많은 라이브러리가 함께 확인합니다. `input` 이벤트에도 `isComposing`이 있고, 조합 중의 `beforeinput`·`input` 이벤트는 `inputType`이 `insertCompositionText`로 나옵니다.

## 두 번 전송되는 이유

`안녕`을 치고 Enter를 누르는 순간, 환경에 따라 이런 순서로 이벤트가 올 수 있습니다.

1. `keydown` (Enter, `isComposing: true`, `keyCode: 229`). 아직 `녕`이 조합 중입니다.
2. `compositionend`. `녕`이 확정됩니다.
3. `keydown` (Enter, `isComposing: false`, `keyCode: 13`).

처음 코드는 `event.key === 'Enter'`만 봅니다. 1번과 3번 모두 `key`가 `'Enter'`라서 **두 번 전송**합니다.

전송이 한 번만 일어나는 환경에서도 문제는 남습니다. 1번 시점에 `input.value = ''`로 입력창을 비웠는데, IME는 그 직후 조합 중이던 `녕`을 확정해서 입력창에 넣습니다. 그래서 비운 입력창에 `녕`이 남습니다. 조합 중에 입력창 값을 바꾸면 IME의 동작과 부딪힙니다.

여기까지 읽고 "그럼 3번만 처리하면 되겠다"고 생각하기 쉽습니다. 그런데 이 순서가 환경마다 달라서 문제가 까다로워집니다.

## 브라우저마다, 운영체제마다, 입력기마다 다릅니다

IME 관련 이벤트 순서는 브라우저, 운영체제, 입력기(OS 기본 입력기인지 다른 입력기인지)의 조합에 따라 달라집니다. 표준(UI Events 명세)이 큰 틀을 정하지만, IME가 운영체제 쪽 소프트웨어라 세부 순서까지 통일되지는 않았습니다.

개발자들 사이에서 자주 보고되는 차이로, 조합 중 Enter에 `keydown`이 한 번만 오는 환경과 위처럼 조합 중·조합 후 두 번 오는 환경이 있습니다. 특히 Safari에서는 `compositionend`가 Enter의 `keydown`보다 **먼저** 와서, 그 `keydown`의 `isComposing`이 `false`로 나온다는 보고가 많습니다. 이때 `keyCode`는 `229`로 나오는 경우가 많습니다.

이 목록을 외워서 분기하는 방법은 좋지 않습니다. 브라우저 업데이트로 바뀌기도 하고, 사용자가 쓰는 입력기까지 다 확인할 수는 없습니다. 대신 어떤 순서로 오든 **두 번 전송되지 않고, 남은 글자가 생기지 않는** 코드를 목표로 합니다. 그리고 실제로 지원하는 브라우저와 OS에서 직접 쳐 보고 확인해야 합니다.

## 방어적인 처리 1단계: 조합 중인 Enter는 무시한다

먼저 조합 중의 키 이벤트를 걸러 냅니다.

```js
input.addEventListener('keydown', (event) => {
  if (event.isComposing || event.keyCode === 229) return;

  if (event.key === 'Enter') {
    event.preventDefault();
    send();
  }
});
```

`isComposing`만 보지 않고 `keyCode === 229`를 함께 보는 이유는 앞의 Safari 같은 경우 때문입니다. `isComposing`이 `false`로 와도 `229`라면 IME가 처리한 키라는 뜻이니 건너뜁니다.

조합 중·조합 후 `keydown`이 두 번 오는 환경에서는 첫 번째를 무시하고 두 번째에서 전송하므로, Enter 한 번에 전송됩니다. 조합을 확정하는 `keydown`만 오는 환경에서는 그 Enter가 무시되고, 사용자가 Enter를 한 번 더 눌러야 전송됩니다.

뒤의 경우가 마음에 걸릴 수 있습니다. 하지만 확정용 Enter와 전송용 Enter가 따로 있는 동작은 일본어 입력 사용자에게는 익숙하고, 적어도 잘못된 메시지가 나가지는 않습니다. 두 번 전송되거나 글자가 남는 것보다는 훨씬 낫습니다.

## 방어적인 처리 2단계: 조합 종료 직후를 표시한다

`keyCode`가 폐기 예정이라 신경 쓰이거나, 조합이 막 끝난 직후의 Enter를 확실히 구분하고 싶다면 조합 이벤트로 직접 상태를 관리할 수 있습니다.

```js
let composing = false;
let justComposed = false;

input.addEventListener('compositionstart', () => {
  composing = true;
});

input.addEventListener('compositionend', () => {
  composing = false;
  justComposed = true;
  // 같은 Enter로 이어지는 keydown까지만 표시를 유지한다
  setTimeout(() => {
    justComposed = false;
  }, 0);
});

input.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey) return;
  if (composing || justComposed || event.isComposing || event.keyCode === 229) return;

  event.preventDefault();
  send();
});
```

`compositionend` 직후 아주 짧은 시간 동안 `justComposed`를 켜 둡니다. `compositionend`가 `keydown`보다 먼저 오는 환경에서도 그 `keydown`을 조합 확정용으로 판단할 수 있습니다.

다만 `setTimeout(0)`이 같은 키 입력의 `keydown`보다 늦게 실행된다는 것도 브라우저의 이벤트 처리 방식에 기댄 가정입니다. 그래서 이 방식은 1단계를 대신하지 않고, 함께 쓰는 보조 장치로 보는 편이 좋습니다. 이 경우에도 실제 브라우저에서 꼭 확인해야 합니다.

## 채팅 입력창 예제

실무에서 쓰는 채팅창은 보통 여러 줄 입력이 되는 `textarea`이고, Shift+Enter는 줄바꿈, Enter는 전송입니다. React로 쓰면 이렇습니다.

```jsx
function ChatInput({ onSend }) {
  const [text, setText] = useState('');

  function handleKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return;

    // React의 합성 이벤트 대신 원래 이벤트에서 조합 여부를 확인한다
    const native = event.nativeEvent;
    if (native.isComposing || native.keyCode === 229) return;

    event.preventDefault(); // textarea에 줄바꿈이 들어가지 않게
    const message = text.trim();
    if (!message) return;   // 빈 메시지는 보내지 않는다

    onSend(message);
    setText('');
  }

  return (
    <textarea
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={handleKeyDown}
      rows={1}
      aria-label="메시지 입력"
    />
  );
}
```

조합 여부는 `event.nativeEvent.isComposing`으로 확인합니다. React 버전과 타입 정의에 따라 합성 이벤트에서 `isComposing`을 바로 쓸 수 없는 경우가 있어서, 원래 이벤트를 꺼내 보는 편이 확실합니다. `preventDefault()`는 전송할 때만 부릅니다. 조합 중인 Enter에 `preventDefault()`를 부르면 환경에 따라 조합 확정이 꼬일 수 있습니다.

빈 메시지 검사는 혹시 이벤트가 한 번 더 오더라도 빈 메시지가 나가지 않게 하는 마지막 안전장치로, 앞의 "빈 메시지가 한 번 더 전송" 증상을 막아 줍니다. 전송 버튼을 따로 두면 키보드 이벤트 처리가 꼬이는 환경에서도 사용자가 우회할 수 있습니다.

## form submit에 맡기면 될까

`<input>` 하나짜리 `<form>`이라면 Enter로 폼이 제출되는 기본 동작(암묵적 제출)을 쓰는 방법도 있습니다. `keydown`을 직접 다루지 않으니 코드가 간단해집니다. 조합 중인 Enter로는 제출하지 않는 브라우저가 많지만, 이것 역시 환경별로 직접 확인해야 합니다. `textarea`에서는 Enter가 줄바꿈이라 이 방법을 쓸 수 없습니다.

## 테스트하는 방법

이 버그가 오래 살아남는 이유는 테스트 환경 때문입니다. 자동화 테스트 도구로 `type('안녕')`을 하면 대부분 IME를 거치지 않고 글자를 바로 넣습니다. 조합 이벤트가 일어나지 않으니 테스트는 통과합니다. 개발자가 영어로만 테스트하면 당연히 재현되지 않습니다.

그래서 수동 확인이 필요합니다. 지원하는 브라우저(Chrome, Safari, Firefox, Edge)와 OS(Windows, macOS, 가능하면 모바일)에서 실제 한글 입력기로 다음을 쳐 봅니다.

- 받침 있는 글자로 끝나는 문장 + Enter (`안녕`, `감사합니다`)
- 받침 없는 글자로 끝나는 문장 + Enter (`하이`)
- 조합 중에 Shift+Enter
- 일본어 입력기로 변환 후보를 띄운 상태에서 Enter

이벤트 순서가 궁금하면 이벤트를 모두 로그로 찍어 보면 됩니다.

```js
['keydown', 'keyup', 'compositionstart', 'compositionupdate', 'compositionend', 'beforeinput', 'input']
  .forEach((type) => {
    input.addEventListener(type, (event) => {
      console.log(type, event.key ?? event.data, event.isComposing, event.keyCode);
    });
  });
```

같은 키를 눌러도 브라우저마다 로그가 다르게 찍히는 걸 보면 왜 방어적으로 써야 하는지 바로 알 수 있습니다.

## 참고

- [MDN - KeyboardEvent.isComposing](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing)
- [MDN - Element: compositionend event](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event)
- [MDN - Element: keydown event](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event)
- [W3C - UI Events](https://www.w3.org/TR/uievents/)
