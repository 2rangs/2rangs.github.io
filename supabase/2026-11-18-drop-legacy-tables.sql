-- 예전 블로그 테이블 categories, metricscache와 쓰지 않는 트리거 함수 5개를 지운다.
-- 사이트는 blog_posts만 읽는다. 지우기 전 데이터는 2026-11-18-legacy-tables-backup.sql에 있다.
-- 되돌리기: 2026-11-18-legacy-tables-backup.sql을 실행한다.
begin;
drop table if exists public.categories;
drop table if exists public.metricscache;
drop function if exists public.handle_category_deletion();
drop function if exists public.increment_likes();
drop function if exists public.decrement_likes();
drop function if exists public.sync_metrics_to_cache();
drop function if exists public.cascade_delete_posttags();
commit;
