-- 2026-11-18 Supabase 보안 점검(security advisor) 후 적용한 변경. 운영 DB에 적용 완료.

-- 트리거 함수의 search_path 고정 (함수 안의 테이블 이름은 public을 기준으로 찾는다)
alter function public.handle_category_deletion() set search_path = public, pg_temp;
alter function public.increment_likes() set search_path = public, pg_temp;
alter function public.decrement_likes() set search_path = public, pg_temp;
alter function public.cascade_delete_posttags() set search_path = public, pg_temp;
alter function public.sync_metrics_to_cache() set search_path = public, pg_temp;
alter function public.blog_posts_touch() set search_path = public, pg_temp;

-- ltree 확장을 public 밖으로 (어떤 열도 ltree 타입을 쓰지 않는다)
create schema if not exists extensions;
alter extension ltree set schema extensions;

-- 예전 블로그 테이블: 지금 사이트는 쓰지 않는다. 지우지 않고 공개 읽기만 막는다.
-- 되돌리기: grant select on public.posts, public.categories, public.metricscache to anon, authenticated;
revoke select on public.posts, public.categories, public.metricscache from anon, authenticated;
