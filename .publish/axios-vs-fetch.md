
Axios에서 Fetch로 옮기면 서버가 404를 돌려줬는데도 `catch`로 안 떨어지고, POST 본문을 서버가 못 읽는 일을 겪는다. 둘 다 Promise 기반이라 겉보기엔 비슷하지만, 기본으로 해 주는 일의 범위가 꽤 다르기 때문이다. 아래에서는 두 도구를 기능별로 비교하고, Fetch로 Axios의 편의 기능을 어디까지 대체할 수 있는지, 프로젝트에서는 어떤 기준으로 고르면 되는지 짚는다.

## Axios와 Fetch API

### Axios

Axios는 브라우저와 Node.js에서 모두 쓸 수 있는 HTTP 클라이언트 라이브러리다. 브라우저에서는 전통적으로 `XMLHttpRequest`, Node.js에서는 `http` 모듈 위에서 동작하며, 최근 버전에서는 `fetch` 어댑터도 선택할 수 있다. 요청·응답 인터셉터, JSON 자동 변환, 타임아웃, 인스턴스별 기본값 설정 같은 편의 기능을 기본으로 제공한다.

```js
import axios from 'axios';

try {
  const response = await axios.get('/api/data');
  console.log(response.data); // 이미 파싱된 JSON
} catch (error) {
  console.error('요청 실패:', error);
}
```

### Fetch API

Fetch API는 WHATWG가 표준화한 웹 플랫폼 API로, 모든 최신 브라우저에 내장되어 있어 설치가 필요 없다. 흔히 ES6와 함께 언급되지만 ECMAScript 언어 명세의 일부는 아니고, 브라우저(와 런타임)가 제공하는 API다. Node.js도 18부터 전역 `fetch`를 기본 제공하고, Deno와 Bun도 마찬가지라서 지금은 "브라우저 전용 API"라고 보기 어렵다.

```js
const response = await fetch('/api/data');

if (!response.ok) {
  throw new Error(`HTTP ${response.status}`);
}

const data = await response.json(); // 직접 파싱
console.log(data);
```

Fetch는 저수준 API에 가깝다. 필요한 기능은 대부분 표준 API(`AbortSignal`, `Headers`, `Request` 등)를 조합해서 직접 만들어야 한다.

## 기능 비교

| 항목 | Axios | Fetch API |
| --- | --- | --- |
| 설치 | 패키지 설치 필요 | 내장 |
| 응답 JSON 파싱 | 자동 (`response.data`) | `response.json()` 호출 |
| 요청 본문 직렬화 | 객체를 넘기면 JSON으로 변환, `Content-Type` 자동 설정 | `JSON.stringify()`와 헤더를 직접 지정 |
| HTTP 에러 처리 | 기본적으로 2xx 외 상태 코드에서 reject | 네트워크 오류에서만 reject, 상태 코드는 `response.ok`로 확인 |
| 타임아웃 | `timeout` 옵션 | `AbortSignal.timeout()` |
| 요청 취소 | `signal` 옵션 (`AbortController`) | `signal` 옵션 (`AbortController`) |
| 인터셉터 | `interceptors` 내장 | 없음, 래퍼 함수로 구현 |
| 기본값 설정 | `axios.create()`로 인스턴스별 설정 | 없음, 래퍼 함수로 구현 |
| 업로드 진행률 | `onUploadProgress` | 표준 방식이 없어 XHR 등이 필요 |
| 응답 스트리밍 | 브라우저에서는 제한적 | `response.body`로 `ReadableStream` 처리 |
| Node.js | 지원 | 18부터 전역 제공 |

예전에는 "Fetch는 타임아웃을 지원하지 않는다", "Node.js에서는 별도 구현이 필요하다", "IE에서 동작하지 않는다"가 Fetch의 단점으로 꼽혔다. 지금은 `AbortSignal.timeout()`이 모든 주요 브라우저에 들어왔고, Node.js가 `fetch`를 기본 제공하며, IE는 2022년에 지원이 종료되었으니 세 가지 모두 더는 결정적인 차이가 아니다.

## 에러 처리의 차이

두 도구가 가장 크게 다르게 동작하는 부분은 에러 처리다. Fetch는 서버가 404나 500을 응답해도 Promise를 **이행(resolve)**한다. 요청 자체는 성공적으로 주고받았기 때문이다. reject되는 건 네트워크 오류, CORS 차단, 취소처럼 응답을 아예 받지 못한 경우뿐이다.

```js
try {
  const response = await fetch('/api/not-found');
  console.log(response.ok, response.status); // false 404 — 여기까지 정상 실행된다
} catch (error) {
  // 네트워크 오류일 때만 여기로 온다
}
```

Axios는 기본적으로 2xx가 아닌 응답을 reject하고, 상태 코드와 응답 본문을 `error.response`에 담아 준다. 다만 네트워크 오류나 타임아웃처럼 응답이 없는 경우에는 `error.response`가 `undefined`이므로 접근할 때 주의해야 한다.

## 인터셉터

Axios는 요청과 응답을 가로채는 인터셉터를 기본 제공한다. 인증 토큰 추가, 공통 에러 처리, 응답 가공을 한곳에서 처리할 수 있다. 전역 `axios` 대신 `axios.create()`로 인스턴스를 만들어 쓰면 다른 라이브러리나 다른 API 서버와 설정이 섞이지 않는다.

```js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 5000,
});

// 요청 인터셉터: Authorization 헤더 추가
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터: 공통 에러 처리
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 네트워크 오류나 타임아웃이면 error.response가 없다
    if (error.response?.status === 401) {
      console.error('인증 오류');
    }
    return Promise.reject(error);
  },
);
```

### Fetch로 인터셉터 흉내 내기

Fetch에는 인터셉터가 없으니 `fetch`를 감싼 함수를 만들어 같은 역할을 하게 한다.

```js
async function request(url, options = {}) {
  const headers = new Headers(options.headers);

  const token = localStorage.getItem('jwt');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    if (response.status === 401) {
      console.error('인증 오류');
    }
    throw new Error(`HTTP ${response.status}`);
  }

  // 204 No Content처럼 본문이 없는 응답 처리
  if (response.status === 204) return null;
  return response.json();
}
```

래퍼를 만들 때 놓치기 쉬운 점이 두 가지 있다. 토큰이 없을 때 `Authorization: undefined`를 객체에 넣으면 헤더가 빠지는 게 아니라 문자열 `"undefined"`로 전송된다. 또 `options.headers`가 `Headers` 인스턴스면 스프레드(`...`)로 복사되지 않는다. `new Headers()`로 감싸고 `set()`으로 조건부 추가하면 두 문제가 모두 해결된다.

## JSON 요청 본문

응답뿐 아니라 요청 본문도 차이가 있다. Axios는 객체를 넘기면 JSON으로 직렬화하고 `Content-Type: application/json`을 붙여 준다.

```js
await api.post('/users', { name: '이랑' });
```

Fetch는 둘 다 직접 해야 한다. 헤더를 빠뜨리면 서버가 본문을 JSON으로 해석하지 못하는 경우가 많다.

```js
await fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '이랑' }),
});
```

## 어느 쪽을 고를까

타임아웃, Node.js 지원, IE 호환성이 더는 기준이 아니니, 남는 차이는 인터셉터, 자동 직렬화, 업로드 진행률 같은 편의 기능을 라이브러리에 맡길지 작은 래퍼로 직접 관리할지다.

Axios는 인터셉터, 자동 직렬화, 타임아웃, 인스턴스 설정처럼 프로젝트마다 반복되는 작업이 이미 정리되어 있고, 업로드 진행률처럼 Fetch로는 번거로운 기능도 쉽게 쓴다. 대신 외부 의존성이라 번들 크기가 늘고, 보안 패치와 메이저 업데이트를 따라가야 한다. 토큰 갱신이나 공통 에러 처리처럼 요청 전후 처리가 많은 프로젝트, 파일 업로드 진행률을 보여 줘야 하는 화면, 이미 Axios 기반 코드와 인스턴스 설정이 자리 잡은 프로젝트라면 Axios가 편하다.

Fetch는 설치가 필요 없고, 브라우저·Node.js·엣지 런타임에서 같은 API를 쓴다. 상태 코드 확인, 직렬화, 공통 헤더 같은 처리를 직접 만들어야 해서 팀마다 래퍼가 제각각이 되기 쉽다. 요청 종류가 단순하고 번들 크기에 민감한 프로젝트, SSR이나 엣지 런타임처럼 여러 환경에서 같은 코드를 돌려야 하는 경우, 스트리밍 응답(예: LLM 응답을 토큰 단위로 표시)을 다뤄야 하는 경우라면 Fetch가 낫다.

어느 쪽을 고르든 컴포넌트에서 직접 `axios`나 `fetch`를 부르지 말고, 앞의 `api` 인스턴스나 `request()` 함수처럼 **한 겹의 API 레이어를 두자**. 그래야 인증 방식이나 클라이언트를 바꿔도 수정 범위가 그 레이어 안에 머문다.

## 참고

- [MDN - Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [MDN - AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)
- [Axios 공식 문서](https://axios-http.com/docs/intro)
