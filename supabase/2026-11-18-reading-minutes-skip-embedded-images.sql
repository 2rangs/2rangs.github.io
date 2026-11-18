-- 본문에 직접 넣은 이미지(data:image/...;base64)는 읽는 시간 계산에서 뺀다.
-- 이미지 한 장이 글자 수만 개로 세어져 읽는 시간이 수천 분으로 나오던 문제.
-- Postgres 15에서는 생성 열의 식을 바꿀 수 없어서 열을 지우고 다시 만든다(값은 자동으로 다시 계산된다).
begin;
alter table public.blog_posts drop column reading_minutes;
alter table public.blog_posts add column reading_minutes integer generated always as (
  greatest(1, round(char_length(regexp_replace(coalesce(body_markdown, ''), '\(data:image/[a-z+]+;base64,[A-Za-z0-9+/=]+\)', '()', 'g'))::numeric / 500.0)::integer)
) stored;
commit;
