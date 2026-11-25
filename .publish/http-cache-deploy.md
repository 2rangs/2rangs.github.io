
버그를 고쳐서 배포했습니다. 내 브라우저에서는 고쳐진 화면이 보입니다. 그런데 기획자에게서 메시지가 옵니다. "아직 그대로인데요?"

"Ctrl+Shift+R 눌러 보세요"라고 답하면 일단은 해결됩니다. 하지만 모든 사용자에게 강력 새로고침을 안내할 수는 없습니다. 그리고 어떤 사용자는 며칠이 지나도 옛 화면을 봅니다.

이 문제는 대부분 캐시 설정을 "기본값"으로 둔 데서 생깁니다. 브라우저, CDN, 서비스 워커가 각자 어떤 규칙으로 파일을 들고 있는지 알면 어디를 고쳐야 할지 보이고, 배포 직후 쏟아지는 ChunkLoadError도 따로 대비할 수 있습니다.

## Cache-Control을 안 줬으니 캐시도 안 된다?

가장 먼저 짚을 오해입니다. 응답에 `Cache-Control`이 없으면 브라우저가 매번 새로 받을 거라고 생각하기 쉽습니다.

그렇지 않습니다. HTTP 캐시 표준(RFC 9111)은 명시적인 만료 정보가 없을 때 캐시가 **스스로 신선도를 추정**하는 것을 허용합니다. 이걸 휴리스틱 캐싱이라고 합니다. 흔히 쓰이는 방식은 `Last-Modified`로부터 지금까지 지난 시간의 10% 정도를 신선한 기간으로 보는 것입니다. 한 달 전에 수정된 파일이라면 사흘 가까이 서버에 묻지도 않고 캐시를 쓸 수 있다는 뜻입니다.

정적 파일 서버는 대개 `Last-Modified`를 자동으로 붙입니다. 그래서 아무 설정도 하지 않은 `index.html`이 브라우저에 며칠씩 남아 있는 일이 실제로 생깁니다. "가끔, 일부 사용자만" 옛 화면을 보는 현상의 흔한 원인입니다.

캐시를 원하지 않는다면 원하지 않는다고 **명시해야** 합니다.

## Cache-Control 주요 지시어

### max-age

```http
Cache-Control: max-age=3600
```

응답을 받은 뒤 3600초 동안은 신선한 것으로 보고, 서버에 묻지 않고 캐시를 씁니다. 이 동안에는 서버에서 파일을 바꿔도 브라우저는 알 방법이 없습니다.

### no-cache와 no-store

이름 때문에 가장 많이 헷갈리는 쌍입니다. `no-cache`는 **저장은 하되, 쓰기 전에 매번 서버에 확인하라**는 뜻이지, 캐시를 쓰지 말라는 뜻이 아닙니다. **아예 저장하지 말라**는 건 `no-store`이고, 이때는 매번 처음부터 전체를 받습니다.

배포 문제를 해결하는 데 필요한 건 대부분 `no-cache`입니다. 매번 확인하지만, 바뀌지 않았다면 본문 없이 짧은 응답만 받으니 비용이 작습니다. `no-store`는 개인 정보가 담긴 응답처럼 기기에 남으면 안 되는 경우에 씁니다.

### immutable

```http
Cache-Control: public, max-age=31536000, immutable
```

`immutable`은 "신선한 기간 동안 이 파일은 절대 바뀌지 않는다"는 표시입니다. 사용자가 새로고침을 눌러도 재검증 요청을 보내지 않아도 된다는 힌트입니다. 브라우저마다 지원과 새로고침 동작이 다르니 작성 시점 기준 MDN에서 확인하세요. 지원하지 않는 브라우저에서도 `max-age`만으로 충분히 동작합니다.

## ETag와 304: 확인은 싸다

`no-cache`가 매번 확인한다고 했는데, 그 확인은 이렇게 이뤄집니다.

서버는 처음 응답에 파일의 버전 식별자를 붙입니다.

```http
HTTP/1.1 200 OK
ETag: "5f2a-1b3c"
Cache-Control: no-cache
```

다음 요청 때 브라우저가 이 값을 함께 보냅니다.

```http
GET /index.html HTTP/1.1
If-None-Match: "5f2a-1b3c"
```

파일이 그대로라면 서버는 본문 없이 `304 Not Modified`를 돌려주고, 브라우저는 캐시에 있던 것을 씁니다. 바뀌었다면 새 `ETag`와 함께 `200`과 새 본문을 줍니다. `Last-Modified`와 `If-Modified-Since`도 같은 방식이지만 초 단위라 정밀도가 떨어지므로 `ETag`가 더 정확합니다.

`index.html`은 몇 KB밖에 안 되니 매번 확인해도 부담이 거의 없습니다.

## 해시 파일명 + index.html no-cache

이제 배포 전략을 세울 수 있습니다. Vite, webpack 같은 번들러는 빌드 결과물 이름에 내용 해시를 넣습니다.

```text
dist/
  index.html
  assets/index-B3k9xQ1a.js
  assets/index-D8fP2mLs.css
  assets/Chart-Cq7w0eTz.js
```

내용이 바뀌면 해시가 바뀌고, 파일 이름이 바뀝니다. 같은 이름의 파일은 영원히 같은 내용입니다. 그러니 이 파일들은 아주 오래 캐시해도 됩니다.

반대로 `index.html`은 이름이 항상 같고, 어떤 해시 파일을 불러올지 적혀 있는 진입점입니다. 이 파일만은 항상 최신이어야 합니다.

| 파일 | Cache-Control | 이유 |
| --- | --- | --- |
| `index.html` | `no-cache` | 이름이 고정. 매번 확인해서 새 해시 파일 목록을 받는다 |
| `assets/*-[hash].js`, `.css` | `public, max-age=31536000, immutable` | 내용이 바뀌면 이름이 바뀐다 |
| `favicon.ico`, `robots.txt` 등 해시 없는 파일 | 짧은 `max-age` 또는 `no-cache` | 이름이 고정 |

Nginx라면 이런 모양입니다.

```bash
location = /index.html {
  add_header Cache-Control "no-cache";
}

location /assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

SPA라서 모든 경로가 `index.html`로 폴백된다면 그 폴백 응답에도 `no-cache`가 붙는지 확인해야 합니다. `/settings`로 들어온 사용자가 받는 것도 결국 `index.html`이기 때문입니다.

이렇게 하면 배포 후 사용자가 페이지를 새로 열 때 `index.html`만 확인하고, 바뀐 해시 파일만 새로 받고, 나머지는 캐시에서 씁니다. 옛 화면 문제와 성능을 둘 다 잡는 표준적인 방법입니다.

## CDN은 또 하나의 캐시입니다

브라우저 설정을 고쳤는데도 옛 화면이 보인다면 CDN을 의심합니다. CDN도 응답을 캐시하고, 대개 `Cache-Control`을 따릅니다. `index.html`이 CDN에 한 시간 캐시돼 있다면 브라우저가 아무리 확인해도 CDN은 한 시간 동안 옛 파일을 줍니다.

브라우저와 CDN의 캐시 기간을 다르게 주고 싶다면 공유 캐시(CDN, 프록시)에만 적용되는 `s-maxage`를 씁니다. 또 CDN마다 `Cache-Control`과 별개로 자체 캐시 규칙을 두는 경우가 많으니, 대시보드의 기본 TTL 설정이 `Cache-Control`보다 우선하는지 꼭 확인하세요. 배포 파이프라인 마지막에는 `index.html`에 대한 캐시 무효화(invalidation, purge)를 넣는 것이 일반적입니다. 해시 파일은 이름이 새것이니 무효화할 필요가 없습니다.

응답 헤더에서 CDN 캐시 적중 여부를 알려 주는 경우가 많습니다(`Age`, 또는 CDN별 `X-Cache` 같은 헤더). `Age` 값이 크다면 CDN에 오래 머문 응답입니다.

## 서비스 워커: 가장 끈질긴 캐시

PWA 템플릿이나 플러그인으로 서비스 워커를 등록했다면 이야기가 하나 더 붙습니다. 서비스 워커는 네트워크 요청을 가로채서 자기 캐시(Cache Storage)에서 응답할 수 있습니다. 여기에 들어간 `index.html`은 HTTP 캐시 헤더와 상관없이 서비스 워커가 정한 대로 쓰입니다.

그리고 새 서비스 워커가 배포돼도 바로 교체되지 않습니다.

1. 브라우저가 서비스 워커 스크립트가 바뀐 걸 발견하고 새 워커를 설치합니다.
2. 새 워커는 **대기(waiting) 상태**로 들어갑니다. 옛 워커가 관리하는 탭이 하나라도 열려 있으면 기다립니다.
3. 그 사이트의 탭을 모두 닫아야 새 워커가 활성화됩니다.

새로고침 한 번으로는 탭이 닫히지 않으므로, 사용자는 새로고침을 몇 번 해도 옛 화면을 봅니다. 탭을 계속 열어 두는 사용자라면 아주 오래 그렇습니다.

새 워커가 대기 상태가 되면 "새 버전이 있습니다. 새로고침" 안내를 띄우고, 사용자가 누르면 `skipWaiting()`으로 교체한 뒤 페이지를 새로고침하는 방식이 많이 쓰입니다. `index.html` 같은 내비게이션 요청은 캐시 우선이 아니라 네트워크 우선으로 처리합니다.

오프라인 지원이 정말 필요하지 않다면 서비스 워커를 쓰지 않는 것도 선택지입니다. 이미 등록된 워커를 없애려면 아무 일도 하지 않는 새 워커를 배포해서 스스로 등록 해제하게 해야 합니다. 스크립트 파일을 지우기만 해서는 사라지지 않습니다.

서비스 워커 스크립트 파일 자체에는 `Cache-Control: no-cache`를 주는 것이 좋습니다. 브라우저는 업데이트 확인 시 기본적으로 HTTP 캐시를 우회하지만, 서버와 CDN 설정을 맞춰 두면 헷갈릴 일이 줄어듭니다.

## 배포 직후 생기는 ChunkLoadError

캐시를 잘 설정해도 피할 수 없는 문제가 하나 남습니다. 배포 직후 에러 모니터링에 이런 에러가 쏟아지는 경우입니다.

```text
ChunkLoadError: Loading chunk 412 failed.
TypeError: Failed to fetch dynamically imported module: https://example.com/assets/Chart-Cq7w0eTz.js
```

첫 번째는 webpack, 두 번째는 Vite에서 흔히 보는 메시지입니다. 상황은 이렇습니다.

1. 사용자가 배포 전에 페이지를 열었습니다. 브라우저에는 옛 `index.html`과 옛 메인 번들이 로드되어 있습니다.
2. 그 사이 새 버전이 배포되고, 서버에서 옛 해시 파일들이 지워졌습니다.
3. 사용자가 차트 화면으로 이동합니다. 옛 번들은 `import()`로 옛 이름의 청크 `Chart-Cq7w0eTz.js`를 요청합니다.
4. 서버에 그 파일이 없으니 404. 화면이 깨집니다.

캐시 문제라기보다 **이미 실행 중인 옛 코드가 사라진 파일을 찾는** 문제입니다. 그래서 캐시 설정만으로는 해결되지 않습니다.

### 옛 파일을 바로 지우지 않기

가장 근본적인 대응은 배포할 때 이전 버전의 해시 파일을 일정 기간 남겨 두는 것입니다. 파일 이름이 겹치지 않으니 여러 버전이 함께 있어도 충돌하지 않습니다. S3 같은 저장소에 올린다면 동기화할 때 삭제 옵션을 쓰지 않고, 오래된 파일은 수명 주기 규칙으로 나중에 정리합니다.

SPA 폴백 설정이 있다면 하나 더 확인할 것이 있습니다. 없는 `.js` 파일 요청에 404 대신 `index.html`을 200으로 돌려주면, 브라우저는 HTML을 자바스크립트로 해석하려다 MIME 타입 에러를 냅니다. `/assets/` 아래 요청은 폴백하지 않도록 분리해 두면 원인을 파악하기 쉬워집니다.

### 그래도 실패하면 새로고침

옛 파일을 남겨도, 오래 열어 둔 탭에서는 결국 실패할 수 있습니다. 이때는 페이지를 새로고침해서 새 `index.html`을 받게 하는 게 가장 확실합니다.

Vite는 동적 import 실패 시 `window`에 `vite:preloadError` 이벤트를 보냅니다.

```js
const RELOAD_KEY = 'chunk-error-reloaded-at';

window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    // 최근 10초 안에 이미 새로고침했다면 반복하지 않고 에러를 그대로 둔다
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault(); // 에러를 던지지 않고 새로고침으로 처리
  window.location.reload();
});
```

새로고침했는데도 파일이 없다면(배포가 잘못됐다면) 무한 새로고침에 빠질 수 있습니다. 그래서 마지막으로 새로고침한 시각을 남겨 두고, 짧은 시간 안에 다시 실패하면 새로고침하지 않고 에러를 그대로 둡니다. 시간을 기준으로 삼으면 다음 배포 때는 따로 표시를 지우지 않아도 다시 동작합니다.

React의 `lazy()`를 쓴다면 import 함수를 감싸서 같은 일을 할 수도 있고, 에러 경계(Error Boundary)에서 이 에러를 잡아 "새 버전이 배포되었습니다. 새로고침해 주세요" 같은 안내를 보여 줄 수도 있습니다. 사용자가 입력 중인 폼이 있다면 자동 새로고침보다 안내가 낫습니다.

## 참고

- [MDN - HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [MDN - Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
- [RFC 9111 - HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111)
- [web.dev - Prevent unnecessary network requests with the HTTP Cache](https://web.dev/articles/http-cache)
- [web.dev - The service worker lifecycle](https://web.dev/articles/service-worker-lifecycle)
- [Vite - Load Error Handling](https://vite.dev/guide/build#load-error-handling)
