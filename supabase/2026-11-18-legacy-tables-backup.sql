-- 2026-11-18 지운 예전 블로그 테이블의 백업(구조 + 데이터 + 함수). 되살리려면 이 파일을 그대로 실행한다.
begin;

create table public.categories (
  id serial primary key,
  name character varying not null,
  description text,
  parent_id integer references public.categories(id) on delete set null,
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now()
);

insert into public.categories (id, name, description, parent_id, created_at, updated_at) values
  (1, '개발', '프로그래밍에 관련된 모든 내용', null, '2024-11-28T10:08:44.898759', '2024-11-28T10:08:44.898759'),
  (2, '일반', '일상 이야기를 적는 공간', null, '2024-12-03T23:49:58.18594', '2024-12-03T23:49:58.18594'),
  (3, '디자인', 'ui/ux', null, '2024-12-03T23:52:14.32141', '2024-12-03T23:52:14.32141'),
  (4, '프로젝트', '포트폴리오 모음', null, '2024-12-03T23:52:45.53615', '2024-12-03T23:52:45.53615'),
  (8, 'DevOps', 'CI/CD, Docker, 배포 전략', 1, '2024-12-03T23:57:54.861513', '2024-12-03T23:57:54.861513'),
  (9, '취미', '취미로 글을 작성해보자.', 2, '2024-12-03T23:57:59.48411', '2024-12-03T23:57:59.48411'),
  (10, '여행', '쉴땐 쉬자.', 2, '2024-12-03T23:57:59.48411', '2024-12-03T23:57:59.48411'),
  (11, 'UIUX', '디자이너가 없으면 내가 해야지 1', 3, '2024-12-03T23:59:17.010444', '2024-12-03T23:59:17.010444'),
  (12, '그래픽 디자인', '디자이너가 없으면 내가 해야지 2', 3, '2024-12-03T23:59:17.010444', '2024-12-03T23:59:17.010444'),
  (13, '진행 중', '현재 진행 중인 프로젝트', 4, '2024-12-03T23:59:22.126686', '2024-12-03T23:59:22.126686'),
  (14, '완료', '나의 뼈와 살', 4, '2024-12-03T23:59:22.126686', '2024-12-03T23:59:22.126686'),
  (29, 'AI', '어느새 개발자 필수소양이 되버린것', 1, '2024-12-04T06:28:03.02011', '2024-12-04T06:28:03.02011'),
  (30, 'JavaScript', 'No java, This is JavaScript', 1, '2024-12-07T08:04:47.577384', '2024-12-07T08:04:47.577384'),
  (31, 'TypeScript', 'JavaScript Type Extention', 1, '2024-12-07T08:05:32.414683', '2024-12-07T08:05:32.414683'),
  (32, 'CSS', 'css, sass, scss, tailwind 등에 대해 알아보자.', 1, '2024-12-12T06:10:28.264295', '2024-12-12T06:10:28.264295'),
  (33, 'Python', '파이썬에 대해 알아봅시다.', 1, '2024-12-12T06:12:04.19446', '2024-12-12T06:12:04.19446'),
  (34, '알고리즘', '알고리즘 관련 항목', 1, '2024-12-18T02:13:43.505817', '2024-12-18T02:13:43.505817'),
  (35, '일상', null, 2, '2024-12-18T04:03:58.837707', '2024-12-18T04:03:58.837707'),
  (36, 'git', 'git과 관련된 글 목록', 1, '2024-12-18T05:18:11.842792', '2024-12-18T05:18:11.842792');
select setval('public.categories_id_seq', (select max(id) from public.categories));

create table public.metricscache (
  post_id integer primary key,
  views integer default 0,
  likes integer default 0,
  updated_at timestamp without time zone default now()
);

insert into public.metricscache (post_id, views, likes, updated_at) values
  (1, 0, 0, '2024-12-04T04:27:45.524146'),
  (2, 0, 1, '2024-12-07T04:39:18.883054'),
  (3, 0, 99, '2025-02-25T07:07:21.355837'),
  (4, 0, 2, '2024-12-09T00:20:02.441224'),
  (5, 0, 2, '2024-12-13T01:42:19.051803'),
  (6, 0, 2, '2024-12-18T07:19:38.810665'),
  (7, 0, 1, '2024-12-16T07:53:41.52154'),
  (8, 0, 1, '2024-12-16T23:55:21.3397'),
  (9, 0, 1, '2024-12-18T03:58:27.100545'),
  (10, 0, 1, '2024-12-18T05:14:44.122467'),
  (11, 0, 2, '2024-12-19T01:00:43.667296'),
  (17, 0, 0, '2025-02-28T00:21:28.307092'),
  (18, 0, 0, '2025-02-28T00:35:58.061156'),
  (19, 0, 0, '2025-02-28T00:56:56.135405'),
  (20, 0, 0, '2025-02-28T02:27:43.658887'),
  (21, 0, 0, '2025-03-14T08:46:53.401714'),
  (22, 0, 0, '2025-03-14T08:53:03.60207'),
  (23, 0, 0, '2025-03-14T08:57:42.627471');

alter table public.categories enable row level security;
alter table public.metricscache enable row level security;
revoke select on public.categories, public.metricscache from anon, authenticated;

create or replace function public.handle_category_deletion() returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $$
begin
  update categories set parent_id = null where parent_id = old.id;
  return old;
end;
$$;
create trigger handle_category_deletion_trigger before delete on public.categories for each row execute function public.handle_category_deletion();

-- 아래 함수들은 이미 없는 posts, posttags 테이블을 가리킨다. 트리거에 걸려 있지 않았다.
create or replace function public.increment_likes() returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $$
begin
  update posts set likes = likes + 1 where id = new.post_id;
  return new;
end;
$$;
create or replace function public.decrement_likes() returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $$
begin
  update posts set likes = greatest(likes - 1, 0) where id = old.post_id;
  return old;
end;
$$;
create or replace function public.sync_metrics_to_cache() returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $$
begin
  insert into metricscache (post_id, views, likes, updated_at) values (new.id, new.views, new.likes, now())
  on conflict (post_id) do update set views = excluded.views, likes = excluded.likes, updated_at = now();
  return new;
end;
$$;
create or replace function public.cascade_delete_posttags() returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $$
begin
  delete from posttags where tag_id = old.id;
  return old;
end;
$$;

commit;
