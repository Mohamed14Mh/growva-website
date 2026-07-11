# GROWVA CMS Phase 13 — Live Content Preview Mode + Revision History + Undo Draft

## Files Changed

| File | Change |
|------|--------|
| `admin/admin.js` | +~230 net lines: Phase 13 state, helper functions, compare tab, improved audit rows, stale warnings, handleAdminClick actions |
| `admin/admin.css` | +130 lines: visitor preview hide rules, exit button, preview bar, compare rows, stale warning/badge, audit filters, diff values |
| `ADMIN_PHASE_13_PREVIEW_REVISION_UNDO_REPORT.md` | This report |

No SQL patch required — all comparison data derives from already-loaded state (`draftRows`, `publishedRows`, `originalValues`, `designTokenDrafts`, etc.).

---

## Feature Summary

### 1. Preview as Visitor

**Trigger:** "Preview as Visitor" button in topbar (added Phase 13).

**Behavior:**
- Adds `body.admin-visitor-preview` class — CSS hides all admin chrome (topbar, panel, dashboard, badges, outlines)
- Injects fixed floating "Exit Preview" button (`#gv-exit-preview-btn`) at bottom-right
- Injects fixed preview bar at top of screen showing preview type
- `visitorPreviewType = 'published'` (default) — applies published content hydration
- `visitorPreviewType = 'draft'` — calls `applyDraftRows()` so the visitor sees the draft state

**Exit:**
- Clicking "Exit Preview" fires `exit-visitor-preview` → `exitVisitorPreview()` → removes classes, removes injected elements, re-applies draft rows

**Security:** Preview is purely client-side display — no data is written. RLS guards all actual Supabase operations.

---

### 2. Draft Compare Tab

**Dashboard tab:** "Draft Compare" (second tab, after Overview).

**What it shows:**
- **Content / Text rows** — each draft row with draft value, published value, and original page value (expandable)
- **Visual Tokens** — token key, draft JSON value vs published JSON value
- **Section Settings** — section key, order, visibility
- **Element Styles** — element key, style JSON preview

**Stale badge:** Any row whose `updated_at` is > 7 days old gets a yellow "stale" badge.

**Per-row actions:**
- "Expand / Collapse" toggle to see full before/after diff
- "Undo Draft" button (editor/owner only) — calls `resetDraftToPublished(editKey)`

**Stale warning banner** — shown at top of compare tab when any stale drafts exist.

---

### 3. Undo Draft (`resetDraftToPublished`)

**What it does:**
1. Confirms with the user ("Undo the draft for 'X'? ...")
2. Deletes the draft row from `cms_content` in Supabase
3. Removes the row from `dashboardDraftRows` in memory
4. Restores the DOM element to the published value (or original value if no published row)
5. Decrements `unsavedCount`
6. Refreshes dashboard

**Permissions:** `canAdminEdit()` required. Viewer blocked.

**Supabase operation:** `DELETE FROM cms_content WHERE id = <draft_row_id>`.

---

### 4. Stale Draft Warning

**Function:** `isDraftStale(row)` — returns true if `row.updated_at` < 7 days ago.

**Function:** `getStaleDraftCount()` — counts stale rows across content drafts, token drafts, section drafts, and element style drafts.

**Warning surfaces:**
- **Overview tab** — warning bar with count + "View Draft Compare" button
- **Publish dialog** — warning bar with count + "View Draft Compare" button
- **Draft Compare tab** — warning banner at top

---

### 5. Improved Audit / Revision Log

**Filter buttons:** all / page / content / media / visual / builder / publish

**State:** `auditFilter` variable (defaults to `'all'`)

**Row improvements:**
- Action label badge with color coding (green for publish, red for delete/archive, default for others)
- Shows `email` field if available (in addition to user_id)
- Only shows old/new value rows if values are present

**Filter persistence:** filter resets to `'all'` on each admin session (not persisted — intentional).

---

## State Variables Added

```js
let visitorPreviewMode = false;     // true while admin UI is hidden
let visitorPreviewType = 'published'; // 'published' | 'draft'
let auditFilter = 'all';            // active audit log filter key
let draftCompareExpanded = null;    // currently expanded compare row edit_key
```

---

## Functions Added

| Function | Purpose |
|----------|---------|
| `isDraftStale(row)` | Returns true if `row.updated_at` > 7 days old |
| `getStaleDraftCount()` | Count of stale rows across all draft types |
| `enterVisitorPreview(type)` | Hide admin UI, inject exit button + preview bar |
| `exitVisitorPreview()` | Restore admin UI, remove injected elements |
| `renderDraftCompareTab()` | Full compare tab HTML with all draft types |
| `renderCompareContentRow(draftRow)` | Single content compare row with expand/undo |
| `resetDraftToPublished(editKey)` | Delete draft in Supabase, restore DOM to published/original |

---

## Functions Modified

| Function | Change |
|----------|--------|
| `renderOverviewTab()` | Added stale draft warning banner with count + compare link |
| `renderAuditRows()` | Replaced with filter-button version; improved row display |
| `openPublishDialog()` | Added stale draft warning + compare link to dialog body |
| `handleAdminClick()` | Added 6 Phase 13 actions |
| `renderDashboardTab()` | Already routing `compare` tab (Phase 13 partial, now completed) |

---

## handleAdminClick Actions Added

| Action | Handler |
|--------|---------|
| `enter-visitor-preview` | `enterVisitorPreview(previewType)` |
| `exit-visitor-preview` | `exitVisitorPreview()` |
| `visitor-preview-type` | Switch `visitorPreviewType`, re-enter preview |
| `compare-reset-draft` | `resetDraftToPublished(editKey)` |
| `compare-expand` | Toggle `draftCompareExpanded` for a row |
| `audit-filter` | Set `auditFilter`, re-render dashboard |

---

## CSS Classes Added

| Class | Purpose |
|-------|---------|
| `body.admin-visitor-preview` | Hides all admin chrome while previewing |
| `.gv-admin-exit-preview` | Fixed floating "Exit Preview" button |
| `.gv-admin-visitor-preview-bar` | Fixed top bar showing preview type |
| `.gv-admin-compare-row` | Left-border accent on compare rows |
| `.gv-admin-compare-row-actions` | Flex row for expand/undo buttons |
| `.gv-admin-stale-warning` | Yellow warning banner for stale drafts |
| `.gv-admin-stale-badge` | Inline yellow badge on stale rows |
| `.gv-admin-audit-filters` | Flex filter button strip |
| `.gv-admin-audit-filter-btn` | Individual filter button (`.is-active` state) |
| `.gv-admin-diff-value` | Monospace diff value block |
| `.gv-admin-diff-value--pub` | Published value (mint color) |
| `.gv-admin-diff-value--orig` | Original value (muted color) |
| `.gv-admin-diff-label` | Small uppercase label ("Draft:", "Published:", etc.) |
| `.gv-admin-section-title` | Section heading in compare tab |
| `.gv-admin-action--danger` | Red danger variant for undo/delete buttons |

---

## Supabase Operations

Phase 13 adds one new write operation:

| Operation | Table | Trigger |
|-----------|-------|---------|
| `DELETE` by `id` | `cms_content` | `resetDraftToPublished()` |

This is guarded by:
- `canAdminEdit()` client-side check (clarity layer)
- RLS policy: "Editors and owners can delete ... drafts" (authoritative)

No new tables or columns. No SQL patch required.

---

## Security Review

- `resetDraftToPublished` requires `canAdminEdit()` — viewer cannot undo drafts
- DOM restoration uses `element.textContent = restoreVal` — no innerHTML
- All compare tab values use `escapeHtml()` before insertion
- `enterVisitorPreview` injects a button via `createElement` (not innerHTML) — no XSS risk
- The preview bar text is set via `textContent` — safe

---

## Regression Notes

- No changes to visitor-mode code paths (script.js, content-registry.js, public HTML)
- GSAP / Lenis / Three.js / Flip / page transitions not touched
- Mega menu / mobile menu not touched
- Section Builder, Media Library, Visual Control, Section Manager unchanged
- `node --check` passes: admin.js ✓ / script.js ✓ / content-registry.js ✓

---

## Remaining Limitations

1. **Image draft undo** — `resetDraftToPublished` only handles text/content rows (`cms_content`). Undoing image, token, section, or element style drafts requires separate per-type undo functions (not implemented in Phase 13; scope was content rows only).
2. **Visitor preview type switcher UI** — `visitor-preview-type` action is wired up but no UI toggle for draft vs published preview was added to the preview bar (the bar is read-only). A future phase could add a "View Draft" / "View Published" toggle inside the preview bar.
3. **Audit log email field** — `email` is shown if present in `dashboardAuditRows`, but the audit log schema stores `user_id`. A join or enrichment step would be needed to populate `email` reliably.
4. **`applyPublishedEdits` guard** — `enterVisitorPreview` calls `applyPublishedEdits && applyPublishedEdits()` for safety (function defined elsewhere in admin.js); if the function name ever changes, this call becomes a no-op silently.

---

## Whether Safe to Commit

**Yes.** All three JS files pass `node --check`. No changes to visitor-mode code, public HTML, or existing database schema. No new security surface introduced.

---

## Exact Commit Command

```bash
git add admin/admin.js admin/admin.css ADMIN_PHASE_13_PREVIEW_REVISION_UNDO_REPORT.md
git commit -m "$(cat <<'EOF'
Phase 13: live content preview mode, draft compare, revision history + undo draft

- Add Preview as Visitor mode: hides all admin chrome, floating exit button,
  preview bar showing published vs draft state
- Add Draft Compare dashboard tab: side-by-side draft vs published vs original
  for content rows, visual tokens, section settings, and element styles
- Add stale draft detection (>7 days): badge on compare rows, warning banners
  in Overview tab and publish dialog, count in getStaleDraftCount()
- Add Undo Draft (resetDraftToPublished): deletes draft from cms_content,
  restores DOM to published/original value, decrements unsaved count
- Improve Revision / Audit Log tab with filter buttons (all/page/content/
  media/visual/builder/publish) and improved row display with action badge
- Add Phase 13 CSS: visitor preview hide rules, exit button, compare rows,
  stale warning/badge, audit filters, diff value blocks, danger button variant
- Wire 6 new handleAdminClick actions for all Phase 13 interactions

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
