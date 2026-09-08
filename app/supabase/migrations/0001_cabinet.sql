-- ============================================================================
-- Личный кабинет ученика и панель наставника (SPEC-cabinet.md, блок C).
-- Проект Supabase приложения (не конвейерный). Схема public.
--
-- Инварианты:
--  * минимум ПДн: email живёт только в auth.users; в profiles – ник, ответы
--    онбординга, согласие, последний визит;
--  * никаких файлов и ссылок на файлы – документы только как статусы;
--  * единственный охранник – RLS; anon не имеет доступа ни к одной таблице;
--  * ученик и члены его активной организации видят одно и то же;
--  * ничего не удаляется, кроме аккаунта по воле его владельца
--    (delete_own_account → каскад).
--
-- Применение: `npm run db:migrate` (scripts/db-migrate.mjs, SUPABASE_DB_URL из
-- app/.env.local). Скрипт идемпотентен: учёт в app_private.schema_migrations.
-- ============================================================================

-- ---------------------------------------------------------------- таблицы --

create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  nick         text check (nick is null or char_length(nick) <= 40),
  onboarding   jsonb,
  consent_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  created_at   timestamptz not null default now()
);
comment on table public.profiles is 'Профиль 1:1 к auth.users; строка создаётся триггером при регистрации.';

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9_-]{1,40}$'),
  name        text not null check (char_length(name) between 1 and 80),
  tagline     text check (tagline is null or char_length(tagline) <= 160),
  telegram    text check (telegram is null or telegram ~ '^[A-Za-z0-9_]{1,64}$'),
  invite_code text unique check (invite_code is null or invite_code ~ '^[A-Z0-9-]{4,40}$'),
  created_at  timestamptz not null default now()
);
comment on table public.organizations is 'Организация-консультант: бренд кабинета ученика и инвайт-код.';

create table if not exists public.org_members (
  org_id   uuid not null references public.organizations (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  role     text not null check (role in ('admin', 'mentor')),
  added_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.mentorships (
  student_id uuid not null references public.profiles (user_id) on delete cascade,
  org_id     uuid not null references public.organizations (id) on delete cascade,
  status     text not null default 'active' check (status in ('active', 'removed')),
  joined_at  timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references auth.users (id) on delete set null,
  primary key (student_id, org_id)
);
-- у ученика не больше ОДНОЙ активной организации
create unique index if not exists mentorships_one_active
  on public.mentorships (student_id) where (status = 'active');

create table if not exists public.plan_items (
  student_id    uuid not null references public.profiles (user_id) on delete cascade,
  university_id text not null check (university_id ~ '^[a-z0-9_-]{1,64}$'),
  status        text not null default 'considering'
                check (status in ('considering', 'preparing', 'applied', 'answered')),
  note          text check (note is null or char_length(note) <= 2000),
  added_at      timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (student_id, university_id)
);
comment on column public.plan_items.university_id is 'University.id (slug) из статического china.json.';

create table if not exists public.plan_docs (
  student_id    uuid not null,
  university_id text not null,
  doc_id        text not null check (char_length(doc_id) between 1 and 64),
  done          boolean not null default false,
  done_at       timestamptz,
  primary key (student_id, university_id, doc_id),
  foreign key (student_id, university_id)
    references public.plan_items (student_id, university_id) on delete cascade
);

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles (user_id) on delete cascade,
  org_id        uuid references public.organizations (id) on delete cascade,
  author_id     uuid references auth.users (id) on delete set null,
  university_id text check (university_id is null or university_id ~ '^[a-z0-9_-]{1,64}$'),
  title         text not null check (char_length(title) between 1 and 140),
  details       text check (details is null or char_length(details) <= 2000),
  due_on        date,
  done_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on column public.tasks.org_id is 'null – задача ученика себе; иначе задача от организации.';
create index if not exists tasks_student_idx on public.tasks (student_id);

create table if not exists public.mentor_notes (
  org_id        uuid not null references public.organizations (id) on delete cascade,
  student_id    uuid not null references public.profiles (user_id) on delete cascade,
  university_id text not null check (university_id ~ '^[a-z0-9_-]{1,64}$'),
  body          text not null check (char_length(body) <= 2000),
  author_id     uuid references auth.users (id) on delete set null,
  updated_at    timestamptz not null default now(),
  primary key (org_id, student_id, university_id)
);

-- ------------------------------------------------------------ триггеры --

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, consent_at)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'consent_at', '')::timestamptz,
      now()
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists plan_items_updated_at on public.plan_items;
create trigger plan_items_updated_at
  before update on public.plan_items
  for each row execute function public.set_updated_at();

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists mentor_notes_updated_at on public.mentor_notes;
create trigger mentor_notes_updated_at
  before update on public.mentor_notes
  for each row execute function public.set_updated_at();

-- plan_docs.done_at следует за done
create or replace function public.plan_docs_done_at()
returns trigger
language plpgsql
as $$
begin
  if new.done and (tg_op = 'INSERT' or not old.done or new.done_at is null) then
    new.done_at := coalesce(new.done_at, now());
  elsif not new.done then
    new.done_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists plan_docs_done_at on public.plan_docs;
create trigger plan_docs_done_at
  before insert or update on public.plan_docs
  for each row execute function public.plan_docs_done_at();

-- ------------------------------------------ вспомогательные функции RLS --
-- security definer, чтобы политики не рекурсировали (org_members ↔ org_members)
-- и чтобы ученик мог проверить членство наставника, не читая org_members.

create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members om
    where om.org_id = org and om.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members om
    where om.org_id = org and om.user_id = auth.uid() and om.role = 'admin'
  );
$$;

-- активная организация ученика (null, если её нет)
create or replace function public.student_active_org(student uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.org_id from public.mentorships m
  where m.student_id = student and m.status = 'active'
  limit 1;
$$;

create or replace function public.my_active_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.student_active_org(auth.uid());
$$;

-- текущий пользователь – член активной организации ученика
create or replace function public.mentors_student(student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mentorships m
    join public.org_members om on om.org_id = m.org_id
    where m.student_id = student
      and m.status = 'active'
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.student_in_org(student uuid, org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mentorships m
    where m.student_id = student and m.org_id = org and m.status = 'active'
  );
$$;

-- ------------------------------------------------ защита строк задач --
-- Политика update не видит OLD, поэтому неизменяемость полей и правило
-- «ученик отмечает задачу наставника только выполненной» живут в триггере.

create or replace function public.tasks_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id
     or new.student_id <> old.student_id
     or new.org_id is distinct from old.org_id
     or new.author_id is distinct from old.author_id
     or new.created_at <> old.created_at then
    raise exception 'tasks: id, student_id, org_id, author_id, created_at are immutable'
      using errcode = 'check_violation';
  end if;

  -- ученик, не являющийся членом организации-автора: только done_at
  if old.org_id is not null
     and auth.uid() = old.student_id
     and not public.is_org_member(old.org_id) then
    if new.title <> old.title
       or new.details is distinct from old.details
       or new.due_on is distinct from old.due_on
       or new.university_id is distinct from old.university_id then
      raise exception 'tasks: a student may only mark a mentor task done'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_guard_update on public.tasks;
create trigger tasks_guard_update
  before update on public.tasks
  for each row execute function public.tasks_guard_update();

-- --------------------------------------------- функции с проверками --

-- Привязка текущего пользователя к организации по инвайт-коду.
-- Отказ, если уже есть другая активная организация. Повтор с тем же кодом –
-- без ошибки. Возвращает бренд организации.
create or replace function public.join_org(code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  org public.organizations%rowtype;
  current_org uuid;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  select * into org from public.organizations o
  where o.invite_code = upper(trim(code));
  if not found then
    raise exception 'invalid_code' using errcode = 'no_data_found';
  end if;
  current_org := public.student_active_org(uid);
  if current_org is not null and current_org <> org.id then
    raise exception 'already_in_org' using errcode = 'unique_violation';
  end if;
  insert into public.mentorships as m (student_id, org_id, status, joined_at, removed_at, removed_by)
  values (uid, org.id, 'active', now(), null, null)
  on conflict (student_id, org_id) do update
    set status = 'active',
        joined_at = case when m.status = 'active' then m.joined_at else now() end,
        removed_at = null,
        removed_by = null;
  return json_build_object(
    'id', org.id, 'slug', org.slug, 'name', org.name,
    'tagline', org.tagline, 'telegram', org.telegram, 'created_at', org.created_at
  );
end;
$$;

-- Снять ученика с сопровождения (только член организации). Строка остаётся
-- со статусом removed; ничего не удаляется.
create or replace function public.org_remove_student(org uuid, student uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_org_member(org) then
    raise exception 'not_a_member' using errcode = 'insufficient_privilege';
  end if;
  update public.mentorships
  set status = 'removed', removed_at = now(), removed_by = auth.uid()
  where org_id = org and student_id = student and status = 'active';
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Удаление собственного аккаунта: каскад уносит профиль, план, задачи,
-- членства и заметки о нём. Единственная удаляющая операция в схеме.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  delete from auth.users where id = uid;
end;
$$;

-- Инвайт-код читают только члены организации (ученику он не нужен).
create or replace function public.org_invite_code(org uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select o.invite_code from public.organizations o
  where o.id = org and public.is_org_member(org);
$$;

-- Перевыпуск кода (только admin): SLUG-XXXX, старый перестаёт работать,
-- уже привязанные ученики не затрагиваются.
create or replace function public.org_reissue_invite(org uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.organizations%rowtype;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  suffix text;
  i integer;
begin
  if not public.is_org_admin(org) then
    raise exception 'not_an_admin' using errcode = 'insufficient_privilege';
  end if;
  select * into o from public.organizations where id = org;
  loop
    suffix := '';
    for i in 1..4 loop
      suffix := suffix || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      update public.organizations
      set invite_code = upper(o.slug) || '-' || suffix
      where id = org;
      exit;
    exception when unique_violation then
      -- коллизия – ещё раз
    end;
  end loop;
  return upper(o.slug) || '-' || suffix;
end;
$$;

-- Список участников с email (email нужен, чтобы отличать коллег; читают
-- только члены той же организации).
create or replace function public.org_members_list(org uuid)
returns table (user_id uuid, role text, email text, added_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select om.user_id, om.role, u.email::text, om.added_at
  from public.org_members om
  join auth.users u on u.id = om.user_id
  where om.org_id = org and public.is_org_member(org)
  order by om.added_at;
$$;

-- Добавить участника по email (только admin). Если аккаунта с таким email
-- нет – исключение user_not_found: человеку нужно сначала войти.
create or replace function public.org_add_member_by_email(org uuid, member_email text, member_role text default 'mentor')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  if not public.is_org_admin(org) then
    raise exception 'not_an_admin' using errcode = 'insufficient_privilege';
  end if;
  if member_role not in ('admin', 'mentor') then
    raise exception 'invalid_role' using errcode = 'check_violation';
  end if;
  select u.id into uid from auth.users u where lower(u.email) = lower(trim(member_email)) limit 1;
  if uid is null then
    raise exception 'user_not_found' using errcode = 'no_data_found';
  end if;
  insert into public.org_members (org_id, user_id, role)
  values (org, uid, member_role)
  on conflict (org_id, user_id) do update set role = excluded.role;
  return uid;
end;
$$;

-- ---------------------------------------------------------------- RLS --

alter table public.profiles      enable row level security;
alter table public.organizations enable row level security;
alter table public.org_members   enable row level security;
alter table public.mentorships   enable row level security;
alter table public.plan_items    enable row level security;
alter table public.plan_docs     enable row level security;
alter table public.tasks         enable row level security;
alter table public.mentor_notes  enable row level security;

-- anon – никуда; authenticated – только через политики и колоночные гранты
revoke all on public.profiles, public.organizations, public.org_members, public.mentorships,
  public.plan_items, public.plan_docs, public.tasks, public.mentor_notes from anon;
revoke all on public.profiles, public.organizations, public.org_members, public.mentorships,
  public.plan_items, public.plan_docs, public.tasks, public.mentor_notes from authenticated;

grant select on public.profiles to authenticated;
grant update (nick, onboarding, last_seen_at) on public.profiles to authenticated;

-- invite_code не в select-гранте: ученик организации читает бренд, но не код
grant select (id, slug, name, tagline, telegram, created_at) on public.organizations to authenticated;
grant update (name, tagline, telegram) on public.organizations to authenticated;

grant select, insert, update, delete on public.org_members to authenticated;
grant select on public.mentorships to authenticated;
grant select, insert, update, delete on public.plan_items to authenticated;
grant select, insert, update, delete on public.plan_docs to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.mentor_notes to authenticated;

-- profiles: сам; члены его активной организации. Пишет только сам.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.mentors_student(user_id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- organizations: члены; ученик своей активной организации (бренд). Пишет admin.
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated
  using (public.is_org_member(id) or id = public.my_active_org());
drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations for update to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));

-- org_members: читают члены той же организации; пишет admin.
drop policy if exists org_members_select on public.org_members;
create policy org_members_select on public.org_members for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists org_members_insert on public.org_members;
create policy org_members_insert on public.org_members for insert to authenticated
  with check (public.is_org_admin(org_id));
drop policy if exists org_members_update on public.org_members;
create policy org_members_update on public.org_members for update to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
drop policy if exists org_members_delete on public.org_members;
create policy org_members_delete on public.org_members for delete to authenticated
  using (public.is_org_admin(org_id));

-- mentorships: ученик – свои; члены – своей организации. Запись – только
-- через join_org / org_remove_student (insert/update-политик нет).
drop policy if exists mentorships_select on public.mentorships;
create policy mentorships_select on public.mentorships for select to authenticated
  using (student_id = auth.uid() or public.is_org_member(org_id));

-- plan_items / plan_docs: ученик; члены его активной организации. Пишет только ученик.
drop policy if exists plan_items_select on public.plan_items;
create policy plan_items_select on public.plan_items for select to authenticated
  using (student_id = auth.uid() or public.mentors_student(student_id));
drop policy if exists plan_items_write on public.plan_items;
create policy plan_items_write on public.plan_items for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

drop policy if exists plan_docs_select on public.plan_docs;
create policy plan_docs_select on public.plan_docs for select to authenticated
  using (student_id = auth.uid() or public.mentors_student(student_id));
drop policy if exists plan_docs_write on public.plan_docs;
create policy plan_docs_write on public.plan_docs for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- tasks: читают ученик и члены его организации.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (student_id = auth.uid() or public.mentors_student(student_id));
-- ученик: свои задачи себе (org_id null); член: задачи своей организации её ученику
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      (student_id = auth.uid() and org_id is null)
      or (org_id is not null and public.is_org_member(org_id) and public.student_in_org(student_id, org_id))
    )
  );
-- ученик – любую свою (триггер оставляет ему только done_at у задач наставника);
-- член – задачи своей организации
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (student_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)))
  with check (student_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)));
-- ученик удаляет только свои задачи себе; член – задачи своей организации
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
  using ((student_id = auth.uid() and org_id is null) or (org_id is not null and public.is_org_member(org_id)));

-- mentor_notes: ученик (своей активной организации) и члены; пишут только члены
drop policy if exists mentor_notes_select on public.mentor_notes;
create policy mentor_notes_select on public.mentor_notes for select to authenticated
  using (public.is_org_member(org_id) or (student_id = auth.uid() and org_id = public.my_active_org()));
drop policy if exists mentor_notes_insert on public.mentor_notes;
create policy mentor_notes_insert on public.mentor_notes for insert to authenticated
  with check (author_id = auth.uid() and public.is_org_member(org_id) and public.student_in_org(student_id, org_id));
drop policy if exists mentor_notes_update on public.mentor_notes;
create policy mentor_notes_update on public.mentor_notes for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id) and author_id = auth.uid());
drop policy if exists mentor_notes_delete on public.mentor_notes;
create policy mentor_notes_delete on public.mentor_notes for delete to authenticated
  using (public.is_org_member(org_id));

-- ------------------------------------------------------- гранты функций --

-- триггерные функции нельзя вызвать напрямую («can only be called as trigger»),
-- гранты на них не трогаем.

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.is_org_member(uuid)', 'public.is_org_admin(uuid)', 'public.student_active_org(uuid)',
    'public.my_active_org()', 'public.mentors_student(uuid)', 'public.student_in_org(uuid, uuid)',
    'public.join_org(text)', 'public.org_remove_student(uuid, uuid)', 'public.delete_own_account()',
    'public.org_invite_code(uuid)', 'public.org_reissue_invite(uuid)', 'public.org_members_list(uuid)',
    'public.org_add_member_by_email(uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;
