-- ============================================================================
-- Lift Tracker — Supabase schema for cloud backup / sync (Phase 1)
--
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to re-run: it only creates things that don't exist yet.
--
-- Design (see cloud-sync-design.md):
--  * Each synced record stores the app's own object as JSON (`data`), so the
--    app's data shape can evolve without schema changes.
--  * `updated_ms` = the device's edit time (ms). Newer edits win; a stale
--    device can never overwrite a newer copy (guard trigger below).
--  * `server_updated_at` = server time of the last change; devices pull
--    "everything changed since X" using this (immune to phone clock skew).
--  * `deleted` = tombstone, so deletions reach other devices.
--  * Row-level security: every user can only ever see and change their own
--    rows. The app ships only the public anon key.
-- ============================================================================

-- ---------- shared trigger: server timestamp + last-write-wins guard -------
create or replace function public.lt_touch()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.updated_ms < old.updated_ms then
    return null;                       -- older edit: keep the newer server copy
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;

-- ---------- profiles (one row per app profile, incl. its settings) ---------
create table if not exists public.profiles (
  user_id           uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id                text        not null,               -- the app's local profile id
  data              jsonb       not null,               -- profile object (+ settings)
  updated_ms        bigint      not null,
  deleted           boolean     not null default false,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------- plans (whole training plan per profile, as one document) -------
create table if not exists public.plans (
  user_id           uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id        text        not null,
  data              jsonb       not null,
  updated_ms        bigint      not null,
  deleted           boolean     not null default false,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);

-- ---------- sessions (one row per finished workout) ------------------------
create table if not exists public.sessions (
  user_id           uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id                text        not null,               -- the app's session id
  profile_id        text        not null,
  data              jsonb       not null,               -- the whole session object
  updated_ms        bigint      not null,
  deleted           boolean     not null default false,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------- last-used weights (pre-fill map) per profile -------------------
create table if not exists public.last_used (
  user_id           uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id        text        not null,
  data              jsonb       not null,
  updated_ms        bigint      not null,
  deleted           boolean     not null default false,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);

-- ---------- triggers, indexes, row-level security --------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','plans','sessions','last_used'] loop
    execute format('drop trigger if exists lt_touch on public.%I', t);
    execute format('create trigger lt_touch before insert or update on public.%I
                    for each row execute function public.lt_touch()', t);
    execute format('create index if not exists %I on public.%I (user_id, server_updated_at)',
                   t || '_pull_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows only" on public.%I', t);
    execute format('create policy "own rows only" on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------- delete my account (removes the login AND all their rows) -------
-- Runs with elevated rights but only ever touches the caller's own account.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = public, auth
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
