# 김이랑 기술 블로그와 포트폴리오

GitHub Pages로 배포하는 개인 사이트다. `main`에 푸시하면 GitHub Actions가 빌드해서 올린다.

| 주소 | 내용 |
| --- | --- |
| `/` | 소개: 최근 글, 일하는 방식, 맡아 온 일, 기술, 연락처 (`/about/`은 여기로 넘어온다) |
| `/privacy/` | 개인정보처리방침(쿠키·광고·댓글 안내) |
| `/projects/` | 포트폴리오 목록 |
| `/projects/<파일 이름>/` | 프로젝트 상세 |
| `/blog/` | 블로그 목록(연도별, 검색, `?tag=태그` 필터) |
| `/blog/<주소>/` | 글 |
| `/write/` | 로그인 후 글쓰기 |

## 구조

화면은 React로 그리지만, 검색엔진과 링크 미리보기(카카오톡, 슬랙 등)는 자바스크립트를 실행하지 않는다. 그래서 `npm run build`가 두 단계로 돈다.

1. `vite build`가 앱을 만든다.
2. `scripts/prerender.mjs`가 주소마다 완성된 HTML을 만든다. 각 페이지에 제목, 설명, 대표 주소(canonical), Open Graph 태그, 구조화 데이터가 들어가고 본문도 미리 그려져 있다. 글 제목이 들어간 썸네일(`/og/*.png`), `sitemap.xml`, `rss.xml`, `robots.txt`, `404.html`도 같이 만든다.

웹 에디터로 발행한 글은 다시 배포하지 않아도 블로그에 바로 보인다. 아직 글별 HTML이 없는 주소는 `404.html`이 앱을 띄워서 그려 준다. 검색 결과와 링크 미리보기에는 다음 빌드(6시간마다 자동, 또는 Actions에서 수동 실행) 뒤에 반영된다.

## 검색엔진 등록과 애드센스

빌드하면 페이지마다 canonical, Open Graph, 구조화 데이터(BlogPosting, BreadcrumbList, ProfilePage)가 들어가고 `sitemap.xml`(lastmod, priority 포함), `robots.txt`, `rss.xml`이 만들어진다.

- **Google Search Console**: `https://2rangs.github.io/`를 URL 접두어 속성으로 등록하고 사이트맵 `https://2rangs.github.io/sitemap.xml`을 제출한다. 소유 확인 코드는 `src/lib/site.ts`의 `verification.google`에 들어 있다.
- **네이버 서치어드바이저**: 받은 코드를 `verification.naver`에 넣고 배포한 뒤 사이트맵과 RSS를 제출한다.
- **Google AdSense**: 게시자 ID(`ca-pub-…`)를 `src/lib/site.ts`의 `adsense`에 넣고 배포하면 소유 확인 메타 태그, 자동 광고 스크립트, `ads.txt`가 함께 나간다. 심사에 필요한 소개(`/`), 연락처, 개인정보처리방침(`/privacy/`) 페이지는 이미 있다.

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
- **대표 이미지**: 목록 썸네일, 글 머리 이미지, 링크 미리보기에 쓰인다. 가로 1200×630 비율이 잘 맞는다. 비워 두면 링크 미리보기에는 제목으로 만든 썸네일이 쓰인다.
- **중간에 넣기**: 에디터에서 빈 줄 맨 앞에 `/`를 치면 제목, 이미지, 코드 블록, 인용, 참고 상자, 목록, 구분선을 커서 자리에 넣는 메뉴가 뜬다(방향키와 Enter로 고른다). 마크다운 모드에서는 위쪽 도구 막대의 버튼이 커서 자리에 넣는다.
- `> **참고** …`로 시작하는 인용은 글에서 덧붙임 상자로 보인다.

- 글은 Supabase `blog_posts` 테이블에 마크다운으로 저장된다. `published_at`이 비어 있으면 초안이다.
- `updated_at`은 수정할 때 트리거가 갱신하고, `reading_minutes`는 본문 길이로 자동 계산된다.
- 예전 블로그(`posts` 테이블) 글은 `blog_posts`로 옮겼다. `legacy_id`가 예전 글 번호이고, 예전 주소 `/blog/legacy-<번호>/`는 새 주소로 넘어간다. `comment_term`으로 예전 댓글 스레드를 그대로 잇는다.
- 이미지는 Supabase Storage의 공개 버킷 `blog-images`에 올라간다. 버킷이 없으면 1.5MB 이하 이미지만 본문에 직접 들어간다. 예전 글의 이미지는 `public/img/blog/`에 있다.
- 댓글은 giscus로 `2rangs/2rang25` Discussions의 Comments 분류에 저장된다.

### 글 화면의 세부 기능

- 코드 블록은 언어별로 색이 입혀진다(댓글과 같은 GitHub 색). 강조되는 언어는 `src/components/Markdown.tsx`의 목록에 있는 것만이고, 나머지는 색 없이 보인다.
- 제목(##, ###)마다 읽을 수 있는 주소(`#지역-스코프`)와 링크 기호가 붙는다.
- 연재: 글에 `series` 값(DB의 `series` 칸, 또는 `content/posts`의 프론트매터)을 같게 주면 글 위에 연재 목록이 나온다.
- 머리말 버튼으로 밝은/어두운 테마를 고를 수 있다. 고르지 않으면 시스템 설정을 따르고, 댓글 창도 같은 테마를 쓴다(`public/giscus-theme*.css`).
- `rss.xml`에는 글 전문이 들어간다.

### DB 정리 SQL

예전 글 16편은 다듬어서 `content/posts/`에 마크다운으로 함께 배포한다. 그래서 DB가 비어 있어도 블로그에 글이 보인다. DB(`blog_posts`)에 같은 주소의 글이 있으면 DB 쪽이 우선한다.

`supabase/2026-11-17-blog-cleanup.sql`은 스키마를 보강하고 이 글들을 DB로 옮긴다. 옮긴 뒤에는 웹 에디터로 고칠 수 있다. SQL Editor에 붙여 넣고 실행하면 되고, 여러 번 실행해도 결과가 같다. `tags`가 `jsonb`나 `text`로 만들어져 있어도 `text[]`로 바꿔 준다. 새 사이트는 `posts` 테이블을 읽지 않는다.

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

Node.js 20.19 이상(빌드 서버는 24)에서 `npm ci` 후 `npm run dev`를 실행한다. 배포 전에는 `npm run build`와 `npm run lint`로 확인한다.
