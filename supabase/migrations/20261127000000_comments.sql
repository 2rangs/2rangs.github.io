-- 익명 댓글: 닉네임 + 비밀번호(삭제용)로 쓰고, 작성자 IP 앞 두 자리를 함께 보여 준다(디시 방식).
-- 테이블은 직접 읽거나 쓸 수 없다. 읽기는 list_comments(), 쓰기·삭제는 Edge Function comments가
-- service_role로 create_comment()/delete_comment()를 부른다. IP는 Edge Function만 알 수 있기 때문이다.
create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_key text not null,
  nickname text not null check (char_length(nickname) between 0 and 20),
  body text not null check (char_length(body) between 0 and 2000),
  -- 화면에 보이는 IP 앞부분(예: 123.45). 전체 IP는 저장하지 않는다.
  ip_prefix text not null default '',
  -- 도배 방지용. 전체 IP에 비밀 소금을 붙인 SHA-256. 원래 IP로 되돌릴 수 없다.
  ip_hash text not null default '',
  password_hash text,
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists comments_post_created on public.comments (post_key, created_at);
create index if not exists comments_ip_created on public.comments (ip_hash, created_at);
alter table public.comments enable row level security;
revoke all on public.comments from anon, authenticated;

-- IP 해시용 소금. Vault에 둔다.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'comment_ip_salt') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'comment_ip_salt', '댓글 IP 해시 소금');
  end if;
end $$;

-- 글 하나의 댓글. 지운 댓글은 자리만 남기고 내용과 작성자는 비운다.
create or replace function public.list_comments(p_post_key text)
returns table (id bigint, nickname text, body text, ip_prefix text, is_owner boolean, created_at timestamptz, deleted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         case when c.deleted_at is null then c.nickname else '' end,
         case when c.deleted_at is null then c.body else '' end,
         case when c.deleted_at is null then c.ip_prefix else '' end,
         c.is_owner, c.created_at, c.deleted_at is not null
  from public.comments c
  where c.post_key = p_post_key
  order by c.created_at, c.id
$$;
revoke all on function public.list_comments(text) from public;
grant execute on function public.list_comments(text) to anon, authenticated;

-- 댓글 쓰기. Edge Function만 부른다(service_role). 비밀번호는 bcrypt로 저장한다.
create or replace function public.create_comment(p_post_key text, p_nickname text, p_password text, p_body text, p_ip text, p_owner boolean)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  salt text;
  hash text;
  prefix text;
  new_id bigint;
begin
  if not exists (select 1 from public.blog_posts where slug = p_post_key and published_at <= now()) then
    raise exception 'post_not_found';
  end if;
  if char_length(btrim(coalesce(p_nickname, ''))) not between 1 and 20 or char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'invalid_input';
  end if;
  if not p_owner and char_length(coalesce(p_password, '')) not between 4 and 50 then
    raise exception 'invalid_password';
  end if;
  select decrypted_secret into salt from vault.decrypted_secrets where name = 'comment_ip_salt';
  hash := encode(extensions.digest(coalesce(p_ip, '') || salt, 'sha256'), 'hex');
  -- 도배 방지: 같은 IP는 20초에 한 번, 하루 30개까지. 주인은 제한하지 않는다.
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
  insert into public.comments (post_key, nickname, body, ip_prefix, ip_hash, password_hash, is_owner)
  values (
    p_post_key, btrim(p_nickname), btrim(p_body),
    case when p_owner then '' else prefix end, hash,
    case when p_owner then null else extensions.crypt(p_password, extensions.gen_salt('bf')) end,
    p_owner
  )
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.create_comment(text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.create_comment(text, text, text, text, text, boolean) to service_role;

-- 댓글 지우기. 비밀번호가 맞거나 주인이면 지운다. 지운 댓글은 내용과 비밀번호를 비운다.
create or replace function public.delete_comment(p_id bigint, p_password text, p_owner boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.comments%rowtype;
begin
  select * into target from public.comments where id = p_id and deleted_at is null;
  if not found then
    return false;
  end if;
  if not p_owner and (target.password_hash is null or target.password_hash <> extensions.crypt(coalesce(p_password, ''), target.password_hash)) then
    return false;
  end if;
  update public.comments set deleted_at = now(), body = '', nickname = '', password_hash = null where id = p_id;
  return true;
end;
$$;
revoke all on function public.delete_comment(bigint, text, boolean) from public, anon, authenticated;
grant execute on function public.delete_comment(bigint, text, boolean) to service_role;
