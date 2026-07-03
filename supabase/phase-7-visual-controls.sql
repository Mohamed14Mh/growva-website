-- GROWVA CMS Phase 7: Visual Control Center + Section Manager
-- Run AFTER phase 3 schema.sql is applied (current_admin_role() must exist).
-- Do NOT overwrite schema.sql.

-- ── Trigger helper (reuse phase-3 function set_updated_at) ───────────────

-- ── Table: design tokens (global CSS vars + page-level overrides) ─────────

create table if not exists public.cms_design_tokens (
  id          uuid        primary key default gen_random_uuid(),
  scope       text        not null check (scope in ('global', 'page')),
  page_path   text,
  token_key   text        not null,
  value_json  jsonb,
  status      text        not null default 'draft' check (status in ('draft', 'published')),
  updated_by  uuid        references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists cms_design_tokens_unique_idx
  on public.cms_design_tokens (scope, coalesce(page_path, ''), token_key, status);

drop trigger if exists cms_design_tokens_set_updated_at on public.cms_design_tokens;
create trigger cms_design_tokens_set_updated_at
before update on public.cms_design_tokens
for each row execute function public.set_updated_at();

create index if not exists cms_design_tokens_scope_page_idx
  on public.cms_design_tokens (scope, page_path, status);

alter table public.cms_design_tokens enable row level security;

drop policy if exists "Public can read published design tokens" on public.cms_design_tokens;
create policy "Public can read published design tokens"
on public.cms_design_tokens for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Admins can read all design tokens" on public.cms_design_tokens;
create policy "Admins can read all design tokens"
on public.cms_design_tokens for select
to authenticated
using (public.current_admin_role() in ('owner', 'editor', 'viewer'));

drop policy if exists "Editors and owners can insert design token drafts" on public.cms_design_tokens;
create policy "Editors and owners can insert design token drafts"
on public.cms_design_tokens for insert
to authenticated
with check (
  status = 'draft'
  and public.current_admin_role() in ('owner', 'editor')
);

drop policy if exists "Editors and owners can update design token drafts" on public.cms_design_tokens;
create policy "Editors and owners can update design token drafts"
on public.cms_design_tokens for update
to authenticated
using  (status = 'draft' and public.current_admin_role() in ('owner', 'editor'))
with check (status = 'draft' and public.current_admin_role() in ('owner', 'editor'));

drop policy if exists "Editors and owners can delete design token drafts" on public.cms_design_tokens;
create policy "Editors and owners can delete design token drafts"
on public.cms_design_tokens for delete
to authenticated
using (status = 'draft' and public.current_admin_role() in ('owner', 'editor'));

drop policy if exists "Owners can insert published design tokens" on public.cms_design_tokens;
create policy "Owners can insert published design tokens"
on public.cms_design_tokens for insert
to authenticated
with check (status = 'published' and public.current_admin_role() = 'owner');

drop policy if exists "Owners can update published design tokens" on public.cms_design_tokens;
create policy "Owners can update published design tokens"
on public.cms_design_tokens for update
to authenticated
using  (status = 'published' and public.current_admin_role() = 'owner')
with check (status = 'published' and public.current_admin_role() = 'owner');

-- ── Table: section settings ───────────────────────────────────────────────

create table if not exists public.cms_section_settings (
  id           uuid        primary key default gen_random_uuid(),
  page_path    text        not null,
  section_id   text        not null,
  section_type text,
  order_index  int,
  is_visible   boolean     not null default true,
  style_json   jsonb,
  status       text        not null default 'draft' check (status in ('draft', 'published')),
  updated_by   uuid        references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint cms_section_settings_unique unique (page_path, section_id, status)
);

drop trigger if exists cms_section_settings_set_updated_at on public.cms_section_settings;
create trigger cms_section_settings_set_updated_at
before update on public.cms_section_settings
for each row execute function public.set_updated_at();

create index if not exists cms_section_settings_page_idx
  on public.cms_section_settings (page_path, status);

alter table public.cms_section_settings enable row level security;

drop policy if exists "Public can read published section settings" on public.cms_section_settings;
create policy "Public can read published section settings"
on public.cms_section_settings for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Admins can read all section settings" on public.cms_section_settings;
create policy "Admins can read all section settings"
on public.cms_section_settings for select
to authenticated
using (public.current_admin_role() in ('owner', 'editor', 'viewer'));

drop policy if exists "Editors and owners can insert section settings drafts" on public.cms_section_settings;
create policy "Editors and owners can insert section settings drafts"
on public.cms_section_settings for insert
to authenticated
with check (status = 'draft' and public.current_admin_role() in ('owner', 'editor'));

drop policy if exists "Editors and owners can update section settings drafts" on public.cms_section_settings;
create policy "Editors and owners can update section settings drafts"
on public.cms_section_settings for update
to authenticated
using  (status = 'draft' and public.current_admin_role() in ('owner', 'editor'))
with check (status = 'draft' and public.current_admin_role() in ('owner', 'editor'));

drop policy if exists "Editors and owners can delete section settings drafts" on public.cms_section_settings;
create policy "Editors and owners can delete section settings drafts"
on public.cms_section_settings for delete
to authenticated
using (status = 'draft' and public.current_admin_role() in ('owner', 'editor'));

drop policy if exists "Owners can insert published section settings" on public.cms_section_settings;
create policy "Owners can insert published section settings"
on public.cms_section_settings for insert
to authenticated
with check (status = 'published' and public.current_admin_role() = 'owner');

drop policy if exists "Owners can update published section settings" on public.cms_section_settings;
create policy "Owners can update published section settings"
on public.cms_section_settings for update
to authenticated
using  (status = 'published' and public.current_admin_role() = 'owner')
with check (status = 'published' and public.current_admin_role() = 'owner');

-- ── Table: element style overrides ────────────────────────────────────────

create table if not exists public.cms_element_styles (
  id          uuid        primary key default gen_random_uuid(),
  page_path   text        not null,
  edit_key    text        not null,
  section_id  text,
  style_json  jsonb,
  status      text        not null default 'draft' check (status in ('draft', 'published')),
  updated_by  uuid        references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint cms_element_styles_unique unique (page_path, edit_key, status)
);

drop trigger if exists cms_element_styles_set_updated_at on public.cms_element_styles;
create trigger cms_element_styles_set_updated_at
before update on public.cms_element_styles
for each row execute function public.set_updated_at();

create index if not exists cms_element_styles_page_idx
  on public.cms_element_styles (page_path, status);

alter table public.cms_element_styles enable row level security;

drop policy if exists "Public can read published element styles" on public.cms_element_styles;
create policy "Public can read published element styles"
on public.cms_element_styles for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Admins can read all element styles" on public.cms_element_styles;
create policy "Admins can read all element styles"
on public.cms_element_styles for select
to authenticated
using (public.current_admin_role() in ('owner', 'editor', 'viewer'));

drop policy if exists "Editors and owners can insert element style drafts" on public.cms_element_styles;
create policy "Editors and owners can insert element style drafts"
on public.cms_element_styles for insert
to authenticated
with check (status = 'draft' and public.current_admin_role() in ('owner', 'editor'));

drop policy if exists "Editors and owners can update element style drafts" on public.cms_element_styles;
create policy "Editors and owners can update element style drafts"
on public.cms_element_styles for update
to authenticated
using  (status = 'draft' and public.current_admin_role() in ('owner', 'editor'))
with check (status = 'draft' and public.current_admin_role() in ('owner', 'editor'));

drop policy if exists "Editors and owners can delete element style drafts" on public.cms_element_styles;
create policy "Editors and owners can delete element style drafts"
on public.cms_element_styles for delete
to authenticated
using (status = 'draft' and public.current_admin_role() in ('owner', 'editor'));

drop policy if exists "Owners can insert published element styles" on public.cms_element_styles;
create policy "Owners can insert published element styles"
on public.cms_element_styles for insert
to authenticated
with check (status = 'published' and public.current_admin_role() = 'owner');

drop policy if exists "Owners can update published element styles" on public.cms_element_styles;
create policy "Owners can update published element styles"
on public.cms_element_styles for update
to authenticated
using  (status = 'published' and public.current_admin_role() = 'owner')
with check (status = 'published' and public.current_admin_role() = 'owner');
