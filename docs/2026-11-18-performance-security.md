# 2026-11-18 성능 개선과 보안 점검

PageSpeed Insights 결과(홈, 모바일 67점)를 보고 원인을 찾아 고치고, 같은 날 보안 점검을 했다.

## 성능

### 측정

| 시점 | 모바일 성능 | 모바일 FCP / LCP | 데스크톱 성능 | 데스크톱 LCP | CLS(모바일 / 데스크톱) |
|---|---|---|---|---|---|
| 고치기 전 (PageSpeed) | 67 | 5.0초 / 5.0초 | 86 | 1.6초 | 0.01 / 0.056 |
| hydrate 적용 후 1차 배포 (PageSpeed, 두 번 측정) | 73 · 50 | 3.6초 · 4.2초 | 73 · 87 | 1.1초 | 0.147~0.757 / 0.056~1.045 |
| 글꼴 수정 후 (로컬 Lighthouse, 압축 없는 미리보기 서버) | 70 | 4.4초 / 5.0초 | 98 | 1.0초 | 0 / 0 |

PageSpeed 점수는 실행마다 차이가 크다(같은 배포에서 데스크톱 73과 87). 숫자 하나보다 원인 항목을 본다.

### 원인과 조치

| 원인 | 조치 | 파일 |
|---|---|---|
| 빌드 때 그린 HTML을 `createRoot`가 지우고 다시 그려, 첫 화면이 JS를 기다림(LCP 요소 렌더링 지연 2.5초) | `renderToString` + `hydrateRoot`로 그려 둔 HTML을 이어받음 | `src/main.tsx`, `src/prerender.tsx` |
| 홈 HTML 156KB: 배경 별 `<circle>` 900여 개(77KB), 함께 넣은 글 목록(49KB) | 별을 투명도별 `<path>` 10개로 묶고 첫 화면 뒤에 그림. 화면에 안 보이는 글의 요약은 뺌 → 70KB | `src/components/NightSky.tsx`, `src/pages/About.tsx` |
| 커버 PNG(최대 1.4MB)를 작은 크기로 표시 | 320/600/1200px WebP를 만들어 `srcset`으로 제공. WebP 목록에 없는 이미지는 원본 PNG | `scripts/thumbs.mjs`, `src/lib/cover.ts` |
| 글 화면에서 Markdown 컴포넌트 객체를 매번 새로 만들어 링크·코드 블록이 다시 마운트됨 | 컴포넌트 객체를 모듈 수준으로 올림 | `src/components/Markdown.tsx` |
| 다크 테마 보조 글자 대비 4.43:1 | `--faint`를 `#8f8f8f`로(5.04:1) | `src/site.css` |
| hydrate 뒤 그려 둔 HTML이 먼저 보이면서, Pretendard가 늦게 도착해 바뀔 때 화면 전체가 밀림(CLS 최대 1.045) | Pretendard `font-display`를 `optional`로 바꿈(빌드 때 변환) | `vite.config.js` |

### 새 커버를 넣을 때

`node scripts/thumbs.mjs`를 실행해 WebP를 만들고 `public/img/thumbs/`, `src/lib/thumbs.json`을 함께 커밋한다(cwebp 필요: `brew install webp`). 깜빡해도 원본 PNG가 나오므로 이미지가 깨지지는 않는다.

### 손대지 않은 것

- 애드센스 스크립트(약 340KB): 사용하지 않는 JS 대부분과 모바일 권장사항 81점의 원인. 광고를 유지하는 한 남는다.
- 캐시 수명 10분: GitHub Pages가 정한다.
- 처음 그릴 때 막는 CSS의 절반(압축 기준 약 14KB)이 Pretendard `@font-face`. 따로 늦게 불러오면 재방문 때 글꼴이 바뀌며 화면이 밀려서 그대로 둔다.

## 보안

### 확인 결과 문제없음

- XSS: `dangerouslySetInnerHTML`·raw HTML 없음, 링크는 `javascript:`를 걸러 냄, 페이지에 넣는 JSON은 `</script>`를 이스케이프함.
- 비밀값: 저장소에 커밋된 키·토큰 없음. 코드의 Supabase 키는 공개용 anon 키.
- Supabase RLS(운영 DB 조회): 글 쓰기·수정·삭제와 이미지 업로드는 주인 계정만. anon은 어떤 테이블에도 쓰기 권한 없음. 실제 정책은 `supabase/policies.sql`에 기록.

### 조치

| 항목 | 조치 |
|---|---|
| 포트폴리오 데모가 블로그와 같은 출처에서 실행됨(로그인 세션에 접근 가능) | 데모 iframe에 `sandbox`(allow-same-origin 없음). 대신 캐시를 함께 못 써서 처음 뜨는 데 10초 넘게 걸릴 수 있어 로딩 안내를 띄움 |
| 배포 워크플로 빌드 단계가 배포 권한을 가진 채 다른 저장소의 설치 스크립트를 실행 | `pages: write`, `id-token: write`는 deploy 작업에만. 빌드는 `contents: read`, `pages: read` |
| Pokestra 설치가 실패하면 `npm install`로 최신 버전을 받음 | 잠금 파일(`npm ci`)로만 설치 |
| CSP 없음 | `object-src 'none'; base-uri 'self'; form-action 'self'` 메타 태그(광고 때문에 스크립트 출처는 막지 않음) |
| TipTap `mergeAttributes` 취약점(주인 전용 에디터) | TipTap 3.34, tiptap-markdown 0.9로 올림. v3에 맞춰 StarterKit의 Link를 끄고 `shouldRerenderOnTransaction` 켬 |
| 개발 도구 의존성 취약점 44건 | `npm audit fix`로 32건으로, TipTap 업그레이드 뒤 4건(picomatch, vite 빌드 도구 전용. 고치려면 vite를 6으로 내려야 해서 둠) |
| Supabase 보안 경고 16건 | 트리거 함수 `search_path` 고정, `ltree` 확장을 `extensions` 스키마로, 예전 테이블(posts, categories, metricscache) 공개 읽기 회수 → 3건. `supabase/2026-11-18-security-hardening.sql` |

### 남은 것

- Supabase 경고 3건 중 2건은 `blog_posts`를 누구나 읽을 수 있다는 것으로 의도한 동작. 1건(유출 비밀번호 차단)은 대시보드 설정이며 GitHub 로그인만 쓰므로 영향 없음.
- 데모를 블로그와 완전히 떼려면 다른 도메인에 올려야 한다(2rangs.github.io 아래 프로젝트 페이지는 모두 같은 출처).

## 배포 워크플로 캐시

포트폴리오 저장소 체크아웃을 Node 설정보다 앞으로 옮기고, `setup-node`의 npm 캐시 키에 블로그와 포트폴리오 잠금 파일 4개를 모두 넣었다. 그대로인 동안에는 세 번의 `npm ci`가 캐시에서 설치한다. 포트폴리오 빌드 단계는 캐시 전 25초.
