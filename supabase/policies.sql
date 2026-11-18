-- 2026-11-18 운영 DB에서 확인한 실제 RLS 정책. (pg_policy 조회 결과를 그대로 옮김)
-- 글쓰기·수정·삭제와 이미지 업로드는 주인 계정(auth.uid)만, 공개된 글 읽기는 누구나.
-- 공개(anon) 역할은 public 스키마의 모든 테이블에 INSERT·UPDATE·DELETE 권한이 없다.
-- 정책을 바꾸면 이 파일도 함께 고친다.

alter table public.blog_posts enable row level security;

create policy "Read published blog posts" on public.blog_posts
  for select to anon, authenticated using (published_at <= now());
create policy "Owner reads drafts" on public.blog_posts
  for select to authenticated using ((select auth.uid()) = '92193eba-8130-497f-94ff-04531af65136'::uuid);
create policy "Owner creates posts" on public.blog_posts
  for insert to authenticated with check ((select auth.uid()) = '92193eba-8130-497f-94ff-04531af65136'::uuid);
create policy "Owner edits posts" on public.blog_posts
  for update to authenticated
  using ((select auth.uid()) = '92193eba-8130-497f-94ff-04531af65136'::uuid)
  with check ((select auth.uid()) = '92193eba-8130-497f-94ff-04531af65136'::uuid);
create policy "Owner deletes posts" on public.blog_posts
  for delete to authenticated using ((select auth.uid()) = '92193eba-8130-497f-94ff-04531af65136'::uuid);

create policy "Owner uploads blog images" on storage.objects
  for insert with check (bucket_id = 'blog-images' and (select auth.uid()) = '92193eba-8130-497f-94ff-04531af65136'::uuid);
create policy "Owner updates blog images" on storage.objects
  for update using (bucket_id = 'blog-images' and (select auth.uid()) = '92193eba-8130-497f-94ff-04531af65136'::uuid);
create policy "Owner deletes blog images" on storage.objects
  for delete using (bucket_id = 'blog-images' and (select auth.uid()) = '92193eba-8130-497f-94ff-04531af65136'::uuid);

-- 예전 블로그 테이블(posts, categories, metricscache)은 RLS가 켜져 있고, 2026-11-18부터 anon·authenticated의 SELECT 권한도 회수했다(2026-11-18-security-hardening.sql).
