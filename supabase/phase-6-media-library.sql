-- GROWVA CMS Phase 6: Media Library
-- Run AFTER the Phase 3 schema.sql is already applied.
--
-- STEP 1 (Dashboard): Storage > New bucket
--   Name: cms-media
--   Public bucket: YES (enables public read of uploaded files)
--
-- STEP 2: Run this entire file in the Supabase SQL Editor.

-- ── Media assets table ────────────────────────────────────────────────────

create table if not exists public.cms_media_assets (
  id            uuid        primary key default gen_random_uuid(),
  storage_path  text        not null unique,
  public_url    text        not null,
  file_name     text        not null,
  file_type     text        not null,
  file_size     bigint      not null,
  width         int,
  height        int,
  alt_text      text        not null default '',
  caption       text        not null default '',
  folder        text        not null default 'cms',
  uploaded_by   uuid        references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists cms_media_assets_set_updated_at on public.cms_media_assets;
create trigger cms_media_assets_set_updated_at
before update on public.cms_media_assets
for each row execute function public.set_updated_at();

create index if not exists cms_media_assets_folder_idx
  on public.cms_media_assets (folder);

create index if not exists cms_media_assets_uploaded_by_idx
  on public.cms_media_assets (uploaded_by);

create index if not exists cms_media_assets_created_at_idx
  on public.cms_media_assets (created_at desc);

-- ── Row-Level Security: cms_media_assets ─────────────────────────────────

alter table public.cms_media_assets enable row level security;

-- Anon and authenticated users can read all assets (needed for public page hydration)
drop policy if exists "Public can read media assets" on public.cms_media_assets;
create policy "Public can read media assets"
on public.cms_media_assets
for select
to anon, authenticated
using (true);

-- Owner and editor can upload (insert)
drop policy if exists "Editors and owners can insert media assets" on public.cms_media_assets;
create policy "Editors and owners can insert media assets"
on public.cms_media_assets
for insert
to authenticated
with check (public.current_admin_role() in ('owner', 'editor'));

-- Owner and editor can update metadata (alt_text, caption, etc.)
drop policy if exists "Editors and owners can update media assets" on public.cms_media_assets;
create policy "Editors and owners can update media assets"
on public.cms_media_assets
for update
to authenticated
using  (public.current_admin_role() in ('owner', 'editor'))
with check (public.current_admin_role() in ('owner', 'editor'));

-- Only owner can delete asset records
drop policy if exists "Owners can delete media assets" on public.cms_media_assets;
create policy "Owners can delete media assets"
on public.cms_media_assets
for delete
to authenticated
using (public.current_admin_role() = 'owner');

-- ── Storage bucket policies: cms-media ────────────────────────────────────
-- These policies apply to the storage.objects table.
-- They require the cms-media bucket to already exist (created in the Dashboard).

-- Public read — any visitor can load images from this bucket
drop policy if exists "Public can read cms-media objects" on storage.objects;
create policy "Public can read cms-media objects"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'cms-media');

-- Owner and editor can upload new objects
drop policy if exists "Editors and owners can upload to cms-media" on storage.objects;
create policy "Editors and owners can upload to cms-media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cms-media'
  and public.current_admin_role() in ('owner', 'editor')
);

-- Owner and editor can overwrite existing objects (upsert / replace)
drop policy if exists "Editors and owners can update cms-media objects" on storage.objects;
create policy "Editors and owners can update cms-media objects"
on storage.objects
for update
to authenticated
using  (bucket_id = 'cms-media' and public.current_admin_role() in ('owner', 'editor'))
with check (bucket_id = 'cms-media' and public.current_admin_role() in ('owner', 'editor'));

-- Only owner can delete objects from storage
drop policy if exists "Owners can delete cms-media objects" on storage.objects;
create policy "Owners can delete cms-media objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'cms-media'
  and public.current_admin_role() = 'owner'
);

-- ── Note on SVG ───────────────────────────────────────────────────────────
-- SVG uploads are intentionally disabled in the client-side upload validation
-- (admin/admin.js) to prevent SVG-embedded script injection.
-- If you need SVG support in the future, sanitize with a server-side tool
-- (e.g., DOMPurify on a Supabase Edge Function) before storing.
