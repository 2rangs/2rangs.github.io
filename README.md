# 2rang25 포트폴리오와 블로그

GitHub Pages에서 포트폴리오는 루트에, 블로그 목록은 /blog/에, 글은 /posts/<slug>/에 제공한다.

## 글 작성과 배포

1. Supabase Table Editor에서 public.blog_posts에 글을 추가한다.
2. slug에는 영문 소문자, 숫자, 하이픈을 사용한다. title, summary, body_markdown, tags를 입력한다.
3. 초안은 published_at을 비워 둔다. 발행할 준비가 되면 발행일을 지정한다.
4. GitHub Actions에서 Deploy Vite site to Pages를 실행한다. 워크플로는 발행된 글로 HTML과 Pagefind 검색 인덱스를 만든다.

저장소 Actions 변수 SUPABASE_PUBLISHABLE_KEY에 프로젝트의 publishable 키를 설정한다. 기존 프로젝트에서 legacy anon 키를 사용하면 Actions secret SUPABASE_ANON_KEY에 설정한다.

## 로컬 확인

Node.js 24에서 npm ci를 실행한다. 위 두 키 중 하나를 환경변수로 설정한 뒤 BLOG_BASE_PATH를 빈 문자열로 설정하고 npm run build, npm run preview를 실행한다. 포트폴리오만 수정할 때는 npm run dev를 사용한다.

댓글은 2rangs/2rang25 Discussions의 Comments 카테고리에 저장되며, 글의 UUID로 연결한다.
