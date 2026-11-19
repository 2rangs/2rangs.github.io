
콘솔에 이렇게 쳐 보면 누구나 한 번은 놀랍니다.

```js
0.1 + 0.2;         // 0.30000000000000004
0.1 + 0.2 === 0.3; // false
```

할인율을 곱하거나 달러 금액을 더하는 화면에 이 값이 그대로 찍히면 버그 제보가 들어옵니다.
흔히 자바스크립트는 계산을 못 한다고 농담하지만, 파이썬의 `float`, 자바와 C의 `double`도 똑같은 결과를 냅니다.
문제는 언어가 아니라 숫자를 저장하는 방식에 있습니다.

## 0.1은 이진수로 정확히 쓸 수 없습니다

자바스크립트의 `Number`는 IEEE 754 배정밀도(64비트) 이진 부동소수점입니다.
부호 1비트, 지수 11비트, 가수 52비트로 이루어져 있고, 숨은 비트까지 합쳐 정밀도는 53비트입니다.

10진수에서 1/3을 끝까지 쓸 수 없는 것과 같은 일이 2진수에서는 1/10에 일어납니다.
분모가 2의 거듭제곱인 분수(1/2, 1/4, 3/8 같은)만 2진수로 딱 떨어집니다.
1/10은 분모에 5가 있어서 2진수로 쓰면 `0.000110011001100...`처럼 끝없이 반복됩니다.

53비트에서 잘라야 하니, `0.1`이라고 쓴 값은 실제로는 0.1에 가장 가까운 2진수 값으로 저장됩니다.

```js
(0.1).toPrecision(21); // '0.100000000000000005551'
(0.2).toPrecision(21); // '0.200000000000000011102'
(0.3).toPrecision(21); // '0.299999999999999988898'
```

`0.1`과 `0.2`는 조금씩 크게, `0.3`은 조금 작게 저장되어 있습니다.
둘을 더하면 오차가 합쳐져서 `0.3`으로 저장된 값의 바로 옆 값이 됩니다.
그 값을 표현하는 가장 짧은 10진수가 `0.30000000000000004`입니다.

`console.log(0.1)`이 `0.1`을 보여 주는 건 저장된 값이 정확히 0.1이어서가 아닙니다.
자바스크립트는 숫자를 문자열로 바꿀 때 "다시 읽었을 때 같은 값이 되는 가장 짧은 10진수"를 고릅니다.
오차는 늘 있었지만 출력에서 가려지다가, 계산 결과가 이웃 값으로 넘어가는 순간 드러납니다.

## toFixed는 반올림 문제를 해결하지 못합니다

화면에 소수점 둘째 자리까지만 보여 주려고 `toFixed`를 쓰곤 합니다.

```js
(0.1 + 0.2).toFixed(2); // '0.30'
```

잘 되는 것처럼 보입니다.
그런데 다음은 어떨까요.

```js
(1.005).toFixed(2);            // '1.00'  ('1.01'을 기대했다)
Math.round(1.005 * 100) / 100; // 1
1.005 * 100;                   // 100.49999999999999
```

`1.005`라고 썼지만 실제로 저장된 값은 `1.00499999999999989...`입니다.
`toFixed`는 저장된 값을 정확하게 반올림했을 뿐이고, 그 값은 1.005보다 작으니 내려갑니다.
100을 곱해 `Math.round`를 쓰는 흔한 우회법도 곱셈 결과가 `100.49999999999999`가 되어 같은 함정에 빠집니다.

`toFixed`는 계산 도구가 아니라 표시용 함수입니다.
돌려주는 값도 숫자가 아니라 **문자열**이라서, `toFixed` 결과끼리 `+`로 더하면 문자열이 이어 붙습니다.
계산 중간에 `toFixed`로 자르고 다시 `Number`로 바꾸는 코드는 오차를 숨길 뿐 없애지 못합니다.

## Number.EPSILON으로 비교하면 될까

부동소수점은 `===` 대신 오차 범위로 비교하라는 조언과 함께 `Number.EPSILON`이 자주 등장합니다.

```js
Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON; // true
```

`Number.EPSILON`은 1과, 1보다 큰 가장 작은 `Number` 사이의 차이로 2⁻⁵²(약 2.2 × 10⁻¹⁶)입니다.
중요한 건 이 값이 **1 근처에서의** 간격이라는 사실입니다.
부동소수점은 수가 커질수록 이웃한 값 사이의 간격도 커집니다.
1000 근처에서는 간격이 이미 `Number.EPSILON`의 512배이고, 2⁵³을 넘으면 정수조차 하나 건너 하나만 표현됩니다.

```js
1000.1 + 1000.2; // 2000.3000000000002
Math.abs(1000.1 + 1000.2 - 2000.3) < Number.EPSILON; // false
```

고정된 `Number.EPSILON`과 비교하는 방식은 큰 수에서는 실패하고, 아주 작은 수끼리 비교할 때는 너무 느슨합니다.
비교 대상의 크기에 비례한 허용 오차를 쓰는 편이 맞습니다.

```js
function nearlyEqual(a, b, relTol = 1e-9) {
  return Math.abs(a - b) <= relTol * Math.max(Math.abs(a), Math.abs(b));
}

nearlyEqual(1000.1 + 1000.2, 2000.3); // true
```

다만 이 방법은 측정값이나 좌표처럼 원래부터 근사값인 수를 비교할 때 씁니다.
금액은 근사하면 안 되는 수입니다.
금액 계산에서는 비교 방법을 고칠 게 아니라 애초에 오차가 생기지 않게 해야 합니다.

## 금액은 정수로 계산합니다

가장 실용적인 방법은 화폐의 최소 단위를 정수로 쓰는 방식입니다.
원화라면 원, 달러라면 센트입니다.
`Number`는 `Number.MAX_SAFE_INTEGER`(2⁵³ − 1, 약 9천조)까지의 정수를 정확하게 표현하고, 결과가 이 범위 안이면 정수끼리의 덧셈, 뺄셈, 곱셈에는 오차가 없습니다.

```js
// 달러 대신 센트로 계산한다
const items = [1999, 2999, 499]; // $19.99, $29.99, $4.99
const total = items.reduce((sum, cents) => sum + cents, 0); // 5497
```

경계에서 조심할 곳이 두 군데 있습니다.

**입력을 정수로 바꿀 때.**
사용자가 입력한 `0.29`달러를 센트로 바꾸려고 100을 곱하면 이미 늦습니다.

```js
0.29 * 100;             // 28.999999999999996
Math.floor(0.29 * 100); // 28  (1센트가 사라졌다)
Math.round(0.29 * 100); // 29
```

곱한 뒤 반드시 `Math.round`로 가장 가까운 정수에 맞춥니다.
더 확실하게 하려면 입력 문자열을 소수점 기준으로 나눠 정수로 조립합니다.

**나눗셈과 비율.**
할인율, 부가세, 분할 결제에서는 정수가 아닌 값이 생길 수밖에 없습니다.
이 지점에서는 반올림할지, 버릴지, 올릴지를 **정책으로 정하고** 한 곳에서만 처리해야 합니다.
비율도 소수 대신 정수로 들고 있으면 중간 오차가 끼어들 곳이 줄어듭니다.

```js
// 퍼센트 할인, 원 단위 미만은 버린다
function applyDiscount(priceWon, percent) {
  return Math.floor((priceWon * (100 - percent)) / 100);
}

applyDiscount(19900, 15); // 16915
```

`19900 * 0.85`처럼 소수를 곱해도 대부분은 맞게 나옵니다.
하지만 위의 `0.29 * 100`처럼 경계에서 한 단위가 어긋나는 경우가 생길 수 있고, 어떤 값에서 어긋날지 미리 알기 어렵습니다.
정수끼리 곱한 다음 마지막에 한 번만 나누면 오차가 생길 수 있는 곳이 그 한 번뿐이고, 바로 거기서 정책대로 정수로 맞추면 됩니다.

나누어 떨어지지 않는 금액을 여럿으로 나눌 때는 나머지를 어디로 보낼지도 정해야 합니다.
10,000원을 셋으로 나누면 3,333원씩이고 1원이 남습니다.

```js
function splitAmount(total, count) {
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

splitAmount(10000, 3); // [3334, 3333, 3333]
```

핵심은 나눈 금액의 합이 원래 금액과 같도록 보장하는 데 있습니다.
각자 따로 반올림하면 합계가 1원씩 어긋나고, 이런 차이가 정산에서 문제가 됩니다.

## 더 큰 정수는 BigInt로

정수로 바꿨는데도 범위가 모자랄 때가 있습니다.
아주 작은 단위를 쓰는 자산, 누적 정산 금액, 다른 시스템에서 받은 64비트 정수 ID 같은 경우입니다.
`BigInt`는 크기 제한 없이 정수를 정확하게 다룹니다.

```js
9007199254740993;      // 9007199254740992 (Number로는 이미 표현할 수 없다)
9007199254740993n + 1n; // 9007199254740994n
```

몇 가지 제약이 있습니다.

- `Number`와 섞어 계산하면 `TypeError`가 납니다. `1n + 1`은 안 되고 명시적으로 변환해야 합니다.
- 나눗셈은 소수점 아래를 버립니다. `7n / 2n`은 `3n`입니다. 반올림이 필요하면 나머지(`%`)를 보고 직접 처리합니다.
- `Math`의 함수를 쓸 수 없습니다.
- `JSON.stringify`가 `BigInt`를 만나면 `TypeError`를 던집니다. API로 보낼 때는 문자열로 바꿔야 합니다.

`BigInt`는 큰 정수를 위한 도구입니다.
소수를 정확하게 다루는 타입은 아직 자바스크립트 표준에 없고, TC39에서 Decimal 제안이 논의되고 있는 단계입니다.
소수 연산이 꼭 필요하면 `decimal.js`나 `big.js` 같은 라이브러리를 씁니다.

## 표시는 Intl.NumberFormat에 맡깁니다

계산은 정수로 하고, 사람에게 보여 줄 때만 단위를 붙입니다.
천 단위 구분 기호, 통화 기호, 소수 자릿수를 문자열로 직접 조립하지 말고 `Intl.NumberFormat`에 맡기면 지역별 규칙까지 맞춰 줍니다.

```js
const krw = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' });
krw.format(16915); // '₩16,915'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
usd.format(5497 / 100); // '$54.97'
```

원화는 기본 소수 자릿수가 0, 달러는 2처럼 통화에 맞게 정해집니다.
`format`은 `BigInt`도 받습니다.

센트를 100으로 나누는 코드는 아주 작은 오차가 있는 값을 만들 수 있습니다.
하지만 표시할 때 소수 둘째 자리에서 반올림하므로 화면에는 정확한 값이 나옵니다.
나눈 결과를 다시 계산에 쓰지만 않으면 됩니다.

## 서버와 데이터베이스에서는 decimal

클라이언트에서 정수로 잘 계산해도, 저장하고 계산하는 쪽이 부동소수점이면 소용없습니다.

- 데이터베이스 컬럼은 `float`나 `double precision`이 아니라 `numeric`·`decimal`처럼 10진수를 정확히 저장하는 타입을 씁니다. 최소 단위 정수로 저장하는 `bigint` 컬럼도 좋은 선택입니다.
- 서버 언어에서도 자바의 `BigDecimal`, 파이썬의 `decimal.Decimal` 같은 10진 연산 타입을 씁니다.
- JSON으로 주고받을 때는 자바스크립트가 숫자를 `Number`로 읽는다는 점을 기억해야 합니다. `"amount": 12345.67`은 받는 순간 2진수 근사값이 됩니다. 최소 단위 정수(`1234567`)나 문자열(`"12345.67"`)로 주고받는 편이 안전합니다.

```sql
create table orders (
  id bigint generated always as identity primary key,
  total_amount numeric(12, 2) not null, -- 소수 둘째 자리까지 정확하게
  currency char(3) not null              -- 'KRW', 'USD' 같은 ISO 4217 코드
);
```

금액과 통화 코드는 항상 함께 다루는 편이 좋습니다.
같은 `1000`이라도 원화, 엔화, 달러에서는 완전히 다른 값이고, 통화마다 최소 단위의 자릿수도 다릅니다.

## 정리

- `0.1 + 0.2`는 언어의 버그가 아니라 IEEE 754 이진 부동소수점이 10진 소수를 정확히 표현하지 못해서 생깁니다.
- `toFixed`는 표시용이고 문자열을 돌려줍니다. 저장된 값을 기준으로 반올림하므로 `(1.005).toFixed(2)`는 `'1.00'`입니다.
- `Number.EPSILON`은 1 근처의 간격일 뿐입니다. 근사값 비교에는 상대 오차를 쓰고, 금액은 애초에 근사하지 않게 합니다.
- 금액은 원·센트 같은 최소 단위의 정수로 계산하고, 반올림은 정책을 정해 한 곳에서 처리합니다.
- 범위를 넘는 정수는 `BigInt`, 표시는 `Intl.NumberFormat`, 저장과 전송은 `decimal` 타입이나 정수·문자열로 합니다.

## 참고

- [MDN - Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)
- [MDN - Number.EPSILON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON)
- [MDN - Number.prototype.toFixed()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed)
- [MDN - BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
- [MDN - Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)
- [PostgreSQL - Numeric Types](https://www.postgresql.org/docs/current/datatype-numeric.html)
- David Goldberg, "What Every Computer Scientist Should Know About Floating-Point Arithmetic" (1991)
