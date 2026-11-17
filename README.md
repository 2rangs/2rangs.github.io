# 김이랑 포트폴리오와 블로그

GitHub Pages로 배포하는 개인 사이트다. `main`에 푸시하면 GitHub Actions가 빌드해서 올린다.

| 주소 | 내용 |
| --- | --- |
| `/` | 소개, 스택, 포트폴리오, 방향, AI 코멘트 |
| `/projects/` | 포트폴리오 목록 |
| `/projects/<파일 이름>/` | 프로젝트 상세 |
| `/blog/` | 블로그 목록 |
| `/blog/<주소>/` | 글 |
| `/write/` | 로그인 후 글쓰기 |

## 구조

화면은 React로 그리지만, 검색엔진과 링크 미리보기(카카오톡, 슬랙 등)는 자바스크립트를 실행하지 않는다. 그래서 `npm run build`가 두 단계로 돈다.

1. `vite build`가 앱을 만든다.
2. `scripts/prerender.mjs`가 주소마다 완성된 HTML을 만든다. 각 페이지에 제목, 설명, 대표 주소(canonical), Open Graph 태그, 구조화 데이터가 들어가고 본문도 미리 그려져 있다. 글 제목이 들어간 썸네일(`/og/*.png`), `sitemap.xml`, `rss.xml`, `robots.txt`, `404.html`도 같이 만든다.

웹 에디터로 발행한 글은 다시 배포하지 않아도 블로그에 바로 보인다. 아직 글별 HTML이 없는 주소는 `404.html`이 앱을 띄워서 그려 준다. 검색 결과와 링크 미리보기에는 다음 빌드(6시간마다 자동, 또는 Actions에서 수동 실행) 뒤에 반영된다.

## 검색엔진 등록

사이트맵 주소는 `https://2rangs.github.io/sitemap.xml`이다. Google Search Console과 네이버 서치어드바이저에 사이트를 등록하고, 받은 소유 확인 코드를 `src/lib/site.ts`의 `verification`에 넣으면 메타 태그로 나간다.

## 포트폴리오 추가

`content/projects/`에 마크다운 파일을 추가하고 푸시한다. 파일 이름이 주소가 된다. `_template.md`를 복사해서 쓰면 된다.

- `kind`: `work`(실무) 또는 `personal`(개인 프로젝트)
- `order`: 작을수록 앞에 나온다
- `cover`: 카드와 상세에 쓸 대표 이미지. `public/img/projects/`에 파일을 넣고 `img/projects/파일이름.png`로 적는다
- 본문 이미지는 `![설명](/img/projects/파일이름.png)`로 넣는다

## 블로그 글쓰기

`/write/`에서 Supabase 계정(이메일과 비밀번호)으로 로그인하면 에디터가 열린다. 로그인한 브라우저에서만 메뉴에 글쓰기 링크와 글의 수정 링크가 보인다. 서식이 보이는 에디터와 마크다운 원문을 오가며 쓸 수 있고, 저장은 마크다운으로 된다.

- 주소는 제목에서 자동으로 만들어진다. 한글 제목이면 날짜로 만들어지니 필요하면 고친다.
- 요약을 비워 두면 본문 앞부분으로 채워진다.
- Cmd/Ctrl+S로 저장한다. 쓰던 내용은 브라우저에 자동으로 임시 저장된다.

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
