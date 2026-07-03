-- GROWVA CMS Phase 11: Media Asset Management Polish
-- Run AFTER phase-6-media-library.sql.
-- Do NOT overwrite schema.sql.

alter table public.cms_media_assets
  add column if not exists title text not null default '',
  add column if not exists description text not null default '',
  add column if not exists metadata_json jsonb not null default '{}'::jsonb,
  add column if not exists is_archived boolean not null default false;

alter table public.cms_media_assets
  alter column updated_at set default now();

create index if not exists cms_media_assets_archived_idx
  on public.cms_media_assets (is_archived, created_at desc);

-- Re-assert RLS policies in an idempotent way.
alter table public.cms_media_assets enable row level security;

drop policy if exists "Public can read media assets" on public.cms_media_assets;
create policy "Public can read media assets"
on public.cms_media_assets
for select
to anon, authenticated
using (true);

drop policy if exists "Editors and owners can update media assets" on public.cms_media_assets;
create policy "Editors and owners can update media assets"
on public.cms_media_assets
for update
to authenticated
using  (public.current_admin_role() in ('owner', 'editor'))
with check (public.current_admin_role() in ('owner', 'editor'));

drop policy if exists "Owners can delete media assets" on public.cms_media_assets;
create policy "Owners can delete media assets"
on public.cms_media_assets
for delete
to authenticated
using (public.current_admin_role() = 'owner');
