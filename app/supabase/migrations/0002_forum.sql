-- Микрофорум на страницах вузов публичной витрины (с 05.10.2026).
--
-- Инварианты:
--  * без аккаунтов и без персональных данных: автор – случайный токен в браузере,
--    в базе только его хэш с секретной солью (author_key); ник («Анонимная лягушка»)
--    выдаёт сервер по этому хэшу, подделать или выбрать его нельзя;
--  * из текста ДО записи вычёркиваются телефоны, почта и @ники; сообщение со
--    ссылкой ждёт модерации (status = 'pending');
--  * IP не хранится: для лимита – хэш IP с солью и датой, строки старше суток удаляются;
--  * anon читает только опубликованное и только безопасные колонки; писать можно
--    только через функции ниже; RLS – единственный охранник.
-- Модерация: владелец меняет status в панели Supabase (см. README §14).

create extension if not exists pgcrypto with schema extensions;
create schema if not exists app_private;
revoke all on schema app_private from public;

create table if not exists app_private.forum_secret (
  id int primary key default 1 check (id = 1),
  salt text not null
);
insert into app_private.forum_secret (salt)
values (encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (id) do nothing;

create table public.forum_posts (
  id bigint generated always as identity primary key,
  university_id text not null check (university_id ~ '^[a-z0-9-]{1,80}$'),
  parent_id bigint references public.forum_posts (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  nickname text not null,
  role text check (role in ('applicant', 'student', 'graduate')),
  status text not null default 'published' check (status in ('published', 'pending', 'hidden', 'deleted')),
  author_key text not null,
  reports int not null default 0,
  created_at timestamptz not null default now()
);
create index forum_posts_university on public.forum_posts (university_id, created_at);
create index forum_posts_parent on public.forum_posts (parent_id);
create index forum_posts_author on public.forum_posts (author_key, created_at desc);

create table app_private.forum_reports (
  post_id bigint not null references public.forum_posts (id) on delete cascade,
  author_key text not null,
  primary key (post_id, author_key)
);

create table app_private.forum_rate (
  ip_hash text not null,
  day date not null,
  n int not null default 0,
  primary key (ip_hash, day)
);

/* ---------- RLS и гранты ---------- */

-- Проект создаётся с выключенным «Automatically expose new tables»: ничего не
-- открывается API по умолчанию, все права ниже выданы явно.
grant usage on schema public to anon, authenticated;

alter table public.forum_posts enable row level security;

-- 'deleted' читается тоже: ветка с чужими ответами остаётся, текст уже стёрт
create policy forum_posts_read on public.forum_posts
  for select to anon, authenticated
  using (status in ('published', 'deleted'));

revoke all on public.forum_posts from anon, authenticated;
grant select (id, university_id, parent_id, body, nickname, role, created_at)
  on public.forum_posts to anon, authenticated;

/* ---------- ник и автор ---------- */

-- Ник по хэшу автора: прилагательное в роде животного + животное. Списки те же,
-- что в app/src/data/forum.ts (тест сверяет).
create or replace function app_private.forum_nickname(p_key text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  adj_m text[] := array['Анонимный', 'Тихий', 'Любопытный', 'Сонный', 'Весёлый', 'Задумчивый', 'Смелый', 'Вежливый',
                        'Бодрый', 'Внимательный', 'Спокойный', 'Добрый', 'Хитрый', 'Мудрый', 'Быстрый', 'Скромный'];
  adj_f text[] := array['Анонимная', 'Тихая', 'Любопытная', 'Сонная', 'Весёлая', 'Задумчивая', 'Смелая', 'Вежливая',
                        'Бодрая', 'Внимательная', 'Спокойная', 'Добрая', 'Хитрая', 'Мудрая', 'Быстрая', 'Скромная'];
  animals_m text[] := array['кот', 'ёж', 'барсук', 'енот', 'волк', 'медведь', 'тигр', 'журавль', 'дельфин', 'филин',
                            'пингвин', 'хомяк', 'бобёр', 'лемур', 'краб'];
  animals_f text[] := array['лягушка', 'панда', 'сова', 'лиса', 'выдра', 'белка', 'черепаха', 'цапля', 'рысь', 'ласка',
                            'сорока', 'пчела', 'акула', 'мышь', 'утка'];
  b bytea := decode(p_key, 'hex');
  a int := get_byte(b, 0) % 16;
  n int := (get_byte(b, 1) * 256 + get_byte(b, 2)) % 30;
begin
  if n < 15 then
    return adj_m[a + 1] || ' ' || animals_m[n + 1];
  end if;
  return adj_f[a + 1] || ' ' || animals_f[n - 15 + 1];
end;
$$;

create or replace function app_private.forum_author_key(p_token uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(p_token::text || s.salt, 'sha256'), 'hex')
  from app_private.forum_secret s
$$;

/** Ник, под которым этот браузер пишет, – чтобы показать его до первого сообщения. */
create or replace function public.forum_whoami(p_token uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.forum_nickname(app_private.forum_author_key(p_token))
$$;

/* ---------- текст ---------- */

/** Вычёркивает телефоны (10+ цифр), почту и @ники. Ничего больше не меняет. */
create or replace function app_private.forum_redact(p_body text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(p_body, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[почта скрыта]', 'g'),
             '(^|[^A-Za-z0-9_])@[A-Za-z0-9_]{3,}', '\1[ник скрыт]', 'g'),
           '\+?\d(?:[\s()-]*\d){9,}', '[телефон скрыт]', 'g')
$$;

create or replace function app_private.forum_has_link(p_body text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_body ~* '(https?://|www\.|t\.me/|[a-z0-9-]+\.(ru|com|cn|me|io|net|org)(/|\s|$))'
$$;

/* ---------- запись ---------- */

/**
 * Новое сообщение (p_parent = null) или ответ на опубликованное сообщение верхнего
 * уровня того же вуза. Лимиты: не чаще раза в 15 секунд от одного автора и не больше
 * 30 сообщений в сутки с одного IP. Возвращает { id, nickname, status }.
 */
create or replace function public.forum_post(
  p_university text,
  p_body text,
  p_token uuid,
  p_parent bigint default null,
  p_role text default null
)
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key text := app_private.forum_author_key(p_token);
  v_body text;
  v_status text;
  v_ip text;
  v_ip_hash text;
  v_n int;
  v_parent public.forum_posts;
  v_id bigint;
  v_nick text;
begin
  if p_token is null or v_key is null then
    raise exception 'forum_no_token';
  end if;
  if p_university is null or p_university !~ '^[a-z0-9-]{1,80}$' then
    raise exception 'forum_bad_university';
  end if;
  if p_role is not null and p_role not in ('applicant', 'student', 'graduate') then
    raise exception 'forum_bad_role';
  end if;

  v_body := btrim(app_private.forum_redact(coalesce(p_body, '')));
  if char_length(v_body) < 2 then
    raise exception 'forum_empty';
  end if;
  if char_length(v_body) > 2000 then
    raise exception 'forum_too_long';
  end if;

  if p_parent is not null then
    select * into v_parent from public.forum_posts where id = p_parent;
    if not found or v_parent.status <> 'published' or v_parent.parent_id is not null
       or v_parent.university_id <> p_university then
      raise exception 'forum_bad_parent';
    end if;
  end if;

  if exists (
    select 1 from public.forum_posts
    where author_key = v_key and created_at > now() - interval '15 seconds'
  ) then
    raise exception 'forum_too_fast';
  end if;

  -- первый адрес из x-forwarded-for; сам IP нигде не записывается
  v_ip := coalesce(
    split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1),
    'unknown');
  select encode(extensions.digest(btrim(v_ip) || s.salt || current_date::text, 'sha256'), 'hex')
    into v_ip_hash from app_private.forum_secret s;
  delete from app_private.forum_rate where day < current_date;
  insert into app_private.forum_rate (ip_hash, day, n) values (v_ip_hash, current_date, 1)
  on conflict (ip_hash, day) do update set n = app_private.forum_rate.n + 1
  returning n into v_n;
  if v_n > 30 then
    raise exception 'forum_day_limit';
  end if;

  v_status := case when app_private.forum_has_link(v_body) then 'pending' else 'published' end;
  v_nick := app_private.forum_nickname(v_key);

  insert into public.forum_posts (university_id, parent_id, body, nickname, role, status, author_key)
  values (p_university, p_parent, v_body, v_nick, p_role, v_status, v_key)
  returning id into v_id;

  return json_build_object('id', v_id, 'nickname', v_nick, 'status', v_status);
end;
$$;

/** Жалоба: одна от автора на сообщение; после трёх сообщение скрывается до модерации. */
create or replace function public.forum_report(p_post bigint, p_token uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key text := app_private.forum_author_key(p_token);
  v_n int;
begin
  if p_token is null or v_key is null then
    raise exception 'forum_no_token';
  end if;
  if not exists (select 1 from public.forum_posts where id = p_post and status = 'published') then
    raise exception 'forum_not_found';
  end if;
  insert into app_private.forum_reports (post_id, author_key) values (p_post, v_key)
  on conflict do nothing;
  select count(*) into v_n from app_private.forum_reports where post_id = p_post;
  update public.forum_posts
     set reports = v_n,
         status = case when v_n >= 3 and status = 'published' then 'hidden' else status end
   where id = p_post;
end;
$$;

/**
 * Автор удаляет своё сообщение в любой момент: текст стирается, ветка с чужими
 * ответами остаётся с пометкой «удалено автором».
 */
create or replace function public.forum_delete_own(p_post bigint, p_token uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key text := app_private.forum_author_key(p_token);
begin
  update public.forum_posts
     set body = '–', status = 'deleted'
   where id = p_post and author_key = v_key and status <> 'deleted';
  return found;
end;
$$;

/* ---------- права на функции ---------- */

revoke all on function app_private.forum_nickname(text) from public;
revoke all on function app_private.forum_author_key(uuid) from public;
revoke all on function app_private.forum_redact(text) from public;
revoke all on function app_private.forum_has_link(text) from public;
revoke all on function public.forum_whoami(uuid) from public;
revoke all on function public.forum_post(text, text, uuid, bigint, text) from public;
revoke all on function public.forum_report(bigint, uuid) from public;
revoke all on function public.forum_delete_own(bigint, uuid) from public;
grant execute on function public.forum_whoami(uuid) to anon, authenticated;
grant execute on function public.forum_post(text, text, uuid, bigint, text) to anon, authenticated;
grant execute on function public.forum_report(bigint, uuid) to anon, authenticated;
grant execute on function public.forum_delete_own(bigint, uuid) to anon, authenticated;
