# 김이랑 포트폴리오와 블로그

GitHub Pages로 배포하는 개인 사이트다. `main`에 푸시하면 GitHub Actions가 빌드해서 올린다.

| 주소 | 내용 |
| --- | --- |
| `/` | 소개, 스택, 포트폴리오, 방향, AI 코멘트 |
| `/projects/` | 포트폴리오 목록. `/projects/?p=<파일 이름>`은 상세 |
| `/blog/` | 블로그 목록. `/blog/?p=<주소>`는 글 |
| `/write/` | 로그인 후 글쓰기 |

## 포트폴리오 추가

`content/projects/`에 마크다운 파일을 추가하고 푸시한다. 파일 이름이 주소가 된다. `_template.md`를 복사해서 쓰면 된다.

- `kind`: `work`(실무) 또는 `personal`(개인 프로젝트)
- `order`: 작을수록 앞에 나온다
- `cover`: 카드와 상세에 쓸 대표 이미지. `public/img/projects/`에 파일을 넣고 `img/projects/파일이름.png`로 적는다
- 본문 이미지는 `![설명](../img/projects/파일이름.png)`로 넣는다

## 블로그 글쓰기

`/write/`에서 Supabase 계정으로 로그인하면 에디터가 열린다. 서식이 보이는 에디터와 마크다운 원문을 오가며 쓸 수 있고, 저장은 마크다운으로 된다. 발행하면 다시 배포하지 않아도 바로 블로그에 나온다.

- 글은 Supabase `blog_posts` 테이블에 저장된다. `published_at`이 비어 있으면 초안이다.
- 예전 블로그 글(`posts` 테이블)은 읽기 전용으로 함께 보여 준다.
- 이미지는 Supabase Storage의 공개 버킷 `blog-images`에 올라간다. 버킷이 없으면 1.5MB 이하 이미지만 본문에 직접 들어간다.
- 댓글은 giscus로 `2rangs/2rang25` Discussions의 Comments 분류에 저장된다.

### Supabase에 필요한 권한

글쓰기와 이미지 업로드가 막히면 SQL Editor에서 아래를 실행한다. `<내 사용자 ID>`는 Authentication > Users에서 확인한다.

```sql
alter table public.blog_posts enable row level security;

create policy "published posts are public" on public.blog_posts
  for select using (published_at is not null);

create policy "owner manages posts" on public.blog_posts
  for all to authenticated
  using (auth.uid() = '<내 사용자 ID>')
  with check (auth.uid() = '<내 사용자 ID>');

insert into storage.buckets (id, name, public) values ('blog-images', 'blog-images', true)
  on conflict (id) do nothing;

create policy "owner uploads images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'blog-images' and auth.uid() = '<내 사용자 ID>');
```

## 로컬 확인

Node.js 20.19 이상에서 `npm ci` 후 `npm run dev`를 실행한다. 배포 전에는 `npm run build`와 `npm run lint`로 확인한다.
