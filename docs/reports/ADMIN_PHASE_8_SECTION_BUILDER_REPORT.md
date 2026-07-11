# ADMIN PHASE 8 SECTION BUILDER REPORT

## Summary

Phase 8 adds safe predefined section templates, a CMS Dashboard Section Builder tab, custom section draft/publish plumbing, protected-section duplication safeguards, and public hydration for published custom sections.

This phase does not add arbitrary HTML, raw CSS, scripts, embeds, image upload expansion, React/Vite/Next, or a server backend.

## Files Changed

- `admin/admin.js`
- `admin/admin.css`
- `supabase/phase-8-section-builder.sql`
- `ADMIN_PHASE_8_SECTION_BUILDER_REPORT.md`

The current worktree also still includes previously completed Phase 7 and Phase 7.5 files.

## SQL Patch Created

Patch:

```text
supabase/phase-8-section-builder.sql
```

It creates `public.cms_custom_sections` with:

- `page_path`
- `section_id`
- `section_type`
- `template_id`
- `title`
- `content_json`
- `style_json`
- `order_index`
- `is_visible`
- `status`
- `updated_by`
- timestamps

Unique key:

```text
(page_path, section_id, status)
```

## RLS Notes

The patch uses the existing `public.current_admin_role()` helper:

- Public users can select published rows only.
- Authenticated owner/editor/viewer can read all rows.
- Owner/editor can insert, update, and delete draft rows.
- Owner can insert and update published rows.
- Viewer remains read-only.

No service-role or secret key is introduced in client code.

## Dashboard Tab Added

New tab:

```text
Section Builder
```

Visible to owner, editor, and viewer. Owner/editor can add, duplicate, edit, and delete/hide drafts. Viewer can browse only.

## Templates Added

- Simple Text Section
- CTA Section
- Feature Cards Section
- Stats Section
- FAQ Section
- Project Highlight Section
- Logo / Partners Strip

Public rendering uses `document.createElement`, `textContent`, and safe attribute assignment. User content is stored as structured JSON, not HTML.

## Add / Duplicate / Delete

- Add creates a draft `cms_custom_sections` row and inserts the section into the current page DOM.
- Duplicate works for custom sections and safe hardcoded sections by converting them into a safe Simple Text template copy.
- Protected animated/fixed/canvas sections are blocked with the requested warning.
- Delete removes custom draft sections.
- Published custom sections are hidden by creating a hidden draft, then require current-page publish to affect public visitors.
- Hardcoded source HTML sections are not permanently deleted.

## Public Hydration

On page load, published custom sections are loaded from `cms_custom_sections`, sanitized, and inserted into `main`. Invalid template IDs are skipped. Visibility and styles are applied through whitelisted values only.

## Security Rules

Blocked:

- Raw HTML editing
- Script tags
- Arbitrary CSS
- `javascript:` URLs
- Data URLs
- Iframes/embeds
- External font injection

Allowed button links:

- Relative URLs
- Internal anchors
- `https://`
- Validated `mailto:`

## Validation

Static checks passed:

```text
node --check admin/admin.js
node --check js/script.js
node --check js/content-registry.js
```

Browser validation passed with a temporary Playwright harness, then the harness was removed. Covered:

- Normal visitor page loads.
- Mega menu still opens.
- Mock admin session enters Admin Mode.
- CMS Dashboard opens.
- Section Builder tab opens.
- Template cards render.
- CTA section add/edit/save works.
- Feature Cards section add works.
- Repeatable item add/move/remove works.
- Custom sections appear in the DOM.
- Custom sections appear in Section Manager.
- Protected duplicate warning appears.
- Mock publish flow opens and completes.
- Mobile dashboard opens Section Builder.
- Public link transition to `about.html` still works.

## Known Limitations

- Real Supabase custom-section writes require running `supabase/phase-8-section-builder.sql` first.
- Local browser validation used the existing `mockAdmin=true` flow because the live backend may not yet have the new table.
- Before the SQL patch is applied, real Supabase requests for `cms_custom_sections` can produce expected REST 404 network messages. Those should disappear after the patch is run.
- Public visitor published-section hydration against real Supabase should be verified after applying the SQL patch.
- This is a safe template builder, not a freeform layout/code builder.

## Manual Testing Checklist

- Run the SQL patch in Supabase SQL Editor.
- Log in as owner.
- Add CTA and Feature Cards sections.
- Edit section content.
- Add, remove, and reorder repeatable items.
- Save draft.
- Publish Current Page.
- Log out and refresh public page.
- Confirm published custom sections appear.
- Confirm draft-only sections do not appear logged out.
- Confirm viewer role cannot save.
- Confirm editor can draft but cannot publish.
- Confirm owner can publish.

## Phase 9

Safe to start Phase 9 after applying the SQL patch and verifying one real Supabase publish cycle.

Recommended next Phase 9 title:

```text
Phase 9: Section Builder Real Supabase QA, Ordering Polish, and Template UX Refinement
```
