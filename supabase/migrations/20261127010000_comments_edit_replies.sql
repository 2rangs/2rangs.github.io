-- 댓글 고치기와 답글. Supabase에 comments_edit, comments_replies로 적용한 내용을 합친 기록이다.
-- 고칠 때는 누구든(주인 포함) 쓸 때 정한 비밀번호가 맞아야 한다. 주인이 로그인해 있으면 지우기만 비밀번호 없이 된다.
alter table public.comments add column if not exists edited_at timestamptz;
alter table public.comments add column if not exists parent_id bigint references public.comments (id);

drop function if exists public.list_comments(text);
create function public.list_comments(p_post_key text)
returns table (id bigint, parent_id bigint, nickname text, body text, ip_prefix text, is_owner boolean, created_at timestamptz, edited boolean, deleted boolean)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.parent_id,
         case when c.deleted_at is null then c.nickname else '' end,
         case when c.deleted_at is null then c.body else '' end,
         case when c.deleted_at is null then c.ip_prefix else '' end,
         c.is_owner, c.created_at, c.edited_at is not null and c.deleted_at is null, c.deleted_at is not null
  from public.comments c
  where c.post_key = p_post_key
  order by c.created_at, c.id
$$;
revoke all on function public.list_comments(text) from public;
grant execute on function public.list_comments(text) to anon, authenticated;

-- 주인도 비밀번호를 정해서 쓴다. 답글은 한 단계만이고, 답글에 단 답글은 원래 댓글 아래로 모은다.
drop function if exists public.create_comment(text, text, text, text, text, boolean);
create function public.create_comment(p_post_key text, p_nickname text, p_password text, p_body text, p_ip text, p_owner boolean, p_parent_id bigint default null)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  salt text;
  hash text;
  prefix text;
  parent bigint;
  new_id bigint;
begin
  if not exists (select 1 from public.blog_posts where slug = p_post_key and published_at <= now()) then
    raise exception 'post_not_found';
  end if;
  if p_parent_id is not null then
    select coalesce(c.parent_id, c.id) into parent from public.comments c where c.id = p_parent_id and c.post_key = p_post_key;
    if parent is null then
      raise exception 'parent_not_found';
    end if;
  end if;
  if char_length(btrim(coalesce(p_nickname, ''))) not between 1 and 20 or char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'invalid_input';
  end if;
  if char_length(coalesce(p_password, '')) not between 4 and 50 then
    raise exception 'invalid_password';
  end if;
  select decrypted_secret into salt from vault.decrypted_secrets where name = 'comment_ip_salt';
  hash := encode(extensions.digest(coalesce(p_ip, '') || salt, 'sha256'), 'hex');
  if not p_owner then
    if exists (select 1 from public.comments where ip_hash = hash and created_at > now() - interval '20 seconds') then
      raise exception 'too_fast';
    end if;
    if (select count(*) from public.comments where ip_hash = hash and created_at > now() - interval '1 day') >= 30 then
      raise exception 'too_many';
    end if;
  end if;
  prefix := case
    when coalesce(p_ip, '') ~ '^\d+\.\d+\.\d+\.\d+$' then split_part(p_ip, '.', 1) || '.' || split_part(p_ip, '.', 2)
    when position(':' in coalesce(p_ip, '')) > 0 then split_part(p_ip, ':', 1) || ':' || split_part(p_ip, ':', 2)
    else ''
  end;
  insert into public.comments (post_key, parent_id, nickname, body, ip_prefix, ip_hash, password_hash, is_owner)
  values (p_post_key, parent, btrim(p_nickname), btrim(p_body), case when p_owner then '' else prefix end, hash,
          extensions.crypt(p_password, extensions.gen_salt('bf')), p_owner)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.create_comment(text, text, text, text, text, boolean, bigint) from public, anon, authenticated;
grant execute on function public.create_comment(text, text, text, text, text, boolean, bigint) to service_role;

-- 반환: ok, wrong_password, not_found, invalid_input
create or replace function public.update_comment(p_id bigint, p_password text, p_body text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  target public.comments%rowtype;
begin
  select * into target from public.comments where id = p_id and deleted_at is null;
  if not found then
    return 'not_found';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    return 'invalid_input';
  end if;
  if target.password_hash is null or target.password_hash <> extensions.crypt(coalesce(p_password, ''), target.password_hash) then
    return 'wrong_password';
  end if;
  update public.comments set body = btrim(p_body), edited_at = now() where id = p_id;
  return 'ok';
end;
$$;
revoke all on function public.update_comment(bigint, text, text) from public, anon, authenticated;
grant execute on function public.update_comment(bigint, text, text) to service_role;
