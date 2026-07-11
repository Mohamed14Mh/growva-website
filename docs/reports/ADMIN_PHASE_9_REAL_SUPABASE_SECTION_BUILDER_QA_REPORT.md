# ADMIN PHASE 9 REAL SUPABASE SECTION BUILDER QA REPORT

## Scope

Phase 9 covered Section Builder real Supabase QA, section ordering polish, template editor UX validation, and RLS/security review. No Phase 10 features were added. No public redesign, schema rewrite, media-library work, raw HTML editor, CSS editor, React/Vite/Next conversion, or Supabase service-role logic was added.

## Files Changed

- `admin/admin.js`
- `ADMIN_PHASE_9_REAL_SUPABASE_SECTION_BUILDER_QA_REPORT.md`

Temporary Playwright/debug harnesses were used under `output/playwright` during QA and removed before completion.

## Phase 8 SQL Patch Status

Reviewed `supabase/phase-8-section-builder.sql`.

Result: safe/idempotent to rerun.

- Uses `create table if not exists`.
- Uses `create index if not exists`.
- Drops/recreates the table trigger safely.
- Drops/recreates named RLS policies safely.
- Enables RLS on `public.cms_custom_sections`.
- Does not overwrite `schema.sql`.

No Phase 9 SQL patch was required.

## Real Supabase QA Results

Real Supabase backend configured in `admin/supabase-config.js` was used.

- Auth login with the provided temporary admin account: passed.
- `admin_profiles` lookup: passed.
- Detected role: `owner`.
- Add CTA Section template: passed.
- Edit CTA text/link fields: passed.
- Save Section Draft to `cms_custom_sections`: passed.
- Section Manager displayed the real custom section: passed.
- Duplicate custom section: passed.
- Add Feature Cards section: passed.
- Repeatable add/move/remove controls: passed.
- Save custom section style draft: passed.
- Protected duplicate warning for animation-risk section: passed.
- Publish Current Page: passed.
- Published custom section hydrated for logged-out public visitor after refresh: passed.
- Public page transition to `about.html`: passed.
- Mega menu interaction after custom section publish: passed.
- Console errors during real owner flow: none found.

Cleanup was performed after real QA by hiding Phase 9 QA custom sections and publishing that hidden state. A logged-out public check confirmed no Phase 9 QA custom content remained visible on `index.html`.

## Template UX Validation

All seven safe templates were smoke-tested in mock-admin browser mode after the real-backend owner flow:

- `simple_text`
- `cta`
- `feature_cards`
- `stats`
- `faq`
- `project_highlight`
- `logo_strip`

The smoke test verified each template can be added, opened in the editor, has the expected editable fields, can accept plain-text edits, and can save a draft. Repeatable templates were also checked for add/move/remove controls.

## Ordering Polish

Fixed Section Manager ordering so it now operates on real section containers only:

- Before: any element with `data-section-id` could be treated as a section, including editable child fields.
- After: section enumeration is limited to `[data-section-type][data-section-id]` outside admin UI.

Added ordering helpers so section order is applied from custom section rows, section setting rows, or existing DOM order. Reordering now persists:

- custom sections via `cms_custom_sections.order_index`
- hardcoded sections via section setting drafts

Sibling-only movement is enforced so a section is not moved into an unrelated parent container.

## Template UX Refinements

Delete/hide behavior was clarified:

- Draft-only custom sections show `Delete Draft`.
- Published custom sections show `Hide Published`.
- Hiding a published custom section creates a hidden draft and requires publishing the current page before the public page changes.

Supabase loading errors for custom sections now surface clearer admin-facing messages:

- missing/unapplied Section Builder table
- RLS/policy denial
- generic Supabase load failure

Publish now handles custom-section fetch errors explicitly instead of silently treating them as no custom drafts.

## RLS And Security Review

Runtime verified:

- Owner can read `admin_profiles`.
- Owner can read draft and published `cms_custom_sections`.
- Owner can publish custom sections.
- Logged-out visitor can read published `cms_custom_sections`.
- Logged-out visitor cannot read draft `cms_custom_sections`.
- Logged-out visitor cannot read `admin_profiles`.
- Logged-out visitor cannot read publish logs.

Policy reviewed:

- `viewer` can read custom sections through the authenticated admin read policy.
- `editor` can insert/update/delete draft custom sections.
- only `owner` can insert/update published custom sections.

Runtime editor/viewer role tests were not performed because only owner credentials were provided.

Client-side security checks:

- No `sb_secret_` key found in client files.
- No service-role key found in client files.
- Custom section rendering uses DOM creation/text assignment rather than raw custom HTML execution.
- Link and image safety guards remain in place.

## Validation Commands

Passed:

```text
node --check admin\admin.js
node --check js\script.js
node --check js\content-registry.js
```

Browser validation:

- Real owner Supabase Section Builder flow: passed.
- Logged-out public hydration check: passed.
- All-template mock-admin smoke test: passed.
- Normal public visitor check after cleanup: passed.

## Known Limitations

- Editor/viewer role runtime testing still needs dedicated non-owner test accounts.
- Phase 9 did not add new schema, image upload, media library features, or a section builder beyond the existing safe template model.
- Temporary QA harnesses were removed; results are documented here rather than kept as product code.

## Commit And Phase Readiness

Safe to commit: yes.

Safe to start Phase 10: yes, with the recommendation to create editor/viewer QA accounts before testing non-owner publishing boundaries.

Recommended Phase 10 title:

`Phase 10: Media Library Integration With Section Builder Images`
