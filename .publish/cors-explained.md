
로컬에서 프론트엔드를 띄우고 API를 호출했더니 콘솔에 빨간 글씨가 뜹니다.

```text
Access to fetch at 'https://api.example.com/users' from origin 'http://localhost:5173'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
on the requested resource.
```

백엔드 개발자에게 물어보면 "Postman으로 해 보니 잘 되는데요? 서버는 문제없어요."라는 대답이 돌아옵니다. 둘 다 틀린 말은 아닙니다. 서버는 실제로 응답을 잘 보냈고, 그 응답을 막은 건 브라우저입니다. CORS 에러를 제대로 고치려면 이 구도부터 이해해야 합니다.

## 막는 쪽은 브라우저입니다

브라우저에는 동일 출처 정책(Same-Origin Policy)이 있습니다. 한 출처에서 불러온 스크립트가 **다른 출처의 응답을 읽지 못하도록** 기본적으로 막는 규칙입니다.

사용자가 은행 사이트에 로그인한 채로 악성 사이트에 들어갔다고 해 봅시다. 악성 사이트의 스크립트가 `fetch('https://bank.example/account')`를 부르면, 브라우저는 은행 쿠키를 붙여서 요청을 보낼 수 있습니다. 동일 출처 정책이 없다면 악성 스크립트가 그 응답, 곧 사용자의 계좌 정보를 그대로 읽을 수 있습니다.

그래서 브라우저는 기본적으로 다른 출처의 응답을 스크립트에게 보여 주지 않습니다. CORS(Cross-Origin Resource Sharing)는 이 제한을 **서버가 허락하는 범위 안에서 풀어 주는** 방법입니다. 서버가 응답 헤더로 "이 출처는 내 응답을 읽어도 된다"고 말하면 브라우저가 스크립트에게 응답을 넘겨줍니다.

Postman에서 되는 이유도 여기서 나옵니다. Postman이나 curl은 브라우저가 아니라서 지켜야 할 다른 사이트의 쿠키도 없고, 동일 출처 정책을 적용하지도 않습니다. 그래서 응답을 그대로 보여 줍니다. CORS 에러는 "서버가 요청을 거부했다"가 아니라 "서버가 이 출처에 읽기를 허락한다는 표시를 하지 않았다"는 뜻입니다.

## 출처란

출처(origin)는 **스킴 + 호스트 + 포트** 세 가지의 조합이고, 셋 중 하나라도 다르면 다른 출처입니다.

| URL | `https://example.com`과 같은 출처인가 |
| --- | --- |
| `https://example.com/about` | 같음 (경로는 상관없음) |
| `http://example.com` | 다름 (스킴) |
| `https://api.example.com` | 다름 (호스트) |
| `https://example.com:8443` | 다름 (포트) |

`localhost:5173`에서 `localhost:8080`을 호출해도 포트가 다르니 다른 출처입니다. 같은 회사 도메인이라도 `www`와 `api`는 서로 다른 출처입니다. 개발 환경에서 CORS를 처음 만나는 이유는 대부분 이 때문입니다.

## 단순 요청과 프리플라이트

CORS 요청은 두 갈래로 나뉩니다.

### 단순 요청

다음 조건을 모두 만족하면 브라우저는 요청을 바로 보냅니다.

- 메서드가 `GET`, `HEAD`, `POST` 중 하나
- 직접 설정한 헤더가 `Accept`, `Accept-Language`, `Content-Language`, `Content-Type` 등 허용된 목록 안에 있음
- `Content-Type`이 `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain` 중 하나

요청에는 브라우저가 `Origin` 헤더를 붙입니다. 서버가 응답에 `Access-Control-Allow-Origin`을 알맞게 넣어 주면 스크립트가 응답을 읽을 수 있고, 아니면 브라우저가 응답을 막습니다.

여기서 놓치기 쉬운 점은 **단순 요청은 서버에 도착해서 처리까지 끝난다**는 것입니다. 브라우저가 막는 건 응답을 읽는 단계입니다. 이 내용은 뒤에서 CSRF를 다룰 때 다시 나옵니다.

### 프리플라이트 요청

조건을 하나라도 벗어나면 브라우저는 본 요청을 보내기 전에 `OPTIONS` 요청으로 먼저 물어봅니다. 이를 프리플라이트(preflight)라고 합니다. JSON API는 거의 다 여기에 해당합니다. `Content-Type: application/json`이 단순 요청 조건에 없기 때문입니다. `Authorization` 헤더를 붙여도, `PUT`이나 `DELETE`를 써도 프리플라이트가 나갑니다.

```http
OPTIONS /users/42 HTTP/1.1
Origin: http://localhost:5173
Access-Control-Request-Method: DELETE
Access-Control-Request-Headers: authorization, content-type
```

서버는 이 요청에 "그 출처, 그 메서드, 그 헤더라면 보내도 된다"고 답해야 합니다.

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Max-Age: 600
```

허락을 받으면 브라우저가 그제야 본 `DELETE` 요청을 보내고, 허락을 못 받으면 본 요청은 아예 나가지 않습니다.

`Access-Control-Max-Age`는 프리플라이트 결과를 몇 초 동안 캐시할지 정합니다. 브라우저마다 허용하는 상한이 따로 있어서 큰 값을 줘도 그만큼 캐시되지 않을 수 있습니다. 정확한 상한은 MDN에서 확인하세요.

### 프리플라이트에서 자주 실패하는 이유

Network 패널에 `OPTIONS` 요청이 401이나 404로 실패해 있다면 서버 라우팅 문제일 가능성이 큽니다.

가장 흔한 건 인증 미들웨어가 `OPTIONS`까지 검사하는 경우입니다. 프리플라이트에는 `Authorization` 헤더도, 쿠키도 붙지 않으니 인증을 요구하면 401이 나고, 그게 CORS 에러로 보입니다. `OPTIONS`는 인증 전에 처리해야 합니다. `OPTIONS` 라우트가 아예 없을 수도 있으니 프레임워크의 CORS 미들웨어가 처리하도록 되어 있는지 확인합니다. 또 프리플라이트 응답은 2xx 성공 상태 코드여야 합니다.

## 응답 헤더

`Access-Control-Allow-Origin`은 읽기를 허락할 출처입니다. 하나의 출처나 `*` 하나만 쓸 수 있고, 쉼표로 여러 출처를 나열할 수 없습니다. `Access-Control-Allow-Methods`와 `Access-Control-Allow-Headers`는 프리플라이트에 대한 답으로, 허용할 메서드와 요청 헤더를 적습니다. `Access-Control-Allow-Credentials`는 쿠키 등 자격 증명이 포함된 요청의 응답을 읽어도 되는지를 나타냅니다.

`Access-Control-Expose-Headers`는 스크립트가 읽을 수 있게 할 응답 헤더입니다. 기본으로는 `Content-Type` 같은 몇 개만 읽을 수 있어서, `X-Total-Count` 같은 커스텀 헤더를 `response.headers.get()`으로 읽으려면 여기에 적어야 합니다.

여러 출처를 허용하려면 서버가 요청의 `Origin`을 허용 목록과 비교해서, 맞으면 그 값을 그대로 돌려줍니다.

```js
const allowed = new Set(['https://app.example.com', 'http://localhost:5173']);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  next();
});
```

`Vary: Origin`을 빠뜨리면 안 됩니다. 응답이 출처에 따라 달라지는데 이걸 알리지 않으면, 중간의 CDN이나 브라우저 캐시가 A 출처용 응답을 B 출처에게 그대로 줄 수 있습니다.

## credentials와 와일드카드

쿠키를 함께 보내려면 클라이언트에서 명시해야 합니다.

```js
fetch('https://api.example.com/me', { credentials: 'include' });
```

이때 서버 응답은 더 엄격한 조건을 만족해야 합니다. `Access-Control-Allow-Credentials: true`가 있어야 하고, `Access-Control-Allow-Origin`에 `*`를 쓸 수 없어 정확한 출처를 적어야 합니다. `Allow-Headers`, `Allow-Methods`, `Expose-Headers`에서도 `*`가 와일드카드로 동작하지 않고 글자 그대로의 `*`로 취급됩니다.

"아무 출처나 허용하면서 쿠키도 받는다"는 조합을 막아 두려는 의도입니다. 이 조합을 허용하면 동일 출처 정책이 막으려던 상황, 곧 아무 사이트나 로그인된 사용자의 데이터를 읽는 상황이 생깁니다.

그래서 요청 `Origin`을 검증 없이 그대로 되돌려주는 설정은 위험합니다. `*`를 쓸 수 없다는 제약을 우회해 모든 출처에 쿠키 포함 응답을 열어 주기 때문입니다. 반드시 허용 목록과 비교해야 합니다.

## 개발할 때는 프록시로

로컬 개발에서 매번 서버 CORS 설정을 바꾸기 번거롭다면 개발 서버의 프록시를 쓰는 방법이 있습니다. 브라우저는 같은 출처(`localhost:5173`)로 요청하고, 개발 서버가 그 요청을 실제 API로 전달합니다. 서버 사이의 요청에는 동일 출처 정책이 없으니 CORS 문제가 생기지 않습니다.

```js
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': {
        target: 'https://api.example.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
};
```

코드에서는 `fetch('/api/users')`처럼 상대 경로로 부릅니다. 다만 이 방법은 개발 환경용입니다. 배포 환경에서도 프론트엔드와 API가 다른 출처라면 서버의 CORS 설정이 필요하고, 같은 도메인 아래 리버스 프록시로 묶는다면 CORS 자체가 필요 없어집니다.

### `mode: 'no-cors'`는 해결책이 아닙니다

에러 메시지가 "If an opaque response serves your needs, set the request's mode to 'no-cors'"라고 안내하니 이 옵션을 넣어 보는 경우가 있습니다. 에러는 사라지지만 응답은 불투명(opaque) 응답이 됩니다. 상태 코드는 0, 본문은 빈 것으로 보여서 스크립트는 아무것도 읽을 수 없습니다. 이미지나 스크립트를 캐시에 담는 것 같은 특수한 용도 외에는 쓸 일이 없습니다.

## CORS는 서버를 보호하지 않습니다

가장 흔하고 위험한 오해는 "CORS를 우리 도메인만 허용하도록 설정했으니 다른 사이트에서 우리 API를 못 부른다"는 생각입니다. CORS는 **브라우저가 사용자를 보호하기 위해** 응답을 읽지 못하게 하는 장치이지, 서버를 보호하는 장치가 아닙니다.

curl이나 서버 코드에서는 CORS와 상관없이 API를 마음대로 호출할 수 있습니다. API 보호는 인증과 권한 검사로 해야 합니다. 그리고 브라우저 안에서도 단순 요청은 서버에 도착해서 처리됩니다. 응답을 못 읽을 뿐입니다.

이 두 번째 내용이 CSRF(Cross-Site Request Forgery)와 연결됩니다. 악성 사이트가 이런 폼을 숨겨 두고 자동으로 제출한다고 해 봅시다.

```html
<form action="https://bank.example/transfer" method="POST">
  <input type="hidden" name="to" value="attacker" />
  <input type="hidden" name="amount" value="1000000" />
</form>
<script>document.forms[0].submit();</script>
```

폼 제출은 CORS 검사 대상도 아니고, 브라우저는 쿠키 설정에 따라 은행 쿠키를 붙여 보낼 수 있습니다. 서버가 이 요청을 처리하면 송금이 일어납니다. 공격자는 응답을 읽을 필요가 없습니다. 요청이 처리되기만 하면 목적을 이룹니다.

CORS 설정을 아무리 좁혀도 이 공격은 막히지 않습니다. CSRF는 쿠키의 `SameSite` 속성, CSRF 토큰, `Origin` 헤더 검증 같은 별도의 방어가 필요합니다. CORS는 "읽기"를, CSRF 방어는 "원치 않는 쓰기"를 다루는 서로 다른 문제입니다.

## 참고

- [MDN - Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [MDN - Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)
- [MDN - Access-Control-Max-Age](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age)
- [WHATWG Fetch Standard - CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol)
- [Vite - server.proxy](https://vite.dev/config/server-options#server-proxy)
- [OWASP - Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
