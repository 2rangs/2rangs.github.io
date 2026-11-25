
아침에 열어 둔 관리자 대시보드가 오후가 되면 눈에 띄게 느려집니다. 스크롤이 끊기고, 탭을 전환할 때마다 잠깐씩 멈추다가, 새로고침하면 다시 멀쩡해집니다. 작업 관리자를 열어 보면 그 탭 하나가 메모리를 1GB 넘게 쓰고 있기도 합니다.

페이지 이동이 없는 SPA에서 자주 보는 장면입니다. 전통적인 웹 페이지는 링크를 누를 때마다 문서가 통째로 버려져서 메모리가 저절로 정리됐습니다. SPA는 한 문서 안에서 화면만 갈아 끼우기 때문에, 정리하지 않은 것이 몇 시간 동안 계속 쌓입니다.

## 가비지 컬렉터는 "안 쓰는 것"이 아니라 "닿을 수 없는 것"을 치웁니다

가비지 컬렉터가 있는데 왜 메모리가 샐까요. 가비지 컬렉터는 개발자의 의도를 모릅니다. 이 객체를 앞으로 쓸지 안 쓸지 판단할 방법이 없습니다. 대신 훨씬 기계적인 기준을 씁니다. **도달 가능성(reachability)** 입니다.

- 전역 객체(`window`), 현재 실행 중인 함수의 지역 변수 같은 것을 뿌리(root)로 삼습니다.
- 뿌리에서 참조를 따라가서 닿는 객체는 모두 "살아 있다"고 봅니다.
- 어디에서도 닿지 않는 객체만 회수합니다.

이 방식을 mark-and-sweep이라고 부릅니다. 서로를 참조하는 두 객체라도 뿌리에서 닿지 않으면 함께 회수되므로, 순환 참조 자체는 문제가 되지 않습니다.

그러니 자바스크립트의 메모리 누수를 정확히 말하면 이런 상태입니다.

> 더 이상 쓰지 않는 객체가, 어딘가에 남은 참조 하나 때문에 뿌리에서 여전히 닿는다.

닿을 수 있는 객체를 지우면 안 되니 컬렉터는 제 할 일을 하고 있는 것이고, 누수를 고치려면 **그 남은 참조 하나를 찾아서 끊으면** 됩니다.

## 흔한 원인 다섯 가지

### 1. 해제하지 않은 이벤트 리스너

```js
function openPanel(data) {
  const panel = createPanel(data);

  function onResize() {
    panel.layout(window.innerWidth);
  }
  window.addEventListener('resize', onResize);

  return () => panel.remove();
}
```

패널을 닫으면 DOM에서는 사라집니다. 그런데 `window`가 `onResize`를 들고 있고, `onResize`는 클로저로 `panel`을 들고 있습니다. `window`는 뿌리이므로 패널과 패널이 가진 `data`까지 전부 살아 있습니다. 패널을 열고 닫을 때마다 하나씩 쌓입니다.

`removeEventListener`는 **등록할 때와 같은 함수 참조**를 넘겨야 동작합니다. `addEventListener('resize', () => ...)`처럼 익명 함수로 등록하면 나중에 지울 방법이 없습니다. `capture` 옵션도 등록할 때와 같아야 합니다. `true`로 등록하고 옵션 없이 지우면 지워지지 않습니다.

### 2. 멈추지 않은 setInterval

```js
const timer = setInterval(() => {
  chart.update(fetchLatest());
}, 5000);
```

`clearInterval`을 부르기 전까지 브라우저는 이 콜백을 계속 들고 있습니다. 콜백이 잡은 `chart`도 함께 살아 있습니다. 화면에서 차트가 사라졌는데도 5초마다 요청을 보내고 있다면 메모리뿐 아니라 네트워크와 CPU도 낭비하고 있습니다. `requestAnimationFrame` 루프, `ResizeObserver`, `IntersectionObserver`, `MutationObserver`, WebSocket 구독도 같은 종류입니다. 시작한 것은 모두 끝내야 합니다.

### 3. 클로저가 잡은 큰 객체

```js
function setupExport(rows) {           // rows: 수십 MB짜리 배열
  const summary = `${rows.length}건`;
  button.addEventListener('click', () => {
    alert(summary);
  });
}
```

콜백은 `summary`만 쓰니 `rows`는 회수될 것 같습니다. 대부분의 경우 엔진이 쓰지 않는 변수를 클로저에 담지 않으니 맞는 기대입니다.

다만 V8 같은 엔진은 **같은 스코프에서 만든 클로저들이 컨텍스트 하나를 공유하도록** 구현되어 있습니다. 같은 함수 안에 `rows`를 쓰는 다른 콜백이 하나라도 있으면, `summary`만 쓰는 콜백도 `rows`가 든 컨텍스트를 함께 붙잡을 수 있습니다. 엔진 내부 구현이라 버전에 따라 달라질 수 있지만, "클로저가 생각보다 많이 잡는다"는 감각은 가져 둘 만합니다. 큰 데이터를 다루는 함수에서 오래 사는 콜백을 만든다면, 필요한 값만 뽑아서 별도 함수로 넘기는 편이 안전합니다.

### 4. 분리된(detached) DOM

```js
const rowCache = new Map();

function renderRow(item) {
  const tr = document.createElement('tr');
  // ...
  rowCache.set(item.id, tr);
  return tr;
}

function clearTable() {
  tbody.replaceChildren(); // 화면에서는 모두 사라진다
}
```

`replaceChildren()`으로 행을 모두 지워도 `rowCache`가 `<tr>`들을 들고 있습니다. 문서 트리에서는 떨어졌지만 자바스크립트에서는 닿는 이런 노드를 **분리된 DOM**이라고 부릅니다. 노드 하나는 작아도, 노드는 부모와 자식을 서로 참조하기 때문에 `<tr>` 하나가 살아 있으면 그 노드가 속했던 서브트리가 통째로 남는 경우가 많습니다. 지도 라이브러리처럼 DOM을 직접 만드는 코드와 React를 섞어 쓸 때 특히 잘 생깁니다.

### 5. 무한히 커지는 캐시

```js
const cache = new Map();

async function getUser(id) {
  if (!cache.has(id)) cache.set(id, await fetchUser(id));
  return cache.get(id);
}
```

모듈 최상위의 `Map`은 페이지가 살아 있는 동안 영원히 닿습니다. 처음에는 성능 최적화였지만, 사용자가 몇 시간 동안 수천 명을 조회하면 그대로 누수가 됩니다. 캐시에는 항상 **크기 상한이나 만료 시간**이 있어야 합니다.

```js
const MAX = 500;
const cache = new Map();

function remember(key, value) {
  cache.delete(key);          // 다시 넣어서 "최근 사용"으로 만든다
  cache.set(key, value);
  if (cache.size > MAX) {
    const oldest = cache.keys().next().value; // Map은 삽입 순서를 유지한다
    cache.delete(oldest);
  }
}
```

`Map`이 삽입 순서를 지킨다는 성질을 이용한 간단한 LRU입니다. 전역 상태 저장소, 로그를 모아 두는 배열, 무한 스크롤로 계속 붙는 목록에도 같은 문제가 생길 수 있습니다.

## React에서는 effect 정리 함수가 기본입니다

React 컴포넌트가 화면에서 사라지면 React가 만든 DOM과 상태는 정리됩니다. 하지만 effect 안에서 **React 바깥에** 등록한 것은 React가 모릅니다. 그래서 effect가 무언가를 시작했다면 정리 함수에서 끝내야 합니다.

```jsx
useEffect(() => {
  function onResize() {
    setWidth(window.innerWidth);
  }
  window.addEventListener('resize', onResize);
  const timer = setInterval(refresh, 5000);

  return () => {
    window.removeEventListener('resize', onResize);
    clearInterval(timer);
  };
}, [refresh]);
```

정리 함수는 컴포넌트가 사라질 때와, 의존성이 바뀌어 effect가 다시 실행되기 직전에 불립니다. 개발 모드의 Strict Mode가 마운트 직후 effect를 한 번 정리하고 다시 실행하는 것도 이 정리 함수를 빠뜨렸는지 드러내기 위해서입니다. Strict Mode에서 리스너가 두 번 붙는 증상이 보인다면, 실제 사용자 환경에서도 화면을 오갈 때마다 리스너가 쌓이고 있다는 신호입니다.

## AbortController로 리스너를 한 번에 해제하기

리스너가 여러 개면 정리 함수가 길어지고, 함수 참조를 하나하나 보관해야 합니다. `addEventListener`는 세 번째 인자에 `signal`을 받습니다. 그 signal이 취소되면 리스너가 자동으로 제거됩니다.

```js
function mountTooltip(target) {
  const controller = new AbortController();
  const { signal } = controller;

  target.addEventListener('pointerenter', show, { signal });
  target.addEventListener('pointerleave', hide, { signal });
  window.addEventListener('scroll', reposition, { signal, passive: true });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  }, { signal });

  return () => controller.abort(); // 네 개가 한 번에 떨어진다
}
```

익명 함수로 등록해도 지울 수 있고, `capture` 옵션을 맞출 필요도 없습니다. React effect에서도 정리 함수를 `return () => controller.abort()` 한 줄로 끝낼 수 있습니다. 같은 signal을 `fetch`에 넘기면 진행 중인 요청까지 함께 취소됩니다. 현재 주요 브라우저의 최신 버전은 모두 이 옵션을 지원합니다. 오래된 브라우저를 지원해야 한다면 MDN의 호환성 표를 확인하세요.

## "메모리가 늘었다"가 곧 누수는 아닙니다

누수를 의심할 때 흔히 메모리 그래프가 올라가는 것만 보고 누수라고 판단합니다.

가비지 컬렉터는 쓰레기가 생기자마자 치우지 않습니다. 어느 정도 쌓이면 한꺼번에 치우기 때문에, 정상적인 앱의 메모리 그래프는 톱니 모양입니다. 올라갔다가 GC가 돌면 뚝 떨어집니다.

봐야 할 것은 **GC 직후의 바닥값**입니다. 같은 동작(패널 열고 닫기, 페이지 오가기)을 반복했을 때 바닥이 계속 올라간다면 누수입니다. 한 번 올라간 뒤 평평하게 유지된다면 캐시나 지연 초기화일 가능성이 큽니다.

DevTools를 연 상태에서는 또 하나의 함정이 있습니다. `console.log(bigObject)`로 찍은 객체는 콘솔에서 펼쳐 볼 수 있도록 DevTools가 참조를 유지합니다. 디버깅용 로그가 누수처럼 보이게 만들 수 있으니, 측정할 때는 콘솔을 비우거나 로그를 지우고 하세요.

## DevTools Memory 패널로 찾기

Chrome 기준 순서는 이렇습니다.

1. 시크릿 창에서 엽니다. 확장 프로그램이 만드는 객체가 섞이지 않게 하기 위해서입니다.
2. Memory 패널에서 **Heap snapshot**을 하나 찍습니다. 스냅샷을 찍기 전에 GC가 실행되므로 "닿는 것"만 남습니다.
3. 의심되는 동작을 여러 번 반복합니다. 패널을 열고 닫는 것을 5번 하는 식입니다. 마지막에는 처음 상태로 돌아옵니다.
4. 스냅샷을 다시 찍습니다.
5. 두 번째 스냅샷을 선택하고, 상단의 보기를 **Comparison**으로 바꿔 첫 번째 스냅샷과 비교합니다.

Comparison 보기에서는 생성자(클래스)별로 새로 생긴 개수(`# New`)와 사라진 개수(`# Deleted`), 크기 변화(`Size Delta`)가 나옵니다. 동작을 5번 반복했는데 어떤 객체가 정확히 5개, 또는 5의 배수만큼 늘었다면 강력한 용의자입니다.

### Detached 요소 찾기

스냅샷의 필터 입력란에 `Detached`를 입력하면 `Detached HTMLDivElement` 같은 분리된 노드만 추려집니다. 이 중 하나를 선택하면 아래쪽 **Retainers** 영역에 "누가 이 객체를 붙잡고 있는지"가 경로로 나옵니다. 경로를 위로 따라가다 보면 `rowCache`, `onResize` 같은 내 코드의 이름이 나옵니다. 그게 끊어야 할 참조입니다. 경로 중간에 `(closure)`나 `context`가 보이면 클로저가 잡고 있다는 뜻이고, 이벤트 리스너가 원인이면 리스너 관련 항목이 경로에 나타납니다.

Retainers를 읽을 때 DevTools 자신이나 내부 구조가 만든 경로도 섞여 있어서 처음에는 복잡해 보입니다. 거리(Distance)가 짧은 경로부터, 내 코드에서 정의한 이름이 나오는 곳을 찾으면 됩니다.

### 시간에 따른 할당 보기

어떤 동작이 원인인지조차 모르겠다면 **Allocations on timeline**이 편합니다. 기록을 켠 채로 앱을 쓰면 시간 축에 할당이 막대로 표시되는데, 파란 막대는 기록이 끝날 때까지 살아남은 할당, 회색은 회수된 할당입니다. 특정 동작을 할 때마다 파란 막대가 남는다면 그 구간을 선택해 어떤 객체인지 확인합니다.

Performance 패널에서 Memory 체크박스를 켜고 기록하면 JS 힙, DOM 노드 수, 리스너 수의 추이를 그래프로 볼 수 있습니다. "동작을 반복할 때마다 리스너 수가 계단처럼 올라간다"는 증상은 여기서 가장 빨리 보입니다.

## WeakMap과 WeakRef는 언제 쓸까

누수 이야기를 하면 `WeakMap`이 해결책으로 자주 나옵니다. `WeakMap`은 키를 약하게 참조합니다. 키 객체가 다른 곳에서 닿지 않게 되면, `WeakMap`에 들어 있다는 이유만으로 살아남지 않습니다. 키와 함께 값도 회수 대상이 됩니다.

```js
const metaByNode = new WeakMap();

function attachMeta(node, meta) {
  metaByNode.set(node, meta); // node가 사라지면 meta도 함께 정리된다
}
```

DOM 노드나 외부 객체에 부가 정보를 붙일 때 딱 맞습니다. 앞의 분리된 DOM 예시처럼 "노드를 키로 무언가를 기억한다"면 `Map` 대신 `WeakMap`이 맞는 선택일 때가 많습니다.

다만 만능은 아닙니다.

- 키는 객체(또는 등록되지 않은 심볼)만 됩니다. 앞의 `getUser(id)` 캐시처럼 숫자나 문자열이 키라면 쓸 수 없습니다.
- 순회할 수 없고 `size`도 없습니다. "지금 몇 개 들어 있나"를 알 수 없다는 뜻입니다.
- 언제 회수될지는 GC가 정합니다. 바로 사라진다는 보장이 없습니다.

`WeakRef`와 `FinalizationRegistry`는 더 조심해야 합니다. `WeakRef`는 객체를 약하게 가리키다가 `deref()`로 꺼내 쓰는 도구인데, 꺼냈을 때 이미 사라졌을 수도 있다는 것을 코드가 항상 감당해야 합니다. GC가 언제 도는지는 엔진과 상황마다 달라서, 이것에 기대는 로직은 테스트하기 어렵고 환경마다 다르게 동작합니다. MDN도 가능하면 쓰지 말라고 권합니다. 큰 캐시를 메모리 압박에 따라 비우는 것처럼 정말 필요한 곳이 아니라면, 명시적으로 지우는 코드가 대부분 더 낫습니다.

새 기능을 만들 때 "이걸 시작한 코드는 어디서 끝내지?"를 같이 적어 두는 습관이 나중에 디버깅하는 것보다 훨씬 쌉니다.

## 참고

- [MDN - Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_management)
- [MDN - EventTarget.addEventListener()](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)
- [MDN - WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)
- [MDN - WeakRef](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef)
- [React - Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [Chrome DevTools - Fix memory problems](https://developer.chrome.com/docs/devtools/memory-problems)
