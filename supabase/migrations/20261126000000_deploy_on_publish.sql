-- 발행한 글이 생기거나 바뀌거나 지워지면 Edge Function trigger-deploy를 불러 GitHub Pages를 다시 빌드한다.
-- GitHub 토큰은 DB에 두지 않는다(Edge Function secret GITHUB_DEPLOY_TOKEN). DB에는 함수 호출 확인용 값만 Vault에 둔다.
create extension if not exists pg_net;
create schema if not exists private;

-- 호출 확인용 값. 트리거가 헤더에 싣고, Edge Function이 verify_deploy_hook으로 대조한다.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'deploy_hook_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'deploy_hook_secret', 'trigger-deploy Edge Function 호출 확인용');
  end if;
end $$;

create or replace function public.verify_deploy_hook(secret text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  -- 매개변수 이름이 vault.decrypted_secrets의 secret 열과 겹치므로 함수 이름으로 한정한다.
  select coalesce(verify_deploy_hook.secret, '') <> '' and exists (
    select 1 from vault.decrypted_secrets d where d.name = 'deploy_hook_secret' and d.decrypted_secret = verify_deploy_hook.secret
  )
$$;
revoke all on function public.verify_deploy_hook(text) from public, anon, authenticated;
grant execute on function public.verify_deploy_hook(text) to service_role;

-- 문장 단위로 한 번만 부른다(여러 글을 한꺼번에 고쳐도 빌드 요청은 한 번). 초안만 바뀐 경우는 건너뛴다.
create or replace function private.request_deploy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched boolean;
  hook text;
begin
  if tg_op = 'INSERT' then
    select exists (select 1 from new_rows where published_at is not null) into touched;
  elsif tg_op = 'UPDATE' then
    select exists (select 1 from new_rows where published_at is not null)
        or exists (select 1 from old_rows where published_at is not null) into touched;
  else
    select exists (select 1 from old_rows where published_at is not null) into touched;
  end if;
  if not touched then
    return null;
  end if;

  select decrypted_secret into hook from vault.decrypted_secrets where name = 'deploy_hook_secret';
  perform net.http_post(
    url := 'https://wbtbmarooytomtynuvoe.supabase.co/functions/v1/trigger-deploy',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-deploy-hook', hook),
    body := jsonb_build_object('op', tg_op),
    timeout_milliseconds := 10000
  );
  return null;
end;
$$;
revoke all on function private.request_deploy() from public, anon, authenticated;

drop trigger if exists blog_posts_deploy_insert on public.blog_posts;
drop trigger if exists blog_posts_deploy_update on public.blog_posts;
drop trigger if exists blog_posts_deploy_delete on public.blog_posts;
create trigger blog_posts_deploy_insert after insert on public.blog_posts
  referencing new table as new_rows for each statement execute function private.request_deploy();
create trigger blog_posts_deploy_update after update on public.blog_posts
  referencing old table as old_rows new table as new_rows for each statement execute function private.request_deploy();
create trigger blog_posts_deploy_delete after delete on public.blog_posts
  referencing old table as old_rows for each statement execute function private.request_deploy();
