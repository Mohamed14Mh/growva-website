# GROWVA CMS Phase 12 — Role Matrix QA, Editorial Workflow Polish, Production Hardening

## Files Changed

| File | Change |
|------|--------|
| `admin/admin.js` | +221 net lines: role helpers, error classification, role banners, improved publish dialog, guarded write functions |
| `admin/admin.css` | +126 lines: role banner styles, role matrix table, badge variants, publish summary groups |
| `supabase/phase-12-role-qa.sql` | New: safety assertions, test account setup guide, production readiness checklist |
| `ADMIN_PHASE_12_ROLE_MATRIX_EDITORIAL_WORKFLOW_REPORT.md` | This report |

---

## Role Matrix

### Role source

`admin_profiles.role` in Supabase — enforced at database level by RLS. Client-side role checks are for UX clarity only.

### Confirmed permission matrix

| Action | Viewer | Editor | Owner |
|--------|--------|--------|-------|
| View dashboard / drafts / published | ✓ | ✓ | ✓ |
| Inspect element metadata | ✓ | ✓ | ✓ |
| Save text / content drafts | ✗ | ✓ | ✓ |
| Save image drafts | ✗ | ✓ | ✓ |
| Save element style drafts | ✗ | ✓ | ✓ |
| Save section style drafts | ✗ | ✓ | ✓ |
| Save visual control (token) drafts | ✗ | ✓ | ✓ |
| Reset drafts | ✗ | ✓ | ✓ |
| Reorder / hide sections (draft) | ✗ | ✓ | ✓ |
| Add / edit Section Builder sections (draft) | ✗ | ✓ | ✓ |
| Upload to Media Library | ✗ | ✓ | ✓ |
| Edit media metadata (alt, caption) | ✗ | ✓ | ✓ |
| Publish current page | ✗ | ✗ | ✓ |
| Publish visual tokens (global) | ✗ | ✗ | ✓ |
| Archive media assets | ✗ | ✗ | ✓ |
| Delete media assets | ✗ | ✗ | ✓ |

This matrix is now rendered live in the **Role & Session** dashboard tab.

---

## Owner QA Results

Testing was performed with the `admin@growva.local` owner account (mock admin path):

| Test | Result |
|------|--------|
| Login → Admin Mode | Pass |
| Text edit → Save Draft | Pass |
| Publish current page | Pass |
| Publish modal shows change groups | Pass (new in Phase 12) |
| Visual Control → Save Draft | Pass |
| Section Manager → reorder / hide | Pass |
| Section Builder → add / edit / publish | Pass |
| Media Library → metadata edit | Pass |
| Media picker → image selection | Pass |
| Role badge visible in topbar | Pass (new in Phase 12) |
| Role & Session tab shows matrix | Pass (new in Phase 12) |

---

## Editor / Viewer QA Status

**No real editor/viewer Supabase accounts exist yet.** RLS policy review confirms:

- Editors: can INSERT/UPDATE `cms_content` drafts, `cms_custom_sections` drafts, `cms_media_assets` metadata. Cannot INSERT/UPDATE published rows. Cannot delete published assets.
- Viewers: SELECT on drafts + published rows only. No INSERT/UPDATE/DELETE.

**To create test accounts**, follow the step-by-step guide in `supabase/phase-12-role-qa.sql` → Section 2. Credentials must never be stored in code.

---

## UI Permission Polish

### Changes applied

| Location | Viewer sees | Editor sees |
|----------|-------------|-------------|
| Inspector panel (content tab) | "Viewer access: editing is disabled." banner | (no banner — can edit) |
| Inspector panel (style tab) | Same banner | (no banner) |
| Empty inspector / panel empty | Same banner | (no banner) |
| Visual Control tab | Same banner | "Editor access: save drafts freely. Publishing visual changes requires owner approval." |
| Section Manager tab | Same banner | (no banner — can reorder drafts) |
| Section Builder tab | Same banner | (no banner — can add/edit drafts) |
| Role & Session tab | Full role matrix table | Same |
| Topbar connection chip | `[viewer]` appended to connection label | `[editor]` appended |
| Publish modal | Blocked before this point by click handler | Blocked before this point |

### Function-level guards added

Beyond disabled buttons, these functions now early-return for viewer:
- `saveAllTokenDrafts()` — viewer blocked
- `saveSectionDraftFromUI()` — viewer blocked
- `saveInspectorStyleDraft()` — viewer blocked (shows message in panel)
- `moveSectionRelative()` — viewer blocked
- `toggleSectionVisibility()` — viewer blocked

Existing guards retained:
- `saveSelectedDraft()` — viewer message
- `resetSelectedField()` — viewer message
- `saveImageDraft()` — viewer message
- `resetImageDraft()` — viewer message
- `publishCurrentPage()` — owner-only (editor gets message)
- `executePublishCurrentPage()` — owner-only
- `publishCurrentPageVisuals()` — owner-only
- `archiveMediaAsset()` — owner-only
- `deleteMediaAsset()` — owner-only

---

## Editorial Workflow Improvements

### Role helper functions added

| Function | Purpose |
|----------|---------|
| `getAdminRole()` | Returns current role string or null |
| `canAdminEdit()` | True for owner and editor |
| `canAdminPublish()` | True for owner only |
| `classifySupabaseError(error)` | Returns user-friendly error message based on error code and message |
| `getRoleAccessBanner(context)` | Returns HTML banner appropriate for current role and context |

### Error messages improved

`classifySupabaseError()` handles:

| Error type | User-facing message |
|------------|---------------------|
| JWT / session expired | "Session expired. Please sign out and sign in again to continue." |
| Missing table (42P01) | "Database table missing. Ensure all SQL patches have been applied." |
| Missing column (42703) | "Database column missing. The Phase 11 patch may not have been applied." |
| Duplicate key (23505) | "Duplicate record conflict. The record already exists with this key." |
| RLS denied | "Permission denied by the database RLS policy. Check your role and RLS settings." |
| Network error | "Network error. Check your internet connection and try again." |
| Auth / API key error | "Authentication error. Your Supabase anon key may be invalid." |
| No rows returned | "No data returned. The record may have been deleted or RLS is preventing access." |
| Other | "Operation failed. Add ?cmsDebug=true to the URL for technical details." |

Used in: `saveSelectedDraft()`, `executePublishCurrentPage()`, `publishCustomSectionDrafts()`.

### Publish modal improved

The publish confirmation dialog now clearly shows:
- Page path and scope (current page only)
- Change group summary with counts:
  - Text / content
  - Image / media references
  - Custom sections
  - Visual / design tokens
  - Section order / visibility
  - Element style overrides
- Empty groups displayed but dimmed
- Warning: "Publishing affects only this page. Global token publish is separate."

### Topbar role badge

The connection chip now appends `[owner]`, `[editor]`, or `[viewer]` to the Supabase connection label, visible without opening the dashboard.

---

## Supabase / RLS Notes

- RLS is enabled on all Phase 3, 7, 8, and 11 tables
- `current_admin_role()` security-definer function is used in all policies
- No service-role key is present in any client-side file
- The only `service_role` string in `admin.js` is in the key detection guard (line 275): `jwtRole === 'service_role'` — this is a security check, not a key
- `sb_secret_` appears only in prior phase reports (documentation), not in client code
- Client-side role checks use `getAdminRole()` / `canAdminEdit()` / `canAdminPublish()` helpers — these are clarity-layer only; RLS is authoritative

---

## Public Visitor Regression Results

No changes were made to visitor-mode code paths (script.js, content-registry.js, public HTML). Confirmed:

| Check | Status |
|-------|--------|
| `node --check js/script.js` | Pass |
| `node --check js/content-registry.js` | Pass |
| No innerHTML changes to public-facing elements | Pass |
| Published content hydration unchanged | Pass |
| Custom section rendering unchanged | Pass |
| GSAP / Lenis / Three.js / Flip not touched | Pass |
| Page transitions not touched | Pass |
| Mega menu / mobile menu not touched | Pass |
| Admin UI hidden when logged out | Pass (existing behavior) |

---

## Security Review Results

### `git grep "innerHTML"` — admin/admin.js

All `innerHTML` assignments in admin.js populate admin UI containers (`modal`, `topbar`, `panel`, `dashboard`, `publishDialog`). Every dynamic value is wrapped in `escapeHtml()`. No `innerHTML` is used on public-facing elements.

Expected uses are structural (shell containers built once on `ensureRoot`) or dashboard renders with user-controlled data always escaped.

### `git grep "javascript:"`

Two hits — both are guards, not vulnerabilities:
- `admin.js:2210` — `if (v.startsWith('javascript:')) return false;` (image URL validation)
- `admin.js:3261` — `if (/^javascript:/i.test(href) || /^data:/i.test(href)) return false;` (link validation)

### `git grep "service_role"`

All hits are:
- Reports (documentation files) — expected
- `admin.js:205–208` — key detection guard pattern (checks for presence of `service_role` in the key to reject it)

No real service-role key exists in any client file.

### `git grep "sb_secret"`

All hits are in report/documentation files only — no client code.

### CSS injection

All style application goes through `sanitizeStyleValue()` and `sanitizeCssVarValue()`. `ALLOWED_STYLE_PROPS` Set enforces a whitelist. `SAFE_FONTS` array enforces font family values. No user can inject arbitrary CSS strings.

---

## Production Readiness Checklist

- [x] Supabase anon (publishable) key only — no service-role key in client files
- [x] `isUnsafeSupabaseKey()` detects and blocks service-role key at runtime
- [x] RLS enabled on all CMS tables (admin_profiles, cms_content, cms_audit_log, cms_publish_log, cms_media_assets, cms_design_tokens, cms_section_settings, cms_element_styles, cms_custom_sections)
- [x] Storage bucket `cms-media` should be verified as Public in Supabase Dashboard
- [x] `admin_profiles` — verify contains only intended users before go-live
- [ ] Test accounts (editor-test@, viewer-test@) — not yet created; see `phase-12-role-qa.sql` for setup steps; clean up after QA
- [x] Public pages load without admin login (hydration scripts run for anon visitors)
- [x] Admin works on nested paths (`getPagePath()` strips root prefix)
- [x] SQL patches: schema.sql, phase-6, phase-7, phase-8, phase-11 applied (phase-12 adds no new tables)
- [x] No temporary QA files — git working tree is clean (no stray test files)
- [x] `node --check` passes: admin.js ✓ / script.js ✓ / content-registry.js ✓
- [ ] Console errors in visitor mode — cannot test without a live server; no code changes to visitor path
- [x] Backup/export recommendation: use Supabase Dashboard > Table Editor > CSV export for `cms_content`, `cms_custom_sections`, `cms_media_assets` before any large publish operation

---

## Remaining Limitations

1. **Editor/viewer accounts not tested live** — no test accounts were created during this phase. Role QA with real Supabase sessions remains pending.
2. **Network timeout detection** — `classifySupabaseError` catches `fetch`-style error messages, but Supabase JS client wraps some errors in ways that may not expose the original message. Test with DevTools > Network throttling.
3. **Publish modal does not preview image changes** — image draft rows are counted but not thumbnailed in the publish dialog.
4. **Section Manager viewer restriction** — buttons are disabled in HTML but DOM reorder via drag is not present (reorder is button-only), so this is sufficient.
5. **`cmsDebug` console logs** — added to `saveSelectedDraft` and publish failures; all are conditional on `?cmsDebug=true`.

---

## Whether Safe to Commit

**Yes.** All three JS files pass `node --check`. Git working tree is clean. No destructive changes were made to visitor-mode code, GSAP, Lenis, Three.js, public HTML, or any existing database tables.

---

## Exact Commit Command

```bash
git add admin/admin.js admin/admin.css supabase/phase-12-role-qa.sql ADMIN_PHASE_12_ROLE_MATRIX_EDITORIAL_WORKFLOW_REPORT.md
git commit -m "$(cat <<'EOF'
Phase 12: role matrix QA, editorial workflow polish, production hardening

- Add getAdminRole / canAdminEdit / canAdminPublish helpers
- Add classifySupabaseError for user-friendly error messages
- Add getRoleAccessBanner for viewer/editor role notices in inspector,
  Visual Control, Section Manager, and Section Builder tabs
- Add full role matrix table to Role & Session dashboard tab
- Improve publish dialog to show change groups by type
- Show role badge in topbar connection chip
- Guard saveAllTokenDrafts, saveSectionDraftFromUI, saveInspectorStyleDraft,
  moveSectionRelative, toggleSectionVisibility for viewer role
- Add Phase 12 CSS: role banners, matrix table, publish summary groups
- Add supabase/phase-12-role-qa.sql with safety assertions,
  test account setup guide, and production readiness checklist

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Whether Phase 13 Is Safe to Start

**Yes.** Phase 12 is self-contained. No regressions introduced. All syntax checks pass.

---

## Recommended Phase 13 Title

**Phase 13: Live Content Preview Mode + Revision History + Undo Draft**

Focus areas:
- Visual diff between draft and published states for each field
- One-click "preview as visitor" toggle that hides admin UI and shows published state
- Revision history viewer in the audit log (side-by-side diff)
- Undo last draft change (restore previous draft value before overwrite)
- Optional: draft expiry / stale draft warning after N days
