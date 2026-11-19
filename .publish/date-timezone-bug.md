
이벤트 시작일을 `2026-03-01`로 저장했습니다.
한국에서는 3월 1일로 잘 보입니다.
그런데 미국에 있는 사용자가 2월 28일로 나온다고 제보합니다.

반대 방향도 있습니다.
한국 사용자가 달력에서 3월 1일을 골랐는데 서버에는 `2026-02-28`이 저장됩니다.

두 버그 모두 코드 한 줄에서 시작합니다.
자바스크립트가 날짜 문자열을 어느 시간대로 해석하는지, 그리고 `Date`가 실제로 무엇을 담고 있는지 알면 원인이 보입니다.

## Date에는 시간대가 없습니다

흔한 오해부터 짚겠습니다.
`Date` 객체는 "한국 시간 3월 1일 0시" 같은 값을 담고 있지 않습니다.
담고 있는 것은 1970-01-01T00:00:00Z(UTC)로부터 지난 밀리초, 숫자 하나뿐입니다.

```js
const date = new Date('2026-03-01T00:00:00Z');
date.getTime(); // 1772323200000
```

시간대는 이 숫자를 **읽을 때** 적용됩니다.
`getDate()`, `getHours()`, `toString()`, `toLocaleDateString()`은 실행 환경의 로컬 시간대로 바꿔서 보여 주고, `getUTCDate()`, `toISOString()`은 UTC로 보여 줍니다.
같은 `Date`가 서울에서는 3월 1일 오전 9시, 뉴욕에서는 2월 28일 오후 7시로 읽힙니다.
둘 다 같은 순간입니다.

## 문자열 모양에 따라 해석하는 시간대가 다릅니다

이제 첫 번째 버그를 봅시다.

```js
new Date('2026-03-01');        // 날짜만 있음 → UTC 자정
new Date('2026-03-01T00:00');  // 날짜와 시간, 오프셋 없음 → 로컬 자정
new Date('2026-03-01T00:00Z'); // 오프셋 있음 → 그 오프셋 기준
```

ECMAScript 명세는 ISO 형식 문자열을 이렇게 해석하도록 정해 두었습니다.

- **날짜만 있으면 UTC**로 봅니다.
- **시간이 있는데 오프셋(`Z`, `+09:00`)이 없으면 로컬 시간**으로 봅니다.

비슷해 보이는 두 문자열이 서로 다른 순간이 됩니다.
명세가 여러 번 바뀌는 과정에서 기존 웹사이트와의 호환성을 지키느라 이렇게 정리된 규칙이라, 직관적이지 않아도 이제는 바뀌지 않습니다.

`new Date('2026-03-01')`은 UTC 3월 1일 0시입니다.
서울(UTC+9)에서 읽으면 3월 1일 오전 9시라서 날짜가 맞아 보입니다.
뉴욕(UTC−5)에서 읽으면 2월 28일 오후 7시입니다.

```js
const start = new Date('2026-03-01');
start.toLocaleDateString('ko-KR');
// 서울에서 실행: '2026. 3. 1.'
// 뉴욕에서 실행: '2026. 2. 28.'
```

한국은 UTC보다 앞선 시간대라서 이 버그가 개발자 화면에서는 보이지 않습니다.
UTC보다 뒤에 있는 아메리카 대륙의 사용자에게서만 나타납니다.

ISO 형식이 아닌 문자열(`'2026/03/01'`, `'March 1, 2026'`, `'2026-3-1'`, `'2026-03-01 00:00'`)은 더 곤란합니다.
명세가 해석 방법을 정하지 않아서 브라우저마다 결과가 다를 수 있습니다.
`new Date(문자열)`에는 ISO 8601 형식만 넘기는 것이 원칙입니다.

## 반대 방향: toISOString으로 날짜를 자르면

두 번째 버그는 한국에서 자주 생깁니다.
날짜 선택기에서 고른 값을 서버로 보낼 때입니다.

```js
const picked = new Date(2026, 2, 1); // 로컬 2026년 3월 1일 0시 (월은 0부터 센다)
picked.toISOString();                // '2026-02-28T15:00:00.000Z'
picked.toISOString().slice(0, 10);   // '2026-02-28'
```

`toISOString()`은 항상 UTC로 바꿔서 출력합니다.
한국의 3월 1일 0시는 UTC로 2월 28일 오후 3시이니, 앞의 10글자를 자르면 하루 전 날짜가 됩니다.
YYYY-MM-DD 문자열을 만드는 간단한 방법으로 이 코드가 자주 쓰이는데, 한국에서는 오전 9시 이전의 모든 시각에서 전날 날짜를 돌려줍니다.

로컬 날짜를 문자열로 만들려면 로컬 값으로 조립합니다.

```js
function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

toLocalDateString(new Date(2026, 2, 1)); // '2026-03-01'
```

## 원칙 1. 순간은 오프셋을 붙여 주고받는다

주문한 시각, 글을 쓴 시각처럼 세계 어디서 봐도 같은 한 순간을 가리키는 값은 오프셋이 붙은 ISO 8601 문자열로 주고받습니다.

```json
{ "createdAt": "2026-03-01T00:00:00Z" }
```

`Z`는 UTC라는 뜻입니다. `+09:00`처럼 오프셋을 붙여도 같은 순간을 정확히 가리킵니다.
오프셋이 없는 `"2026-03-01T00:00:00"`은 받는 쪽이 자기 로컬 시간으로 해석하므로, 서버와 브라우저의 시간대가 다르면 다른 순간이 됩니다.
서버 내부는 UTC로 통일하고, 밖으로 내보낼 때도 오프셋을 빠뜨리지 않는 것이 기본입니다.

데이터베이스에서도 순간은 시간대를 아는 타입으로 저장합니다.
PostgreSQL이라면 `timestamp`가 아니라 `timestamptz`입니다.
이름과 달리 `timestamptz`는 시간대 정보를 따로 저장하지 않습니다.
입력을 UTC로 바꿔 저장했다가 조회할 때 세션 시간대로 바꿔 돌려주므로, 순간을 담기에 맞는 타입입니다.

## 원칙 2. 보여 줄 때 기준 시간대를 정한다

화면에 표시할 때는 누구의 시간으로 보여 줄지 정해야 합니다.
기본은 사용자 기기의 시간대입니다.
"이 공연은 서울 시간 기준"처럼 특정 시간대로 보여 줘야 한다면 `Intl.DateTimeFormat`의 `timeZone` 옵션을 씁니다.

```js
const instant = new Date('2026-03-01T00:00:00Z');

new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
}).format(instant);
// '2026년 3월 1일 오전 9:00' (어느 나라에서 실행해도 같다)
```

`timeZone`에는 `Asia/Seoul`, `America/New_York` 같은 IANA 시간대 이름을 씁니다.
고정 오프셋 대신 지역 이름을 써야 서머타임 전환까지 반영됩니다.
사용자 기기의 시간대 이름은 `Intl.DateTimeFormat().resolvedOptions().timeZone`으로 알 수 있습니다.

## 원칙 3. 날짜만 있는 값은 문자열로 다룬다

생일, 기념일, 공휴일, 숙박 체크인 날짜는 순간이 아닙니다.
1990년 5월 3일생은 서울에서도 뉴욕에서도 5월 3일생이어야 합니다.
이런 값을 `Date`로 바꾸는 순간 그날의 몇 시, 어느 시간대인지를 억지로 정하게 되고, 거기서 하루 밀림이 생깁니다.

그래서 날짜만 있는 값은 가능한 한 `'1990-05-03'` 같은 문자열로 들고 다닙니다.

- 비교는 문자열 그대로 해도 됩니다. `YYYY-MM-DD` 형식은 사전순이 곧 날짜순입니다.
- 데이터베이스에서는 `date` 타입에 저장합니다.
- 화면에 표시해야 하면 UTC로 만들고 UTC로 읽어서 시간대 영향을 없앱니다.

```js
function formatDateOnly(value) {
  // value: '1990-05-03'. 날짜만 있는 ISO 문자열은 UTC 자정으로 해석된다
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(value));
}

formatDateOnly('1990-05-03'); // '1990년 5월 3일'
```

앞에서 버그의 원인이었던 "날짜만 있으면 UTC" 규칙을 거꾸로 이용했습니다.
UTC로 만들어 UTC로 읽으면 어느 시간대에서 실행해도 같은 날짜가 나옵니다.

날짜 계산이 필요하면 로컬 생성자로 만들고 로컬 메서드만 씁니다.

```js
const [y, m, d] = '2026-03-01'.split('-').map(Number);
const date = new Date(y, m - 1, d);
date.setDate(date.getDate() + 1); // 다음 날
toLocalDateString(date);          // '2026-03-02'
```

하루를 더할 때 `24 * 60 * 60 * 1000`을 더하지 않는 이유가 있습니다.
서머타임이 있는 지역에서는 하루가 23시간이나 25시간인 날이 있어서, 밀리초를 더하면 날짜가 어긋날 수 있습니다.
`setDate`는 달력 기준으로 하루를 더합니다.
한 가지 방식(로컬이든 UTC든)을 정했으면 끝까지 그 방식의 메서드만 쓰는 것도 중요합니다.
로컬로 만들고 `getUTCDate()`로 읽는 식으로 섞이면 다시 하루가 밀립니다.

### 오늘과 마감일은 누구의 날짜인가

날짜만 있는 값이 순간과 만나는 지점에서는 정책을 정해야 합니다.
"쿠폰은 3월 1일까지"라면, 서울의 3월 1일이 끝나는 순간인지 사용자가 있는 곳의 3월 1일이 끝나는 순간인지에 따라 마감이 다릅니다.
서비스 기준 시간대를 정하고, 마감은 그 시간대의 다음 날 0시 같은 순간(`2026-03-02T00:00:00+09:00`)으로 바꿔 저장하면 비교가 명확해집니다.
`23:59:59`로 저장하면 마지막 1초 동안의 요청이 애매해지니, 다음 날 0시 "미만"으로 비교하는 편이 깔끔합니다.

오늘 날짜를 구할 때도 기준 시간대를 명시합니다.

```js
function todayIn(timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

todayIn('Asia/Seoul'); // 서울 기준 오늘, 예: '2026-09-18'
```

## 시간대 버그를 재현하는 방법

이 버그들은 개발자가 있는 시간대에서는 보이지 않는 경우가 많습니다.
일부러 다른 시간대에서 돌려 봐야 합니다.

- Node.js 테스트는 `TZ` 환경 변수로 시간대를 바꿔 실행할 수 있습니다. macOS나 리눅스, 대부분의 CI 환경에서 `TZ=America/New_York npm test`처럼 실행합니다. UTC보다 앞선 시간대와 뒤진 시간대에서 한 번씩 돌리면 대부분 잡힙니다.
- Chrome DevTools의 Sensors 패널에서 위치를 바꾸면 페이지의 시간대도 함께 바꿔 볼 수 있습니다.

## Temporal: 날짜와 순간을 타입으로 나누는 새 API

지금까지의 규칙이 복잡한 이유는 `Date` 하나로 순간, 날짜, 벽시계 시각을 모두 표현하려 했기 때문입니다.
TC39의 `Temporal`은 이것들을 아예 다른 타입으로 나눕니다.

- `Temporal.Instant`: 시간대와 무관한 한 순간
- `Temporal.ZonedDateTime`: 특정 시간대의 날짜와 시각
- `Temporal.PlainDate`: 시간도 시간대도 없는 날짜 (생일)
- `Temporal.PlainDateTime`, `Temporal.PlainTime`: 시간대 없는 날짜와 시각, 시각만

```js
const birthday = Temporal.PlainDate.from('1990-05-03');
birthday.toString();                  // '1990-05-03' (어디서 실행해도 같다)
birthday.add({ days: 1 }).toString(); // '1990-05-04'

const instant = Temporal.Instant.from('2026-03-01T00:00:00Z');
instant.toZonedDateTimeISO('America/New_York').toPlainDate().toString(); // '2026-02-28'

Temporal.Now.plainDateISO('Asia/Seoul'); // 서울 기준 오늘
```

`PlainDate`에는 시간대가 끼어들 자리가 없으니 하루 밀림이 구조적으로 생기지 않습니다.
월도 1부터 셉니다.
뉴욕에서 2월 28일이 되는 마지막 줄처럼, 순간을 날짜로 바꾸려면 시간대를 반드시 지정해야 한다는 점도 코드에 드러납니다.

지원 현황은 빠르게 바뀌고 있습니다.
작성 시점 기준으로 일부 브라우저가 기본 지원을 시작했지만, 모든 주요 브라우저와 런타임에서 쓸 수 있는지는 MDN의 호환성 표를 확인해야 합니다.
지원하지 않는 환경을 위한 폴리필(`@js-temporal/polyfill`)이 있습니다.

## 정리

- `Date`는 UTC 기준 밀리초 숫자 하나입니다. 시간대는 읽을 때 적용됩니다.
- `new Date('2026-03-01')`은 UTC 자정, `new Date('2026-03-01T00:00')`은 로컬 자정입니다. UTC보다 뒤진 시간대에서는 앞의 것이 전날로 보입니다.
- `toISOString().slice(0, 10)`은 UTC 날짜를 줍니다. 한국에서는 오전 9시 이전 시각이 전날이 됩니다.
- 순간은 오프셋을 붙인 ISO 8601로 주고받고 `timestamptz`에 저장하며, 표시할 때 `Intl.DateTimeFormat`의 `timeZone`으로 기준을 정합니다.
- 생일처럼 날짜만 있는 값은 문자열과 `date` 타입으로 다루고, `Date`로 바꿔야 하면 UTC로 만들어 UTC로 읽습니다.
- `Temporal.PlainDate`는 이 문제를 타입으로 해결합니다. 지원 현황은 MDN에서 확인하세요.

## 참고

- [MDN - Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)
- [MDN - Date.parse()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse)
- [ECMAScript - Date Time String Format](https://tc39.es/ecma262/#sec-date-time-string-format)
- [MDN - Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- [MDN - Temporal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal)
- [TC39 - Temporal documentation](https://tc39.es/proposal-temporal/docs/)
- [PostgreSQL - Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html)
