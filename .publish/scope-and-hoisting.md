
선언보다 앞줄에서 변수를 찍었더니 에러 없이 `undefined`가 나오고, 비슷한 코드인데 `let`으로 바꾸면 `ReferenceError`가 난다. `for` 문 안의 `setTimeout`이 0, 1, 2 대신 3, 3, 3을 찍기도 한다. 이런 현상은 대부분 스코프(scope)와 호이스팅(hoisting)으로 설명된다. 스코프는 변수가 어디서 보이는지를, 호이스팅은 선언이 언제부터 존재하는지를 정한다.

## 스코프

스코프는 변수나 함수에 **어디서 접근할 수 있는지**를 정하는 범위다. 크게 전역 스코프와 지역 스코프로 나누고, 지역 스코프는 다시 함수 스코프와 블록 스코프로 나뉜다.

### 전역 스코프

함수나 블록 바깥, 최상위에서 선언한 변수는 전역 스코프에 속하고 프로그램 어디서든 접근할 수 있다.

```js
let globalNum = 100; // 전역 변수

const example = () => {
  console.log(globalNum); // 100
};

example();
console.log(globalNum); // 100
```

편리하지만 남용하면 어디서 값이 바뀌는지 추적하기 어렵고, 이름 충돌로 예기치 않은 버그가 생긴다. 전역 변수는 꼭 필요한 것만 두는 편이 좋다.

### 지역 스코프

함수나 블록 안에서 선언한 변수는 그 안에서만 유효하다.

```js
const example = () => {
  let localNum = 50; // 지역 변수
  console.log(localNum); // 50
};

example();
console.log(localNum); // ReferenceError: localNum is not defined
```

`localNum`은 `example` 함수 안에서만 존재하므로 바깥에서 접근하면 에러가 난다.

### 함수 스코프와 블록 스코프

지역 스코프의 범위는 선언 키워드에 따라 달라진다.

| 키워드 | 스코프 | 범위 |
| --- | --- | --- |
| `var` | 함수 스코프 | 선언된 함수 전체 |
| `let`, `const` | 블록 스코프 | 선언된 중괄호 `{}` 블록 안 |

차이는 `if`나 `for` 같은 블록 안에서 선언할 때 드러난다.

```js
const example = () => {
  if (true) {
    var funcVar = "함수 스코프 변수";
    let blockVar = "블록 스코프 변수";
  }

  console.log(funcVar); // "함수 스코프 변수"
  console.log(blockVar); // ReferenceError: blockVar is not defined
};

example();
```

`var`로 선언한 `funcVar`는 `if` 블록을 벗어나도 함수 안 어디서든 접근할 수 있지만, `let`으로 선언한 `blockVar`는 `if` 블록이 끝나면 더 이상 접근할 수 없다. 함수 밖에서는 둘 다 접근할 수 없다. `var`가 블록을 무시한다는 점은 반복문에서 특히 문제가 된다.

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i)); // 3, 3, 3
}

for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log(j)); // 0, 1, 2
}
```

`var i`는 함수 전체에서 하나뿐이라 콜백이 실행될 때는 이미 3이 되어 있다. `let j`는 반복마다 새 바인딩이 만들어져 각 콜백이 자기 값을 기억한다.

### 스코프 체인

자바스크립트는 변수를 찾을 때 현재 스코프부터 시작해 바깥 스코프로 한 단계씩 올라가며 탐색한다. 이 연결을 스코프 체인이라고 한다. 전역 스코프까지 올라가도 찾지 못하면 `ReferenceError`가 발생한다.

```js
const globalVar = "전역 변수";

const outer = () => {
  const outerVar = "외부 변수";

  function inner() {
    console.log(globalVar); // "전역 변수"
    console.log(outerVar); // "외부 변수"
  }

  inner();
};

outer();
```

`inner`는 자신의 스코프에서 `outerVar`를 찾지 못하면 `outer`의 스코프를, 거기서도 없으면 전역 스코프를 확인한다.

스코프 체인은 **함수를 어디서 호출했는지가 아니라 어디서 선언했는지**로 정해진다. 이를 렉시컬 스코프(lexical scope)라고 한다.

```js
const value = "전역";

function printValue() {
  console.log(value);
}

function run() {
  const value = "run 내부";
  printValue();
}

run(); // "전역"
```

`printValue`는 `run` 안에서 호출되었지만 전역에서 선언되었으므로 전역의 `value`를 본다. 클로저도 이 성질 위에서 동작한다.

## 호이스팅

호이스팅은 선언이 코드의 맨 위로 끌어올려진 것처럼 동작하는 현상이다. 실제로 코드가 이동하는 것은 아니다. 자바스크립트 엔진은 코드를 실행하기 전에 각 스코프의 선언을 먼저 훑어 식별자를 등록해 두는데, 그 결과 선언보다 앞줄에서도 식별자가 이미 존재하게 된다.

식별자가 **어떤 상태로 등록되는지**는 선언 방식마다 다르고, 선언 전에 접근했을 때의 결과도 여기서 갈린다.

| 선언 방식 | 선언 전 접근 시 |
| --- | --- |
| 함수 선언식 `function f() {}` | 정상 호출된다 (함수 전체가 미리 준비됨) |
| `var` | `undefined` |
| `let`, `const`, `class` | `ReferenceError` (TDZ) |
| `const f = () => {}` 같은 함수 표현식 | 변수 선언 방식(`const`, `let`, `var`)을 따른다 |

### 함수 선언식

함수 선언식은 이름과 함수 본문이 통째로 미리 준비되므로, 선언보다 앞에서 호출해도 정상적으로 실행된다.

```js
sayHello(); // "Hello World!"

function sayHello() {
  console.log("Hello World!");
}
```

### 함수 표현식과 화살표 함수

변수에 함수를 할당하는 함수 표현식은 다르다. 호이스팅되는 것은 **변수 선언**뿐이고, 함수를 할당하는 일은 그 줄이 실행될 때 일어난다. 따라서 `const`로 선언한 화살표 함수는 선언 전에 호출할 수 없다.

```js
sayHello(); // ReferenceError: Cannot access 'sayHello' before initialization

const sayHello = () => {
  console.log("Hello World!");
};
```

`var`로 선언하면 에러 메시지만 달라진다. 변수는 `undefined`로 초기화되어 있으므로, `undefined`를 함수처럼 호출하려다 `TypeError`가 난다.

```js
sayHello(); // TypeError: sayHello is not a function

var sayHello = () => {
  console.log("Hello World!");
};
```

선언 전에 호출할 수 있는 것은 함수 선언식뿐이다.

### var의 호이스팅

`var`로 선언한 변수는 선언과 동시에 `undefined`로 초기화된다. 할당은 원래 자리에 남아 있으므로, 선언 전에 접근하면 에러 대신 `undefined`가 나온다.

```js
console.log(num); // undefined
var num = 10;
console.log(num); // 10
```

엔진 입장에서는 아래 코드처럼 동작한다고 보면 된다.

```js
var num; // 선언과 undefined 초기화가 먼저
console.log(num); // undefined
num = 10; // 할당은 원래 자리에서
console.log(num); // 10
```

에러 없이 `undefined`가 그대로 쓰이기 때문에 버그를 늦게 발견하게 된다.

### let과 const의 호이스팅과 TDZ

`let`과 `const`도 호이스팅된다. 다만 선언은 등록되지만 초기화되지 않은 상태로 남고, 선언문이 실행되기 전까지는 접근할 수 없다. 스코프 시작부터 선언문까지의 이 구간을 TDZ(Temporal Dead Zone, 일시적 사각지대)라고 한다.

```js
console.log(num); // ReferenceError: Cannot access 'num' before initialization
let num = 10;
```

호이스팅이 정말 일어난다는 것은 바깥에 같은 이름의 변수가 있을 때 확인할 수 있다.

```js
const num = 1;

{
  console.log(num); // ReferenceError: Cannot access 'num' before initialization
  const num = 2;
}
```

호이스팅되지 않았다면 블록 안의 `console.log`는 스코프 체인을 따라 바깥의 `num`(1)을 출력했을 것이다. 블록 안의 `num` 선언이 이미 등록되어 바깥 변수를 가리고 있기 때문에 TDZ 에러가 난다.

## 호이스팅을 고려한 코드 작성

변수는 `const`를 기본으로 쓰고, 재할당이 필요할 때만 `let`을 쓴다. `var`는 쓰지 않는다. 변수는 사용하기 직전, 가능한 한 좁은 블록에서 선언하고 바로 초기화한다. 그러면 `undefined`가 조용히 흘러다니는 일도, TDZ에 걸리는 일도 거의 없다.

함수 표현식과 화살표 함수는 호출보다 위에 선언한다. 선언 전에 호출해야 하는 구조라면 함수 선언식을 쓴다. ESLint의 `no-var`, `no-use-before-define` 같은 규칙을 켜 두면 이런 실수를 미리 잡을 수 있다.

## 참고

- [MDN - Scope](https://developer.mozilla.org/en-US/docs/Glossary/Scope)
- [MDN - Hoisting](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting)
- [MDN - let](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let)
