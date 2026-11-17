-- 블로그 DB 정리 (2026-11-17)
-- Supabase 대시보드 > SQL Editor에 통째로 붙여 넣고 한 번 실행한다. 여러 번 실행해도 결과가 같다.
-- 사이트는 이 SQL을 실행하지 않아도 content/posts의 글을 보여 준다. 실행하면 글이 DB로 들어가 웹 에디터로 고칠 수 있다.
-- 1) blog_posts 스키마 보강  2) 예전 posts 글 16편을 다듬어 blog_posts로 이전  3) 예전 테이블 보관 처리
begin;

-- 1. 스키마 ---------------------------------------------------------------
alter table public.blog_posts
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  -- 예전 posts.id. /blog/legacy-<id>/ 주소를 새 주소로 잇는 데 쓴다.
  add column if not exists legacy_id bigint,
  -- giscus 댓글 스레드 이름. 비어 있으면 앱이 blog-post-<id>를 쓴다. 옮겨 온 글은 예전 댓글을 이어 받는다.
  add column if not exists comment_term text;

-- 읽는 시간(분). 한국어 기준 분당 약 500자. 본문이 바뀌면 자동으로 다시 계산된다.
alter table public.blog_posts
  add column if not exists reading_minutes integer
  generated always as (greatest(1, round(char_length(coalesce(body_markdown, '')) / 500.0)::integer)) stored;

-- tags는 text[]로 맞춘다. 처음 만들 때 jsonb나 text로 만들었어도 그대로 바꿔 준다.
do $$
declare
  kind text;
begin
  select udt_name into kind from information_schema.columns
   where table_schema = 'public' and table_name = 'blog_posts' and column_name = 'tags';
  if kind is null then
    alter table public.blog_posts add column tags text[];
  elsif kind in ('jsonb', 'json') then
    alter table public.blog_posts alter column tags drop default;
    alter table public.blog_posts alter column tags type text[]
      using case when tags is null or jsonb_typeof(tags::jsonb) <> 'array' then '{}'::text[]
                 else translate(tags::jsonb::text, '[]', '{}')::text[] end;
  elsif kind in ('text', 'varchar') then
    alter table public.blog_posts alter column tags drop default;
    alter table public.blog_posts alter column tags type text[]
      using case when tags is null or btrim(tags) = '' then '{}'::text[]
                 else string_to_array(regexp_replace(tags, '\s*,\s*', ',', 'g'), ',') end;
  end if;
end $$;
alter table public.blog_posts alter column tags set default '{}';
update public.blog_posts set tags = '{}' where tags is null;

create unique index if not exists blog_posts_slug_key on public.blog_posts (slug);
create unique index if not exists blog_posts_legacy_id_key on public.blog_posts (legacy_id);
create index if not exists blog_posts_published_at_idx on public.blog_posts (published_at desc nulls first);
create index if not exists blog_posts_tags_idx on public.blog_posts using gin (tags);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'blog_posts_slug_format') then
    alter table public.blog_posts add constraint blog_posts_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') not valid;
  end if;
end $$;

-- 수정할 때마다 updated_at을 갱신한다. 사이트맵 lastmod와 글의 "수정" 날짜로 쓰인다.
create or replace function public.blog_posts_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists blog_posts_touch on public.blog_posts;
create trigger blog_posts_touch before update on public.blog_posts
  for each row execute function public.blog_posts_touch();

-- 2. 예전 글 이전 -----------------------------------------------------------
-- 발행일은 예전 글의 작성일을 그대로 쓴다.
insert into public.blog_posts (legacy_id, slug, title, summary, tags, body_markdown, published_at, comment_term)
values
  (3, 'cnn-basics', 'CNN 기초 정리, 구성 요소부터 특징 맵 크기 계산까지', '합성곱 신경망(CNN)의 구성 요소와 합성곱·풀링 연산, 커널·패딩·스트라이드가 특징 맵 크기에 미치는 영향을 정리한다.', array['AI']::text[], $body3$
CNN(Convolutional Neural Network, 합성곱 신경망)은 이미지처럼 공간 구조가 있는 데이터에서 특징을 뽑아내는 데 특화된 딥러닝 모델이다. 이 글에서는 CNN의 개요와 주요 구성 요소, 핵심 연산, 그리고 커널·패딩·스트라이드 같은 하이퍼파라미터가 특징 맵 크기를 어떻게 바꾸는지 정리한다.

## CNN이란

CNN은 이미지 분류, 객체 탐지, 영상 처리 등에 널리 쓰인다. 모든 입력을 모든 뉴런에 연결하는 완전 연결 신경망과 달리, CNN은 작은 필터를 입력 위로 이동시키며 **지역적인 패턴**을 학습한다.

이 구조에서 두 가지 이점이 나온다.

- **지역 연결**: 각 출력은 입력의 작은 영역만 본다. 가까운 픽셀끼리 의미 있는 관계를 갖는 이미지의 성질과 잘 맞는다.
- **가중치 공유**: 같은 필터를 입력 전체에 반복해서 적용하므로, 완전 연결층보다 파라미터 수가 크게 줄고 학습 효율이 올라간다.

## 주요 구성 요소

일반적인 CNN은 아래 순서로 데이터를 처리한다. 합성곱–활성화–풀링 묶음을 여러 번 쌓은 뒤 완전 연결층으로 넘기는 형태가 기본이다.

| 구성 요소 | 역할 |
| --- | --- |
| 입력 레이어 | 이미지를 H × W × C 형태로 받는다. H는 높이, W는 너비, C는 채널 수(RGB면 3)다. |
| 합성곱 레이어 | 필터로 입력의 특징을 추출해 특징 맵(feature map)을 만든다. CNN의 핵심이다. |
| 활성화 함수 | ReLU 같은 함수로 비선형성을 더해 복잡한 패턴을 학습할 수 있게 한다. |
| 풀링 레이어 | 특징 맵의 공간 크기를 줄여 연산량을 낮춘다. |
| 완전 연결층 | 앞에서 추출한 특징을 종합해 예측에 필요한 값을 계산한다. |
| 출력 레이어 | 다중 분류는 Softmax, 이진 분류는 Sigmoid로 최종 예측값을 낸다. |

풀링은 작은 위치 변화에 덜 민감한 표현을 만들어 주고 파라미터 없이 크기를 줄이므로 과적합 완화에 어느 정도 도움이 된다. 다만 과적합을 직접 막는 장치라기보다는 부수 효과에 가깝고, 본격적인 규제는 드롭아웃이나 데이터 증강 같은 기법이 맡는다.

## 핵심 연산

### 합성곱 연산

합성곱 연산은 필터(커널)를 입력 위에서 한 칸씩 이동시키며, 겹치는 영역의 값과 필터 값을 곱해 모두 더한다. 이 결과가 특징 맵의 한 칸이 된다. 필터는 경계선, 질감 같은 특정 패턴에 강하게 반응하며, 필터 값은 학습을 통해 갱신된다.

크기가 k × k인 커널을 쓸 때 특징 맵 계산식은 다음과 같다.

![2차원 합성곱 수식. S(i, j)는 m과 n을 0부터 k-1까지 더한 I(i+m, j+n)과 K(m, n)의 곱의 합](/img/blog/post-3-1.png)

- I: 입력 데이터
- K: 커널(필터)
- S: 출력 특징 맵

엄밀히 말하면 수학에서의 합성곱은 커널을 뒤집어서 곱한다. 위 식처럼 뒤집지 않는 연산은 교차 상관(cross-correlation)이라고 부르는데, 커널 값을 어차피 학습하므로 결과에 차이가 없어 딥러닝 프레임워크 대부분이 이 방식을 쓰면서도 관례적으로 합성곱이라고 부른다.

또 실제 이미지는 채널이 여러 개이므로, 필터 하나는 입력 채널 수만큼의 깊이(k × k × C)를 가진다. 필터 하나가 특징 맵 한 장을 만들고, 필터 개수가 곧 출력 채널 수가 된다.

### 풀링 연산

풀링은 지정한 영역을 하나의 값으로 요약해 크기를 줄인다.

- **Max Pooling**: 영역 안에서 가장 큰 값을 고른다. 가장 강하게 반응한 특징을 남긴다.
- **Average Pooling**: 영역 안의 평균을 계산한다. 영역 전체의 경향을 부드럽게 남긴다.

예를 들어 2 × 2 영역, 스트라이드 2로 Max Pooling을 하면 특징 맵의 가로·세로가 각각 절반이 된다.

## 특징 맵 구조를 바꾸는 하이퍼파라미터

### 커널 크기와 개수

- **커널 크기**: 보통 3 × 3, 5 × 5를 쓴다. 작을수록 세밀한 특징을, 클수록 넓은 영역의 특징을 한 번에 본다. 요즘은 작은 커널을 여러 층 쌓아 넓은 영역을 보는 구성이 흔하다.
- **커널 개수**: 늘리면 더 다양한 특징을 학습할 수 있지만 파라미터와 연산량도 함께 늘어난다.

### 패딩

패딩은 입력 가장자리에 값(보통 0)을 덧대는 것이다. 출력 크기를 조정하고, 가장자리 정보가 연산에서 덜 반영되는 문제를 줄인다.

- **Valid**: 패딩 없이 연산한다. 출력 크기가 입력보다 작아진다.
- **Same**: 스트라이드가 1일 때 출력 크기가 입력과 같아지도록 패딩을 넣는다. 홀수 크기 커널 K라면 P = (K − 1) / 2다.

### 스트라이드

스트라이드는 커널이 한 번에 이동하는 간격이다.

- **Stride = 1**: 모든 위치를 훑으므로 출력이 크다.
- **Stride = 2**: 한 칸씩 건너뛰므로 출력 크기가 대략 절반으로 줄어든다.

### 출력 크기 계산

특징 맵 크기는 입력 크기, 커널 크기, 패딩, 스트라이드로 결정된다.

![특징 맵 출력 크기 공식. O는 I에서 K를 빼고 2P를 더한 값을 S로 나눈 뒤 1을 더한 값](/img/blog/post-3-2.png)

- O: 출력 크기
- I: 입력 크기
- K: 커널 크기
- P: 패딩 크기
- S: 스트라이드

나눗셈이 딱 떨어지지 않으면 소수점 아래를 버린다. 즉 정확한 식은 O = ⌊(I − K + 2P) / S⌋ + 1이다.

몇 가지 경우를 계산해 보면 감이 온다.

| 입력 I | 커널 K | 패딩 P | 스트라이드 S | 출력 O |
| --- | --- | --- | --- | --- |
| 32 | 3 | 0 | 1 | 30 |
| 32 | 3 | 1 | 1 | 32 |
| 32 | 3 | 1 | 2 | 16 |
| 28 | 5 | 0 | 1 | 24 |

두 번째 줄이 Same 패딩, 첫 번째와 네 번째 줄이 Valid 패딩에 해당한다.

## 정리

> CNN은 합성곱과 풀링으로 이미지의 공간적 특징을 추출하고 학습하는 딥러닝 모델로, 이미지 분류와 객체 탐지에 널리 쓰인다.

- 지역 연결과 가중치 공유 덕분에 완전 연결 신경망보다 적은 파라미터로 이미지를 다룬다.
- 합성곱–활성화–풀링을 쌓아 특징을 추출하고, 완전 연결층과 출력 레이어에서 예측한다.
- 특징 맵 크기는 O = ⌊(I − K + 2P) / S⌋ + 1로 계산하며, 커널·패딩·스트라이드로 조절한다.
$body3$, '2024-12-07T05:07:22.600Z'::timestamptz, 'posts/CNN%EC%97%90-%EB%8C%80%ED%95%B4-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90'),
  (4, 'typescript-basics', 'TypeScript 기본 타입 문법 정리', '변수·함수 타입 지정부터 유니온, 타입 별칭, 리터럴 타입, as const, interface와 extends, 조건부 타입까지 TypeScript 기본 문법을 정리한다.', array['TypeScript']::text[], $body4$
TypeScript는 JavaScript에 정적 타입 시스템을 더한 언어다. JavaScript 문법을 그대로 쓰면서 그 위에 타입 표기를 얹는 구조라서, JavaScript의 상위 집합(superset)이라고 부른다. 브라우저나 Node.js에서 실행될 때는 타입이 모두 지워진 JavaScript로 변환되므로, 타입은 실행이 아니라 **작성과 빌드 단계**에서 힘을 발휘한다.

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

`readonly`는 컴파일 단계의 검사일 뿐이라, 변환된 JavaScript에서 객체가 실제로 얼어붙지는 않는다. 런타임에서도 막아야 한다면 `Object.freeze`를 쓴다.

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
$body4$, '2024-12-07T08:22:53.740Z'::timestamptz, 'posts/%ED%83%80%EC%9E%85%EC%8A%A4%ED%81%AC%EB%A6%BD%ED%8A%B8%EC%97%90-%EB%8C%80%ED%95%B4-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90'),
  (5, 'tailwind-css-basics', 'Tailwind CSS 입문 (1) 설치, 유틸리티 우선, 상태와 반응형', 'Tailwind CSS의 유틸리티 우선 철학과 설치, 상태·반응형 접두사, 빌드 최적화를 정리하고 v4에서 달라진 부분을 함께 짚는다.', array['Tailwind CSS', 'CSS']::text[], $body5$
Tailwind CSS는 CSS 파일에 규칙을 따로 쓰는 대신, 미리 정의된 작은 클래스(유틸리티)를 HTML에 조합해 스타일을 완성하는 유틸리티 우선(utility-first) CSS 프레임워크다. 이 글은 Tailwind CSS 입문 시리즈의 첫 번째 글로, 설치부터 상태·반응형 스타일링, 빌드 최적화까지 기본기를 다룬다.

처음 이 글을 쓴 2024년 말에는 v3가 최신이었다. 2025년 1월 v4가 나오면서 설치와 설정 방식이 크게 바뀌었기 때문에, 본문은 v3 기준으로 설명하되 v4에서 달라진 부분은 각 섹션에 따로 적었다. v4 전체 변경 사항은 [시리즈 세 번째 글](/blog/tailwind-css-v4/)에서 정리한다.

## 기존 CSS와 무엇이 다른가

가로 그라디언트 배경을 가진 박스를 만든다고 해 보자. 일반적인 CSS라면 클래스를 하나 정의하고 스타일을 적는다.

```html
<style>
  .gradient-box {
    width: 100%;
    height: 100px;
    background: linear-gradient(to right, #facc15, #f87171);
  }
</style>

<div class="gradient-box">yellow to red</div>
```

Tailwind에서는 별도 CSS 없이 클래스만 조합한다.

```html
<div class="h-[100px] w-full bg-gradient-to-r from-yellow-400 to-red-400">
  yellow to red
</div>
```

`bg-gradient-to-r`은 방향, `from-*`과 `to-*`는 시작·끝 색이다. 클래스 이름이 곧 스타일이라 마크업만 읽어도 결과를 예상할 수 있다.

> v4에서는 그라디언트 유틸리티 이름이 `bg-linear-to-r`로 바뀌었다. `bg-linear-45` 처럼 각도 지정도 된다.

## 설치하기 (v3, Tailwind CLI)

빌드 도구 없이 Tailwind CLI만으로 시작하는 가장 단순한 방법이다. React, Vue 같은 프레임워크를 쓴다면 [공식 프레임워크 가이드](https://tailwindcss.com/docs/installation/framework-guides)를 따르는 편이 낫다.

먼저 패키지를 설치하고 설정 파일을 만든다.

```bash
npm install -D tailwindcss@3
npx tailwindcss init
```

프로젝트 루트에 `tailwind.config.js`가 생긴다. `content`에는 Tailwind 클래스를 쓰는 모든 템플릿 파일 경로를 적는다. Tailwind는 이 파일들을 스캔해서 실제로 쓰인 클래스만 CSS로 생성한다.

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

`src/input.css`를 만들고 Tailwind 지시문을 추가한다.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

CLI로 템플릿을 스캔해 CSS를 빌드한다. `--watch`를 붙이면 파일이 바뀔 때마다 다시 빌드한다.

```bash
npx tailwindcss -i ./src/input.css -o ./src/output.css --watch
```

생성된 CSS를 HTML에 연결하면 끝이다.

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link href="./output.css" rel="stylesheet" />
  </head>
  <body>
    <h1 class="text-3xl font-bold underline">Hello world!</h1>
  </body>
</html>
```

### v4에서 달라진 설치

v4는 설정 파일 없이 CSS에서 시작한다. `tailwind.config.js`와 `content` 배열이 필수가 아니며, 템플릿 파일은 자동으로 감지한다(`.gitignore`에 있는 경로는 제외). CLI도 별도 패키지로 분리됐다.

```bash
npm install tailwindcss @tailwindcss/cli
```

```css
/* src/input.css */
@import "tailwindcss";
```

```bash
npx @tailwindcss/cli -i ./src/input.css -o ./src/output.css --watch
```

세 줄짜리 `@tailwind` 지시문이 `@import "tailwindcss";` 한 줄로 대체된 것이 가장 눈에 띄는 차이다. Vite를 쓴다면 `@tailwindcss/vite` 플러그인을, PostCSS를 쓴다면 `@tailwindcss/postcss`를 설치한다.

## 유틸리티 우선이라는 철학

유틸리티 우선은 하나의 역할만 하는 작은 클래스를 조합해 디자인을 만드는 방식이다. 별도 CSS 파일을 오가거나 기존 스타일을 덮어쓰지 않고 마크업에서 바로 작업할 수 있다는 것이 핵심이다.

- **역할이 명확한 클래스**: `text-center`는 가운데 정렬, `pt-4`는 위쪽 패딩, `text-blue-500`은 글자색처럼 클래스 하나가 하나의 일만 한다.
- **빠른 프로토타이핑**: 클래스를 붙이는 즉시 결과가 보이므로, 클래스 이름 짓기나 파일 구조를 고민하지 않고 UI를 시험해 볼 수 있다.
- **일관성**: 간격·색상·글자 크기가 미리 정해진 스케일(디자인 토큰) 안에서 선택되므로, 프로젝트 전체의 값이 자연스럽게 통일된다. CSS 파일이 기능이 늘어날 때마다 커지지 않는다는 장점도 있다.
- **반응형과 상태**: `md:`, `hover:` 같은 접두사로 미디어 쿼리와 의사 클래스를 클래스 안에서 바로 표현한다.

```html
<div class="rounded-lg bg-gray-200 p-4 shadow-lg">
  <h1 class="text-2xl font-bold text-blue-500">안녕하세요, Tailwind CSS!</h1>
  <p class="mt-2 text-gray-700">
    유틸리티 클래스를 조합하면 빠르고 일관되게 작업할 수 있다.
  </p>
</div>
```

## 상태 기반 스타일링

마우스 오버, 포커스, 클릭처럼 요소의 상태에 따라 스타일을 바꾸려면 유틸리티 앞에 상태 접두사(variant)를 붙인다. CSS의 `:hover`, `:focus` 같은 의사 클래스를 클래스 이름으로 옮긴 것이다.

### hover, focus, active

```html
<!-- 마우스를 올리면 배경이 진해진다 -->
<button class="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700">
  Hover Me
</button>

<!-- 포커스를 받으면 테두리와 링 색이 바뀐다 -->
<input class="border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />

<!-- 누르고 있는 동안 적용된다 -->
<button class="rounded bg-blue-500 px-4 py-2 font-bold text-white active:bg-blue-800">
  Active State
</button>
```

### disabled

`disabled` 속성이 있는 요소에 적용된다.

```html
<button class="rounded bg-blue-500 px-4 py-2 font-bold text-white disabled:opacity-50" disabled>
  Disabled
</button>
```

### group-hover

부모에 `group` 클래스를 붙이면, 부모가 hover 상태일 때 자식의 스타일을 바꿀 수 있다. 카드 전체에 마우스를 올렸을 때 안쪽 제목 색만 바꾸는 식의 UI에 유용하다.

```html
<div class="group rounded-lg p-4">
  <div class="bg-gray-200 p-4 group-hover:bg-gray-400">
    부모에 마우스를 올리면 배경이 바뀐다
  </div>
</div>
```

### 그 밖의 상태 접두사

| 접두사 | 적용 조건 |
| --- | --- |
| `focus-visible:` | 키보드 탐색 등으로 포커스 표시가 필요할 때만 |
| `focus-within:` | 자식 중 하나가 포커스를 받았을 때 |
| `checked:` | 체크박스·라디오가 선택된 상태 |
| `first:`, `last:` | 형제 중 첫 번째·마지막 요소 |
| `odd:`, `even:` | 홀수·짝수 번째 요소 |

> v4에서 `hover:`는 `@media (hover: hover)` 안에서만 적용된다. 터치 기기에서 탭한 뒤 hover 스타일이 남는 문제를 막기 위한 변경이다.

## 반응형 디자인

Tailwind는 미디어 쿼리를 직접 쓰지 않고도 화면 크기별 스타일을 지정할 수 있게 반응형 접두사를 제공한다. 기본 브레이크포인트는 다음과 같다.

![Tailwind CSS v3 기본 브레이크포인트 표. sm 640px, md 768px, lg 1024px, xl 1280px, 2xl 1536px 이상에 각각 min-width 미디어 쿼리가 대응된다](/img/blog/post-5-1.png)

v4에서도 기준 폭은 같지만 단위가 rem으로 바뀌었다(`sm`은 40rem, `md`는 48rem 등).

중요한 점은 Tailwind가 **모바일 우선**이라는 것이다. 접두사가 없는 클래스는 모든 화면에 적용되고, `md:`는 "md 이상"에서 적용된다. 따라서 작은 화면 스타일을 먼저 쓰고, 큰 화면에서 바뀌는 부분만 접두사로 덮어쓴다.

```html
<p class="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl">
  반응형 텍스트 크기
</p>
```

기본은 `text-base`, 640px 이상에서 `text-lg`, 768px 이상에서 `text-xl`로 단계적으로 커진다. 레이아웃도 같은 방식으로 구성한다.

```html
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
  <div class="bg-blue-500 p-4">1</div>
  <div class="bg-blue-500 p-4">2</div>
  <div class="bg-blue-500 p-4">3</div>
  <div class="bg-blue-500 p-4">4</div>
</div>
```

기본 1열에서 시작해 sm 이상 2열, md 이상 3열, lg 이상 4열로 바뀐다.

### 브레이크포인트 추가하기

v3에서는 설정 파일에서 브레이크포인트를 바꾼다. `theme.screens`에 바로 쓰면 기본값을 **덮어쓰므로**, 기존 값을 유지하면서 하나만 추가하려면 `extend`를 쓰거나 전체 목록을 다시 적어야 한다. 여기서는 `xs`가 가장 작은 값이라 목록 맨 앞에 와야 하므로 전체를 다시 적었다.

```js
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
  },
};
```

이제 `xs:` 접두사로 480px 이상에서만 적용되는 스타일을 쓸 수 있다.

v4에서는 같은 작업을 CSS의 `@theme` 블록에서 한다. `--breakpoint-*` 변수를 추가하면 그에 맞는 접두사가 생긴다.

```css
@import "tailwindcss";

@theme {
  --breakpoint-xs: 30rem; /* 480px */
}
```

## 빌드 최적화

Tailwind는 템플릿에서 실제로 쓰인 클래스만 CSS로 생성한다. 공식 문서는 여기에 압축과 네트워크 압축(gzip, Brotli)을 더하면 대형 프로젝트에서도 보통 10kB 미만의 CSS가 나온다고 설명하며, 예시로 Netflix Top 10 사이트가 네트워크로 전송하는 CSS가 6.5kB라고 소개한다(작성 당시 기준). CSS가 이 정도로 작으면 페이지별 CSS 코드 분할 같은 복잡한 전략 없이, 파일 하나를 받아 다음 배포까지 캐시하면 충분하다.

Tailwind CLI를 쓴다면 `--minify` 플래그로 압축한다.

```bash
npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify
```

v3를 PostCSS 플러그인으로 쓴다면 프로덕션 빌드에서만 `cssnano`를 추가하는 방법이 있다(`cssnano`는 따로 설치해야 한다).

```js
// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {}),
  },
};
```

Vite, Next.js 같은 프레임워크는 프로덕션 빌드에서 CSS를 알아서 압축하므로 이 설정이 필요 없는 경우가 많다.

v4는 내부적으로 Lightning CSS를 사용해 벤더 프리픽스와 최신 문법 변환을 직접 처리한다. 그래서 `autoprefixer`나 `postcss-import`를 따로 둘 필요가 없고, PostCSS 설정도 `@tailwindcss/postcss` 하나면 된다. CLI에서 압축할 때는 `npx @tailwindcss/cli -i ./src/input.css -o ./dist/output.css --minify`처럼 같은 플래그를 쓴다.

## 정리

- Tailwind는 단일 역할의 유틸리티 클래스를 조합해 스타일을 만드는 유틸리티 우선 프레임워크다.
- `hover:`, `focus:`, `group-hover:` 같은 상태 접두사와 `sm:`, `md:` 같은 반응형 접두사로 의사 클래스와 미디어 쿼리를 클래스 안에서 표현한다. 반응형은 모바일 우선이다.
- 사용한 클래스만 생성하므로 결과 CSS가 작고, 압축까지 더하면 대부분의 프로젝트에서 CSS 크기를 크게 신경 쓸 필요가 없다.
- v4에서는 `@import "tailwindcss"`로 시작하고, 설정은 `tailwind.config.js` 대신 CSS의 `@theme`에서 한다.

[다음 글](/blog/tailwind-css-customization/)에서는 다크 모드와 테마 커스터마이징, 임의 값, 사용자 정의 스타일 추가 방법을 다룬다.

## 참고

- [Tailwind CSS 설치 가이드](https://tailwindcss.com/docs/installation)
- [Hover, focus, and other states](https://tailwindcss.com/docs/hover-focus-and-other-states)
- [Responsive design](https://tailwindcss.com/docs/responsive-design)
- [Tailwind CSS v4 업그레이드 가이드](https://tailwindcss.com/docs/upgrade-guide)
$body5$, '2024-12-12T06:26:11.958Z'::timestamptz, 'posts/TailwindCSS%EC%97%90-%EB%8C%80%ED%95%B4-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90'),
  (6, 'tailwind-css-customization', 'Tailwind CSS 입문 (2) 다크 모드와 테마, 사용자 정의 스타일', 'Tailwind CSS의 다크 모드, 테마 커스터마이징, 임의 값, @layer를 이용한 사용자 정의 스타일을 정리하고 v4 방식과 비교한다.', array['Tailwind CSS', 'CSS']::text[], $body6$
Tailwind CSS 입문 시리즈의 두 번째 글이다. [첫 번째 글](/blog/tailwind-css-basics/)에서 설치와 유틸리티 우선, 상태·반응형 접두사를 다뤘다면, 이번에는 다크 모드와 프로젝트에 맞게 Tailwind를 확장하는 방법을 정리한다.

프레임워크를 쓸 때 가장 곤란한 순간은 프레임워크가 제공하지 않는 것이 필요할 때다. Tailwind는 처음부터 확장을 염두에 두고 설계되어서, 디자인 토큰을 바꾸고, 필요하면 제약을 벗어나고, 직접 CSS를 추가하는 방법이 모두 마련되어 있다. 본문은 작성 당시 최신이던 v3 기준이며, v4에서 달라진 부분은 따로 적었다.

## 다크 모드

요즘은 웬만한 웹사이트가 다크 모드를 지원한다. Tailwind에서는 `dark:` 접두사를 붙여 다크 모드일 때만 적용할 스타일을 지정한다.

```html
<div class="rounded-lg bg-white px-6 py-8 shadow-xl ring-1 ring-slate-900/5 dark:bg-slate-800">
  <h3 class="text-base font-medium tracking-tight text-slate-900 dark:text-white">
    Writes Upside-Down
  </h3>
  <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
    The Zero Gravity Pen can be used to write in any orientation, including upside-down.
  </p>
</div>
```

`bg-white dark:bg-slate-800`처럼 라이트 모드 값을 기본으로 두고, 다크 모드에서 바뀌는 값만 `dark:`로 덮어쓴다.

### 다크 모드를 켜는 기준

기본적으로 `dark:`는 운영체제 설정을 따르는 `prefers-color-scheme: dark` 미디어 쿼리로 동작한다. 사이트에 다크 모드 토글 버튼을 두려면 클래스 기준으로 바꿔야 한다. v3에서는 설정 파일에서 지정한다.

```js
// tailwind.config.js
module.exports = {
  darkMode: 'class', // v3.4.1부터는 'selector'도 사용 가능
  // ...
};
```

이제 `<html class="dark">`처럼 상위 요소에 `dark` 클래스가 있을 때 `dark:` 스타일이 적용된다. v4에서는 설정 파일 대신 CSS에서 `dark` 변형을 재정의한다.

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

## 테마 커스터마이징

색상 팔레트, 간격, 글꼴, 브레이크포인트 같은 디자인 토큰은 v3에서 `tailwind.config.js`의 `theme`에서 바꾼다. 여기서 주의할 점은 `theme` 바로 아래에 쓴 키는 기본값을 **통째로 교체**하고, `theme.extend` 아래에 쓴 키는 기본값에 **추가**된다는 것이다.

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js}'],
  theme: {
    // 기본 브레이크포인트·색상·글꼴을 모두 교체
    screens: {
      sm: '480px',
      md: '768px',
      lg: '976px',
      xl: '1440px',
    },
    colors: {
      blue: '#1fb6ff',
      pink: '#ff49db',
      orange: '#ff7849',
      green: '#13ce66',
      'gray-dark': '#273444',
      gray: '#8492a6',
      'gray-light': '#d3dce6',
    },
    fontFamily: {
      sans: ['Graphik', 'sans-serif'],
      serif: ['Merriweather', 'serif'],
    },
    // 기본값은 유지하고 추가
    extend: {
      spacing: {
        128: '32rem',
        144: '36rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
};
```

위 설정에서는 `colors`를 교체했기 때문에 `bg-blue-500` 같은 기본 색상 클래스는 더 이상 생성되지 않고, 대신 `bg-blue`, `text-gray-dark`를 쓸 수 있다. 반면 `spacing`은 `extend`에 넣었으므로 기존 간격 스케일에 `w-128`, `p-144`가 추가된다.

### v4의 @theme

v4에서는 같은 설정을 CSS 변수로 선언한다. `@theme` 안의 변수 이름 접두사(`--color-*`, `--font-*`, `--breakpoint-*` 등)가 어떤 유틸리티를 만들지 결정한다.

```css
@import "tailwindcss";

@theme {
  --breakpoint-sm: 30rem;
  --breakpoint-lg: 61rem;

  --color-*: initial; /* 기본 색상 팔레트 제거 */
  --color-blue: #1fb6ff;
  --color-pink: #ff49db;
  --color-gray-dark: #273444;

  --font-sans: Graphik, sans-serif;
  --font-serif: Merriweather, serif;

  --radius-4xl: 2rem;
}
```

변수를 그냥 추가하면 v3의 `extend`처럼 동작하고, `--color-*: initial;`처럼 네임스페이스를 초기화하면 v3에서 `theme.colors`를 교체한 것과 같다. 테마 값은 실제 CSS 변수로도 노출되므로 `var(--color-pink)`처럼 일반 CSS나 JavaScript에서 바로 참조할 수 있다. 또 v4는 간격 유틸리티가 `--spacing` 기본 단위의 배수로 계산되어서 `w-128` 같은 값을 따로 등록하지 않아도 쓸 수 있다.

기존 JavaScript 설정 파일을 계속 쓰고 싶다면 `@config "./tailwind.config.js";`로 불러올 수 있다.

## 임의 값 사용하기

정해진 디자인 토큰만으로 대부분의 화면을 만들 수 있지만, 가끔은 픽셀 단위로 정확한 값이 필요하다. 이때 대괄호 표기법으로 임의 값(arbitrary value)을 넣으면 그 자리에서 클래스가 생성된다.

```html
<div class="top-[117px]"></div>
```

v3에서는 `theme()` 함수로 설정 파일의 값을 참조할 수 있다.

```html
<div class="grid grid-cols-[fit-content(theme(spacing.32))]"></div>
```

v4에서는 `theme()` 대신 간격 값을 계산하는 `--spacing()` 함수나 테마 변수를 쓴다.

```html
<div class="grid grid-cols-[fit-content(--spacing(32))]"></div>
```

### CSS 변수

v3.3 이상에서는 대괄호 안에 CSS 변수 이름만 쓰면 `var()`로 감싸 준다. v4에서는 대괄호 대신 소괄호를 쓰는 문법으로 바뀌었다.

```html
<!-- v3 -->
<div class="bg-[--my-color]"></div>

<!-- v4 -->
<div class="bg-(--my-color)"></div>
```

`bg-[var(--my-color)]`처럼 `var()`를 직접 쓰는 방식은 두 버전 모두에서 동작한다.

### 임의 속성

Tailwind에 유틸리티가 없는 CSS 속성은 대괄호 안에 `속성:값`을 통째로 쓴다. 상태·반응형 접두사도 그대로 붙일 수 있고, CSS 변수 값을 화면 크기별로 바꾸는 데도 쓸 수 있다.

```html
<div class="[mask-type:luminance] hover:[mask-type:alpha]"></div>

<div class="[--scroll-offset:56px] lg:[--scroll-offset:44px]"></div>
```

### 공백과 밑줄

클래스 이름에는 공백을 쓸 수 없으므로, 임의 값 안의 공백은 밑줄(`_`)로 적는다. Tailwind가 빌드할 때 공백으로 바꿔 준다. URL처럼 밑줄이 의미를 갖는 곳에서는 변환하지 않는다.

```html
<div class="grid grid-cols-[1fr_500px_2fr]"></div>

<div class="bg-[url('/what_a_rush.png')]"></div>
```

밑줄을 정말 밑줄로 쓰고 싶다면 `\_`처럼 백슬래시로 이스케이프한다. JSX에서는 백슬래시가 JavaScript 문자열 이스케이프로 먼저 처리되므로 `String.raw`로 감싼다.

```jsx
<div className={String.raw`before:content-['hello\_world']`}></div>
```

## 사용자 정의 CSS와 레이어

### Tailwind가 스타일을 레이어로 나누는 이유

CSS에서 두 선택자의 명시도(specificity)가 같으면 스타일시트에서 나중에 나온 규칙이 이긴다.

```css
.btn {
  background: blue;
}

.bg-black {
  background: black;
}
```

```html
<button class="btn bg-black">...</button>
<button class="bg-black btn">...</button>
```

`class` 속성 안의 순서는 상관없다. `.bg-black`이 CSS에서 뒤에 있으므로 두 버튼 모두 검은색이 된다. 이 순서를 예측 가능하게 관리하기 위해 Tailwind는 생성하는 스타일을 세 레이어로 나눈다. ITCSS에서 널리 알려진 개념이다.

| 레이어 | 용도 |
| --- | --- |
| `base` | 리셋 규칙, HTML 요소의 기본 스타일 |
| `components` | 유틸리티로 덮어쓸 수 있는 클래스 기반 컴포넌트 스타일 |
| `utilities` | 단일 목적의 작은 클래스. 항상 가장 우선한다 |

`@layer` 지시문으로 직접 작성한 스타일을 원하는 레이어에 넣으면, 코드를 어디에 쓰든 최종 선언 순서는 레이어 순서를 따른다. v3에서는 Tailwind가 빌드 시점에 순서를 맞춰 주는 방식이고, v4는 브라우저의 네이티브 캐스케이드 레이어(`@layer`)를 그대로 사용한다.

### 기본 스타일 추가하기

페이지 전체의 글자색, 배경색, 글꼴 정도라면 `html`이나 `body`에 클래스를 붙이는 것이 가장 간단하다. 스타일 결정을 별도 파일에 숨기지 않고 마크업에 함께 둘 수 있다.

```html
<!doctype html>
<html lang="ko" class="bg-gray-100 font-serif text-gray-900">
  <!-- ... -->
</html>
```

특정 HTML 요소의 기본 스타일은 `base` 레이어에 추가한다. 테마 값을 쓰려면 `@apply`나 `theme()` 함수를 활용한다.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  h1 {
    @apply text-2xl;
  }
  h2 {
    @apply text-xl;
  }
}
```

### 컴포넌트 클래스 추가하기

여러 곳에서 반복되는 묶음은 `components` 레이어에 클래스로 정의한다. 같은 요소에 유틸리티를 함께 붙이면 유틸리티가 이긴다.

```css
@layer components {
  .card {
    background-color: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
  }
}
```

### 유틸리티 추가하기

Tailwind에 없는 유틸리티는 v3에서 `utilities` 레이어에 추가한다. 이렇게 넣은 클래스에도 `hover:`, `lg:` 같은 접두사를 붙일 수 있다.

```css
@layer utilities {
  .content-auto {
    content-visibility: auto;
  }
}
```

v4에서는 `@layer utilities` 대신 `@utility` 지시문을 쓴다. 지시문을 쓰는 쪽이 Tailwind가 유틸리티로 인식해 접두사 지원과 정렬을 처리해 준다.

```css
@import "tailwindcss";

@utility content-auto {
  content-visibility: auto;
}
```

`@layer base`와 `@layer components`는 v4에서도 그대로 쓸 수 있다.

## 정리

- 다크 모드는 `dark:` 접두사로 지정한다. 기본은 OS 설정을 따르고, 토글을 만들려면 v3는 `darkMode: 'class'`, v4는 `@custom-variant dark`로 클래스 기준으로 바꾼다.
- 테마는 v3에서 `theme`(교체)과 `theme.extend`(추가)로, v4에서 `@theme`의 CSS 변수로 커스터마이징한다.
- 토큰으로 부족할 때는 `top-[117px]`, `[mask-type:luminance]` 같은 임의 값과 임의 속성을 쓴다. 공백은 `_`로 쓴다.
- 직접 쓴 CSS는 `@layer base`, `@layer components`에 넣어 우선순위를 관리하고, 유틸리티는 v4에서 `@utility`로 추가한다.

여기까지 알면 일상적인 작업은 대부분 해낼 수 있다. Tailwind는 쓸수록 손에 붙는 도구다. [다음 글](/blog/tailwind-css-v4/)에서는 v4 출시와 함께 달라진 점을 정리한다.

## 참고

- [Dark mode](https://tailwindcss.com/docs/dark-mode)
- [Theme variables](https://tailwindcss.com/docs/theme)
- [Adding custom styles](https://tailwindcss.com/docs/adding-custom-styles)
- [Tailwind CSS v4 업그레이드 가이드](https://tailwindcss.com/docs/upgrade-guide)
$body6$, '2024-12-13T07:27:36.910Z'::timestamptz, 'posts/TailwindCSS%EC%97%90-%EB%8C%80%ED%95%B4-%EB%98%90-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90'),
  (7, 'scheduler-api-posttask-yield', 'Scheduler API로 메인 스레드 작업 우선순위 다루기', 'scheduler.postTask와 scheduler.yield로 작업 우선순위를 정하고 긴 작업을 쪼개 UI 반응성을 지키는 방법을 정리한다.', array['Web API', '웹 성능', 'JavaScript']::text[], $body7$
웹 애플리케이션이 커지면 이런 증상을 한 번쯤 만난다. 클릭했는데 반응이 늦고, 입력이 한 박자 늦게 찍히고, 스크롤이 순간 멈춘다. 대부분 원인은 같다. 브라우저의 메인 스레드는 하나뿐이고, 그 위에서 자바스크립트 실행과 렌더링, 입력 처리가 모두 차례를 기다리는데 무거운 작업 하나가 그 줄을 오래 붙잡고 있는 것이다.

Scheduler API(정식 명칭은 Prioritized Task Scheduling API)는 이 줄 서기에 개입할 수 있게 해 준다. 작업에 우선순위를 붙여 큐에 넣는 `scheduler.postTask()`, 실행 중인 작업이 잠시 메인 스레드를 양보하는 `scheduler.yield()`가 핵심이다. 이 글에서는 두 API가 해결하는 문제와 쓰는 법, 그리고 지원 범위와 대체 방안을 정리한다.

## 기존 방식의 한계

지금까지 작업을 뒤로 미루는 대표적인 방법은 `setTimeout(fn, 0)`이었다.

```js
setTimeout(() => {
  console.log('작업 실행');
}, 0);
```

이 방식에는 두 가지 문제가 있다.

- **우선순위를 표현할 수 없다.** 사용자 입력에 대한 반응이든 분석 로그 전송이든 모두 같은 태스크 큐에 들어간다.
- **양보 후 다시 줄의 맨 뒤로 간다.** 긴 작업을 쪼개려고 `setTimeout`으로 끊으면, 그 사이에 들어온 다른 태스크(서드파티 스크립트 등)가 모두 끝난 뒤에야 이어서 실행된다. 게다가 중첩 호출이 깊어지면 브라우저가 최소 지연(약 4ms)을 강제한다.

`requestAnimationFrame`은 다음 프레임 렌더링 직전에 실행할 작업에, `requestIdleCallback`은 유휴 시간에 돌릴 작업에 맞춰져 있어서 "이 작업은 이 정도로 중요하다"를 일반적으로 표현하기엔 부족하다.

## scheduler.postTask

`scheduler.postTask()`는 콜백을 우선순위와 함께 예약하고, 콜백의 반환값으로 이행되는 Promise를 돌려준다.

```js
const result = await scheduler.postTask(() => {
  return computeSummary(data);
}, { priority: 'user-visible' });
```

우선순위는 세 가지다.

| 우선순위 | 용도 | 예시 |
| --- | --- | --- |
| `user-blocking` | 사용자가 결과를 기다리는 작업 | 입력에 대한 즉각적인 반응 |
| `user-visible` (기본값) | 화면에 보이지만 급하지 않은 작업 | 목록 일부 렌더링, 이미지 후처리 |
| `background` | 사용자가 의식하지 않는 작업 | 로그 전송, 캐시 정리, 프리페치 |

같은 시점에 예약된 작업이라면 우선순위가 높은 쪽이 먼저 실행된다.

```js
scheduler.postTask(() => console.log('데이터 동기화'), { priority: 'background' });
scheduler.postTask(() => console.log('UI 업데이트'), { priority: 'user-blocking' });

// 출력 순서: UI 업데이트 → 데이터 동기화
```

여기서 오해하기 쉬운 점이 있다. **우선순위는 "다음에 무엇을 실행할지"를 정할 뿐, 이미 실행 중인 작업을 중단시키지 않는다.** `background` 작업 하나가 300ms 동안 동기적으로 돈다면 그동안 들어온 `user-blocking` 작업도 기다려야 한다. 그래서 긴 작업은 반드시 쪼개야 하고, 그때 필요한 것이 뒤에서 다룰 `scheduler.yield()`다.

### 지연 실행과 취소

`delay` 옵션으로 지정한 시간 뒤에 큐에 넣을 수 있고, `TaskController`로 취소하거나 우선순위를 나중에 바꿀 수 있다.

```js
const controller = new TaskController({ priority: 'background' });

scheduler
  .postTask(() => prefetchNextPage(), { signal: controller.signal, delay: 1000 })
  .catch((error) => {
    if (error.name === 'AbortError') return; // 취소된 경우
    throw error;
  });

// 사용자가 다음 페이지 버튼에 마우스를 올리면 우선순위를 올린다
nextButton.addEventListener('pointerenter', () => {
  controller.setPriority('user-visible');
});

// 페이지를 떠나면 취소한다
controller.abort();
```

취소된 작업의 Promise는 `AbortError`로 거부되므로 `catch`로 처리해 두는 것이 좋다. 우선순위를 바꿀 필요가 없고 취소만 하면 된다면 일반 `AbortController`의 `signal`을 넘겨도 된다.

## scheduler.yield로 긴 작업 쪼개기

`scheduler.yield()`는 현재 작업을 잠시 멈추고 메인 스레드를 브라우저에 돌려준 뒤, 이어서 실행할 수 있게 해 주는 Promise를 반환한다. `setTimeout`으로 양보할 때와 달리 **이어지는 작업이 큐의 앞쪽에 배치**되기 때문에, 양보하는 동안 입력 처리나 렌더링은 끼어들 수 있지만 다른 일반 태스크에 순서를 빼앗기지는 않는다.

지원하지 않는 브라우저를 위해 `setTimeout`으로 대체하는 헬퍼를 두고 쓰면 된다.

```js
function yieldToMain() {
  if (globalThis.scheduler?.yield) {
    return scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}
```

수천 개의 항목을 처리해야 한다면, 일정 시간마다 양보하도록 루프를 짠다.

```js
async function processInChunks(items, processItem, budgetMs = 50) {
  let deadline = performance.now() + budgetMs;

  for (const item of items) {
    processItem(item);

    if (performance.now() >= deadline) {
      await yieldToMain();
      deadline = performance.now() + budgetMs;
    }
  }
}
```

50ms는 브라우저가 "긴 작업(long task)"으로 분류하는 기준이다. 매 항목마다 양보하면 오버헤드가 커지고, 너무 드물게 양보하면 입력 지연이 생기므로 시간 예산을 기준으로 끊는 편이 실용적이다. 이 패턴은 INP(Interaction to Next Paint) 지표를 개선할 때 가장 먼저 시도해 볼 만한 방법이기도 하다.

## 브라우저 지원과 대체 방안

작성 시점(2026년 11월) 기준으로 Chrome, Edge 등 Chromium 계열 브라우저는 `scheduler.postTask()`(Chrome 94부터)와 `scheduler.yield()`(Chrome 129부터)를 모두 지원한다. Firefox도 최근 버전에서 지원을 추가했지만, Safari는 아직 지원하지 않는 것으로 알고 있다. 지원 현황은 빠르게 바뀌므로 도입 전에 MDN의 호환성 표를 직접 확인하는 것이 안전하다.

따라서 실무에서는 기능 감지를 전제로 써야 한다. `window` 대신 `globalThis`를 쓰면 Web Worker에서도 같은 코드가 동작한다.

```js
const supportsPostTask = 'scheduler' in globalThis && 'postTask' in scheduler;
const supportsYield = 'scheduler' in globalThis && 'yield' in scheduler;
```

지원하지 않는 환경에서 고려할 수 있는 선택지는 다음과 같다.

- **`setTimeout` 폴백**: 위의 `yieldToMain()`처럼 동작은 같게, 순서 보장만 포기한다. 가장 단순하고 대부분의 경우 충분하다.
- **폴리필**: `scheduler.postTask`는 폴리필(`scheduler-polyfill` 패키지)이 있다. 다만 브라우저 내부 큐에 접근할 수는 없으므로 우선순위를 완벽하게 재현하지는 못한다.
- **Web Worker**: 계산 자체가 무겁다면 우선순위를 조정하기보다 메인 스레드 밖으로 옮기는 편이 근본적이다. DOM에 접근하지 않는 파싱, 정렬, 집계 작업이 대상이다.
- **프레임워크 스케줄러**: React는 18부터 `startTransition`, `useDeferredValue` 같은 동시성 기능으로 렌더링 우선순위를 자체적으로 관리한다. React 내부의 렌더링에는 이쪽이 더 자연스럽다.
- **`requestIdleCallback`**: 정말 급하지 않은 작업에 쓸 수 있지만, Safari 지원이 없거나 제한적이니 마찬가지로 폴백이 필요하다.

## 실무에서 쓸 만한 곳

- **대시보드와 데이터 시각화**: 수천 개의 데이터 포인트를 가공하는 동안에도 필터 조작이 바로 반응해야 한다. 가공 루프에 `yieldToMain()`을 넣고, 차트 갱신은 `user-visible`, 통계 로그는 `background`로 나누는 식이다.
- **지도 위 대량 마커 처리**: 좌표 변환과 클러스터링을 청크 단위로 나눠 처리하면 지도 이동 중에 프레임이 끊기지 않는다.
- **초기 로딩 이후 작업**: 분석 스크립트 초기화, 다음 화면 프리페치, 캐시 워밍업처럼 첫 상호작용과 경쟁하면 안 되는 작업을 `background`로 미룬다.

## 도입할 때 주의할 점

- **우선순위 남용**: 모든 작업을 `user-blocking`으로 올리면 결국 아무것도 우선하지 않는 것과 같다. 기본값인 `user-visible`을 기준으로, 정말 필요한 것만 올리고 내린다.
- **쪼개지 않으면 의미가 없다**: 앞서 말했듯 우선순위는 실행 중인 작업을 멈추지 못한다. 긴 동기 작업을 그대로 `postTask`에 넣는 것만으로는 반응성이 좋아지지 않는다.
- **측정 후 적용**: Chrome DevTools의 Performance 패널에서 긴 작업이 어디서 생기는지 먼저 확인하고, 적용 전후의 INP를 비교해 실제로 효과가 있는지 확인한다.

## 정리

`scheduler.postTask()`는 작업에 우선순위를 붙여 "무엇을 먼저 할지"를 브라우저에 알려 주고, `scheduler.yield()`는 긴 작업을 쪼개면서도 실행 순서를 잃지 않게 해 준다. 둘 다 메인 스레드를 더 빠르게 만들어 주는 마법은 아니고, 한정된 메인 스레드 시간을 사용자에게 중요한 일부터 쓰도록 배분하는 도구다. 아직 모든 브라우저가 지원하지는 않으므로 기능 감지와 `setTimeout` 폴백을 함께 두고, 지원하는 환경에서 점진적으로 이점을 얻는 방식으로 도입하는 것이 현실적이다.

## 참고

- [MDN - Prioritized Task Scheduling API](https://developer.mozilla.org/en-US/docs/Web/API/Prioritized_Task_Scheduling_API)
- [MDN - Scheduler.postTask()](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/postTask)
- [MDN - Scheduler.yield()](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield)
- [web.dev - Optimize long tasks](https://web.dev/articles/optimize-long-tasks)
$body7$, '2024-12-16T07:39:10.427Z'::timestamptz, 'posts/Scheduler-API%EC%97%90-%EB%8C%80%ED%95%B4-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90'),
  (8, 'axios-vs-fetch', 'Axios vs Fetch API 비교와 선택 기준', 'Axios와 Fetch API를 JSON 처리, 에러, 타임아웃, 인터셉터 관점에서 비교하고 프로젝트에 맞는 선택 기준을 정리한다.', array['JavaScript', 'HTTP', 'Web API']::text[], $body8$
프론트엔드에서 HTTP 요청은 빠질 수 없는 작업이다. 데이터를 불러오고, 폼을 제출하고, 외부 API와 통신한다. 이때 가장 많이 쓰는 두 가지가 Axios와 Fetch API다. 둘 다 Promise 기반이라 겉보기엔 비슷하지만, 기본으로 해 주는 일의 범위가 꽤 다르다.

이 글에서는 두 도구를 기능별로 비교하고, Fetch로 Axios의 편의 기능을 어디까지 대체할 수 있는지, 실무에서는 어떤 기준으로 고르면 되는지 정리한다.

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

원래 글에서는 "Fetch는 타임아웃을 지원하지 않는다", "Node.js에서는 별도 구현이 필요하다", "IE에서 동작하지 않는다"를 단점으로 꼽았다. 지금은 `AbortSignal.timeout()`이 모든 주요 브라우저에 들어왔고, Node.js가 `fetch`를 기본 제공하며, IE는 2022년에 지원이 종료되었으니 세 가지 모두 더는 결정적인 차이가 아니다.

## 에러 처리의 차이

두 도구의 가장 중요한 동작 차이는 에러 처리다. Fetch는 서버가 404나 500을 응답해도 Promise를 **이행(resolve)**한다. 요청 자체는 성공적으로 주고받았기 때문이다. reject되는 건 네트워크 오류, CORS 차단, 취소처럼 응답을 아예 받지 못한 경우뿐이다.

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

원래 글의 래퍼에는 두 가지 함정이 있었다. 토큰이 없을 때 `Authorization: undefined`를 객체에 넣으면 헤더가 빠지는 게 아니라 문자열 `"undefined"`로 전송된다. 또 `options.headers`가 `Headers` 인스턴스면 스프레드(`...`)로 복사되지 않는다. `new Headers()`로 감싸고 `set()`으로 조건부 추가하면 두 문제가 모두 해결된다.

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

## 장단점

**Axios**

- 장점: 인터셉터, 자동 직렬화, 타임아웃, 인스턴스 설정 등 실무에서 반복되는 작업이 이미 정리되어 있다. 업로드 진행률처럼 Fetch로는 번거로운 기능도 쉽게 쓴다.
- 단점: 외부 의존성이라 번들 크기가 늘고, 보안 패치와 메이저 업데이트를 따라가야 한다. 단순한 요청 몇 개에는 과할 수 있다.

**Fetch API**

- 장점: 설치가 필요 없고, 브라우저·Node.js·엣지 런타임에서 같은 API를 쓴다. 스트리밍 응답 처리처럼 저수준 제어가 필요한 경우 유리하다.
- 단점: 상태 코드 확인, 직렬화, 공통 헤더 같은 처리를 직접 만들어야 한다. 팀마다 래퍼가 제각각이 되기 쉽다.

## 실무에서 선택 기준

Axios가 잘 맞는 경우는 다음과 같다.

- 토큰 갱신, 공통 에러 처리처럼 요청 전후 처리가 많은 프로젝트
- 파일 업로드 진행률 표시가 필요한 경우
- 이미 Axios 기반 코드와 인스턴스 설정이 자리 잡은 프로젝트

Fetch가 잘 맞는 경우는 다음과 같다.

- 요청 종류가 단순하고 번들 크기에 민감한 프로젝트
- SSR이나 엣지 런타임처럼 여러 환경에서 같은 코드를 돌려야 하는 경우
- 스트리밍 응답(예: LLM 응답을 토큰 단위로 표시)을 다뤄야 하는 경우

어느 쪽을 고르든 컴포넌트에서 직접 `axios`나 `fetch`를 부르기보다, 앞의 `api` 인스턴스나 `request()` 함수처럼 **한 겹의 API 레이어를 두는 것**이 더 중요하다. 그래야 인증 방식이나 클라이언트를 바꿔도 수정 범위가 그 레이어 안에 머문다.

## 정리

- Axios는 편의 기능이 갖춰진 라이브러리이고, Fetch는 어디서나 쓸 수 있는 표준 저수준 API다.
- Fetch는 HTTP 에러 상태에서 reject하지 않으므로 `response.ok` 확인이 필수다.
- 타임아웃(`AbortSignal.timeout()`), Node.js 지원, IE 호환성은 이제 두 도구를 가르는 기준이 아니다.
- 실제 차이는 인터셉터, 자동 직렬화, 업로드 진행률 같은 편의 기능을 라이브러리에 맡길지, 작은 래퍼로 직접 관리할지에 있다.

## 참고

- [MDN - Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [MDN - AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)
- [Axios 공식 문서](https://axios-http.com/docs/intro)
$body8$, '2024-12-16T08:38:21.724Z'::timestamptz, 'posts/Axios-vs-Fetch'),
  (9, 'scope-and-hoisting', '자바스크립트 스코프와 호이스팅 정리', '전역·함수·블록 스코프와 스코프 체인, var·let·const와 함수 선언식·표현식의 호이스팅 차이를 예제로 정리한다.', array['JavaScript']::text[], $body9$
스코프(scope)와 호이스팅(hoisting)은 자바스크립트의 실행 흐름을 이해하는 데 꼭 필요한 개념이다. 스코프는 변수가 어디서 보이는지를, 호이스팅은 선언이 언제부터 존재하는지를 설명한다. 둘을 함께 알아 두면 `undefined`가 찍히거나 `ReferenceError`가 나는 이유를 대부분 설명할 수 있다.

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

- `funcVar`는 `var`로 선언했으므로 `if` 블록을 벗어나도 함수 안 어디서든 접근할 수 있다.
- `blockVar`는 `let`으로 선언했으므로 `if` 블록이 끝나면 더 이상 접근할 수 없다.

블록과 상관없이 함수 밖에서는 둘 다 접근할 수 없다. `var`가 블록을 무시한다는 점은 반복문에서 특히 문제가 된다.

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

중요한 점은 스코프 체인이 **함수를 어디서 호출했는지가 아니라 어디서 선언했는지**로 정해진다는 것이다. 이를 렉시컬 스코프(lexical scope)라고 한다.

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

이때 식별자가 **어떤 상태로 등록되는지**가 선언 방식마다 다르고, 이 차이가 호이스팅의 핵심이다.

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

정리하면, 선언 전에 호출할 수 있는 것은 함수 선언식뿐이다.

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

에러 없이 `undefined`가 흘러가기 때문에 버그를 늦게 발견하게 만든다.

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

- 변수는 `const`를 기본으로, 재할당이 필요할 때만 `let`을 쓴다. `var`는 쓰지 않는다.
- 변수는 사용하기 직전, 가능한 한 좁은 블록에서 선언하고 바로 초기화한다.
- 함수 표현식과 화살표 함수는 호출보다 위에 선언한다. 선언 전에 호출해야 하는 구조라면 함수 선언식을 쓴다.
- ESLint의 `no-var`, `no-use-before-define` 같은 규칙을 켜 두면 이런 실수를 미리 잡을 수 있다.

## 정리

- 스코프는 변수에 접근할 수 있는 범위다. `var`는 함수 스코프, `let`과 `const`는 블록 스코프를 따른다.
- 스코프 체인은 안쪽에서 바깥쪽으로 변수를 찾으며, 함수가 선언된 위치를 기준으로 정해진다.
- 호이스팅은 실행 전에 선언이 먼저 등록되는 현상이다. 코드가 실제로 이동하는 것은 아니다.
- 함수 선언식만 선언 전에 호출할 수 있다. `var`는 `undefined`, `let`·`const`는 TDZ 때문에 `ReferenceError`가 나며, `const`로 선언한 화살표 함수도 마찬가지다.

## 참고

- [MDN - Scope](https://developer.mozilla.org/en-US/docs/Glossary/Scope)
- [MDN - Hoisting](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting)
- [MDN - let](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let)
$body9$, '2024-12-18T03:43:27.803Z'::timestamptz, 'posts/%EC%8A%A4%EC%BD%94%ED%94%84%EC%99%80-%ED%98%B8%EC%9D%B4%EC%8A%A4%ED%8C%85%EC%9D%84-%EB%A7%9B%EB%B3%B4%EC%9E%90'),
  (10, '2024-retrospective', '2024년 연말 회고, 성취와 배운 점과 개선할 점', 'Nuxt 3로 만든 개인 블로그, Quasar 전환 중 만난 중복 호출 버그, 산업기능요원으로 보낸 한 해를 질문 형식으로 돌아본다.', array['회고']::text[], $body10$
벌써 1년이 지나간다. 올해를 정리하면서 스스로에게 몇 가지 질문을 던지고 답해 보기로 했다. 크게 성취, 배운 점, 개선할 점 세 갈래로 나눴고, 마지막에는 개발 바깥에서 보낸 한 해를 적었다.

## 성취

### 가장 만족스러운 프로젝트

Nuxt 3, TypeScript, Supabase로 만든 개인 블로그 '2rang25'다. 꼭 만들고 싶었던 것을, 꼭 써 보고 싶었던 기술로 만들었기 때문에 작업 내내 즐거웠다.

### 가장 기억에 남는 기능

TipTap으로 만든 글 작성 기능이다. Notion처럼 블록 단위로 마크다운을 쓸 수 있다는 점이 무척 흥미로웠다.

### 새로운 기술 스택을 적용한 경험

올해 Nuxt 3를 배우고 실제로 써 봤다. SPA만 개발하다가 SSR로 넘어가니 신경 쓸 부분이 확실히 많았다. 그런데 막상 익숙해지고 나니 아주 편하고 좋다.

### UI/UX 개선 작업의 성과

내가 주도한 개선 작업으로 사용자 편의성이 이전보다 상당히 좋아졌다. 새 요구 사항이 들어왔을 때 기능을 유연하게 덧붙일 수 있는 디자인으로 만든 점도 만족스럽다.

### 협업 도구와 워크플로 개선

아쉽지만 올해는 이런 경험이 없었다. 프론트엔드 팀은 프로젝트마다 한 명씩 배정되는 구조이기 때문이다. 대신 백엔드 팀이 올해 중후반부터 지라(JIRA)로 일을 관리하면서 효율이 오르는 모습을 보여 줬다. 내년에는 프론트엔드 팀도 여기에 맞춰 지라를 쓰게 되지 않을까 싶다.

## 배운 점

### 새로 배운 기술

Nuxt 3, AWS 배포, GitHub Actions를 이용한 자동 배포를 배웠다. 복잡하고 어려웠지만 공식 문서를 차근차근 확인하고 여러 글을 참고하면서 결국 나만의 블로그를 완성할 수 있었다.

### 기억에 남는 피드백

개발할 때 기능만 보지 말고 더 큰 그림을 그려야 한다는 점을 깨달았다. 상사분들의 의견을 들을 때마다 내 시야가 얼마나 좁은지 많이 느꼈다.

### 가장 복잡했던 버그

Quasar 프레임워크로 전환하던 도중에 생긴 일이다. 당시에는 컴포넌트 안에서 검색 조건 변수를 `watch`로 감시하다가, 값이 바뀔 때마다 검색을 실행하는 구조였다. 문제는 페이지를 이동할 때 목록 조회 요청이 두 번이나 더 나간다는 것이었다.

해결 방법은 검색 조건을 검색 컴포넌트 안에서만 관리하지 않고, 별도의 상태 관리 항목으로 분리해 store에서 관리하는 것이었다. 조건의 출처를 한곳으로 모으자 중복 호출이 사라졌다.

### 코드 품질을 높이려는 노력

나는 그림을 그렸다. 눈에 직접 보이는 것을 좋아하는 편이라, 먼저 내가 맡은 프로젝트의 구조를 추상적으로 그려 봤다. 그다음 더 효율적으로 관리할 수 있는 배치를 구상하고, 그것을 프로젝트에 맞게 녹이는 방향으로 구조를 다시 짰다.

### 사용자 경험을 위한 노력

최대한 객관적으로 접근하려고 했다. 여러 디자인과 사이트를 직접 써 보며 사용자 경험을 몸으로 느끼고, 내 사이트와 비교해 장단점을 나눴다. 좋은 점은 가져오고 아쉬운 점은 덜어내는 과정을 거쳤다. 그 결과물이 바로 블로그 '2rang25'다. velog와 티스토리, 그리고 여러 개인 블로그를 참고했다.

## 개선할 점

### 내 코드에서 고쳐야 할 부분

기능에만 초점을 두고 개발하다 보니 재사용성이 떨어지거나 중복 코드가 생기는 문제가 있었다. 그래서 코드를 정리하다가 예상치 못한 사이드 이펙트가 터지기도 했다. 서두르지 말고 큰 그림을 그리면서 차근차근 개발해야겠다고 느꼈다.

### 성능 최적화에서 부족했던 점

성능 최적화에서는 메모리 누수 관리, 데이터 캐싱, 로딩 시간 단축이 중요하다고 생각했다. 하지만 실제 프로젝트에서는 마감일을 맞추기에 급급해서 로딩 시간 단축 말고는 많이 미흡했다. 이 부분은 꼭 고쳐야겠다.

### 협업 커뮤니케이션

프로젝트마다 담당자가 따로 정해져 있다 보니 소통 측면에서는 많이 부족했다. 기능에 대한 코드 리뷰나, 앞으로의 고도화에 필요한 정보를 나누는 개발 미팅 시간을 늘리면 좋겠다.

### 내년 목표

내년에는 프론트엔드 개발자로서 역량을 키우기 위해 세 가지 목표를 세웠다.

1. 정보처리기사 취득
2. 서브 프로젝트 2개 진행
3. Git 커밋 메시지 규칙 지키기

지금은 공학사 과정과 직장 생활을 함께 하고 있는데, 가지고 있는 산업기사 자격만으로는 충분하지 않다고 판단해 정보처리기사에 도전하려 한다. 서브 프로젝트는 외부 API를 활용하거나 개인 취미와 연결한 주제로 구상하고 있다. 마지막으로 커밋 메시지. 지금까지는 별생각 없이 코멘트만 남겼는데, 효율적으로 관리하려면 커밋 메시지부터 정해진 규칙에 맞게 쓰기로 했다.

## 개발 바깥의 한 해

돌아보면 올해는 개발 외적으로도 변화가 많았다. 연초에 한국공학대학교 3학년으로 편입했고, 회사가 산업체로 지정되면서 산업기능요원으로 신분이 바뀌었다. 소집 해제는 2027년 1월이니 아직 갈 길이 멀다. 대학교 수업은 생각보다 빡빡했고, 여름에는 훈련소에도 다녀왔다.

가장 힘들었던 건 산업기능요원의 연구소 출입이 금지되면서 팀과 떨어져 지내야 했던 일이다. 생각보다 심적 부담이 컸고, 소외감도 느꼈던 것 같다.

그래서 연말 소식이 더 반갑다. 회사가 이사를 가면서 다시 팀원들 곁에서 일할 수 있게 됐다. 정말 행복하다.

## 정리

다시 돌아보니 시간이 참 빠르다. 올해는 만들고 싶던 것을 만들었고, 내 시야가 좁다는 것도 배웠다. 내년에는 더 큰 그림을 그리며 더 열심히 살아 보자. 화이팅!

![두 팔을 번쩍 들고 환호하는 애니메이션 캐릭터](/img/blog/post-10-1.jpg)
$body10$, '2024-12-18T04:32:05.548Z'::timestamptz, 'posts/%EC%A3%BC%EC%9D%B8%EC%9E%A5%EC%9D%98-2024%EB%85%84-%EC%97%B0%EB%A7%90-%ED%9A%8C%EA%B3%A0'),
  (11, 'commit-message-conventions', '좋은 커밋 메시지 작성 규칙과 Conventional Commits', '커밋 메시지 7가지 규칙과 Conventional Commits의 타입, 본문, 푸터 작성법을 예시와 함께 정리한다.', array['Git', '협업']::text[], $body11$
커밋 메시지는 코드 변경을 설명하는 가장 가까운 문서다. `git log`, `git blame`, 코드 리뷰, 릴리스 노트까지 결국 커밋 메시지를 읽게 된다. 잘 쓴 메시지는 몇 달 뒤 "이 코드는 왜 이렇게 바뀌었지?"라는 질문에 바로 답해 준다.

나도 아직 습관이 완전히 들지 않았지만, 제대로 익혀 두려고 이 글을 정리한다. 흔히 함께 쓰이는 두 가지, 메시지 형식에 대한 일반 규칙 7가지와 타입 접두사를 붙이는 Conventional Commits를 차례로 다룬다.

## 커밋 메시지의 7가지 규칙

널리 알려진 7가지 규칙은 Chris Beams의 글 "How to Write a Git Commit Message"에서 정리된 것이다. 원래는 영어 메시지를 기준으로 한 규칙이라, 한국어로 쓸 때는 취지를 살려 적용하면 된다.

### 제목과 본문을 빈 줄로 구분한다

Git은 첫 줄을 제목으로, 빈 줄 다음부터를 본문으로 취급한다. `git log --oneline`이나 GitHub의 커밋 목록은 제목만 보여 주므로 이 구분이 중요하다.

```text
fix: 모바일 Safari에서 모달 열 때 배경이 스크롤되는 문제 수정

모달이 열린 상태에서 터치 스크롤이 body로 전파되어 배경이 함께
움직였다. 모달이 열려 있는 동안 body에 overflow hidden을 적용한다.
```

터미널에서 바로 작성한다면 `-m`을 두 번 쓰면 각각 제목과 본문이 되고, 그 사이에 빈 줄이 들어간다.

```bash
git commit -m "fix: 모달 배경 스크롤 문제 수정" -m "모달이 열린 동안 body 스크롤을 막는다."
```

### 제목은 50자 안팎으로 짧게 쓴다

제목은 변경의 핵심만 담는다. 50자는 영어 기준의 권장값이고 GitHub은 72자를 넘는 제목을 말줄임 처리한다. 한글은 터미널에서 두 칸을 차지하므로 더 짧게 잡는 편이 읽기 좋다.

```text
feat: 상품 목록 검색 기능 추가
```

### 제목의 첫 글자는 대문자로 쓴다

영어 메시지에만 해당하는 규칙이다. 다만 Conventional Commits를 함께 쓴다면 주의할 점이 있다. 많이 쓰는 commitlint 기본 설정(`@commitlint/config-conventional`)은 타입 뒤 설명을 대문자로 시작하면 오류로 처리한다. 즉 순수한 영어 메시지에서는 `Add installation guide`, 타입 접두사를 쓸 때는 `docs: add installation guide`처럼 소문자로 시작하는 것이 일반적이다. 팀에서 어느 쪽을 쓸지 하나로 정해 두면 된다.

```text
docs: add installation guide
```

### 제목 끝에 마침표를 붙이지 않는다

제목은 문장이라기보다 표제에 가깝다. 짧은 공간에서 구두점은 정보를 늘리지 않는다.

```text
style: 불필요한 주석 제거 및 CSS 선언 순서 정리
```

### 제목은 명령문으로 쓴다

영어에서는 `Fixed`, `Added` 같은 과거형 대신 `Fix`, `Add` 같은 명령형을 쓴다. "이 커밋을 적용하면 ___한다"의 빈칸을 채운다고 생각하면 된다. Git이 자동으로 만드는 `Merge branch ...`, `Revert ...`도 같은 형식이다. 한국어로 쓸 때는 "추가했음"처럼 과거형으로 늘이기보다 "추가", "수정", "제거"처럼 명사형으로 끝맺는 것이 같은 효과를 낸다.

```text
refactor: 사용하지 않는 상태 변수 제거
```

### 본문은 한 줄 72자 안쪽에서 줄바꿈한다

Git은 본문을 자동으로 줄바꿈하지 않는다. `git log`는 본문을 들여쓰기해 출력하므로 80자 터미널에서도 읽히도록 72자 정도에서 직접 줄을 바꾼다. 한글이라면 대략 35~40자 정도가 같은 폭이다.

```text
feat: 주문 목록 필터링 API 추가

기간과 주문 상태로 주문 목록을 조회할 수 있도록 엔드포인트를
추가한다. 기존 전체 조회 후 클라이언트에서 거르던 방식보다
응답 크기가 줄어든다.
```

### 본문에는 어떻게보다 무엇을, 왜를 쓴다

어떻게 바꿨는지는 코드 diff가 이미 보여 준다. 본문에는 diff만으로 알 수 없는 것, 즉 무엇이 문제였고 왜 이 방식을 택했는지를 쓴다.

```text
perf: 상품 이미지를 CDN에서 제공

원본 서버에서 이미지를 직접 내려받아 첫 화면 로딩이 느렸다.
정적 이미지를 CDN으로 옮겨 사용자와 가까운 위치에서 응답하도록
한다. 원본 서버의 트래픽 부담도 함께 줄어든다.
```

## Conventional Commits의 구조

Conventional Commits는 커밋 메시지에 일정한 구조를 부여하는 명세다. 사람이 읽기 쉬울 뿐 아니라, 도구가 메시지를 해석해 변경 로그를 만들거나 시맨틱 버전을 자동으로 올릴 수 있게 하는 것이 목적이다. 기본 형식은 다음과 같다.

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

세부 규칙은 회사나 팀마다 조금씩 다를 수 있으니, 아래 내용을 바탕으로 팀의 합의를 우선하면 된다.

### 헤더

`타입: 설명` 형식으로 쓴다. 콜론은 타입에 바로 붙이고 뒤에 공백 하나를 둔다. `feat : 로그인 구현`처럼 콜론 앞에 공백을 넣으면 명세에 맞지 않아 도구가 인식하지 못한다. 괄호로 범위(scope)를 붙일 수도 있다.

```text
feat(auth): 로그인 기능 구현
```

### 본문

변경 이유와 맥락을 자유롭게 쓴다. 헤더와는 빈 줄 하나로 구분한다.

```text
feat(auth): 로그인 기능 구현

JWT 기반 인증을 추가한다. 로그인에 실패하면 원인별로
구분된 에러 메시지를 반환한다.
```

### 푸터

이슈 번호, 리뷰어, 호환성이 깨지는 변경 같은 메타 정보를 `토큰: 값` 또는 `토큰 #값` 형식으로 쓴다. 커밋 메시지에는 주석 문법이 없으니 `// 이슈 번호` 같은 설명을 덧붙이면 그대로 메시지에 남는다는 점에 주의한다.

```text
fix: 모달 배경 스크롤 문제 수정

모달이 열린 동안 body 스크롤을 막는다.

Refs: #1234
```

GitHub에서는 기본 브랜치에 병합될 때 `Closes #1234`, `Fixes #1234`, `Resolves #1234` 같은 키워드가 있으면 해당 이슈를 자동으로 닫는다.

### 호환성이 깨지는 변경

API를 바꾸는 등 하위 호환이 깨지는 변경은 타입 뒤에 `!`를 붙이거나 푸터에 `BREAKING CHANGE:`를 쓴다. 시맨틱 버전 자동화 도구는 이를 보고 메이저 버전을 올린다.

```text
feat(api)!: 주문 조회 응답 형식 변경

BREAKING CHANGE: items 필드가 orderItems로 이름이 바뀌었다.
```

## 커밋 타입

명세가 필수로 정한 타입은 `feat`(새 기능, 마이너 버전)와 `fix`(버그 수정, 패치 버전) 두 가지이고, 나머지는 Angular 컨벤션에서 온 관례적인 타입이다. 자주 쓰는 타입을 표로 정리했다.

![커밋 타입별 설명과 예시를 정리한 표. feat, fix, build, chore, ci, docs, style, refactor, test, perf](/img/blog/post-11-1.png)

원래 글의 예시에 있던 `update:`는 표준 타입 목록에 없다. 성격에 따라 `refactor`, `style`, `chore` 중 하나로 고르는 것이 맞다. 처음부터 전부 외우기보다 `feat`, `fix`, `refactor`, `docs`, `chore` 정도로 시작해 천천히 늘려 가면 된다.

## 규칙을 습관으로 만드는 도구

규칙은 사람이 기억하는 것보다 도구로 강제할 때 오래 간다.

- **commitlint**: 커밋 메시지가 규칙에 맞는지 검사한다. Husky 같은 Git 훅 도구와 함께 `commit-msg` 훅에 연결하면 형식에 맞지 않는 커밋을 막을 수 있다.
- **커밋 템플릿**: `git config commit.template <파일>`로 커밋 에디터에 기본 양식을 띄울 수 있다.
- **Squash 병합**: PR 단위로 squash 병합한다면 개별 커밋보다 PR 제목을 규칙에 맞추는 것이 더 중요해진다.

## 정리

> 좋은 커밋 메시지는 무엇을 바꿨는지와 왜 바꿨는지에 답한다.

제목은 짧은 명령형으로, 본문은 빈 줄로 구분해 이유를 중심으로 쓴다. 여기에 Conventional Commits의 타입과 푸터 규칙을 더하면 사람과 도구가 모두 읽을 수 있는 이력이 된다. 커밋 메시지는 혼자 남기는 기록이 아니라 팀이 함께 읽는 문서이므로, 세부 규칙보다 팀이 하나의 규칙을 합의하고 꾸준히 지키는 것이 가장 중요하다.

## 참고

- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [How to Write a Git Commit Message - Chris Beams](https://cbea.ms/git-commit/)
- [commitlint](https://commitlint.js.org/)
- [GitHub Docs - Linking a pull request to an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
$body11$, '2024-12-18T05:59:51.520Z'::timestamptz, 'posts/%EC%BB%A4%EB%B0%8B-%EB%A9%94%EC%84%B8%EC%A7%80-%EA%B7%9C%EC%B9%99%EC%9D%84-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90'),
  (17, 'design-system-basics', '디자인 시스템이 필요한 이유와 구축 전략', '디자인 시스템이 왜 필요한지, 무엇으로 이루어지는지, 디자인 토큰과 컴포넌트 라이브러리와 문서화로 어떻게 만들고 운영하는지 정리한다.', array['디자인 시스템', '협업']::text[], $body17$
디자인 시스템(Design System)은 제품 전반의 일관성을 지키고 디자인과 개발 과정을 효율적으로 운영하기 위한 체계다. 흔히 UI 컴포넌트 라이브러리와 같은 말로 쓰이지만, 실제로는 디자인 원칙, 시각 규칙, 코드, 문서화, 그리고 이를 고쳐 나가는 운영 방식까지 포함하는 넓은 개념이다.

이 글에서는 디자인 시스템이 필요한 이유, 구성 요소, 그리고 프론트엔드 관점에서 구현하고 운영하는 전략을 정리한다.

## 디자인 시스템이 필요한 이유

### 일관된 사용자 경험

디자인 시스템이 없으면 개발자마다 UI를 따로 구현하게 되고, 같은 역할의 버튼이 화면마다 다른 크기와 색을 갖게 된다. 사용자는 이런 불일치를 정확히 짚어내지 못하더라도 "어딘가 어수선하다"고 느끼고, 브랜드 정체성도 흐려진다. 기준이 잘 잡혀 있으면 사용자는 어느 화면에서든 같은 인터페이스와 같은 인터랙션을 경험하고, 이는 제품에 대한 신뢰로 이어진다.

### 개발 생산성

버튼, 폼 요소, 카드, 모달처럼 반복되는 UI를 매번 새로 만들 필요가 없어진다. 검증된 컴포넌트를 가져다 쓰면 개발자는 화면의 로직과 기능에 집중할 수 있고, 코드 중복도 줄어든다. 다만 초기 구축 비용이 분명히 있으므로, 생산성 이득은 제품과 팀이 어느 정도 규모가 되었을 때 크게 나타난다.

### 협업 비용 감소

디자이너와 개발자가 같은 이름, 같은 값, 같은 규칙을 공유하면 "이 회색이 그 회색 맞아요?" 같은 대화가 줄어든다. 디자인 수정 요청이나 의도와 다른 구현도 함께 줄어든다. 새 팀원이 합류했을 때도 디자인 시스템 문서가 곧 온보딩 자료가 된다.

### 유지보수

UI 변경을 한곳에서 하면 전체에 반영된다. 예를 들어 버튼의 모서리 반경을 바꿀 때 디자인 시스템의 컴포넌트나 토큰만 수정하면 모든 화면이 함께 바뀐다. 화면마다 흩어진 스타일을 찾아 고치는 일이 사라지니 장기적으로 기술 부채가 줄어든다.

## 구성 요소

| 구성 요소 | 내용 |
| --- | --- |
| 디자인 원칙 | 브랜드의 핵심 가치와 UI/UX 방향성. 애매한 디자인 결정의 기준이 된다 |
| 파운데이션(스타일 가이드) | 색상, 타이포그래피, 간격, 그리드, 아이콘, 그림자 같은 시각 요소의 규칙 |
| 디자인 토큰 | 파운데이션의 값을 이름 붙여 디자인 툴과 코드가 함께 쓰는 형태 |
| 컴포넌트 라이브러리 | 버튼, 입력 필드, 모달 등 재사용 가능한 UI 요소 |
| 패턴 | 내비게이션, 폼 입력 흐름, 피드백 메시지처럼 컴포넌트를 조합한 반복 패턴 |
| 접근성 가이드라인 | 색 대비, 글자 크기, 키보드 조작, 스크린 리더 대응 기준 |
| 문서 | 위 모든 것의 사용법과 사용하지 말아야 할 경우를 설명하는 가이드 |

접근성은 별도 항목이기도 하지만, 실제로는 모든 컴포넌트에 녹아 있어야 한다. 버튼 하나를 만들 때도 포커스 표시, 키보드 조작, 대비 기준을 컴포넌트 수준에서 해결해 두면 사용하는 쪽에서 실수할 여지가 줄어든다.

## 구현 전략

### 디자인 토큰으로 값을 관리한다

디자인 토큰은 색상, 글자 크기, 간격 같은 디자인 결정을 이름 붙은 값으로 관리하는 방식이다. 핵심은 계층을 나누는 것이다. 원시 값을 담는 기본 토큰(primitive)과, 그 값이 어떤 역할로 쓰이는지 표현하는 의미 토큰(semantic)을 분리하면 테마를 바꿀 때 의미 토큰의 연결만 바꾸면 된다.

웹에서는 CSS 사용자 지정 속성으로 쉽게 표현할 수 있다.

```css
:root {
  /* 기본 토큰: 원시 값 */
  --blue-500: #1e90ff;
  --blue-700: #1565c0;
  --gray-50: #f8f9fa;
  --gray-900: #1a1d21;

  /* 의미 토큰: 역할 */
  --color-primary: var(--blue-500);
  --color-primary-hover: var(--blue-700);
  --color-bg: var(--gray-50);
  --color-text: var(--gray-900);
  --space-2: 8px;
  --space-4: 16px;
  --radius-md: 8px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: var(--gray-900);
    --color-text: var(--gray-50);
  }
}

.button-primary {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: #fff;
}

.button-primary:hover {
  background: var(--color-primary-hover);
}
```

컴포넌트는 `--blue-500`이 아니라 `--color-primary`만 알면 된다. 다크 모드나 다른 브랜드 테마를 지원할 때도 의미 토큰이 가리키는 값만 바꾸면 컴포넌트 코드는 그대로다. 규모가 커지면 토큰을 JSON 같은 형식으로 한곳에 정의하고, 빌드 도구로 CSS 변수나 플랫폼별 코드를 생성해 디자인 툴과 코드의 값이 어긋나지 않게 관리한다.

### 컴포넌트 라이브러리를 만든다

토큰 위에 컴포넌트를 쌓는다. 선택지는 크게 세 가지다.

- 기존 컴포넌트 라이브러리 위에 테마를 입힌다. Vue의 Vuetify처럼 완성된 컴포넌트 라이브러리를 쓰면 빠르게 시작할 수 있지만, 라이브러리의 디자인 언어에서 크게 벗어나기는 어렵다.
- 스타일이 없는 헤드리스 컴포넌트에 스타일만 입힌다. 동작과 접근성은 검증된 구현을 빌리고, 시각 표현은 우리 토큰으로 채우는 방식이다.
- 처음부터 직접 만든다. 통제권은 가장 크지만 접근성과 엣지 케이스까지 모두 책임져야 한다.

Tailwind CSS는 컴포넌트 라이브러리가 아니라 유틸리티 CSS 프레임워크다. 다만 테마 설정에 토큰을 연결해 두면 컴포넌트를 구현하는 좋은 도구가 된다. 컴포넌트를 나누는 기준으로는 작은 단위에서 큰 단위로 조합해 가는 Atomic Design 같은 방법론이 참고가 된다.

### Storybook으로 개발하고 문서화한다

Storybook은 UI 프레임워크가 아니라, 컴포넌트를 애플리케이션과 분리해 개발하고 문서화하는 도구다. React 전용도 아니어서 Vue, Angular, Svelte, Web Components 등을 함께 지원한다. 컴포넌트의 상태별 모습을 스토리로 정의해 두면 그 자체로 살아 있는 문서이자 시각적 테스트 대상이 된다.

```ts
// Button.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Button from './Button.vue'

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { label: '저장' },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: { variant: 'primary' },
}

export const Disabled: Story = {
  args: { variant: 'primary', disabled: true },
}
```

Figma, Notion, GitHub Wiki 같은 곳에 쓰는 가이드 문서도 필요하다. 다만 코드와 떨어진 문서는 금방 낡는다. 컴포넌트 사용법은 Storybook처럼 코드와 함께 사는 곳에 두고, 디자인 원칙이나 의사결정 배경처럼 자주 바뀌지 않는 내용은 별도 문서에 두는 식으로 역할을 나누면 관리가 쉽다.

### 버전을 관리하고 계속 고친다

디자인 시스템은 한 번 만들고 끝나는 결과물이 아니라 계속 운영하는 제품이다.

- 컴포넌트 라이브러리를 npm 패키지로 배포하고 시맨틱 버저닝을 따른다. 속성 이름 변경처럼 사용처를 깨뜨리는 변경은 메이저 버전으로 올리고, 변경 기록을 남긴다.
- 새 요구 사항이 생기면 화면 쪽에서 임시로 덮어쓰기보다 디자인 시스템에 반영할지부터 논의한다. 예외가 쌓이면 시스템은 금방 무력해진다.
- 사용하는 팀에서 정기적으로 피드백을 받는다. 쓰이지 않는 디자인 시스템은 아무리 잘 만들어도 의미가 없다.

이 글을 쓴 뒤 회사에서 KRDS(대한민국 정부 디자인 시스템)를 바탕으로 Vue 3, React, Storybook을 활용한 디자인 시스템 작업을 주도하게 됐다. 여기 정리한 원칙들은 그때도 출발점이 되어 주었다.

## 정리

- 디자인 시스템은 컴포넌트 모음이 아니라 원칙, 토큰, 컴포넌트, 패턴, 접근성, 문서를 아우르는 체계다.
- 디자인 토큰은 기본 토큰과 의미 토큰으로 나누면 테마 전환과 유지보수가 쉬워진다.
- Storybook은 프레임워크가 아니라 컴포넌트 개발·문서화 도구이고, Tailwind CSS는 컴포넌트 라이브러리가 아니라 유틸리티 CSS 프레임워크다. 도구의 역할을 구분해 조합한다.
- 버전 관리와 피드백으로 계속 운영해야 시스템이 살아남는다.

처음부터 거대한 시스템을 만들 필요는 없다. 색상과 간격 토큰, 그리고 가장 자주 쓰는 버튼과 입력 필드 몇 개부터 시작해도 충분하다.

## 참고

- [MDN, CSS 사용자 지정 속성 사용하기](https://developer.mozilla.org/ko/docs/Web/CSS/Using_CSS_custom_properties)
- [MDN, prefers-color-scheme](https://developer.mozilla.org/ko/docs/Web/CSS/@media/prefers-color-scheme)
- [Storybook 공식 문서](https://storybook.js.org/docs)
- [Atomic Design, Brad Frost](https://atomicdesign.bradfrost.com/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
$body17$, '2025-02-28T00:18:10.816Z'::timestamptz, 'posts/%EB%94%94%EC%9E%90%EC%9D%B8-%EC%8B%9C%EC%8A%A4%ED%85%9C%EC%97%90-%EB%8C%80%ED%95%B4-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90'),
  (18, 'what-is-monorepo', '모노레포란 무엇인가 - 장단점과 도구 정리', '모노레포와 멀티레포의 차이, 장단점과 해결 방법, pnpm 워크스페이스 기반 구조와 대표 도구를 정리한다.', array['아키텍처', '협업', 'Git']::text[], $body18$
모노레포(monorepo)는 여러 프로젝트를 하나의 저장소에서 관리하는 방식이다. 단순히 폴더를 한곳에 모으는 것이 아니라, 프로젝트 사이의 코드 공유와 변경을 한 번에 다룰 수 있게 해서 협업과 유지보수 비용을 줄이는 데 목적이 있다. Google, Meta, Microsoft 같은 대형 기업이 거대한 코드베이스를 이 방식으로 운영하는 것으로 잘 알려져 있다.

다만 대기업의 모노레포는 자체 버전 관리 시스템과 빌드 인프라 위에서 돌아간다. 프론트엔드 팀이 현실적으로 마주하는 모노레포는 웹 앱 몇 개와 공통 패키지를 하나의 Git 저장소에 담은 형태다. 이 글에서는 그 관점에서 모노레포의 개념, 장단점과 해결 방법, 구조 예시와 도구를 정리한다.

## 모노레포와 멀티레포

### 모노레포

하나의 저장소에 여러 애플리케이션과 패키지를 둔다. 코드 스타일, 린트·빌드 설정, 공통 라이브러리를 공유하고, CI/CD도 한곳에서 관리한다. 공통 패키지를 고치면 그 패키지를 쓰는 앱까지 같은 커밋에서 함께 수정하고 검증할 수 있다.

### 멀티레포

프로젝트마다 별도 저장소를 둔다. 각 팀이 독립적으로 버전을 관리하고 배포할 수 있어 서로의 변경에 영향을 덜 받는다. 대신 공통 코드는 패키지로 배포해서 버전으로 맞춰야 하고, 저장소가 늘어날수록 설정 동기화와 의존성 업데이트 같은 관리 부담이 커진다.

| 항목 | 모노레포 | 멀티레포 |
| --- | --- | --- |
| 코드 공유 | 저장소 안에서 바로 참조 | 패키지 배포 후 버전으로 참조 |
| 여러 프로젝트에 걸친 변경 | 하나의 커밋, 하나의 PR | 저장소마다 PR과 배포 순서 조율 |
| 설정 일관성 | 공유 설정으로 유지하기 쉬움 | 저장소마다 따로 관리 |
| 독립성 | 다른 프로젝트 변경의 영향을 받기 쉬움 | 높음 |
| 권한 관리 | 저장소 단위라 세분화가 어려움 | 저장소별로 분리 가능 |

## 모노레포의 장점

### 코드 재사용과 일관성

디자인 시스템 컴포넌트, API 클라이언트, 유틸리티 같은 공통 코드를 여러 앱이 직접 참조한다. 같은 함수를 앱마다 복사해 두는 일이 줄고, ESLint·TypeScript 설정을 하나로 공유하면 코드 스타일도 자연스럽게 맞춰진다.

### 원자적인 변경

여러 프로젝트에 걸친 변경을 하나의 커밋으로 묶을 수 있다. 예를 들어 공통 버튼 컴포넌트의 props를 바꾸면서 이를 쓰는 모든 앱을 같은 PR에서 함께 고칠 수 있다. 멀티레포라면 패키지를 먼저 배포하고, 앱 저장소마다 버전을 올리는 PR을 따로 만들어야 한다.

### 협업과 가시성

모든 코드가 한곳에 있으니 다른 팀의 코드를 찾아보고 변경의 영향 범위를 파악하기 쉽다. 코드 리뷰와 배포 절차도 하나로 통일할 수 있다.

### 통합된 CI/CD

빌드·테스트·배포 파이프라인을 한 번 잘 만들어 두면 모든 프로젝트가 같은 기준으로 검증된다. 다만 이 장점은 뒤에서 다룰 "변경된 부분만 빌드하는" 체계가 있을 때 비로소 살아난다.

## 모노레포의 단점과 해결 방법

### 저장소 크기 증가

프로젝트와 이력이 쌓이면 클론과 체크아웃이 느려진다. Git에는 이를 줄이는 기능이 있다.

- **부분 클론**: `--filter=blob:none`으로 파일 내용은 필요할 때 받아 온다.
- **Sparse checkout**: 작업에 필요한 디렉터리만 작업 트리에 꺼내 둔다.
- **Git LFS**: 이미지, 영상 같은 대용량 바이너리를 저장소 밖에 보관한다. 일반 소스 코드가 많아서 커진 저장소에는 효과가 없다.

```bash
git clone --filter=blob:none --sparse https://github.com/acme/monorepo.git
cd monorepo
git sparse-checkout set apps/web packages/ui
```

### 빌드와 테스트 시간 증가

변경 하나마다 모든 프로젝트를 빌드하고 테스트하면 CI가 금방 느려진다. 해결의 핵심은 두 가지다.

- **영향 범위 분석**: 패키지 간 의존성 그래프를 보고 변경된 패키지와 그에 의존하는 패키지만 빌드·테스트한다.
- **캐싱**: 입력이 같으면 이전 결과를 재사용한다. 원격 캐시를 쓰면 CI와 팀원 사이에서도 결과를 공유한다.

Nx, Turborepo, Bazel 같은 도구가 이 역할을 맡는다.

### 접근 권한 관리

Git은 저장소 단위로 읽기 권한을 준다. 따라서 모노레포에서는 특정 디렉터리만 숨기는 것이 근본적으로 어렵다. Sparse checkout은 작업 트리에 보이는 파일을 줄일 뿐 권한을 제한하지 않는다는 점에 주의해야 한다. 현실적인 대응은 다음과 같다.

- **CODEOWNERS**: 디렉터리별 담당자를 지정해 해당 경로를 수정하는 PR에 담당 팀의 리뷰를 필수로 건다. 읽기는 막지 못하지만 쓰기 통제에는 효과적이다.
- **분리**: 정말로 접근을 막아야 하는 코드(보안 민감 코드, 외부 협력사 코드 등)는 별도 저장소로 분리한다. 모노레포가 모든 코드를 담아야 하는 것은 아니다.

## 프로젝트 구조 예시

pnpm 워크스페이스와 Turborepo를 쓰는 프론트엔드 모노레포의 전형적인 구조다.

```text
my-monorepo/
├── apps/
│   ├── web/        # 사용자용 웹 앱 (React)
│   ├── admin/      # 관리자 대시보드
│   └── api/        # 백엔드 서버 (Express)
├── packages/
│   ├── ui/         # 공통 UI 컴포넌트 라이브러리
│   ├── utils/      # 유틸리티 함수
│   └── config/     # ESLint, TypeScript 공유 설정
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── turbo.json
```

`apps`에는 독립적으로 배포되는 애플리케이션을, `packages`에는 여러 앱이 공유하는 모듈을 둔다. 워크스페이스 범위는 `pnpm-workspace.yaml`에 선언한다.

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

앱에서 내부 패키지를 쓸 때는 `workspace:` 프로토콜로 의존성을 선언한다. 레지스트리가 아닌 저장소 안의 패키지를 링크한다는 뜻이다.

```json
{
  "name": "web",
  "dependencies": {
    "@acme/ui": "workspace:*",
    "@acme/utils": "workspace:*"
  }
}
```

작업 실행 순서와 캐시 대상은 `turbo.json`에 정의한다. `^build`는 "의존하는 패키지의 build를 먼저 실행한다"는 뜻이다.

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
```

Turborepo 1.x에서는 같은 내용을 `tasks` 대신 `pipeline` 키로 썼다. 이제 특정 앱만, 또는 변경된 패키지와 그에 의존하는 패키지만 골라 실행할 수 있다.

```bash
# web 앱과 그 의존 패키지만 빌드
pnpm turbo run build --filter=web

# origin/main 이후 변경된 패키지와 이를 의존하는 패키지만 테스트
pnpm --filter "...[origin/main]" test
```

## 모노레포 관리 도구

도구는 역할에 따라 크게 두 층으로 나뉜다.

**패키지 매니저의 워크스페이스**: 여러 패키지의 의존성을 한 번에 설치하고 내부 패키지를 서로 링크한다.

- **npm workspaces**: npm 7부터 기본 내장되어 있다.
- **Yarn workspaces**: 일찍부터 워크스페이스를 지원해 모노레포 확산에 큰 역할을 했다.
- **pnpm workspaces**: 콘텐츠 주소 기반 저장소로 설치가 빠르고 디스크를 아끼며, 선언하지 않은 의존성 접근을 막는 엄격함 덕분에 모노레포에서 특히 많이 쓰인다.

**태스크 러너와 빌드 시스템**: 의존성 그래프를 따라 작업을 실행하고, 캐싱과 영향 범위 분석을 제공한다.

- **Turborepo**: Vercel이 인수해 관리하는 도구로, 설정이 가볍고 로컬·원격 캐싱에 강점이 있다. 기존 워크스페이스 위에 얹기 쉽다.
- **Nx**: Angular 생태계에서 출발했지만 지금은 React, Vue, Node.js 등 프레임워크와 무관하게 쓰는 빌드 시스템이다. 영향 범위 분석, 코드 생성, 모듈 경계 규칙 등 기능이 폭넓다.
- **Lerna**: 초창기 자바스크립트 모노레포의 대표 도구로, 패키지 버전 관리와 npm 배포에 강점이 있다. 2022년부터 Nx 팀이 관리를 맡아 작업 실행에는 Nx를 사용한다.
- **Bazel**: Google 내부 빌드 시스템을 공개한 도구로, 여러 언어를 아우르는 대규모 저장소에 맞지만 도입과 운영 비용이 크다.

프론트엔드 팀이 처음 시작한다면 pnpm workspaces에 Turborepo나 Nx를 더하는 조합이 가장 무난하다. 패키지를 npm에 배포해야 한다면 버전과 변경 로그 관리에 Changesets 같은 도구를 함께 고려한다.

## 정리

모노레포는 코드 공유가 잦고 여러 프로젝트를 함께 바꾸는 일이 많을 때 큰 효과를 낸다. 원자적인 변경, 일관된 설정, 통합된 CI가 그 장점이다. 반대로 저장소 크기, 빌드 시간, 권한 관리라는 비용이 따르고, 이 비용은 부분 클론, 영향 범위 기반 빌드와 캐싱, CODEOWNERS 같은 도구로 관리해야 한다.

팀과 프로젝트가 서로 독립적으로 개발·배포되고 공유 코드가 적다면 멀티레포가 더 단순한 선택일 수 있다. 모노레포냐 멀티레포냐보다 중요한 것은 코드가 얼마나 자주 함께 바뀌는지, 팀이 어떻게 일하는지에 맞춰 구조를 고르는 것이다.

## 참고

- [pnpm - Workspace](https://pnpm.io/workspaces)
- [Turborepo 공식 문서](https://turborepo.com/docs)
- [Nx 공식 문서](https://nx.dev/)
- [Git - git-sparse-checkout](https://git-scm.com/docs/git-sparse-checkout)
- [GitHub Docs - About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
$body18$, '2025-02-28T00:33:14.175Z'::timestamptz, 'posts/%EB%AA%A8%EB%85%B8%EB%A0%88%ED%8F%AC%EB%8A%94-%EB%8C%80%EC%B2%B4-%EB%AD%98%EA%B9%8C'),
  (19, 'do-you-know-this-chicken', '이 닭을 아시나요', '말 한마디 없이 하숙집을 장악한 펭귄, 페더스 맥그로. 〈월레스와 그로밋: 전자바지 소동〉을 그의 시점에서 다시 따라가 본 짧은 글.', array['에세이']::text[], $body19$
초인종이 울렸다. 월레스는 신문을 읽다 말고 자리에서 일어나 문을 열었다. 그 순간, 검은 그림자가 문턱을 넘어 집 안으로 들어왔다. 깔끔하게 정돈된 깃털, 무표정한 얼굴. 펭귄이었다. 손님방을 세놓겠다는 광고를 보고 찾아온 이 낯선 존재는, 이름도 밝히지 않은 채 그저 가방을 내려놓고 그로밋을 쳐다보았다. 단순한 하숙인인가? 아니면 그 이상의 존재인가?

페더스 맥그로. 그 이름은 사건이 끝난 후에야 밝혀졌다. 아니, 사실 그로밋이 본 신문 기사 한 구석에서나 등장했을 뿐, 그 누구도 처음부터 그의 정체를 알지 못했다. 말이 없는 존재는 주목받지 않는다. 그는 이 점을 너무도 잘 알고 있었다. 그래서 말 대신 행동으로 움직였고, 서서히 공간을 장악해갔다. 원래 그로밋이 쓰던 방을 차지하고, 음악을 틀어 자신의 영역을 선언하고, 자신의 몸에 맞춰 문까지 개조했다. 월레스는 그의 행동을 이상하게 여기지 않았다. 애초에 펭귄이라는 존재 자체가 의심을 받지 않는 생물이지 않은가?

하지만 그로밋은 알았다. 그의 눈빛이 평범한 동물의 것이 아니라는 것을. 감정을 배제한 눈동자, 목적을 향해 한 치의 흔들림도 없이 움직이는 몸짓. 그는 이미 단순한 손님이 아니었다. 아니, 애초부터 그럴 생각이 없었던 것이다. 그로밋은 방에서 그가 남긴 흔적을 찾아냈다. 정리된 문서, 계산된 이동 경로, 그리고 한 가지 확실한 증거. 월레스의 발명품, ‘전자바지(Techno Trousers)’의 설계도를 검토하고 있던 흔적.

그리고 마침내, 계획이 시작되었다. 한밤중, 월레스는 무언가에 의해 조종당했다. 깨어나려 해도 눈꺼풀이 무겁고, 몸은 저절로 움직였다. 그는 알지 못했다. 자신의 발밑에서 움직이는 이 기계가, 더 이상 자신의 것이 아니라는 것을. 그가 발명한 바지가, 이제는 범죄 도구가 되어버렸다는 것을. 페더스 맥그로는 그의 발명품을 이용해 다이아몬드를 훔치는 계획을 세웠다. 사람들은 말하는 존재에게만 속는다. 그렇다면 말을 하지 않는 존재라면? 그는 모든 것을 자신이 원하는 대로 움직였다.

하지만 변수가 있었다. 그로밋이었다. 본능적으로 위험을 감지하는 유일한 존재. 맥그로는 그의 존재를 간과하지 않았다. 처음부터 방해가 될 가능성이 있는 개였으므로, 그의 정신을 무너뜨리기 위해 계획적으로 움직였다. 시끄러운 음악, 서서히 밀려나는 공간, 월레스의 관심을 자신에게로 돌리는 조작. 모든 것은 그로밋을 집에서 몰아내기 위한 계산된 행동이었다. 그리고 결국, 그는 성공했다. 그로밋은 집을 나섰고, 이제 그를 방해할 존재는 아무도 남지 않았다.

그러나 완벽한 계획이란 존재하지 않는 법. 페더스 맥그로는 치밀했다. 하지만 그로밋은 끈질겼다. 그가 집을 떠났을지언정, 진실을 포기하지 않았다. 몰래 숨어 그의 행동을 감시했고, 마침내 결정적 순간을 포착했다. 페더스 맥그로가 변장한 모습을 본 것이다. 머리에 빨간 장갑을 쓰고 닭으로 위장한 그의 모습. 모든 증거를 하나로 맞출 마지막 퍼즐이었다. 수배 중이던 도둑, 정체불명의 하숙객, 그리고 머리에 쓰인 닭 벼슬 모양의 고무장갑. 이 모든 것이 한 사람에게 귀결되었다.

그리고 그는 패배했다. 숨겨둔 다이아몬드는 드러났고, 그의 계획은 와해되었다. 도망가려 했으나, 끝없는 추격전이 펼쳐졌다. 마침내 그는 붙잡혔다. 다름 아닌, 그 자신이 개조했던 전자바지에 의해. 그는 이제 경찰서로 향하고 있었다. 단 한 마디의 변명도 없이, 단 하나의 감정도 없이. 그가 떠난 자리에는 그를 둘러싼 모든 것들이 남아 있었다. 교묘한 심리 조작, 완벽한 신분 위장, 기술을 이용한 범죄. 그러나 결국, 한 마리 개의 직감에 의해 그의 계획은 허물어졌다.

그렇게 끝난 이야기처럼 보였다. 하지만 정말 끝이었을까? 수감된 그의 눈빛은 여전히 차가웠다. 계획이 실패했다고 해서, 그가 더 이상 움직이지 않을 거라 생각하는 것은 순진한 착각일지도 모른다. 어쩌면, 그는 여전히 다음을 준비하고 있을 것이다. 어쩌면, 우리는 다시금 그 초인종 소리를 듣게 될지도 모른다. 이번에는 다른 모습으로, 다른 공간에서. 하지만 본질은 같을 것이다. 말이 없는 존재는 주목받지 않는다. 그는 이 점을 너무도 잘 알고 있다.

> 기억해 보십시오. 이 닭을 아시나요?

*〈월레스와 그로밋: 전자바지 소동〉(1993)을 다시 보고 쓴 감상이다. 그는 2024년 〈벤전스 모스트 파울〉로 정말 돌아왔다.*
$body19$, '2025-02-28T00:51:39.726Z'::timestamptz, 'posts/%EC%9D%B4-%EB%8B%AD%EC%9D%84-%EC%95%84%EC%8B%9C%EB%82%98%EC%9A%94'),
  (20, 'foxtail-is-human-tail', '강아지풀은 인간의 꼬리다', '인간이 잃어버린 꼬리는 어디로 갔을까. 길가의 강아지풀에서 그 흔적을 찾는, 엄연한 사실에 관한 짧은 글.', array['에세이']::text[], $body20$
인류는 오랫동안 자연을 연구해 왔지만 아직 밝혀지지 않은 비밀이 많다. 그중 하나가 인간이 한때 가지고 있던 꼬리의 행방이다. 진화 과정에서 쓸모없어진 기관은 흔적만 남기고 사라졌다고들 한다. 하지만 정말 사라졌을까. 나는 그 꼬리가 다른 모습으로 자연 속에 남아 있다고 본다.

증거는 길가에 있다. 강아지풀이다.

## 가설

인간은 꼬리를 가진 조상에게서 갈라져 나왔다. 나무를 타고 균형을 잡는 데 쓰이던 꼬리는 직립보행을 시작하면서 쓸모를 잃었고, 결국 퇴화했다. 여기까지가 교과서의 이야기다.

여기서부터는 내 이야기다. 꼬리가 퇴화하는 긴 시간 동안 모든 꼬리가 얌전히 사라지지는 않았을 것이다. 어떤 꼬리는 몸에서 떨어져 나간 뒤에도 끝내 분해되지 않았고, 땅에 뿌리를 내려 새로운 생명으로 살아남았다. 그것이 오늘날의 강아지풀이다.

## 생김새가 말해 주는 것

강아지풀을 가만히 들여다보면 이 가설이 단순한 추측이 아니라는 것을 알 수 있다.

- 길고 유연한 줄기는 꼬리뼈의 구조를 닮았다.
- 끝에 달린 보송한 잔털은 체모가 변한 것이다.
- 바람이 불면 살랑살랑 흔들리는 모습이 영락없는 꼬리다.

강아지들이 강아지풀만 보면 달려드는 것도 우연이 아니다. 본능적으로 잃어버린 꼬리를 알아보는 것이다.

## 이름에 남은 단서

강아지풀은 한자로 구미초(狗尾草), 개의 꼬리 풀이라고 부른다. 옛사람들도 이 풀이 꼬리라는 사실만큼은 정확히 알고 있었던 셈이다. 누구의 꼬리인지까지는 미처 적지 못했을 뿐이다. 개는 만 년 넘게 인간 곁에서 살아왔다. 개들이 유독 강아지풀에 친근하게 구는 것도, 그 오랜 동거의 기억이 어딘가에 남아 있기 때문일지 모른다.

## 동물과 식물 사이

동물과 식물의 경계는 분명해 보이지만, 자연은 생각보다 너그럽다. 어떤 바다 민달팽이는 먹은 조류의 엽록체를 몸에 품고 지내고, 파리지옥 같은 식물은 곤충을 잡아먹는다. 이런 세상에서 꼬리 하나가 풀이 되었다고 해서 그렇게 이상한 일일까.

자라는 방식도 닮았다. 인간의 배아는 발생 초기에 꼬리 같은 구조를 만들었다가 다시 거둬들인다. 강아지풀도 환경에 따라 길이가 달라진다. 무엇보다 인간의 꼬리가 한 번 퇴화한 뒤로 다시 돋아나지 않았듯, 내 꼬리도 아직 돌아오지 않았다.

## 정리

강아지풀은 인간의 꼬리다. 엄연한 사실이다.

물론 식물학자와 진화생물학자 앞에서는 이 이야기를 꺼내지 않는 게 좋다. 하지만 다음에 길가에서 바람에 흔들리는 강아지풀을 보게 된다면, 잠깐 멈춰서 인사 정도는 해 줘도 괜찮을 것 같다. 오래전에 헤어진 우리의 일부일지도 모르니까.
$body20$, '2025-02-28T02:27:07.231Z'::timestamptz, 'posts/%EA%B0%95%EC%95%84%EC%A7%80%ED%92%80%EC%9D%80-%EC%9D%B8%EA%B0%84%EC%9D%98-%EA%BC%AC%EB%A6%AC%EB%8B%A4.'),
  (21, 'web-image-optimization', '웹 성능을 위한 이미지 최적화 방법', '포맷 선택, srcset과 picture를 이용한 반응형 이미지, sharp 압축, 지연 로딩, CDN까지 웹 이미지 최적화의 기본 전략을 정리한다.', array['웹 성능', 'Web API']::text[], $body21$
이미지는 대부분의 웹페이지에서 가장 많은 바이트를 차지하는 리소스다. 최적화하지 않은 이미지는 로딩을 늦추고, 레이아웃을 흔들고, 모바일 사용자의 데이터를 낭비한다. 특히 히어로 이미지처럼 화면에서 가장 큰 요소는 Core Web Vitals의 LCP(Largest Contentful Paint)를 직접 좌우하므로, 사용자 경험과 검색 노출 모두에 영향을 준다.

이 글에서는 이미지 최적화를 다섯 단계로 나눠 정리한다. 알맞은 포맷을 고르고, 화면에 맞는 크기를 내려주고, 파일 자체를 압축하고, 필요한 시점에 불러오고, 가까운 서버에서 전달하는 것이다.

## 이미지 포맷 고르기

같은 이미지라도 포맷에 따라 파일 크기가 크게 달라진다.

| 포맷 | 압축 | 투명도 | 적합한 용도 |
| --- | --- | --- | --- |
| JPEG | 손실 | 미지원 | 사진. 가장 호환성이 좋은 폴백 |
| PNG | 무손실 | 지원 | 스크린샷, 선명한 경계가 중요한 그래픽 |
| WebP | 손실·무손실 | 지원 | JPEG·PNG의 대체 |
| AVIF | 손실·무손실 | 지원 | 사진 위주에서 더 높은 압축률 |
| SVG | 벡터 | 지원 | 아이콘, 로고, 단순한 일러스트 |

Google의 측정에 따르면 손실 WebP는 같은 화질의 JPEG보다 25~34% 정도 작다. AVIF는 보통 WebP보다 더 작게 압축되지만 인코딩이 느리다는 단점이 있다. WebP와 AVIF 모두 현재 주요 브라우저에서 지원되므로, 사진은 AVIF나 WebP를 기본으로 하고 JPEG를 폴백으로 두는 구성이 무난하다. 아이콘과 로고는 래스터 포맷보다 SVG가 대부분 더 작고 선명하다.

## 반응형 이미지

### 포맷 협상은 picture로

`<picture>`의 `<source>`는 위에서부터 순서대로 검사되고, 브라우저가 처음으로 지원하는 `type`의 이미지를 고른다. 어떤 것도 지원하지 않으면 `<img>`의 `src`를 쓴다.

```html
<picture>
  <source srcset="photo.avif" type="image/avif" />
  <source srcset="photo.webp" type="image/webp" />
  <img src="photo.jpg" alt="해 질 녘의 한강 공원" width="1200" height="800" />
</picture>
```

### 크기 선택은 srcset과 sizes로

포맷만 바꿔서는 부족하다. 휴대폰 화면에 1600px짜리 이미지를 내려보내면 대부분의 바이트가 낭비된다. `srcset`에 너비 서술자(`w`)로 여러 크기를 나열하고, `sizes`로 이미지가 화면에서 차지할 폭을 알려 주면 브라우저가 화면 폭과 픽셀 밀도를 고려해 가장 알맞은 파일을 고른다.

```html
<img
  src="photo-800.jpg"
  srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1600.jpg 1600w"
  sizes="(min-width: 1024px) 50vw, 100vw"
  alt="해 질 녘의 한강 공원"
  width="1600"
  height="1067"
/>
```

`sizes`는 "1024px 이상에서는 화면 폭의 절반, 그 외에는 화면 전체 폭"이라는 뜻이다. 두 방식은 함께 쓸 수 있다. `<source>`에도 `srcset`과 `sizes`를 넣으면 포맷과 크기를 동시에 고르게 할 수 있다.

### width와 height는 꼭 적는다

`width`와 `height` 속성을 생략하면 이미지가 로드되기 전까지 브라우저가 높이를 알 수 없어서, 이미지가 뜨는 순간 아래 콘텐츠가 밀려난다. 이것이 CLS(Cumulative Layout Shift)를 키우는 대표적인 원인이다. 속성으로 원본 비율만 알려 주면 브라우저가 공간을 미리 확보하고, CSS의 `width: 100%; height: auto;`와 함께 써도 비율이 유지된다.

## 압축과 변환

### 도구

한두 장이라면 브라우저에서 바로 쓰는 도구로 충분하다.

- [Squoosh](https://squoosh.app/): 포맷과 품질을 바꿔 가며 원본과 나란히 비교할 수 있다.
- [TinyPNG](https://tinypng.com/): PNG, JPEG, WebP를 간단히 압축한다.

### sharp로 자동화하기

이미지가 많다면 빌드 단계에서 자동으로 변환하는 것이 낫다. Node.js에서는 [sharp](https://sharp.pixelplumbing.com/)가 대표적이다. 아래 스크립트는 원본 하나로 여러 너비의 AVIF와 WebP를 한 번에 만든다.

```js
// optimize-images.mjs
import sharp from 'sharp';

const widths = [400, 800, 1600];

for (const width of widths) {
  const image = sharp('input.jpg').resize({ width, withoutEnlargement: true });

  await image.clone().avif({ quality: 50 }).toFile(`photo-${width}.avif`);
  await image.clone().webp({ quality: 80 }).toFile(`photo-${width}.webp`);
}
```

`withoutEnlargement`는 원본보다 큰 크기로 늘리지 않게 한다. 품질 값은 포맷마다 의미가 달라서 AVIF는 WebP보다 낮은 숫자에서도 비슷한 화질이 나온다. 적당한 값은 실제 이미지로 비교해 보고 정하는 것이 좋다.

## 지연 로딩

### loading="lazy"

화면 밖에 있는 이미지는 사용자가 스크롤해서 가까워질 때 불러오면 된다. 지금은 HTML 속성 하나로 충분하다.

```html
<img src="photo.jpg" loading="lazy" alt="해 질 녘의 한강 공원" width="1200" height="800" />
```

브라우저가 뷰포트와의 거리를 판단해 적당한 시점에 요청을 보낸다.

### 첫 화면 이미지는 지연하지 않는다

지연 로딩을 모든 이미지에 일괄 적용하는 것은 흔한 실수다. 첫 화면에 보이는 이미지, 특히 LCP 요소에 `loading="lazy"`를 붙이면 레이아웃이 계산될 때까지 요청이 미뤄져 오히려 LCP가 나빠진다. 첫 화면의 핵심 이미지는 반대로 우선순위를 높인다.

```html
<img src="hero.webp" fetchpriority="high" alt="서비스 메인 배너" width="1600" height="900" />
```

### JavaScript로 직접 구현하기

`loading="lazy"`로 부족할 때, 예를 들어 미리 불러올 거리를 직접 정하고 싶다면 `IntersectionObserver`를 쓴다. 실제 주소는 `data-src`에 두고, 요소가 뷰포트에 가까워졌을 때 `src`로 옮긴다.

```html
<img data-src="photo.jpg" alt="해 질 녘의 한강 공원" width="1200" height="800" class="lazy" />
```

```js
const observer = new IntersectionObserver(
  (entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const img = entry.target;
      img.src = img.dataset.src;
      obs.unobserve(img);
    }
  },
  { rootMargin: '200px 0px' }, // 뷰포트 200px 전부터 미리 불러온다
);

document.querySelectorAll('img.lazy').forEach((img) => observer.observe(img));
```

`DOMContentLoaded`에서 모든 이미지의 `src`를 한꺼번에 채우는 방식은 지연 로딩이 아니다. 문서가 준비되자마자 모든 이미지를 요청하기 때문이다. 관찰자가 "보일 때"를 알려 주는 구조여야 한다. JavaScript가 꺼진 환경에서는 이미지가 보이지 않으므로, 가능하면 네이티브 `loading="lazy"`를 먼저 고려한다.

## CDN으로 전달하기

CDN(Content Delivery Network)은 사용자와 가까운 엣지 서버에 파일을 캐시해 두고 전달해 네트워크 지연을 줄인다. 이미지와 관련해서는 두 종류를 구분해 두면 좋다.

- **일반 CDN**: 이미 만들어 둔 파일을 캐시해 빠르게 전달한다. AWS CloudFront, Cloudflare CDN 등이 있다. 정적 호스팅 서비스도 대부분 CDN을 거쳐 파일을 제공한다.
- **이미지 CDN**: 원본 하나만 올려 두면 URL 파라미터나 요청 헤더에 따라 크기 조절, 포맷 변환, 압축을 즉석에서 해 준다. Cloudflare Images, Imgix 등이 있다. 앞에서 다룬 여러 크기·포맷 생성을 직접 관리하지 않아도 된다는 것이 장점이다.

어느 쪽이든 파일 이름에 해시를 넣고 긴 `Cache-Control` 기간을 주면 재방문 시 네트워크 요청 자체를 줄일 수 있다.

## 정리

- 사진은 AVIF·WebP를 기본으로, JPEG를 폴백으로 둔다. 아이콘과 로고는 SVG를 쓴다.
- `<picture>`로 포맷을, `srcset`과 `sizes`로 크기를 브라우저가 고르게 한다. `width`·`height`로 공간을 미리 확보해 레이아웃 이동을 막는다.
- sharp 같은 도구로 빌드 단계에서 변환과 압축을 자동화한다.
- 화면 밖 이미지는 `loading="lazy"`로 미루고, 첫 화면의 핵심 이미지는 `fetchpriority="high"`로 앞당긴다.
- CDN, 필요하면 이미지 CDN으로 전달 경로를 짧게 만든다.

## 참고

- [MDN 반응형 이미지](https://developer.mozilla.org/en-US/docs/Web/HTML/Responsive_images)
- [MDN img 요소](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img)
- [MDN Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [web.dev Optimize Largest Contentful Paint](https://web.dev/articles/optimize-lcp)
- [sharp 문서](https://sharp.pixelplumbing.com/)
$body21$, '2025-03-14T08:43:54.252Z'::timestamptz, 'posts/%EC%9B%B9-%EC%84%B1%EB%8A%A5%EC%9D%84-%EC%9C%84%ED%95%9C-%EC%9D%B4%EB%AF%B8%EC%A7%80-%EC%B5%9C%EC%A0%81%ED%99%94-%EB%B0%A9%EB%B2%95'),
  (22, 'tailwind-css-v4', 'Tailwind CSS 입문 (3) v4에서 달라진 것과 마이그레이션', '2025년 1월 출시된 Tailwind CSS v4의 CSS 우선 설정, 새 엔진, 이름이 바뀐 유틸리티와 v3에서 옮겨 가는 방법을 정리한다.', array['Tailwind CSS', 'CSS']::text[], $body22$
Tailwind CSS 입문 시리즈의 세 번째 글이다. [첫 번째](/blog/tailwind-css-basics/)와 [두 번째](/blog/tailwind-css-customization/) 글은 v3 기준으로 쓰고 v4 차이를 덧붙였는데, 이번 글에서는 v4에서 무엇이 왜 바뀌었는지를 한곳에 모아 정리한다.

Tailwind CSS v4.0은 2025년 1월에 정식 출시됐다. 겉으로 보이는 클래스 문법은 대부분 그대로지만, 설정 방식과 내부 엔진은 사실상 새로 만들어졌다. 한 문장으로 요약하면 "JavaScript 설정 파일 중심에서 CSS 중심으로" 옮겨 간 버전이다.

## 무엇이 바뀌었나

### 설정이 CSS로 옮겨 왔다

가장 큰 변화다. v3에서는 `tailwind.config.js`가 필수였고 CSS에는 `@tailwind` 지시문 세 줄을 썼다. v4에서는 CSS 파일 하나에서 시작한다.

```css
/* v3 */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```css
/* v4 */
@import "tailwindcss";

@theme {
  --font-display: "Satoshi", sans-serif;
  --color-primary: #1e40af;
  --color-secondary: #9333ea;
  --breakpoint-3xl: 120rem;
}
```

`@theme` 안에 선언한 변수는 이름의 네임스페이스에 따라 유틸리티가 된다. 위 설정만으로 `font-display`, `bg-primary`, `text-secondary`, `3xl:` 접두사를 쓸 수 있다. 테마 값은 `:root`의 CSS 변수로도 노출되므로 일반 CSS나 인라인 스타일에서 `var(--color-primary)`로 참조할 수 있다.

### content 설정이 필요 없다

v3에서는 `content` 배열에 템플릿 경로를 빠짐없이 적어야 했고, 빠뜨리면 클래스가 생성되지 않는 문제가 자주 생겼다. v4는 프로젝트 파일을 자동으로 탐색하며 `.gitignore`에 있는 경로와 바이너리 파일은 제외한다. 자동 탐색에서 빠지는 경로(예를 들어 `node_modules` 안의 UI 라이브러리)는 `@source`로 추가한다.

```css
@import "tailwindcss";
@source "../node_modules/@my-company/ui-lib";
```

### 새 엔진과 빌드 도구 통합

엔진이 성능을 중심으로 다시 작성됐다. 공식 발표에 따르면 전체 빌드는 최대 5배, 증분 빌드는 100배 이상 빨라졌다. 내부적으로 Lightning CSS를 사용해 `@import` 처리, 벤더 프리픽스, 최신 문법 변환을 직접 처리하므로 `postcss-import`나 `autoprefixer`를 따로 설치할 필요가 없다.

빌드 도구별 통합 패키지도 나뉘었다.

| 환경 | 패키지 |
| --- | --- |
| Vite | `@tailwindcss/vite` |
| PostCSS | `@tailwindcss/postcss` |
| CLI | `@tailwindcss/cli` |

Vite 프로젝트라면 플러그인을 추가하는 것으로 끝난다.

```js
// vite.config.js
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
});
```

### 최신 CSS 기능 기반

v4는 브라우저의 최신 기능을 적극적으로 사용한다. 네이티브 캐스케이드 레이어(`@layer`)로 우선순위를 관리하고, `@property`로 커스텀 속성에 타입을 지정하며, 투명도 수정자(`bg-black/50`)는 `color-mix()`로 구현한다. 기본 색상 팔레트는 OKLCH 색 공간으로 다시 정의되어 지원하는 디스플레이에서 더 선명한 색을 보여 준다.

이 때문에 지원 브라우저 하한도 올라갔다. Safari 16.4, Chrome 111, Firefox 128 이상이 필요하다. 더 오래된 브라우저를 지원해야 한다면 v3.4를 유지하는 것이 공식 권장이다.

### 새로 들어온 기능들

- **컨테이너 쿼리 내장**: 플러그인 없이 부모에 `@container`, 자식에 `@sm:`, `@md:` 같은 접두사를 쓴다.
- **동적 유틸리티 값**: 간격이 `--spacing` 기본 단위의 배수로 계산되어 `w-29`, `mt-17` 같은 값을 설정 없이 쓸 수 있다. `grid-cols-15`처럼 그리드 열 수도 마찬가지다.
- **새 변형**: `starting:`(`@starting-style`), `not-*`, `inert:` 등이 추가됐다.
- **그라디언트 확장**: `bg-gradient-to-r`이 `bg-linear-to-r`로 이름이 바뀌었고, `bg-linear-45` 같은 각도 지정, `bg-radial`, `bg-conic`이 추가됐다.

```html
<div class="@container">
  <div class="grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-4">
    <!-- 화면 폭이 아니라 부모 컨테이너 폭에 따라 열 수가 바뀐다 -->
  </div>
</div>
```

## 호환성에서 주의할 점

클래스 문법이 비슷하다 보니 업그레이드 후 "어딘가 미묘하게 달라진" 화면을 만나기 쉽다. 자주 마주치는 변경을 정리했다.

### 이름이 바뀐 유틸리티

스케일 이름을 일관되게 맞추면서 접미사 없는 기본값이 한 단계씩 밀렸다.

| v3 | v4 |
| --- | --- |
| `shadow-sm` | `shadow-xs` |
| `shadow` | `shadow-sm` |
| `rounded-sm` | `rounded-xs` |
| `rounded` | `rounded-sm` |
| `blur-sm` | `blur-xs` |
| `blur` | `blur-sm` |
| `outline-none` | `outline-hidden` |
| `ring` | `ring-3` |

v3의 `shadow`를 v4에서 그대로 쓰면 에러 없이 다른 크기의 그림자가 나오므로 특히 조심해야 한다.

### 제거된 유틸리티

- `bg-opacity-*`, `text-opacity-*`, `border-opacity-*` 등 투명도 유틸리티는 제거됐다. `bg-black/50` 같은 투명도 수정자를 쓴다.
- `flex-shrink-*`, `flex-grow-*`는 `shrink-*`, `grow-*`로 대체됐다. v3에서도 이미 짧은 이름이 권장되던 것이다.

### 기본값 변경

- `border`의 기본 색이 `gray-200`에서 `currentColor`로 바뀌었다. 색을 지정하지 않은 테두리는 글자색을 따라간다.
- `ring`의 기본 두께가 3px에서 1px로, 기본 색이 `blue-500`에서 `currentColor`로 바뀌었다.
- 버튼의 기본 커서가 `pointer`에서 브라우저 기본값(`default`)으로 바뀌었다.
- `hover:`는 hover를 지원하는 기기(`@media (hover: hover)`)에서만 적용된다.

### 문법 변경

- 변형을 겹칠 때 적용 순서가 오른쪽에서 왼쪽이 아니라 왼쪽에서 오른쪽으로 바뀌었다(`*:first:` 같은 조합에 영향).
- CSS 변수를 쓰는 임의 값은 `bg-[--brand]` 대신 `bg-(--brand)`로 쓴다.
- `!important` 수정자는 `!flex` 대신 `flex!`처럼 뒤에 붙이는 것이 새 문법이다.

### 다크 모드

다크 모드가 "자동으로 켜졌다"는 설명을 종종 보는데, 정확하지 않다. v3도 v4도 기본 `dark:`는 OS 설정(`prefers-color-scheme`)을 따른다. 달라진 것은 클래스로 전환하는 방법이다. v3에서는 `darkMode: 'class'`를 설정했지만, v4에서는 CSS에서 변형을 재정의한다.

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

이 설정이 없으면 `<html class="dark">`를 붙여도 `dark:` 스타일은 OS 설정만 따른다.

## v3에서 마이그레이션하기

공식 업그레이드 도구가 의존성 갱신, 설정 파일의 CSS 변환, 템플릿 안의 클래스 이름 변경을 대부분 자동으로 처리한다. Node.js 20 이상이 필요하다.

```bash
npx @tailwindcss/upgrade
```

변경 범위가 넓으므로 새 브랜치에서 실행하고, diff를 꼼꼼히 확인한 뒤 화면을 직접 비교해 보는 것이 좋다. 도구가 처리하지 못한 부분은 위의 호환성 항목을 기준으로 손본다.

설정 파일을 당장 옮기기 어렵다면 기존 `tailwind.config.js`를 그대로 불러올 수도 있다. 다만 `corePlugins`, `safelist`, `separator` 옵션은 v4에서 지원하지 않는다.

```css
@import "tailwindcss";
@config "../tailwind.config.js";
```

## v4 방식으로 다시 써 보기

### 런타임 테마 전환

v4의 유틸리티는 테마 값을 CSS 변수로 참조한다. 그래서 `@theme`에 정의한 변수를 특정 선택자 아래에서 다시 정의하면, 클래스를 바꾸지 않고도 테마를 전환할 수 있다.

```css
@import "tailwindcss";

@theme {
  --color-primary: #1e40af;
  --color-secondary: #9333ea;
}

@layer base {
  [data-theme="light"] {
    --color-primary: #3b82f6;
    --color-secondary: #a855f7;
  }
}
```

```html
<section data-theme="light">
  <div class="bg-primary p-4 text-white">
    <p class="text-secondary">data-theme만 바꾸면 색이 바뀐다</p>
  </div>
</section>
```

v3에서 같은 일을 하려면 `bg-[var(--theme-primary)]`처럼 임의 값을 쓰거나 설정 파일에서 색을 CSS 변수로 연결해야 했다. v4에서는 `bg-primary`라는 의미 있는 이름을 그대로 쓴다.

### 사용자 정의 유틸리티

v3에서는 `@layer utilities`나 JavaScript 플러그인의 `addUtilities`로 유틸리티를 추가했다. v4에서는 `@utility` 지시문을 쓴다. 이렇게 정의한 유틸리티에도 `hover:`, `lg:` 같은 접두사가 그대로 붙는다.

```css
@utility text-stroke {
  -webkit-text-stroke: 1px black;
}
```

기존 JavaScript 플러그인은 `@plugin`으로 불러온다.

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

### @apply와 @reference

`@apply`는 v4에서도 쓸 수 있다. 메인 CSS 파일에서는 그대로 쓰면 된다.

```css
@import "tailwindcss";

@theme {
  --color-primary: #1e40af;
}

@layer components {
  .btn-primary {
    @apply rounded-lg bg-primary px-4 py-2 font-bold text-white;
  }
}
```

다만 Vue나 Svelte 컴포넌트의 `<style>` 블록, CSS 모듈처럼 별도로 처리되는 스타일시트에서는 테마 정보를 알 수 없다. 이때는 `@reference`로 메인 CSS를 참조해야 한다. 참조는 스타일을 중복 출력하지 않는다.

```vue
<style scoped>
@reference "../assets/main.css";

h1 {
  @apply text-2xl font-bold text-primary;
}
</style>
```

## 정리

- v4는 설정을 `tailwind.config.js`에서 CSS의 `@theme`로 옮겼고, `@import "tailwindcss"` 한 줄로 시작한다. 템플릿 경로는 자동으로 탐색한다.
- 새 엔진과 Lightning CSS 통합으로 빌드가 빨라지고 `autoprefixer` 같은 부가 도구가 필요 없어졌다. 대신 최신 브라우저(Safari 16.4, Chrome 111, Firefox 128 이상)가 필요하다.
- `shadow`, `rounded`, `blur` 같은 기본 스케일 이름이 한 단계씩 밀렸고, 테두리·링 기본값이 바뀌었다. 업그레이드는 `npx @tailwindcss/upgrade`로 시작하되 화면 비교는 직접 하자.
- 테마 값이 CSS 변수가 되면서 런타임 테마 전환이 훨씬 자연스러워졌다.

## 참고

- [Tailwind CSS v4.0 발표](https://tailwindcss.com/blog/tailwindcss-v4)
- [Upgrade guide](https://tailwindcss.com/docs/upgrade-guide)
- [Theme variables](https://tailwindcss.com/docs/theme)
- [Functions and directives](https://tailwindcss.com/docs/functions-and-directives)
$body22$, '2025-03-14T08:51:50.153Z'::timestamptz, 'posts/Tailwindcss-V4%EA%B0%80-%EB%82%98%EC%99%94%EC%8A%B5%EB%8B%88%EB%8B%A4'),
  (23, 'agentica-typescript-function-calling', 'Agentica로 TypeScript 함수를 LLM Function Calling에 연결하기', 'TypeScript 타입과 주석에서 Function Calling 스키마를 만들어 주는 Agentica와 Typia의 동작 방식, 설치와 기본 사용법을 정리한다.', array['TypeScript', 'AI']::text[], $body23$
LLM에게 날씨 조회나 상품 검색 같은 실제 작업을 맡기려면, 호출할 수 있는 함수의 이름·설명·매개변수를 JSON 스키마로 알려 줘야 한다. 이 스키마를 손으로 관리하다 보면 코드와 스키마가 금세 어긋난다. [Agentica](https://github.com/wrtnlabs/agentica)는 이 문제를 TypeScript 타입으로 풀려는 오픈소스 라이브러리로, 함수 시그니처와 주석에서 스키마를 자동으로 만들어 LLM에 연결해 준다.

이 글에서는 Agentica가 어떤 원리로 동작하는지와 기본 사용법을 정리한다. 코드와 API는 작성 당시(2025년 3월) 버전 기준이며, 이후 바뀌었을 수 있으니 실제로 적용할 때는 공식 저장소의 최신 문서를 확인하길 권한다.

## LLM Function Calling

Function Calling은 LLM이 외부 데이터에 접근하거나 특정 동작을 수행할 수 있게 하는 방식이다. 예를 들어 "오늘 날씨 어때?"라는 질문을 받으면, LLM은 직접 답을 지어내는 대신 날씨 조회 함수를 호출하겠다는 요청과 인자를 돌려준다. 애플리케이션이 그 함수를 실제로 실행하고 결과를 다시 LLM에 넘기면, LLM이 결과를 바탕으로 답변을 완성한다.

여기서 LLM은 함수를 직접 실행하지 않는다는 점이 중요하다. LLM이 하는 일은 **어떤 함수를 어떤 인자로 호출할지 고르는 것**이고, 그 판단의 근거가 바로 함수 스키마다.

```json
{
  "name": "getWeather",
  "description": "지정한 도시의 오늘 날씨를 조회한다.",
  "parameters": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "도시 이름" }
    },
    "required": ["city"]
  }
}
```

함수가 몇 개뿐이면 직접 써도 되지만, 수십 개로 늘어나고 매개변수 구조가 바뀔 때마다 스키마를 함께 고쳐야 한다면 유지보수 부담이 커진다. 스키마가 틀리면 LLM은 잘못된 인자로 함수를 호출한다.

## Agentica의 접근 방식

Agentica는 스키마를 사람이 쓰는 대신 TypeScript 컴파일러가 만들게 한다. 그 역할을 하는 것이 같은 팀이 만든 [Typia](https://typia.io/)다.

- **컴파일 타임 스키마 생성**: Typia는 TypeScript 컴파일러 플러그인(트랜스포머)으로 동작한다. `typia.llm.application<클래스, 모델>()`을 호출하면 빌드 과정에서 클래스의 메서드 타입을 분석해 Function Calling 스키마로 바꿔 넣는다. 타입이 곧 스키마이므로 둘이 어긋날 일이 없다.
- **주석이 곧 설명**: 메서드와 속성에 단 JSDoc 주석이 스키마의 `description`으로 들어간다. LLM은 이 설명을 읽고 어떤 함수를 언제 호출할지 판단하므로, 주석을 잘 쓰는 것이 곧 프롬프트를 잘 쓰는 일이 된다.
- **인자 검증과 재시도**: LLM이 타입에 맞지 않는 인자를 만들어 내는 경우가 있다. Agentica는 Typia의 런타임 검증으로 인자를 확인하고, 틀렸다면 어떤 부분이 틀렸는지 LLM에 알려 다시 생성하게 한다.
- **여러 종류의 컨트롤러**: TypeScript 클래스뿐 아니라 OpenAPI(Swagger) 문서로 정의된 HTTP API도 컨트롤러로 연결할 수 있다.

데코레이터나 별도의 설정 파일 없이, 평범한 클래스와 타입, 주석만으로 동작한다는 점이 핵심이다.

## 설치와 설정

### 프로젝트 초기화

```bash
mkdir agentica-test && cd agentica-test

npm init -y
npm i -D typescript
npx tsc --init

npm i @agentica/core openai typia
```

OpenAI SDK의 패키지 이름은 `openai`다.

### Typia 설정

Typia는 컴파일 단계에서 코드를 변환하므로 TypeScript 컴파일러에 플러그인을 연결해야 한다. 설정 마법사가 필요한 의존성 설치와 `tsconfig.json` 수정을 대신해 준다.

```bash
npx typia setup
```

이후 `tsc`로 빌드하면 `typia.llm.application<...>()` 호출 자리에 생성된 스키마가 들어간다. 트랜스포머가 적용되지 않은 채로 실행하면 Typia 함수가 에러를 내므로, 빌드 결과물을 실행하거나 트랜스포머를 지원하는 실행 도구를 써야 한다.

API 키는 코드에 직접 쓰지 말고 환경 변수로 넘긴다.

```bash
export OPENAI_API_KEY="..."
```

## 기본 사용법

### LLM 연결

컨트롤러 없이 Agentica 인스턴스를 만들면 일반 챗봇처럼 동작한다.

```ts
import { Agentica } from "@agentica/core";
import OpenAI from "openai";

const agent = new Agentica({
  model: "chatgpt",
  vendor: {
    model: "gpt-4o-mini",
    api: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  },
  controllers: [],
});

const histories = await agent.conversate("안녕");
console.log(histories);
```

`model`은 스키마를 어떤 LLM 벤더 형식으로 만들지를, `vendor.model`은 실제로 호출할 모델 이름을 뜻한다. `conversate`는 이번 대화에서 생긴 기록(사용자 메시지, 어시스턴트 응답, 함수 호출 등)을 배열로 돌려준다. 최상위 `await`를 쓰려면 ESM 환경이어야 하며, CommonJS라면 `async` 함수로 감싸면 된다.

### 함수 연결

날씨를 조회하는 클래스를 만들어 컨트롤러로 등록해 보자.

```ts
import { Agentica } from "@agentica/core";
import OpenAI from "openai";
import typia from "typia";

class WeatherService {
  /**
   * 지정한 도시의 오늘 날씨를 조회한다.
   *
   * 사용자가 날씨를 물어볼 때 호출한다.
   */
  getWeather(props: {
    /** 날씨를 조회할 도시 이름 */
    city: string;
  }): { city: string; weather: string } {
    return { city: props.city, weather: "맑음" };
  }
}

const agent = new Agentica({
  model: "chatgpt",
  vendor: {
    model: "gpt-4o-mini",
    api: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  },
  controllers: [
    {
      protocol: "class",
      name: "weather",
      application: typia.llm.application<WeatherService, "chatgpt">(),
      execute: new WeatherService(),
    },
  ],
});

await agent.conversate("서울 날씨 어때?");
```

몇 가지 짚어 둘 점이 있다.

- `protocol: "class"`는 TypeScript 클래스 인스턴스를 실행 대상으로 쓴다는 뜻이다. `execute`에 넘긴 인스턴스의 메서드가 실제로 호출된다.
- 매개변수는 `props` 객체 하나로 받는다. LLM Function Calling의 인자는 이름 붙은 속성을 가진 객체로 전달되므로, 이렇게 객체 하나로 묶는 형태가 스키마와 가장 자연스럽게 맞는다.
- 메서드 위의 주석과 속성 위의 주석이 각각 함수 설명과 매개변수 설명이 된다. 실제 서비스라면 반환값에 하드코딩된 문자열 대신 날씨 API 호출 결과를 넣으면 된다.

이제 사용자가 날씨를 물으면, LLM이 `getWeather`를 `{ city: "서울" }` 인자로 호출하도록 고르고 Agentica가 이를 실행한 뒤 결과를 바탕으로 답변을 만든다. "어떤 기능을 쓸 수 있어?"라고 물으면 등록된 함수 설명을 근거로 답한다.

### 여러 컨트롤러 등록

컨트롤러는 여러 개를 함께 등록할 수 있다. LLM은 대화 맥락에 따라 필요한 함수를 골라 호출한다.

```ts
class NewsService {
  /**
   * 주제와 관련된 최신 뉴스 제목을 조회한다.
   */
  getHeadlines(props: {
    /** 검색할 뉴스 주제 */
    topic: string;
  }): string[] {
    return [`${props.topic} 관련 뉴스 1`, `${props.topic} 관련 뉴스 2`];
  }
}

const agent = new Agentica({
  model: "chatgpt",
  vendor: {
    model: "gpt-4o-mini",
    api: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  },
  controllers: [
    {
      protocol: "class",
      name: "weather",
      application: typia.llm.application<WeatherService, "chatgpt">(),
      execute: new WeatherService(),
    },
    {
      protocol: "class",
      name: "news",
      application: typia.llm.application<NewsService, "chatgpt">(),
      execute: new NewsService(),
    },
  ],
});

await agent.conversate("서울 날씨랑 오늘 IT 뉴스 알려줘");
```

함수가 많아질수록 LLM이 올바른 함수를 고르는 정확도가 중요해진다. 함수 이름을 의도가 드러나게 짓고, 비슷한 함수끼리 언제 무엇을 써야 하는지 주석에 분명히 적어 두는 것이 좋다.

## 정리

- Function Calling에서 LLM은 함수를 직접 실행하지 않고, 스키마를 보고 호출할 함수와 인자를 고른다. 그래서 스키마의 정확성이 중요하다.
- Agentica는 Typia를 이용해 TypeScript 타입과 JSDoc 주석에서 스키마를 컴파일 타임에 생성한다. 코드와 스키마가 어긋나지 않는다.
- 클래스를 만들고 `typia.llm.application`으로 컨트롤러에 등록하면 LLM이 그 메서드를 호출할 수 있다. 인자가 타입에 맞지 않으면 검증 후 재시도한다.
- 주석이 곧 LLM에게 주는 설명이므로, 함수와 매개변수 설명을 꼼꼼히 쓰는 것이 결과 품질을 좌우한다.

## 참고

- [Agentica GitHub 저장소](https://github.com/wrtnlabs/agentica)
- [Typia 공식 문서](https://typia.io/)
- [OpenAI Function Calling 가이드](https://platform.openai.com/docs/guides/function-calling)
$body23$, '2025-03-14T08:56:26.889Z'::timestamptz, 'posts/TypeScript-%EA%B0%9C%EB%B0%9C%EC%9E%90%EB%A5%BC-%EC%9C%84%ED%95%9C-Agentica-%EB%9D%BC%EC%9D%B4%EB%B8%8C%EB%9F%AC%EB%A6%AC-%ED%99%9C%EC%9A%A9')
on conflict (legacy_id) do update set
  slug = excluded.slug,
  title = excluded.title,
  summary = excluded.summary,
  tags = excluded.tags,
  body_markdown = excluded.body_markdown,
  published_at = excluded.published_at,
  comment_term = excluded.comment_term;

update public.blog_posts set created_at = published_at where legacy_id is not null and created_at > published_at;

-- 3. 예전 테이블 보관 --------------------------------------------------------
-- 새 사이트는 posts, categories를 읽지 않는다. 지우지 않고 설명만 남긴다.
-- 새 사이트가 배포되고 문제가 없으면 아래 두 줄로 지워도 된다.
--   drop table public.posts;
--   drop table public.categories;
comment on table public.posts is '보관용. 2026-11-17 blog_posts로 이전됨(blog_posts.legacy_id). 사이트에서 읽지 않음.';
comment on table public.categories is '보관용. 예전 posts의 분류. blog_posts는 tags 배열을 쓴다.';

commit;

-- 확인
select legacy_id, slug, title, tags, reading_minutes, published_at::date from public.blog_posts order by published_at desc;
