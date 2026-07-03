-- GROWVA CMS Phase 8: Safe Section Builder Templates
-- Run AFTER schema.sql and phase-7-visual-controls.sql are applied.
-- Do NOT overwrite schema.sql.

create table if not exists public.cms_custom_sections (
  id           uuid        primary key default gen_random_uuid(),
  page_path    text        not null,
  section_id   text        not null,
  section_type text        not null,
  template_id  text        not null,
  title        text,
  content_json jsonb,
  style_json   jsonb,
  order_index  int,
  is_visible   boolean     default true,
  status       text        default 'draft' check (status in ('draft', 'published')),
  updated_by   uuid        references auth.users(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  constraint cms_custom_sections_page_section_status_unique unique (page_path, section_id, status)
);

drop trigger if exists cms_custom_sections_set_updated_at on public.cms_custom_sections;
create trigger cms_custom_sections_set_updated_at
before update on public.cms_custom_sections
for each row execute function public.set_updated_at();

create index if not exists cms_custom_sections_page_status_idx
  on public.cms_custom_sections (page_path, status);

create index if not exists cms_custom_sections_template_idx
  on public.cms_custom_sections (template_id);

alter table public.cms_custom_sections enable row level security;

drop policy if exists "Public can read published custom sections" on public.cms_custom_sections;
create policy "Public can read published custom sections"
on public.cms_custom_sections for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Admins can read all custom sections" on public.cms_custom_sections;
create policy "Admins can read all custom sections"
on public.cms_custom_sections for select
to authenticated
using (public.current_admin_role() in ('owner', 'editor', 'viewer'));

drop policy if exists "Editors and owners can insert custom section drafts" on public.cms_custom_sections;
create policy "Editors and owners can insert custom section drafts"
on public.cms_custom_sections for insert
to authenticated
with check (
  status = 'draft'
  and public.current_admin_role() in ('owner', 'editor')
);

drop policy if exists "Editors and owners can update custom section drafts" on public.cms_custom_sections;
create policy "Editors and owners can update custom section drafts"
on public.cms_custom_sections for update
to authenticated
using (
  status = 'draft'
  and public.current_admin_role() in ('owner', 'editor')
)
with check (
  status = 'draft'
  and public.current_admin_role() in ('owner', 'editor')
);

drop policy if exists "Editors and owners can delete custom section drafts" on public.cms_custom_sections;
create policy "Editors and owners can delete custom section drafts"
on public.cms_custom_sections for delete
to authenticated
using (
  status = 'draft'
  and public.current_admin_role() in ('owner', 'editor')
);

drop policy if exists "Owners can insert published custom sections" on public.cms_custom_sections;
create policy "Owners can insert published custom sections"
on public.cms_custom_sections for insert
to authenticated
with check (
  status = 'published'
  and public.current_admin_role() = 'owner'
);

drop policy if exists "Owners can update published custom sections" on public.cms_custom_sections;
create policy "Owners can update published custom sections"
on public.cms_custom_sections for update
to authenticated
using (
  status = 'published'
  and public.current_admin_role() = 'owner'
)
with check (
  status = 'published'
  and public.current_admin_role() = 'owner'
);
