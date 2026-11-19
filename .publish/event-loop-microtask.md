
다음 코드는 무엇을 어떤 순서로 출력할까요?

```js
console.log('A');

setTimeout(() => console.log('B'), 0);

Promise.resolve().then(() => console.log('C'));

console.log('D');
```

`setTimeout`에 0을 넘겼으니 바로 실행될 것 같습니다.
그런데 실제 출력은 `A`, `D`, `C`, `B`입니다.
0ms로 예약한 타이머가 Promise 콜백보다 늦습니다.

순서를 외워 두면 퀴즈는 맞힐 수 있습니다.
하지만 왜 그런지 알아 두면, 스피너가 안 뜨는 버그나 화면이 통째로 멈추는 버그를 만났을 때 원인을 바로 짚을 수 있습니다.
브라우저가 코드를 실행하는 순서부터 따라가 보겠습니다.

## 자바스크립트는 한 번에 하나만 실행합니다

브라우저의 메인 스레드에서 자바스크립트는 한 번에 한 작업만 실행합니다.
지금 실행 중인 함수들은 콜 스택(call stack)에 쌓입니다.
함수를 부르면 스택에 올라가고, 끝나면 내려옵니다.

그럼 `setTimeout`의 콜백이나 클릭 이벤트 핸들러는 언제 실행될까요?
이런 콜백은 나중에 실행할 일로 따로 줄을 서 있다가, 콜 스택이 비면 하나씩 꺼내 실행됩니다.
이 줄을 관리하며 계속 도는 과정이 이벤트 루프입니다.

줄은 크게 두 종류입니다.

- **태스크 큐(task queue)**: `setTimeout`·`setInterval` 콜백, 클릭이나 키 입력 같은 이벤트, `MessageChannel` 메시지 등. 흔히 매크로태스크라고도 부릅니다.
- **마이크로태스크 큐(microtask queue)**: Promise의 `then`·`catch`·`finally` 콜백, `await` 이후의 코드, `queueMicrotask`로 넣은 함수, `MutationObserver` 콜백.

HTML 표준에서 태스크 큐는 하나가 아니라 여러 개일 수 있고, 브라우저가 어느 큐에서 꺼낼지 고를 수 있습니다.
예를 들어 사용자 입력을 타이머보다 우선할 수 있습니다.
그래서 타이머와 클릭 중 무엇이 먼저 실행될지는 보장되지 않습니다.
반면 태스크와 마이크로태스크 사이의 순서는 명확하게 정해져 있습니다.

## 이벤트 루프 한 바퀴

이벤트 루프 한 바퀴를 단순하게 쓰면 이렇습니다.

1. 태스크 큐에서 태스크 **하나**를 꺼내 실행합니다. 스크립트 파일을 처음 실행하는 것도 하나의 태스크입니다.
2. 콜 스택이 비면 마이크로태스크 큐를 **빌 때까지 전부** 실행합니다. 실행 도중 새로 추가된 마이크로태스크도 이번에 같이 실행합니다.
3. 브라우저가 필요하다고 판단하면 화면을 갱신합니다. `requestAnimationFrame` 콜백, 스타일 계산, 레이아웃, 페인트가 여기서 일어납니다.
4. 1로 돌아갑니다.

핵심은 2번입니다.
태스크는 한 번에 하나씩, 마이크로태스크는 한 번에 전부 처리합니다.
그리고 마이크로태스크는 다음 태스크로 넘어가기 **전에** 처리됩니다.

이제 처음 퀴즈를 다시 보면 순서가 자연스럽습니다.

- 스크립트 실행(태스크)이 `A`를 찍습니다.
- 타이머 콜백은 0ms 뒤 태스크 큐로, `then` 콜백은 마이크로태스크 큐로 들어갑니다.
- `D`를 찍고 스크립트가 끝나 콜 스택이 빕니다.
- 마이크로태스크를 비웁니다. `C`.
- 다음 태스크로 타이머 콜백을 꺼냅니다. `B`.

`setTimeout(fn, 0)`의 0은 지금 바로가 아니라 "최소 0ms 뒤에 태스크로 실행해 달라"는 뜻입니다.
게다가 브라우저는 타이머 중첩이 5단계를 넘으면 최소 지연을 4ms로 올리고, 백그라운드 탭에서는 훨씬 더 늦추기도 합니다.
0ms 타이머는 정확한 시간 약속이 아닙니다.

## 퀴즈 2. await 이후의 코드

조금 더 헷갈리는 예제입니다.

```js
async function load() {
  console.log('1');
  await fetchData();
  console.log('2');
}

async function fetchData() {
  console.log('3');
}

console.log('4');
load();
setTimeout(() => console.log('5'), 0);
Promise.resolve().then(() => console.log('6'));
console.log('7');
```

정답은 `4`, `1`, `3`, `7`, `2`, `6`, `5`입니다.

여기에는 흔한 오해가 두 가지 있습니다.

첫째, async 함수를 부르면 함수 전체가 나중에 실행된다고 생각하기 쉽습니다.
실제로는 **첫 번째 `await`까지는 동기로** 실행됩니다.
그래서 `1`과 `3`이 `7`보다 먼저 나옵니다.
`new Promise((resolve) => { ... })`에 넘긴 함수도 마찬가지로 그 자리에서 바로 실행됩니다.
Promise를 쓴다고 코드가 저절로 비동기가 되지는 않습니다.

둘째, `await` 다음 줄은 기다리던 값이 준비되면 곧바로 실행된다고 생각하기 쉽습니다.
실제로는 `await` 이후의 코드는 마이크로태스크로 예약됩니다.
`fetchData()`가 이미 끝난 Promise를 돌려줬는데도, `2`는 현재 스크립트가 끝난 뒤에야 찍힙니다.
`await`는 함수를 그 지점에서 잘라 나머지를 `then` 콜백으로 넘기는 것과 비슷하게 동작합니다.

`2`가 `6`보다 먼저인 이유는 마이크로태스크 큐에 먼저 들어갔기 때문입니다.
`load()` 안의 `await`가 아래쪽 `Promise.resolve().then()`보다 먼저 실행됐습니다.

참고로 `await`가 몇 번의 마이크로태스크를 거치는지는 기다리는 값에 따라 다릅니다.
네이티브 Promise를 기다리면 한 번이지만, 직접 만든 thenable 객체를 기다리거나 async 함수 안에서 Promise를 `return`하면 단계가 더 끼어듭니다.
이런 미세한 순서에 기대는 코드는 읽기 어렵고 쉽게 깨집니다.
순서가 중요하다면 `await`로 명시적으로 이어 주는 편이 낫습니다.

## queueMicrotask는 언제 쓸까

`queueMicrotask(fn)`은 Promise를 만들지 않고 마이크로태스크를 직접 예약합니다.

```js
queueMicrotask(() => {
  console.log('현재 코드가 끝난 직후, 다음 태스크보다 먼저');
});
```

`Promise.resolve().then(fn)`과 실행 시점은 같지만 의도가 분명합니다.
콜백에서 에러가 나면 처리되지 않은 Promise 거부가 아니라 일반 예외로 보고된다는 차이도 있습니다.

쓸 만한 경우는 같은 태스크 안에서 여러 번 일어나는 일을 모아서 한 번에 처리하고 싶을 때입니다.

```js
let pending = [];
let scheduled = false;

function track(event) {
  pending.push(event);
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    send(pending);
    pending = [];
    scheduled = false;
  });
}

track('a');
track('b');
track('c'); // send는 ['a', 'b', 'c']로 한 번만 호출된다
```

현재 코드가 다 끝난 직후, 다른 이벤트나 렌더링이 끼어들기 전에 실행됩니다.
그래서 상태가 어중간한 순간을 다른 코드나 화면이 보지 못합니다.
여러 UI 라이브러리가 상태 변경을 모아서 처리할 때 비슷한 방식을 씁니다.

## 렌더링은 마이크로태스크 사이에 끼어들지 않습니다

이벤트 루프 한 바퀴에서 렌더링은 3번, 마이크로태스크를 다 비운 **뒤**였습니다.
이 순서 때문에 실무에서 자주 버그가 생깁니다.

```js
button.addEventListener('click', () => {
  spinner.hidden = false; // 스피너를 보여 주고
  heavyCalculation();     // 2초 걸리는 동기 계산
  spinner.hidden = true;  // 숨긴다
});
```

스피너는 한 번도 보이지 않습니다.
DOM 값은 바로 바뀌지만, 화면을 그릴 기회는 이 클릭 핸들러(태스크)가 끝난 뒤에야 옵니다.
그때는 이미 `hidden = true`로 돌아간 상태입니다.
사용자는 2초 동안 멈춘 화면만 봅니다.

`heavyCalculation()`을 `Promise.resolve().then()` 안으로 옮겨도 똑같습니다.
마이크로태스크는 렌더링 전에 실행되기 때문입니다.
"비동기로 바꿨는데 왜 그대로지?"라는 질문의 상당수가 여기서 나옵니다.

렌더링 기회를 주려면 **다음 태스크**로 넘겨야 합니다.

```js
button.addEventListener('click', () => {
  spinner.hidden = false;
  // 다음 프레임이 그려진 뒤에 계산을 시작한다
  requestAnimationFrame(() => {
    setTimeout(() => {
      heavyCalculation();
      spinner.hidden = true;
    }, 0);
  });
});
```

`requestAnimationFrame` 콜백은 페인트 직전에 실행됩니다.
그 안에서 `setTimeout`을 걸면 스피너가 그려진 다음 태스크에서 계산이 시작됩니다.

물론 계산이 도는 2초 동안은 여전히 스크롤도 클릭도 되지 않습니다.
근본적으로는 계산을 잘게 나눠 중간중간 메인 스레드를 양보하거나, Web Worker로 옮겨야 합니다.
작업 중간에 양보하는 용도로 `scheduler.yield()`라는 API도 나와 있습니다.
작성 시점 기준 브라우저마다 지원이 달라서, 쓰기 전에 MDN 호환성 표를 확인해야 합니다.

## 마이크로태스크 무한 루프는 화면을 멈춥니다

두 함수를 비교해 보겠습니다.

```js
function loopWithTimeout() {
  setTimeout(loopWithTimeout, 0);
}

function loopWithMicrotask() {
  queueMicrotask(loopWithMicrotask);
}
```

`loopWithTimeout`은 영원히 돌지만 페이지는 멀쩡합니다.
매 바퀴가 별도의 태스크라서, 그 사이사이에 클릭 이벤트도 처리되고 화면도 그려집니다.
CPU를 조금 낭비할 뿐입니다.

`loopWithMicrotask`는 페이지를 완전히 멈춥니다.
마이크로태스크를 처리하는 동안 새 마이크로태스크가 계속 추가되고, 이벤트 루프는 큐가 빌 때까지 다음 단계로 넘어가지 않습니다.
렌더링도, 입력 처리도, 다른 타이머도 영원히 차례를 기다립니다.
`while (true) {}`와 다를 바가 없습니다.

이렇게 대놓고 쓸 일은 없지만, 비슷한 구조는 의외로 쉽게 생깁니다.

```js
async function waitUntilReady() {
  while (!state.ready) {
    await null; // 잠깐 쉬었다가 다시 확인하려는 의도
  }
  return state;
}
```

`await null`은 잠깐 쉬는 것처럼 보이지만 실제로는 마이크로태스크 하나만큼만 미룹니다.
`state.ready`를 바꿔 줄 코드(네트워크 응답, 타이머, 사용자 입력)는 태스크로 들어오기 때문에 끝내 실행되지 못합니다.
탭은 응답하지 않게 됩니다.

정말 기다려야 한다면 `setTimeout`으로 다음 태스크까지 넘기거나, 더 좋게는 준비가 끝났을 때 resolve되는 Promise를 받아 `await`해야 합니다.

## Node.js에서는 조금 다릅니다

Node.js도 태스크와 마이크로태스크를 구분하는 큰 틀은 같습니다.
다만 `process.nextTick`으로 넣은 콜백이 별도의 큐에 쌓이고, Promise 마이크로태스크보다 먼저 처리됩니다.
타이머, I/O 콜백, `setImmediate`가 이벤트 루프의 서로 다른 단계(phase)에서 실행되는 것도 브라우저와 다른 점입니다.
브라우저에서 확인한 순서를 Node.js 코드에 그대로 가정하지 않는 편이 안전합니다.

## 정리

- 이벤트 루프는 태스크를 **하나** 실행하고, 마이크로태스크를 **전부** 비운 뒤, 필요하면 화면을 그립니다.
- `setTimeout(fn, 0)`은 태스크이고, `then` 콜백과 `await` 이후 코드, `queueMicrotask`는 마이크로태스크입니다. 그래서 Promise 쪽이 먼저 실행됩니다.
- async 함수는 첫 `await`까지 동기로 실행되고, `await` 이후 코드는 이미 끝난 Promise를 기다려도 마이크로태스크로 미뤄집니다.
- 렌더링은 마이크로태스크 사이에 끼어들지 않습니다. 화면을 갱신할 기회를 주려면 다음 태스크로 넘겨야 합니다.
- 마이크로태스크가 끝없이 새 마이크로태스크를 만들면 `while (true)`처럼 페이지가 멈춥니다.

## 참고

- [MDN - Using microtasks in JavaScript with queueMicrotask()](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide)
- [MDN - In depth: Microtasks and the JavaScript runtime environment](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide/In_depth)
- [MDN - setTimeout()](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout)
- [HTML Standard - Event loops](https://html.spec.whatwg.org/multipage/webappapis.html#event-loops)
- [Jake Archibald - Tasks, microtasks, queues and schedules](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/)
