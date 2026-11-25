
게시판 목록 페이지가 느리다는 이야기를 듣고 쿼리를 봅니다. 글 목록을 가져오는 쿼리는 인덱스도 잘 타고 2ms 만에 끝납니다. 작성자를 가져오는 쿼리도 기본 키 조회라 1ms도 안 걸립니다. 느린 쿼리가 하나도 없습니다.

그런데 로그를 세어 보면 페이지 하나에 쿼리가 101번 나가고 있습니다. 느린 쿼리가 아니라 **많은 쿼리**가 문제였습니다. 이게 N+1 문제입니다.

## 101번은 어디서 나올까

글 목록과 작성자 이름을 보여 주는 코드를 평범하게 써 보겠습니다.

```js
const posts = await db.query('select id, title, author_id from posts order by id desc limit 100');

for (const post of posts.rows) {
  const author = await db.query('select name from users where id = $1', [post.author_id]);
  post.authorName = author.rows[0]?.name;
}
```

목록을 가져오는 쿼리가 1번, 글마다 작성자를 가져오는 쿼리가 100번. 그래서 1 + N, 흔히 N+1이라고 부릅니다.

코드만 보면 잘못된 곳이 없습니다. "글을 가져오고, 각 글의 작성자를 가져온다"는 생각을 그대로 옮겼으니까요. 그래서 리뷰에서도 잘 걸리지 않습니다.

## 쿼리가 빠른데 왜 느릴까

"쿼리 하나가 1ms면 100번이어도 100ms니 괜찮다"고 계산하기 쉽습니다. 여기서 빠진 게 **왕복 시간**입니다.

쿼리 한 번은 이런 과정을 거칩니다.

1. 애플리케이션이 쿼리를 보낸다.
2. 네트워크를 건너 데이터베이스에 도착한다.
3. 데이터베이스가 쿼리를 해석하고 실행한다.
4. 결과가 네트워크를 건너 돌아온다.
5. 드라이버가 결과를 객체로 바꾼다.

데이터베이스 안에서 실행되는 시간은 3번뿐입니다. 나머지는 쿼리가 아무리 가벼워도 매번 고정으로 듭니다. 로컬 개발 환경에서는 데이터베이스가 같은 컴퓨터에 있어 왕복 비용이 거의 없으니 문제가 안 보입니다. 운영 환경에서 애플리케이션 서버와 데이터베이스가 다른 머신, 다른 가용 영역에 있으면 그 왕복이 100번 쌓입니다.

위 코드처럼 `await`를 반복문 안에서 순서대로 걸면 더 나쁩니다. 앞 쿼리가 돌아와야 다음 쿼리를 보내니, 왕복 시간이 그대로 더해집니다. 게다가 N은 데이터와 함께 자랍니다. 목록이 20개일 때 멀쩡하던 페이지가 페이지 크기를 100으로 늘리는 순간 느려집니다.

데이터베이스 쪽에서도 연결을 오래 붙잡고, 같은 모양의 쿼리를 수없이 처리해야 하니 동시 사용자가 늘수록 부담이 커집니다.

## 방법 1. JOIN으로 한 번에

가장 먼저 떠오르는 해결책은 JOIN입니다.

```sql
select p.id, p.title, u.name as author_name
from posts p
join users u on u.id = p.author_id
order by p.id desc
limit 100;
```

쿼리 한 번, 왕복 한 번입니다. 글 하나에 작성자 하나인 관계(다대일)라면 이 방법이 가장 깔끔합니다.

"JOIN은 느리니 피해야 한다"는 말도 가끔 듣는데, 인덱스가 있는 키로 연결하는 JOIN은 관계형 데이터베이스가 가장 잘하는 일입니다. `users.id`는 기본 키라 이미 인덱스가 있습니다.

JOIN이 불편해지는 건 일대다 관계를 붙일 때입니다. 글마다 댓글을 붙이려고 `comments`를 JOIN하면 댓글 수만큼 글 행이 복제됩니다. 글의 제목과 본문이 댓글 개수만큼 반복해서 전송되고, 애플리케이션에서 다시 묶어야 합니다. 일대다 관계를 두 개 이상 JOIN하면 행 수가 곱으로 늘어납니다. 댓글 10개, 태그 5개면 글 하나가 50행이 됩니다.

## 방법 2. IN으로 묶어서 한 번 더

그래서 쿼리를 두 번으로 나누는 방법을 많이 씁니다. 먼저 글을 가져오고, 필요한 작성자 ID를 모아 한 번에 가져옵니다.

```js
const posts = (await db.query(
  'select id, title, author_id from posts order by id desc limit 100',
)).rows;

const authorIds = [...new Set(posts.map((p) => p.author_id))];
const authors = (await db.query(
  'select id, name from users where id = any($1)',
  [authorIds],
)).rows;

const byId = new Map(authors.map((a) => [a.id, a]));
for (const post of posts) {
  post.authorName = byId.get(post.author_id)?.name;
}
```

N이 몇이든 쿼리는 2번입니다. `where id = any($1)`는 PostgreSQL에서 배열 하나를 매개변수로 넘기는 방식으로, `where id in (...)`과 같은 일을 합니다. 값 개수에 따라 쿼리 문자열이 바뀌지 않아서 매개변수 처리도 간단합니다.

같은 사람이 쓴 글이 많으면 같은 ID가 반복되니 `Set`으로 한 번 걸러 줍니다. `IN`이나 `any`의 결과는 넘긴 ID 순서대로 오지 않으므로, 결과 순서를 믿지 말고 `Map`으로 ID를 기준으로 다시 맞춥니다. 탈퇴한 사용자처럼 짝이 없는 ID가 있을 수 있으니 없는 경우도 처리합니다.

반대 방향에는 인덱스가 필요합니다. 글 목록에 댓글을 붙인다면 `where post_id = any($1)`가 되고, 이때 `comments.post_id`에 인덱스가 있어야 합니다. PostgreSQL은 외래 키를 만들어도 참조하는 쪽 컬럼에 인덱스를 자동으로 만들지 않습니다.

## ORM이 숨기는 N+1

직접 SQL을 쓰면 반복문 안의 쿼리가 눈에 보입니다. ORM을 쓰면 보이지 않습니다.

```js
const posts = await Post.findAll({ limit: 100 });
for (const post of posts) {
  console.log(post.author.name); // 여기서 쿼리가 나간다
}
```

`post.author`는 평범한 속성 접근처럼 보이지만, 지연 로딩(lazy loading)을 쓰는 ORM에서는 처음 접근하는 순간 쿼리를 보냅니다. 쓸지 안 쓸지 모르는 관계를 미리 가져오지 않으려는 합리적인 설계지만, 반복문 안에서 접근하면 그대로 N+1이 됩니다. 템플릿에서 `{{ post.author.name }}`을 출력해도 똑같습니다. 템플릿 안에서 쿼리가 나가는 줄 모르고 지나치기 쉽습니다.

그래서 ORM마다 "이 관계를 미리 가져와라"라고 알려 주는 방법이 있습니다.

- Django: `select_related('author')`는 JOIN으로, `prefetch_related('comments')`는 별도 쿼리와 IN으로 가져옵니다. 다대일에는 앞의 것, 일대다와 다대다에는 뒤의 것을 씁니다.
- Rails(Active Record): `includes`, `preload`, `eager_load`로 미리 가져옵니다.
- JPA/Hibernate: JPQL의 `join fetch`, `@EntityGraph`, 또는 Hibernate의 배치 크기 설정(`@BatchSize`)을 씁니다.

JPA에서는 "연관 관계를 즉시 로딩(`FetchType.EAGER`)으로 바꾸면 N+1이 사라진다"는 오해가 자주 보입니다. JPQL로 글 목록을 조회하면 Hibernate는 먼저 쿼리대로 글만 가져오고, 그다음 즉시 로딩 설정을 지키려고 글마다 작성자를 따로 조회할 수 있습니다. 가져오는 시점이 앞당겨질 뿐 쿼리 수는 그대로입니다. 쓰지 않는 화면에서도 매번 가져오게 되니 오히려 손해입니다. 기본은 지연 로딩으로 두고, 필요한 조회에서 명시적으로 함께 가져오는 쪽이 낫습니다.

## GraphQL에서는 구조적으로 생깁니다

GraphQL은 필드마다 리졸버가 따로 실행됩니다.

```graphql
query {
  posts(first: 100) {
    title
    author { name }
  }
}
```

`posts` 리졸버가 글 100개를 돌려주면, `Post.author` 리졸버가 글마다 한 번씩 100번 실행됩니다. 리졸버 안에서 그냥 `select ... where id = $1`을 하면 N+1이 그대로 생깁니다. 리졸버는 다른 리졸버의 존재를 모르니 스스로 요청을 묶을 수 없습니다.

이 문제를 풀려고 나온 도구가 DataLoader입니다. 리졸버는 "이 ID의 사용자를 줘"라고 `load(id)`만 부르고, DataLoader가 같은 실행 틱 안에 들어온 요청을 모아 배치 함수를 한 번 부릅니다.

```js
import DataLoader from 'dataloader';

function createLoaders(db) {
  return {
    user: new DataLoader(async (ids) => {
      const { rows } = await db.query('select id, name from users where id = any($1)', [ids]);
      const byId = new Map(rows.map((u) => [u.id, u]));
      return ids.map((id) => byId.get(id) ?? null); // ids와 같은 순서, 같은 길이로
    }),
  };
}

const resolvers = {
  Post: {
    author: (post, args, context) => context.loaders.user.load(post.author_id),
  },
};
```

배치 함수의 규칙은 하나입니다. **받은 키 배열과 같은 길이, 같은 순서로 결과를 돌려준다.** 방법 2에서 `Map`으로 순서를 맞춘 것과 같은 이유입니다.

DataLoader는 같은 키를 한 번만 가져오도록 캐시도 합니다. 그래서 **요청마다 새로 만들어야 합니다.** 서버 전역에 하나 두면 사용자 A의 요청에서 가져온 데이터가 사용자 B에게 보일 수 있고, 데이터가 바뀌어도 캐시가 계속 남습니다. 보통 위 코드처럼 요청 컨텍스트를 만들 때마다 `createLoaders()`를 부릅니다.

## Supabase에서는 관계를 select 안에 씁니다

Supabase 클라이언트로 작업하면 N+1이 브라우저에서 생깁니다.

```js
const { data: posts } = await supabase.from('posts').select('id, title, author_id').limit(100);

const withAuthors = await Promise.all(
  posts.map(async (post) => {
    const { data } = await supabase.from('profiles').select('name').eq('id', post.author_id).single();
    return { ...post, author: data };
  }),
);
```

`Promise.all`로 병렬로 보냈으니 괜찮아 보이지만, 브라우저에서 HTTP 요청 101개가 나갑니다. 요청마다 헤더와 인증 토큰이 붙고, 브라우저의 동시 연결 수 제한에도 걸립니다.

Supabase의 REST API는 PostgREST로 만들어져 있고, PostgREST는 외래 키 관계를 보고 연관 데이터를 함께 가져오는 기능(resource embedding)을 제공합니다.

```js
const { data } = await supabase
  .from('posts')
  .select('id, title, author:profiles(name)')
  .order('id', { ascending: false })
  .limit(100);

// data[0] → { id: 42, title: '...', author: { name: '김이랑' } }
```

`author:profiles(name)`은 "외래 키로 연결된 `profiles`에서 `name`을 가져와 `author`라는 이름으로 붙여라"라는 뜻입니다. 요청은 한 번이고, 데이터베이스에서도 한 번의 쿼리로 처리됩니다. 일대다도 같은 문법입니다. `select('id, title, comments(id, body)')`라고 쓰면 각 글에 댓글 배열이 붙습니다.

PostgREST는 스키마의 외래 키로 관계를 찾습니다. 외래 키 없이 ID만 저장해 두었다면 임베딩할 수 없습니다. 같은 테이블로 가는 외래 키가 둘이면 어느 쪽인지 정해 줘야 합니다. `posts`에 `author_id`와 `editor_id`가 둘 다 `profiles`를 가리킨다면 `author:profiles!author_id(name)`처럼 `!` 뒤에 컬럼이나 제약 조건 이름을 적습니다.

RLS는 임베딩된 테이블에도 적용됩니다. `profiles`를 읽을 권한이 없으면 `author`가 `null`로 옵니다. 쿼리가 틀렸다고 착각하기 쉽습니다.

## 쿼리 수를 세는 습관

N+1은 느린 쿼리 로그에 잡히지 않습니다. 하나하나는 빠르니까요. 그래서 시간이 아니라 **개수**를 봐야 합니다.

가장 쉬운 건 ORM 로그를 켜는 것입니다. Prisma는 `new PrismaClient({ log: ['query'] })`, Django는 `DEBUG = True`일 때 `django.db.connection.queries`, Hibernate는 `hibernate.show_sql`이나 통계(`hibernate.generate_statistics`)로 실행된 쿼리를 볼 수 있습니다. 페이지 하나를 열고 같은 모양의 쿼리가 줄줄이 찍히면 N+1입니다.

데이터베이스에서 셀 수도 있습니다. PostgreSQL의 `pg_stat_statements` 확장은 쿼리 모양별 실행 횟수(`calls`)와 총 시간을 모아 줍니다. 평균 시간은 짧은데 `calls`가 유난히 많은 쿼리가 후보입니다. 개발 환경이라면 `log_statement = 'all'`로 모든 쿼리를 남겨 볼 수도 있습니다. 클라이언트에서 직접 데이터를 가져온다면 DevTools Network 패널에서 같은 주소로 가는 요청이 줄지어 있는지 봅니다.

찾아서 고친 뒤에는 테스트로 고정해 둡니다. Django의 `assertNumQueries`처럼 "이 화면은 쿼리를 3번만 쓴다"를 테스트로 박아 두면, 누군가 템플릿에 관계 접근을 하나 추가했을 때 바로 알 수 있습니다.

## 참고

- [PostgREST - Resource Embedding](https://docs.postgrest.org/en/stable/references/api/resource_embedding.html)
- [Supabase - Querying Joins and Nested tables](https://supabase.com/docs/guides/database/joins-and-nesting)
- [GraphQL DataLoader (GitHub)](https://github.com/graphql/dataloader)
- [Django - QuerySet API: select_related, prefetch_related](https://docs.djangoproject.com/en/stable/ref/models/querysets/)
- [PostgreSQL - pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)
