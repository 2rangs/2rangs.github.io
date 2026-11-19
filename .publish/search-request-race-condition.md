
검색창에 `react`를 빠르게 쳤습니다.
그런데 결과 목록에는 `rea`로 검색한 결과가 떠 있습니다.
다시 쳐 보면 잘 나옵니다.
QA에서 "가끔 결과가 이상하다"는 제보로 올라오는데, 개발자 PC에서는 잘 재현되지 않는 버그입니다.

코드를 보면 틀린 곳이 없어 보입니다.

```js
input.addEventListener('input', async (event) => {
  const keyword = event.target.value;
  const response = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`);
  const results = await response.json();
  render(results);
});
```

입력할 때마다 검색하고, 응답이 오면 그린다.
문제는 "응답이 오면"에 있습니다.

## 응답은 보낸 순서대로 오지 않습니다

`r`, `re`, `rea`, `reac`, `react`를 치면 요청 다섯 개가 거의 동시에 나갑니다.
우리는 무의식적으로 응답도 이 순서대로 돌아온다고 가정합니다.
하지만 각 요청은 서로 독립적입니다.

- 짧은 검색어는 결과가 많아서 서버가 더 오래 걸릴 수 있습니다.
- 캐시에 걸린 요청은 빨리, 안 걸린 요청은 늦게 옵니다.
- 모바일 네트워크에서는 패킷 하나만 늦어도 순서가 바뀝니다.

그래서 이런 일이 생깁니다.

| 시각 | 일어난 일 | 화면 |
| --- | --- | --- |
| 0ms | `rea` 요청 보냄 | |
| 80ms | `react` 요청 보냄 | |
| 200ms | `react` 응답 도착, 그림 | `react` 결과 |
| 450ms | `rea` 응답 도착, 그림 | **`rea` 결과** |

마지막에 **보낸** 요청이 아니라 마지막에 **도착한** 응답이 화면을 차지합니다.
입력창에는 `react`가 있는데 목록은 `rea` 결과인, 서로 맞지 않는 상태가 됩니다.
이렇게 여러 비동기 작업이 끝나는 순서에 따라 결과가 달라지는 것을 경쟁 상태(race condition)라고 부릅니다.

개발 서버는 응답이 빠르고 일정해서 순서가 거의 뒤집히지 않습니다.
"내 컴퓨터에서는 안 된다"가 나오는 이유입니다.
재현하고 싶다면 응답 시간을 일부러 흔들어 보면 됩니다.

```js
// 개발용: 응답을 0~1초 사이로 무작위로 늦춘다
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fakeSearch(keyword) {
  await sleep(Math.random() * 1000);
  return [`${keyword} 결과 1`, `${keyword} 결과 2`];
}
```

이걸로 바꿔 놓고 빠르게 입력하면 거의 매번 엉뚱한 결과가 남습니다.
DevTools의 Network 패널에서 스로틀링을 거는 것도 방법이지만, 스로틀링은 모든 요청을 비슷하게 늦추기 때문에 순서가 잘 안 뒤집힙니다. 무작위 지연이 더 확실합니다.

## 방법 1. 오래된 응답은 버린다

가장 단순한 해결책은 응답이 왔을 때 "이게 아직 최신 요청의 응답인가"를 확인하는 것입니다.
요청마다 번호를 붙이고, 최신 번호가 아니면 그리지 않습니다.

```js
let latestId = 0;

input.addEventListener('input', async (event) => {
  const id = ++latestId;
  const keyword = event.target.value;

  const response = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`);
  const results = await response.json();

  if (id !== latestId) return; // 그 사이에 더 새로운 요청이 나갔다
  render(results);
});
```

이것만으로 화면이 틀리는 문제는 사라집니다.
다만 버려질 요청도 끝까지 다운로드하고 JSON 파싱까지 합니다.
결과가 크거나 요청이 많으면 네트워크와 CPU를 낭비합니다.

## 방법 2. 이전 요청을 취소한다

새 검색을 시작할 때 이전 요청을 아예 끊어 버리면 낭비도 줄일 수 있습니다.
`fetch`는 `AbortController`로 취소할 수 있습니다.

```js
let controller;

input.addEventListener('input', async (event) => {
  controller?.abort(); // 이전 요청을 끊는다
  controller = new AbortController();
  const { signal } = controller;

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(event.target.value)}`, { signal });
    const results = await response.json();
    render(results);
  } catch (error) {
    if (signal.aborted) return; // 일부러 끊은 것이니 무시한다
    showError(error);
  }
});
```

`abort()`를 부르면 그 `signal`을 받은 `fetch`의 Promise가 거부됩니다.
아직 응답 헤더가 오기 전이면 `fetch()`가, 본문을 받는 중이면 `response.json()`이 거부됩니다.
그래서 `json()`까지 같은 `try` 안에 두어야 합니다.

### 취소 에러를 구분할 때 주의할 점

흔히 `error.name === 'AbortError'`로 취소인지 확인합니다.
`abort()`를 인자 없이 부르면 실제로 `AbortError`라는 이름의 `DOMException`이 나오니 맞는 방법입니다.

그런데 `abort(reason)`처럼 이유를 넘기면 `fetch`는 그 `reason`을 그대로 던집니다.
`controller.abort(new Error('새 검색어'))`라고 쓰면 `error.name`은 `'Error'`가 됩니다.
`AbortSignal.timeout()`으로 시간 초과가 나면 `TimeoutError`가 나옵니다.

에러 이름 대신 **내가 넘긴 signal이 취소됐는지**를 보면 이런 차이에 흔들리지 않습니다.
위 코드에서 `signal.aborted`를 확인한 이유입니다.
여기서 `controller.signal`이 아니라 지역 변수 `signal`을 쓴 것도 중요합니다.
`catch`가 실행될 때쯤 `controller`에는 이미 다음 요청의 컨트롤러가 들어 있을 수 있기 때문입니다.

### 취소는 서버 작업까지 멈추지 않습니다

`abort()`를 부르면 브라우저는 응답을 기다리지 않고 연결을 정리합니다.
서버는 요청을 이미 받았다면 대개 끝까지 처리합니다.
검색처럼 읽기만 하는 요청은 상관없지만, 결제나 저장 같은 요청을 "취소했으니 안 됐겠지"라고 가정하면 안 됩니다.
그런 요청은 애초에 중복으로 보내지 않도록 버튼을 막거나, 서버에서 멱등성 키로 막아야 합니다.

### 타임아웃과 같이 쓰기

"새 입력이 오면 취소"와 "5초가 지나면 취소"를 같이 걸고 싶을 때가 있습니다.
`AbortSignal.any()`로 여러 signal을 하나로 합칠 수 있습니다.

```js
const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]);
const response = await fetch(url, { signal });
```

둘 중 하나라도 취소되면 합친 signal도 취소됩니다.
2024년부터 Chrome, Firefox, Safari 최신 버전이 모두 지원합니다.
이 경우에도 `catch`에서는 합친 `signal.aborted`를 보면 되고, 시간 초과만 따로 안내하고 싶다면 그때 `error.name === 'TimeoutError'`를 확인합니다.

## 디바운스는 해결책이 아니라 보조 수단입니다

이 문제를 디바운스로 해결했다는 글도 자주 보입니다.
입력이 멈추고 300ms가 지나야 요청을 보내는 방식입니다.

```js
function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

input.addEventListener('input', debounce(search, 300));
```

요청 수가 크게 줄어서 서버 부담을 덜고, 경쟁이 일어날 확률도 낮아집니다.
하지만 **확률이 낮아질 뿐 사라지지는 않습니다.**
`rea`를 치고 잠깐 멈췄다가 `ct`를 치면 요청이 두 번 나가고, 그 둘의 순서는 여전히 보장되지 않습니다.
사용자가 느린 네트워크에 있을수록 더 잘 일어납니다.

그래서 디바운스는 요청 수를 줄이는 용도로 쓰고, 순서 문제는 방법 1이나 방법 2로 따로 막아야 합니다.
실무에서는 보통 **디바운스 + 취소**를 함께 씁니다.

## React에서는 useEffect 정리 함수로

React에서 검색어 상태에 따라 데이터를 가져온다면 같은 문제가 그대로 생깁니다.
다행히 `useEffect`의 정리(cleanup) 함수가 이 상황에 딱 맞습니다.
검색어가 바뀌면 React가 이전 effect의 정리 함수를 먼저 실행하고 새 effect를 실행하기 때문입니다.

```jsx
function useSearch(keyword) {
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!keyword) {
      setResults([]);
      return;
    }

    const controller = new AbortController();

    fetch(`/api/search?q=${encodeURIComponent(keyword)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        setResults(data);
        setError(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err);
      });

    return () => controller.abort(); // 검색어가 바뀌거나 컴포넌트가 사라지면 취소
  }, [keyword]);

  return { results, error };
}
```

여기서는 `controller`가 effect마다 새로 만들어지는 지역 변수라서, 앞에서 말한 "다음 요청의 컨트롤러를 보는" 문제가 생기지 않습니다.

개발 모드의 Strict Mode에서는 effect가 마운트 직후 한 번 정리되고 다시 실행됩니다.
그래서 Network 패널에 취소된(canceled) 요청이 하나씩 보이는데, 정리 함수가 제대로 동작한다는 뜻이니 걱정하지 않아도 됩니다.

이 정도 일을 매번 직접 하기 번거롭다면 TanStack Query 같은 데이터 패칭 라이브러리를 쓰는 것도 좋습니다.
결과를 쿼리 키(검색어)별로 따로 저장하기 때문에 늦게 온 `rea` 응답이 `react` 화면을 덮어쓰지 않습니다.
`queryFn`에 `signal`도 넘겨주므로, 그걸 `fetch`에 전달하면 더 이상 쓰지 않는 요청을 취소할 수도 있습니다.

## 검색창 말고도 같은 문제가 있습니다

"사용자가 고른 것에 따라 데이터를 가져와 그린다"는 구조라면 어디서나 생깁니다.

- **탭이나 필터 전환**: A 탭을 누르고 바로 B 탭을 누르면 A 데이터가 B 탭에 그려질 수 있습니다.
- **목록에서 상세 보기**: 1번 항목을 누르고 곧바로 2번을 누르면 2번 화면에 1번 상세가 뜰 수 있습니다.
- **지도 이동**: 지도를 움직일 때마다 영역 안의 데이터를 가져온다면, 이미 지나간 영역의 응답이 마지막에 도착해 엉뚱한 마커가 남습니다.
- **자동 저장**: 저장 요청이 순서가 바뀌어 도착하면 오래된 내용이 서버에 마지막으로 남을 수 있습니다. 이건 클라이언트에서 버리는 것만으로는 안 되고, 버전 번호를 함께 보내 서버가 오래된 쓰기를 거절하게 해야 합니다.

## 정리

- 비동기 요청의 응답은 보낸 순서대로 온다는 보장이 없습니다. 마지막에 도착한 응답이 화면을 차지하면 입력과 결과가 어긋납니다.
- 최소한 **오래된 응답은 버리세요.** 요청 번호를 비교하는 것만으로 화면이 틀리는 문제는 사라집니다.
- 더 나아가 `AbortController`로 **이전 요청을 취소하면** 낭비도 줄일 수 있습니다. 취소 여부는 에러 이름보다 `signal.aborted`로 확인하는 편이 안전합니다.
- 취소는 브라우저 쪽 이야기입니다. 서버에서 이미 처리된 쓰기 작업은 되돌려지지 않습니다.
- 디바운스는 요청 수를 줄이는 보조 수단이지 경쟁 상태의 해결책이 아닙니다.
- React에서는 `useEffect` 정리 함수에서 `abort()`를 부르는 것이 기본 패턴입니다.

개발 환경에서 잘 보이지 않는 버그라서, 데이터를 가져오는 코드를 쓸 때마다 "이 응답이 늦게 오면 어떻게 되지?"를 한 번씩 물어보는 습관이 가장 확실한 예방책입니다.

## 참고

- [MDN - AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [MDN - AbortSignal.any()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static)
- [MDN - AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)
- [React - Synchronizing with Effects: Fetching data](https://react.dev/learn/synchronizing-with-effects#fetching-data)
- [TanStack Query - Query Cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)
