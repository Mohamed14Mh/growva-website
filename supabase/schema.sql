-- GROWVA CMS Phase 3 schema
-- Run this in the Supabase SQL editor after creating the project.

create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_content (
  id uuid primary key default gen_random_uuid(),
  page_path text not null,
  page_id text,
  edit_key text not null,
  edit_type text,
  section_id text,
  section_type text,
  value_text text,
  value_json jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  version int not null default 1,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_content_page_edit_status_unique unique (page_path, edit_key, status)
);

create table if not exists public.cms_publish_log (
  id uuid primary key default gen_random_uuid(),
  page_path text,
  published_by uuid references auth.users(id),
  published_count int,
  created_at timestamptz not null default now()
);

create table if not exists public.cms_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text,
  page_path text,
  edit_key text,
  old_value text,
  new_value text,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_profiles_set_updated_at on public.admin_profiles;
create trigger admin_profiles_set_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();

drop trigger if exists cms_content_set_updated_at on public.cms_content;
create trigger cms_content_set_updated_at
before update on public.cms_content
for each row execute function public.set_updated_at();

create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.admin_profiles where id = auth.uid();
$$;

alter table public.admin_profiles enable row level security;
alter table public.cms_content enable row level security;
alter table public.cms_publish_log enable row level security;
alter table public.cms_audit_log enable row level security;

drop policy if exists "Admins can read own profile" on public.admin_profiles;
create policy "Admins can read own profile"
on public.admin_profiles
for select
to authenticated
using (id = auth.uid() or public.current_admin_role() = 'owner');

drop policy if exists "Owners can manage admin profiles" on public.admin_profiles;
create policy "Owners can manage admin profiles"
on public.admin_profiles
for all
to authenticated
using (public.current_admin_role() = 'owner')
with check (public.current_admin_role() = 'owner');

drop policy if exists "Public can read published cms content" on public.cms_content;
create policy "Public can read published cms content"
on public.cms_content
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Admins can read all cms content" on public.cms_content;
create policy "Admins can read all cms content"
on public.cms_content
for select
to authenticated
using (public.current_admin_role() in ('owner', 'editor', 'viewer'));

drop policy if exists "Editors and owners can insert drafts" on public.cms_content;
create policy "Editors and owners can insert drafts"
on public.cms_content
for insert
to authenticated
with check (
  status = 'draft'
  and public.current_admin_role() in ('owner', 'editor')
);

drop policy if exists "Editors and owners can update drafts" on public.cms_content;
create policy "Editors and owners can update drafts"
on public.cms_content
for update
to authenticated
using (
  status = 'draft'
  and public.current_admin_role() in ('owner', 'editor')
)
with check (
  status = 'draft'
  and public.current_admin_role() in ('owner', 'editor')
);

drop policy if exists "Editors and owners can delete drafts" on public.cms_content;
create policy "Editors and owners can delete drafts"
on public.cms_content
for delete
to authenticated
using (
  status = 'draft'
  and public.current_admin_role() in ('owner', 'editor')
);

drop policy if exists "Owners can insert published content" on public.cms_content;
create policy "Owners can insert published content"
on public.cms_content
for insert
to authenticated
with check (
  status = 'published'
  and public.current_admin_role() = 'owner'
);

drop policy if exists "Owners can update published content" on public.cms_content;
create policy "Owners can update published content"
on public.cms_content
for update
to authenticated
using (
  status = 'published'
  and public.current_admin_role() = 'owner'
)
with check (
  status = 'published'
  and public.current_admin_role() = 'owner'
);

drop policy if exists "Admins can insert audit log" on public.cms_audit_log;
create policy "Admins can insert audit log"
on public.cms_audit_log
for insert
to authenticated
with check (public.current_admin_role() in ('owner', 'editor'));

drop policy if exists "Owners can read audit log" on public.cms_audit_log;
create policy "Owners can read audit log"
on public.cms_audit_log
for select
to authenticated
using (public.current_admin_role() = 'owner');

drop policy if exists "Owners can insert publish log" on public.cms_publish_log;
create policy "Owners can insert publish log"
on public.cms_publish_log
for insert
to authenticated
with check (public.current_admin_role() = 'owner');

drop policy if exists "Owners can read publish log" on public.cms_publish_log;
create policy "Owners can read publish log"
on public.cms_publish_log
for select
to authenticated
using (public.current_admin_role() = 'owner');

create index if not exists cms_content_page_status_idx
on public.cms_content (page_path, status);

create index if not exists cms_content_edit_key_idx
on public.cms_content (edit_key);
