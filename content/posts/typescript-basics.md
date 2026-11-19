---
legacy_id: 4
slug: typescript-basics
title: TypeScript 기본 타입 문법 정리
summary: 변수·함수 타입 지정부터 유니온, 타입 별칭, 리터럴 타입, as const, interface와 extends, 조건부 타입까지 TypeScript 기본 문법을 정리한다.
tags: [TypeScript]
date: 2024-12-07T08:22:53.740Z
comment_term: posts/%ED%83%80%EC%9E%85%EC%8A%A4%ED%81%AC%EB%A6%BD%ED%8A%B8%EC%97%90-%EB%8C%80%ED%95%B4-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90
---

TypeScript는 JavaScript에 정적 타입 시스템을 더한 언어다. JavaScript 문법을 그대로 쓰면서 그 위에 타입 표기를 얹는 구조라서, JavaScript의 상위 집합(superset)이라고 부른다. 브라우저나 Node.js에서 실행될 때는 타입이 모두 지워진 JavaScript로 변환되므로, 타입은 실행이 아니라 **작성과 빌드 단계**에서 쓰인다.

이 글에서는 실무에서 바로 쓰는 기본 타입 문법을 순서대로 정리한다.

## TypeScript를 쓰는 이유

가장 큰 이유는 에러를 실행 전에 잡는 것이다. 버그를 아예 없앨 수는 없지만, 타입이 맞지 않는 값이 오가는 종류의 실수는 코드를 작성하는 시점에 에디터와 컴파일러가 알려 준다.

```ts
const sum = (a: number, b: number) => {
  return a + b;
};

sum(1, 2); // 3
sum(1, "2"); // 에러: Argument of type 'string' is not assignable to parameter of type 'number'.
```

JavaScript였다면 `sum(1, "2")`는 에러 없이 `"12"`를 반환했을 것이다. 덤으로 자동 완성과 리팩터링 지원이 좋아지고, 타입 자체가 문서 역할을 한다.

## 변수 타입 지정

변수 이름 뒤에 `: 타입`을 붙인다.

```ts
let userName: string = "rang";
let age: number = 20;
let isMarried: boolean = false;

let members: string[] = ["rang", "john"]; // 배열
let me: { age: number } = { age: 20 }; // 객체

userName = 123; // 에러: Type 'number' is not assignable to type 'string'.
```

초깃값이 있으면 TypeScript가 타입을 알아서 추론하므로, 매번 적지 않아도 된다.

```ts
let userName = "rang"; // string으로 추론
let age = 20; // number로 추론
```

보통은 추론에 맡기고, 추론이 불가능하거나 의도를 분명히 하고 싶은 곳(함수 매개변수, 외부에서 들어오는 데이터 등)에만 직접 적는다.

### 유니온 타입

여러 타입 중 하나를 허용할 때는 `|`로 잇는다.

```ts
let id: string | number;
id = "a-1";
id = 1;
```

## 함수 타입 지정

매개변수와 반환값에 각각 타입을 지정한다.

```ts
// 숫자 두 개를 받아 숫자를 반환한다
function add(n1: number, n2: number): number {
  return n1 + n2;
}

// 반환값이 없는 함수는 void
function log(message: string): void {
  console.log(message);
}

// 매개변수 이름 뒤의 ?는 선택적 매개변수다. 타입은 number | undefined가 된다
function greet(name?: string): string {
  return `Hello, ${name ?? "guest"}`;
}

// 매개변수와 반환값에도 유니온을 쓸 수 있다
function format(x?: string | boolean): string | void {
  if (typeof x === "string") return x.trim();
}
```

`void`로 지정한 함수에서 값을 반환하려 하면 에러가 난다.

```ts
function wrong(n1: number, n2: number): void {
  return n1 + n2; // 에러: Type 'number' is not assignable to type 'void'.
}
```

## 타입 별칭

길어지는 타입은 `type` 키워드로 이름을 붙여 재사용한다. 이를 타입 별칭(type alias)이라고 한다.

```ts
type AnimalId = string | number | undefined;

let animal: AnimalId;
```

함수 타입도 별칭으로 만들어 두면 선언할 때마다 타입을 반복해서 적지 않아도 된다. 별칭을 붙인 함수는 매개변수 타입이 자동으로 추론된다.

```ts
type NumOp = (x: number, y: number) => number;

const sum: NumOp = function (x, y) {
  return x + y;
};

const multiply: NumOp = (x, y) => x * y;
```

## readonly로 속성 변경 막기

`const`는 변수의 재할당만 막는다. `const`로 선언한 객체라도 속성 값은 바꿀 수 있다.

```ts
const data = { name: "rang" };

data.name = "ha"; // 가능: 속성 변경
data = { name: "ha" }; // 에러: Cannot assign to 'data' because it is a constant.
```

속성까지 바꾸지 못하게 하려면 타입에 `readonly`를 붙인다.

```ts
type User = {
  readonly name: string;
};

const user: User = { name: "rang" };

user.name = "minori"; // 에러: Cannot assign to 'name' because it is a read-only property.
```

`readonly`는 컴파일 단계의 검사일 뿐이라, 변환된 JavaScript에서 객체가 실제로 동결되지는 않는다. 런타임에서도 막아야 한다면 `Object.freeze`를 쓴다.

## 리터럴 타입

리터럴(literal)은 "값 그대로"라는 뜻이다. 특정 값 자체를 타입으로 쓰면 그 값만 할당할 수 있다.

```ts
let direction: "left" = "left";
direction = "right"; // 에러: Type '"right"' is not assignable to type '"left"'.
```

유니온과 함께 쓰면 허용할 값의 목록을 정확히 표현할 수 있다. 가위바위보 함수를 예로 들면 이렇다.

```ts
type Hand = "가위" | "바위" | "보";

// 가위·바위·보 중 하나를 받아, 그 손을 이기는 손을 반환한다
function counter(hand: Hand): Hand {
  if (hand === "가위") return "바위";
  if (hand === "바위") return "보";
  return "가위";
}

const history: Hand[] = ["가위", "보"];
```

실무에서는 버튼 크기(`"sm" | "md" | "lg"`), 요청 상태(`"idle" | "loading" | "error"`)처럼 값의 범위가 정해진 곳에서 자주 쓴다.

## as const

객체 뒤에 `as const`를 붙이면 모든 속성이 `readonly`가 되고, 값의 타입도 넓은 `string`이 아니라 리터럴 타입으로 고정된다.

```ts
const dict = {
  name: "kim",
} as const;
// 타입: { readonly name: "kim" }

dict.name = "lee"; // 에러: Cannot assign to 'name' because it is a read-only property.
```

`as const`가 없으면 `dict.name`의 타입은 `string`이다. 상수 객체에서 리터럴 유니온을 뽑아낼 때 특히 유용하다.

```ts
const SIZES = ["sm", "md", "lg"] as const;
type Size = (typeof SIZES)[number]; // "sm" | "md" | "lg"
```

## 객체와 메서드 타입 지정

객체 안의 메서드도 타입으로 표현할 수 있다.

```ts
type Member = {
  name: string;
  age: number;
  plusOne: (x: number) => number;
  changeName: (name: string) => void;
};

const my: Member = {
  name: "rang",
  age: 20,
  plusOne(age) {
    return age + 1;
  },
  changeName(name) {
    console.log(name);
  },
};
```

개인적으로 이 부분이 가장 중요하다고 생각한다. API 응답처럼 객체 형태로 들어오는 데이터는 실무에서 아주 흔한데, 타입 없이 받아서 쓰면 린트와 컴파일러가 곳곳에서 에러를 낸다. 응답 형태를 타입으로 먼저 정의해 두면 이후 코드 전체가 그 타입을 기준으로 검사된다.

## interface

객체의 형태는 `interface`로도 정의할 수 있다.

```ts
interface Square {
  color: string;
  width: number;
}

const square: Square = { color: "red", width: 10 };
```

### extends로 확장하기

`extends`를 쓰면 기존 interface의 속성을 물려받고 새 속성을 더할 수 있다.

```ts
interface Person {
  name: string;
}

interface Teacher extends Person {
  subject: string;
}

const teacher: Teacher = { name: "rang", subject: "math" };
```

`Teacher`는 `name`과 `subject`를 모두 가진다. 타입 별칭에서는 교차 타입(`&`)으로 비슷하게 표현한다.

```ts
type PersonType = { name: string };
type TeacherType = PersonType & { subject: string };
```

객체 형태를 정의할 때 `type`과 `interface`는 대부분 바꿔 써도 된다. 차이를 들자면 `interface`는 같은 이름으로 다시 선언하면 합쳐지고(선언 병합), `type`은 유니온이나 조건부 타입처럼 객체가 아닌 타입도 표현할 수 있다. 팀 안에서 기준을 하나 정해 일관되게 쓰는 편이 낫다.

## 제네릭과 조건부 타입

타입도 함수처럼 매개변수를 받을 수 있다. 이를 제네릭(generic)이라고 한다.

```ts
type Box<T> = { value: T };

const numberBox: Box<number> = { value: 1 };
const stringBox: Box<string> = { value: "a" };
```

제네릭에 조건을 걸면 조건부 타입이 된다. 문법은 삼항 연산자와 같은 모양이다.

```ts
type OnlyString<T> = T extends string ? T : never;

type A = OnlyString<"hello">; // "hello"
type B = OnlyString<number>; // never
```

`T extends string`은 "T가 string에 할당 가능하면"이라는 뜻이다. 조건이 참이면 `?` 뒤의 타입, 거짓이면 `:` 뒤의 타입이 결과가 된다. TypeScript에 내장된 `Exclude`, `Extract`, `NonNullable` 같은 유틸리티 타입이 이 문법으로 만들어져 있다.

## 정리

- 초깃값이 있는 변수는 추론에 맡기고, 함수 매개변수와 외부 데이터에는 타입을 직접 적는다.
- 반복되는 타입은 `type`이나 `interface`로 이름을 붙여 재사용한다.
- `const`는 재할당만 막는다. 속성 변경까지 막으려면 `readonly`나 `as const`를 쓴다.
- 리터럴 타입과 유니온으로 허용할 값의 범위를 좁힐 수 있다.
- 제네릭과 조건부 타입으로 입력에 따라 달라지는 타입을 표현할 수 있다.

## 참고

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
