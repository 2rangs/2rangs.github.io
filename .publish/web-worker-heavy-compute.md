
사용자가 10만 행짜리 CSV 파일을 올립니다. 파싱하고 집계하는 동안 로딩 스피너를 띄웠는데, 스피너가 돌지 않습니다. 멈춘 채로 3초쯤 있다가 결과와 함께 사라집니다. 그동안 버튼도, 스크롤도, 입력창도 반응하지 않았습니다.

"그럼 async 함수로 바꾸면 되지 않을까" 싶어 이렇게 고쳐 봅니다.

```js
async function analyze(file) {
  const text = await file.text();
  return heavyAggregate(parseCsv(text)); // 여전히 3초 동안 멈춘다
}
```

똑같이 멈춥니다. `async`가 있어도 `parseCsv`와 `heavyAggregate`는 평범한 동기 코드라, 실행되는 동안 다른 일을 할 수 없습니다. Promise는 "나중에 실행한다"는 약속이지 "다른 곳에서 실행한다"는 뜻이 아닙니다. 이 주제에서 가장 흔한 오해입니다.

## 메인 스레드는 하나입니다

브라우저 탭의 JavaScript는 기본적으로 메인 스레드 하나에서 실행됩니다. 그런데 이 스레드는 JavaScript만 하는 게 아닙니다. 클릭과 키 입력 같은 이벤트 처리, 스타일 계산, 레이아웃, 페인트도 상당 부분 같은 스레드에서 일어납니다.

메인 스레드는 이벤트 루프로 돌아갑니다. 작업 하나를 꺼내서 끝까지 실행하고, 필요하면 화면을 그리고, 다음 작업을 꺼냅니다. **작업 하나가 끝나기 전에는 화면을 그릴 기회도, 클릭을 처리할 기회도 없습니다.** 3초짜리 계산은 3초 동안 이벤트 루프를 붙잡고 있고, 스피너가 돌지 않았던 것도 그래서입니다. `transform`이나 `opacity`만 바꾸는 CSS 애니메이션은 브라우저가 컴포지터 스레드에서 돌릴 수 있어서 계속 돌기도 하지만, JavaScript로 프레임마다 그리는 스피너나 레이아웃을 바꾸는 애니메이션은 함께 멈춥니다. 스피너가 돌더라도 클릭에 반응하지 못하는 건 마찬가지입니다.

브라우저는 50ms를 넘는 작업을 긴 작업(long task)으로 봅니다. Core Web Vitals의 INP(Interaction to Next Paint)도 사용자가 무언가를 눌렀을 때 다음 화면이 그려지기까지의 시간을 재는데, 긴 작업이 있으면 이 값이 그대로 나빠집니다.

해결 방향은 두 가지입니다. 하나는 계산을 잘게 쪼개서 `setTimeout`이나 `scheduler.yield()`로 중간중간 메인 스레드를 양보하는 것인데, 간단하지만 전체 시간은 오히려 늘고 쪼갤 수 없는 계산에는 쓸 수 없습니다. 다른 하나는 계산을 아예 다른 스레드로 옮기는 것이고, 그게 Web Worker입니다.

## Worker 만들기

Worker는 메인 스레드와 따로 도는 스레드에서 스크립트를 실행합니다. 이벤트 루프와 전역 객체가 따로 있고, 메인 스레드와는 메시지로만 대화합니다.

```js
// csv.worker.js
self.onmessage = (event) => {
  const { id, text } = event.data;
  const rows = parseCsv(text);
  const summary = heavyAggregate(rows);
  self.postMessage({ id, summary });
};
```

```js
// main.js
const worker = new Worker(new URL('./csv.worker.js', import.meta.url), { type: 'module' });

worker.onmessage = (event) => {
  const { summary } = event.data;
  renderSummary(summary);
};

worker.onerror = (event) => {
  showError(event.message);
};

async function analyze(file) {
  const text = await file.text();
  worker.postMessage({ id: 1, text });
}
```

이제 3초짜리 계산이 도는 동안에도 메인 스레드는 비어 있습니다. 스피너가 돌고, 스크롤도 되고, 다른 버튼도 눌립니다.

`new URL('./csv.worker.js', import.meta.url)`이라는 모양에는 이유가 있습니다. 그냥 `new Worker('./csv.worker.js')`라고 쓰면 그 경로는 현재 페이지 기준으로 해석되고, 번들러는 이 문자열이 파일을 가리킨다는 걸 알지 못합니다. `new URL(..., import.meta.url)`로 쓰면 지금 모듈 파일을 기준으로 경로를 풀고, Vite나 webpack 5 같은 번들러가 이 패턴을 알아보고 Worker 파일을 따로 묶은 뒤 빌드된 주소로 바꿔 줍니다. Vite에서는 이 패턴이 `new Worker(...)` 호출 안에 그대로 들어 있어야 인식됩니다. Vite는 `import MyWorker from './csv.worker.js?worker'`처럼 접미사로 가져오는 방법도 제공합니다.

`{ type: 'module' }`을 주면 Worker 안에서 `import` 문을 쓸 수 있습니다. 주지 않으면 예전 방식(classic) Worker가 되고, 다른 스크립트는 `importScripts()`로 불러와야 합니다.

### Worker에서 할 수 없는 일

Worker는 다른 스레드라서 **DOM에 접근할 수 없습니다.** `document`도 `window`도 없고, `document.querySelector`를 부르면 `document is not defined` 오류가 납니다. DOM은 여러 스레드가 동시에 건드리도록 설계되지 않았기 때문입니다. 그래서 Worker는 데이터를 받아 계산하고 결과를 돌려주는 일만 맡고, 화면을 바꾸는 일은 결과를 받은 메인 스레드가 합니다.

대신 Worker에서도 쓸 수 있는 API는 꽤 많습니다. `fetch`, `setTimeout`, `IndexedDB`, `WebSocket`, `crypto`, 그리고 `OffscreenCanvas`가 있고, `OffscreenCanvas`를 쓰면 캔버스 그리기도 Worker에서 할 수 있습니다. 자세한 목록은 MDN의 "Functions and classes available to Web Workers" 문서에서 확인할 수 있습니다.

## postMessage는 공짜가 아닙니다

메인 스레드와 Worker는 메모리를 공유하지 않습니다. `postMessage`로 보낸 객체는 참조가 넘어가는 게 아니라 **복사**되고, 이때 쓰는 알고리즘이 구조화된 복제(structured clone)입니다.

구조화된 복제는 `JSON.stringify`보다 많은 것을 복사합니다. `Map`, `Set`, `Date`, `RegExp`, `ArrayBuffer`, 타입 배열, 순환 참조까지 다룹니다. 하지만 복사할 수 없는 것도 있습니다.

- **함수**: 함수가 들어 있으면 `DataCloneError`가 납니다. 콜백을 넘길 수 없다는 뜻입니다.
- **DOM 노드**: 마찬가지로 복사할 수 없습니다.
- **클래스 인스턴스**: 오류는 안 나지만 평범한 객체로 도착합니다. 프로토타입이 사라져서 메서드를 부를 수 없습니다.

그리고 복사에는 시간이 듭니다. 보내는 쪽에서 직렬화하고 받는 쪽에서 다시 만드는데, 데이터가 크면 이 비용이 커집니다. 특히 **직렬화는 `postMessage`를 부른 스레드에서 일어납니다.** 수백 MB짜리 객체를 메인 스레드에서 보내면, 계산은 옮겼는데 보내는 순간 메인 스레드가 멈추는 일이 생깁니다.

그래서 Worker에 무엇을 보낼지 고르는 것도 설계의 일부입니다. 앞의 예에서 파싱된 10만 개 객체 배열을 보내지 않고 원본 텍스트를 보낸 것도 그 때문입니다. 문자열 하나를 보내고 파싱을 Worker에서 하면 보내는 비용도 Worker 쪽으로 넘어갑니다. 결과도 마찬가지로, 10만 행을 통째로 돌려주기보다 화면에 필요한 집계 결과만 돌려주는 편이 낫습니다.

## 복사 대신 넘겨주기: Transferable

큰 이진 데이터는 복사하지 않고 **소유권을 넘길** 수 있습니다. `postMessage`의 두 번째 인자에 넘길 객체를 적으면 됩니다.

```js
// main.js: 캔버스 픽셀을 Worker로 넘긴다
const imageData = ctx.getImageData(0, 0, width, height);
const buffer = imageData.data.buffer;

worker.postMessage({ buffer, width, height }, [buffer]);
console.log(buffer.byteLength); // 0. 이제 이 스레드에서는 쓸 수 없다
```

```js
// image.worker.js
self.onmessage = (event) => {
  const { buffer, width, height } = event.data;
  const pixels = new Uint8ClampedArray(buffer);
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = gray;
  }
  self.postMessage({ buffer, width, height }, [buffer]); // 다시 넘겨준다
};
```

```js
// main.js: 돌려받아 그린다
worker.onmessage = (event) => {
  const { buffer, width, height } = event.data;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0);
};
```

넘겨준 `ArrayBuffer`는 보낸 쪽에서 "분리(detached)"되어 길이가 0이 됩니다. 메모리를 복사하지 않고 주인만 바꾸므로 크기와 상관없이 거의 즉시 끝납니다. 대신 같은 데이터를 양쪽이 동시에 쓸 수는 없습니다.

타입 배열은 그 자체가 아니라 `.buffer`를 넘긴다는 점에 주의합니다. `ArrayBuffer` 말고도 `MessagePort`, `ImageBitmap`, `OffscreenCanvas` 등이 Transferable입니다.

정말로 메모리를 함께 쓰고 싶다면 `SharedArrayBuffer`가 있습니다. 다만 보안상의 이유로 페이지가 교차 출처 격리(cross-origin isolation) 상태여야 하고, 이를 위해 `Cross-Origin-Opener-Policy`와 `Cross-Origin-Embedder-Policy` 응답 헤더를 설정해야 합니다. 여러 스레드가 같은 메모리를 건드리니 `Atomics`로 동기화도 직접 해야 합니다. 대부분의 경우 Transferable로 충분합니다.

## 메시지 대신 함수 호출처럼: Comlink

메시지를 주고받는 코드는 금방 지저분해집니다. 요청에 ID를 붙이고, 응답을 ID로 짝지어 Promise를 풀어 주고, 에러도 따로 전달해야 합니다. Comlink는 이 일을 대신해 주는 작은 라이브러리입니다.

```js
// math.worker.js
import * as Comlink from 'comlink';

const api = {
  aggregate(text) {
    return heavyAggregate(parseCsv(text));
  },
};

Comlink.expose(api);
```

```js
// main.js
import * as Comlink from 'comlink';

const worker = new Worker(new URL('./math.worker.js', import.meta.url), { type: 'module' });
const api = Comlink.wrap(worker);

const summary = await api.aggregate(text); // Worker의 함수를 부르는 것처럼
```

`wrap`이 돌려준 객체의 메서드를 부르면 Comlink가 메시지로 바꿔 보내고 결과를 Promise로 돌려줍니다. Worker에서 던진 에러도 호출한 쪽의 Promise 거부로 전달됩니다. Transferable로 넘기고 싶을 때는 `Comlink.transfer(value, [buffer])`로 감쌉니다.

편해졌다고 해서 원리가 바뀐 것은 아닙니다. 함수처럼 보여도 인자와 반환값은 여전히 구조화된 복제를 거칩니다. 그래서 콜백 함수를 넘기려면 `Comlink.proxy()`로 감싸야 하고, 큰 객체를 주고받는 비용도 그대로입니다.

### 취소는 terminate로

메인 스레드에서 돌던 3초짜리 동기 계산은 중간에 멈출 방법이 없지만 Worker는 다릅니다. 사용자가 다른 파일을 골랐다면 진행 중인 Worker를 끝내 버리면 됩니다.

```js
worker.terminate(); // 진행 중인 계산과 함께 Worker가 즉시 종료된다
worker = new Worker(new URL('./csv.worker.js', import.meta.url), { type: 'module' });
```

React에서 Worker를 쓴다면 `useEffect`에서 만들고 정리 함수에서 `terminate()`를 부릅니다. 그렇지 않으면 컴포넌트가 사라진 뒤에도 Worker가 남아 메모리를 차지합니다. Worker 하나를 계속 쓰면서 요청을 여러 번 보낸다면 응답에도 요청 ID를 붙여 오래된 응답을 무시해야 합니다. 늦게 끝난 이전 계산의 결과가 최신 결과를 덮어쓸 수 있기 때문입니다.

## Worker가 오히려 손해일 때

Worker는 공짜 성능이 아닙니다. 수 밀리초면 끝나는 짧은 계산은 메시지를 주고받는 비용이 계산보다 클 수 있고, Worker를 처음 만들 때는 스크립트를 불러오고 실행 환경을 준비하는 시간도 듭니다.

주고받는 데이터가 계산보다 클 때도 손해입니다. 큰 객체를 복사해서 보내고 큰 결과를 복사해서 받는다면 메인 스레드는 그 복사 동안 여전히 멈춥니다. 앞에서 본 것처럼 무엇을 보내고 받을지 줄이거나 Transferable을 써야 합니다.

화면이 느린 원인이 레이아웃이나 수천 개의 DOM 노드라면 Worker로 옮길 수 있는 게 없습니다. 이럴 때는 가상 스크롤처럼 그리는 양을 줄이는 쪽으로 가야 합니다. Worker를 너무 많이 만드는 것도 문제입니다. Worker마다 별도의 JavaScript 실행 환경과 메모리를 쓰니, 병렬로 나누더라도 `navigator.hardwareConcurrency`가 알려 주는 논리 코어 수 정도를 넘기면 이득이 없습니다.

그래서 먼저 Performance 패널에서 긴 작업이 정말 JavaScript 계산인지 확인합니다. 노란색(Scripting) 막대가 길다면 Worker 후보이고, 보라색(Rendering)이나 초록색(Painting)이 길다면 다른 곳을 봐야 합니다.

## 참고

- [MDN - Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [MDN - The structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
- [MDN - Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
- [Vite - Web Workers](https://vite.dev/guide/features.html#web-workers)
- [Comlink (GitHub)](https://github.com/GoogleChromeLabs/comlink)
- [web.dev - Optimize long tasks](https://web.dev/articles/optimize-long-tasks)
