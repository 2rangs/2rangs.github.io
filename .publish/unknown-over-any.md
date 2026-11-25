
TypeScript로 옮긴 프로젝트에서 이런 코드를 자주 봅니다.

```ts
const data: any = await response.json();
setUserName(data.user.name);
```

빨간 줄이 사라졌고, 빌드도 됩니다. 그런데 서버가 응답 모양을 `{ user: { profile: { name } } }`로 바꾸는 날, 이 코드는 아무 경고 없이 `undefined`를 화면에 내보냅니다. `data.user`가 없는 응답이 오면 `Cannot read properties of undefined`로 화면이 멈춥니다. TypeScript를 쓰는 이유가 이런 문제를 미리 잡으려는 것인데, 이 줄에서는 아무것도 잡아 주지 않았습니다.

`any`와 `unknown`은 둘 다 "무엇이든 들어올 수 있는 타입"입니다. 차이는 그다음에 있습니다. `any`는 "무엇이든 해도 된다"이고, `unknown`은 "확인하기 전에는 아무것도 못 한다"입니다.

## any는 타입 검사를 끄는 스위치입니다

`any`는 "이 값의 타입은 넓다"가 아니라 "이 값에 대해서는 검사하지 마라"라는 지시에 가깝습니다.

```ts
const value: any = 'hello';

value.toFixed(2);        // 오류 없음 (실행하면 TypeError)
value();                 // 오류 없음
const n: number = value; // 오류 없음
value.a.b.c.d;           // 오류 없음
```

`any`는 모든 타입에 대입할 수 있고, 모든 타입을 대입받을 수 있고, 어떤 속성 접근이나 호출도 허락합니다. 타입 시스템의 규칙이 이 값에서만 멈춥니다.

더 큰 문제는 `any`가 한자리에 머무르지 않는다는 데 있습니다.

```ts
function parse(text: string) {
  return JSON.parse(text); // 반환 타입: any
}

const config = parse(raw);       // any
const port = config.server.port; // any
const url = `http://localhost:${port + 1}`; // port + 1도 any
startServer(port);               // 어떤 매개변수 타입이든 통과
```

`any`에서 꺼낸 값은 `any`이고, `any`로 계산한 값도 대개 `any`입니다. 함수가 `any`를 반환하면 그 함수를 부르는 모든 곳으로 퍼집니다. 한 군데 붙인 `any`가 그 값을 쓰는 코드 전체의 검사를 경고 없이 끕니다.

까다로운 건 이게 눈에 보이지 않는다는 점입니다. `config`에 마우스를 올려 보기 전에는 이 변수가 검사받지 않는다는 사실을 알기 어렵습니다. 직접 `any`라고 쓰지 않아도 생깁니다. 표준 라이브러리에도 `any`를 돌려주는 API가 있고, `JSON.parse()`, `Response.prototype.json()`(`Promise<any>`)이 대표적입니다.

## unknown은 확인을 요구합니다

`unknown`도 무엇이든 받습니다. 하지만 꺼내 쓰려면 먼저 무엇인지 확인해야 합니다.

```ts
const value: unknown = JSON.parse(text);

value.name;             // 오류: 'value' is of type 'unknown'
const s: string = value; // 오류: unknown은 string에 대입할 수 없음

if (typeof value === 'string') {
  value.toUpperCase(); // 여기서는 string
}
```

`unknown`에 대입하기는 자유롭지만, `unknown`을 다른 곳에 쓰기는 막혀 있습니다. `unknown`은 `unknown`과 `any`에만 대입할 수 있습니다. 그래서 `unknown`은 전염되지 않습니다. 확인하지 않고는 한 발짝도 나갈 수 없으니 퍼지기 전에 경계에서 멈춥니다.

둘 다 "타입을 모른다"는 상황에서 쓰지만 태도가 반대입니다. `any`는 모르니까 믿겠다는 쪽이고, `unknown`은 모르니까 확인하겠다는 쪽입니다.

## 타입 좁히기로 확인합니다

`unknown`을 쓸 수 있는 타입으로 바꾸는 과정을 타입 좁히기(narrowing)라고 합니다. TypeScript는 조건문을 읽고 그 블록 안에서 타입을 좁혀 줍니다. 원시 타입은 `typeof`로 확인합니다.

```ts
function format(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toFixed(2);
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}
```

`typeof null`이 `'object'`라는 JavaScript의 오래된 특징 때문에, 객체를 확인할 때는 `value !== null`을 함께 써야 합니다. TypeScript도 이 점을 알고 있어서 `null` 확인 없이 속성에 접근하면 `'value' is possibly 'null'` 오류를 냅니다.

클래스 인스턴스는 `instanceof`로 확인합니다.

```ts
if (value instanceof Date) value.getTime();
if (value instanceof Error) console.error(value.message);
```

객체에 특정 속성이 있는지는 `in`으로 확인합니다. TypeScript 4.9부터는 타입에 없던 속성이라도 `in`으로 확인하면 그 속성이 있는 타입으로 좁혀 줍니다.

```ts
if (typeof value === 'object' && value !== null && 'name' in value) {
  value.name; // unknown. 있다는 것만 알 뿐, 무슨 타입인지는 아직 모른다
}
```

속성이 있다는 사실과 그 속성의 타입은 별개라서 `value.name`은 여전히 `unknown`입니다. 한 단계 더 확인해야 합니다.

확인 로직이 길어지면 사용자 정의 타입 가드로 묶습니다. 반환 타입에 `value is User`라고 적으면, 이 함수가 `true`를 반환한 곳에서 TypeScript가 `value`를 `User`로 봅니다.

```ts
type User = { id: number; name: string };

function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value && typeof value.id === 'number' &&
    'name' in value && typeof value.name === 'string'
  );
}

if (isUser(data)) {
  data.name; // string
}
```

흔히 오해하는 부분인데, TypeScript는 **타입 가드의 본문이 맞는지 검사하지 않습니다.** `return true`라고만 써도 컴파일러는 그대로 믿습니다. 타입 가드는 "이 함수가 확인해 줄 테니 믿어 달라"는 약속이고, 약속을 지키는 건 작성자 몫입니다. 그래서 필드가 많은 객체를 손으로 검사하는 타입 가드는 실수하기 쉽고, 타입이 바뀔 때 함께 고치는 것도 잊기 쉽습니다. 뒤에서 볼 런타임 검증 라이브러리가 필요한 이유가 여기 있습니다.

## catch 변수는 unknown이어야 맞습니다

`catch`로 잡은 에러의 타입은 무엇일까요? `Error`라고 생각하기 쉽지만 JavaScript에서는 무엇이든 던질 수 있습니다.

```ts
throw 'string';
throw { code: 42 };
throw undefined;
```

내가 쓴 코드는 `Error`만 던져도, 라이브러리나 다른 사람이 쓴 코드가 무엇을 던질지는 모릅니다. 그런데도 TypeScript는 예전에 `catch` 변수를 `any`로 두었고, `error.message`를 써도 아무 말 하지 않았습니다.

TypeScript 4.4에서 `useUnknownInCatchVariables` 옵션이 생겼고, `strict`를 켜면 함께 켜집니다. 이 옵션이 켜져 있으면 `catch` 변수는 `unknown`입니다.

```ts
try {
  await save();
} catch (error) {
  // error: unknown
  const message = error instanceof Error ? error.message : String(error);
  showToast(message);
}
```

`instanceof Error`로 좁힌 다음에 `message`를 씁니다. 옵션을 켤 수 없는 프로젝트라도 `catch (error: unknown)`처럼 직접 적어 줄 수 있습니다. 반대로 `catch (error: Error)`처럼 `unknown`, `any` 외의 타입은 적을 수 없습니다. 던져진 값이 정말 `Error`인지 TypeScript가 보장할 방법이 없기 때문입니다.

## API 응답에 as를 붙이면 안 되는 이유

다시 처음 코드로 돌아가 보겠습니다. `any`가 나쁘다는 걸 알고 나면 많은 사람이 이렇게 고칩니다.

```ts
const user = (await response.json()) as User;
```

빨간 줄도 없고 `user.name`이 `string`으로 나옵니다. 하지만 달라진 건 **TypeScript가 보는 타입뿐**입니다.

`as`는 타입 단언(type assertion)입니다. 변환이 아니라 "내가 더 잘 아니까 이 타입으로 봐 달라"는 선언이고, 실행 시점에는 아무 코드도 남기지 않습니다. TypeScript의 타입은 컴파일하면서 모두 지워지니, 서버가 `name` 대신 `nickname`을 보내도 `user.name`은 여전히 `string`으로 보이고 실행하면 `undefined`가 나옵니다. `any`로 숨기던 문제를 `as`로 다시 숨겼을 뿐입니다.

`fetchJson<T>(url): Promise<T>` 같은 범용 함수도 마찬가지입니다. 제네릭으로 감싸서 안전해 보이지만, 안에서는 `any`를 `T`로 바꾸고 있을 뿐입니다.

API 응답, `localStorage`, URL 쿼리, `postMessage`로 받은 데이터, 사용자가 올린 JSON 파일처럼 외부에서 들어오는 값은 컴파일러가 볼 수 없습니다. 이런 값은 **실행 시점에 확인**해야 합니다.

## 런타임 검증: 스키마 하나로 타입과 검사를 함께

손으로 쓴 타입 가드의 약점은 타입과 검사 코드가 따로 관리된다는 점이었습니다. zod 같은 스키마 라이브러리는 스키마 하나에서 둘 다 만들어 냅니다.

```ts
import { z } from 'zod';

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().optional(),
});

type User = z.infer<typeof UserSchema>; // 스키마에서 타입을 뽑는다

async function getUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const json: unknown = await response.json();
  return UserSchema.parse(json); // 모양이 다르면 여기서 예외
}
```

`parse`는 값이 스키마와 맞으면 타입이 붙은 값을 돌려주고, 다르면 어느 필드가 왜 틀렸는지 담은 에러를 던집니다. 예외 대신 결과로 받고 싶다면 `safeParse`를 씁니다. `{ success: true, data }` 또는 `{ success: false, error }`가 나옵니다.

이렇게 하면 서버 응답이 바뀌었을 때 엉뚱한 화면에서 `undefined`가 터지는 대신, 데이터가 들어오는 입구에서 바로 알 수 있습니다. 에러 메시지가 원인을 직접 가리키니 디버깅도 쉬워집니다.

zod 말고도 Valibot, ArkType 같은 비슷한 라이브러리가 있으니 번들 크기나 문법 취향에 따라 고르면 됩니다. 라이브러리보다 중요한 건 **경계에서 한 번 검증하고, 안쪽에서는 타입을 믿는다**는 구조입니다. 모든 함수 매개변수를 검증할 필요는 없습니다.

## as를 줄이는 습관

`as`가 늘 나쁘지는 않습니다. `as const`는 단언이 아니라 리터럴 타입을 유지하라는 표시이고, 테스트에서 일부 필드만 채운 가짜 객체를 만들 때처럼 정말 내가 더 잘 아는 경우도 있습니다. 문제는 타입 오류를 없애는 가장 빠른 방법으로 `as`를 쓰는 습관입니다.

`as unknown as T`가 보이면 경고 신호로 받아들입니다. TypeScript는 서로 관계없는 타입 사이의 단언을 막는데, 이를 `unknown`을 거쳐 우회하는 형태입니다. 이렇게 써야 한다면 타입 설계가 어긋나 있을 가능성이 높습니다.

값이 타입을 만족하는지만 확인하고 싶다면 `satisfies`를 씁니다. TypeScript 4.9에 들어온 연산자로, 타입을 검사하되 추론된 구체적인 타입은 그대로 둡니다. `as`와 달리 맞지 않으면 오류를 냅니다.

DOM 요소는 `instanceof`로 좁힙니다. `document.querySelector('#email') as HTMLInputElement` 대신 `if (el instanceof HTMLInputElement)`로 확인하면 선택자를 잘못 썼을 때 조용히 넘어가지 않습니다. `!`(non-null 단언)도 단언입니다. `map.get(key)!`는 "절대 없을 리 없다"는 약속이고, 틀리면 `as`와 똑같이 실행 중에 터집니다.

마지막으로 도구의 힘을 빌립니다. typescript-eslint의 `no-explicit-any`는 직접 쓴 `any`를 막고, 타입 정보를 쓰는 규칙인 `no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-call`, `no-unsafe-return`은 `JSON.parse()`처럼 어딘가에서 흘러 들어온 `any`까지 잡아 줍니다. `any`가 퍼지는 경로를 사람이 눈으로 추적하기는 어렵지만, 이 규칙들은 그 경로를 그대로 따라갑니다.

JavaScript 프로젝트를 옮기는 중이라 당장 `any`를 다 없앨 수 없다면, 남은 `any`를 경계에 모아 두고 거기서 바로 `unknown`이나 검증된 타입으로 바꾸는 것부터 시작해도 충분합니다.

## 참고

- [TypeScript Handbook - Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript - TSConfig: useUnknownInCatchVariables](https://www.typescriptlang.org/tsconfig/#useUnknownInCatchVariables)
- [TypeScript 4.9 Release Notes (in 좁히기, satisfies)](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html)
- [Zod 공식 문서](https://zod.dev)
- [typescript-eslint - no-unsafe-member-access](https://typescript-eslint.io/rules/no-unsafe-member-access/)
