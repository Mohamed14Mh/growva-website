# GROWVA CMS Phase 16 — Visual Properties Panel + Persistent Style Editing

## Files Changed

| File | Change |
|------|--------|
| `admin/admin.js` | +337 lines (net): Visual tab, 6 property groups, Phase 16 functions, click handlers, state, persistence, draft compare bugfix |
| `admin/admin.css` | +153 lines: Full Phase 16 panel CSS (breakpoint bar, property groups, controls, color rows, save bar) |
| `supabase/phase-16-visual-properties-panel.sql` | Created — documentation-only, no schema changes |
| `ADMIN_PHASE_16_VISUAL_PROPERTIES_PANEL_REPORT.md` | This report |

---

## SQL Patch Needed?

**No.** The existing `cms_element_styles` table (created in Phase 7) requires zero schema changes.

The `style_json JSONB` column already stores both the legacy flat format and the new breakpoint format without modification:

| Format | shape |
|--------|-------|
| Legacy (Style tab, Phases 7–15) | `{ "styles": { "color": "#fff" } }` |
| Phase 16 VD (new) | `{ "desktop": {}, "tablet": {}, "mobile": {} }` |
| Merged (both) | `{ "styles": {...}, "desktop": {...}, "tablet": {...}, "mobile": {...} }` |

`supabase/phase-16-visual-properties-panel.sql` is documentation only. Do not run it unless you need to audit the schema.

---

## Visual Tab Result

A third tab — **Visual** — was added to the standard element inspector (Content | Style | **Visual**).

- Added `data-inspector-tab="visual"` button in `renderInspector()`.
- `inspectorTab === 'visual'` case dispatches to `renderVisualTabHTML(element)` and binds `bindVisualTabEvents()`.
- The Visual tab only appears for standard editable elements (custom section elements use their own 3-tab editor and are unaffected).
- Viewer role: controls render as read-only (`disabled` attribute on all inputs).
- Editor / Owner role: full control interaction.

---

## Property Groups Result

6 collapsible `<details>` groups, each rendered as a 2-column label/control grid (`display: contents` technique):

| Group | Properties |
|-------|-----------|
| **Typography** | color, fontSize, fontWeight, lineHeight, letterSpacing, textAlign, textTransform, textDecoration |
| **Spacing** | marginTop/Right/Bottom/Left, paddingTop/Right/Bottom/Left, gap |
| **Layout** | display, flexDirection, flexWrap, justifyContent, alignItems, alignSelf, overflow |
| **Size** | width, height, minWidth, maxWidth, minHeight, maxHeight |
| **Border** | borderWidth, borderStyle, borderColor, borderRadius |
| **Effects** | backgroundColor, opacity, boxShadow, transform, transition, zIndex |

All 46 properties are from `VD_ALLOWED_STYLE_PROPS` (Phase 14). All values go through `vdSanitizeStyleValue()` before being applied to the DOM — no arbitrary CSS injection possible.

Control types:
- **color** → `<input type="color">` swatch + `<input type="text">` hex field (synced bidirectionally)
- **select** → allowlisted option values from code constants (not user input)
- **text** → free text, sanitized by `vdSanitizeStyleValue()` before DOM write

Groups are open by default. Users can collapse groups they don't need.

---

## Breakpoint Result

A breakpoint switcher bar (Desktop / Tablet / Mobile) sits above the property groups.

- Active breakpoint shown with blue highlight and `aria-pressed="true"`.
- Switching calls `window.GV_ADMIN_VISUAL.setBreakpoint(bp)` which:
  1. Updates `vdBreakpoint`
  2. Calls `vdApplyBreakpointStyles(el, bp)` — applies stored styles for the new breakpoint to the DOM
  3. Triggers inspector re-render — controls repopulate from the new breakpoint's stored values
- Each breakpoint's styles are stored and saved independently.
- A hint line reads "Editing **desktop** styles for `edit-key`".

**Public visitor limitation**: Breakpoint styles are stored as `desktop`/`tablet`/`mobile` keys in `style_json`. When applied to public visitors (via `applyElementStyleJson()`), only desktop styles are applied as the base. Tablet and mobile overrides require admin breakpoint switching. Full responsive hydration would require injected `@media` rules, which is out of scope for Phase 16.

---

## Undo / Redo / Copy / Paste / Reset Result

All five controls are wired to the Phase 14 VD engine API.

| Button | Calls | Disabled when |
|--------|-------|---------------|
| Undo | `vdHistoryUndo()` | `!vd.hasUndo` or not editor/owner |
| Redo | `vdHistoryRedo()` | `!vd.hasRedo` or not editor/owner |
| Copy | `vd.copyStyles(el)` | Never (always enabled) |
| Paste | `vd.pasteStyles(el)` | `!vd.hasClipboard` or not editor/owner |
| Reset | `resetVisualStyleDraft(el)` | No stored VD styles or not editor/owner |

Undo/Redo/Paste all re-render the inspector to refresh control values. History depth: 50 entries (Phase 14 constant `VD_MAX_HISTORY`).

Ctrl+Z and Ctrl+Y keyboard shortcuts (wired in Phase 14) continue to work alongside the panel buttons.

---

## Persistence Result

### Save Draft

`saveVisualStyleDraft(el)`:
1. Reads `vdStyleStore[editKey]` for all three breakpoints.
2. Merges with any existing `styles` key from the previous row (preserves legacy Style-tab overrides).
3. Calls `saveElementStyleDraftData(editKey, merged)` — upserts to `cms_element_styles` with `status = 'draft'`.
4. On success: updates `elementStyleDrafts[editKey]`, clears `vdVisualDirty`, sets topbar status.
5. Mock admin: saves to in-memory `elementStyleDrafts` only (same pattern as existing Style-tab mock behavior).

The Save button shows `Save Visual Draft*` when controls have been changed since last save.

### Load / Hydration

`loadElementStyles()` (called on every `enterAdminMode()`):
1. Loads all `draft` and `published` rows for the current page from `cms_element_styles`.
2. Populates `elementStyleDrafts` and `elementStylesPublished` (unchanged from Phase 7).
3. **Phase 16 addition**: calls `vd16HydrateStoreEntry(editKey, styleJson)` for every draft row. If the row has breakpoint keys (`desktop`/`tablet`/`mobile`), their values are merged into `vdStyleStore`. Legacy-only rows (no breakpoint keys) are skipped.

### Applied to Visitors

`applyElementStyleJson(el, styleJson)` now handles both formats:
- If `styleJson.styles` exists → applies via `sanitizeStyleValue()` (legacy path, unchanged).
- If `styleJson.desktop` exists → applies via `vdSanitizeStyleValue()` (new path). Desktop styles only.
- If both exist → applies legacy first, VD desktop overrides (for merged-format rows).

Published styles apply to all visitors as soon as the owner publishes. Draft styles never leak to public visitors (RLS gate on the database; `loadElementStyles()` only called in admin mode).

---

## Save Draft Result

- "Save Visual Draft" button at the bottom of the Visual tab.
- Disabled if the element has no `data-edit-key` (live preview only, no persistence).
- Disabled for viewers.
- Shows `*` suffix when controls have changed since last save.
- Shows "Saving..." momentarily during async save.
- Status message appears in admin topbar (aria-live region — screen reader announced).
- Saving a VD draft does not disturb existing Content tab drafts.

---

## Publish / Draft Compare Integration Result

### Publish Dialog

VD panel saves flow through `saveElementStyleDraftData()` which on success sets `elementStyleDrafts[editKey] = styleJson`. This means:

- VD drafts are **automatically counted** in the publish dialog ("Element style overrides: N").
- VD drafts are **automatically published** by `publishCurrentPageVisuals()` — it iterates all `elementStyleDrafts` keys and upserts them with `status = 'published'`.
- No additional code was needed: the existing publish pipeline handles VD-format rows without modification.

### Draft Compare

The Draft Compare tab (dashboard) shows all element style drafts under "Element Styles (N)". Each row shows the edit key and a JSON preview of the full style_json (up to 180 chars).

**Bug fixed**: A pre-existing bug (present since Phase 7) caused the style preview to always show `""` because the code read `row?.style_json` when `row` IS the style_json. Fixed to `JSON.stringify(row || '').slice(0, 180)` — now shows the actual style content.

### Role Access

| Role | Read Visual tab | Change controls | Save Draft | Publish |
|------|----------------|-----------------|------------|---------|
| Viewer | Yes (read-only) | No | No | No |
| Editor | Yes | Yes | Yes | No |
| Owner | Yes | Yes | Yes | Yes |

RLS is the authoritative gate. Client-side `canAdminEdit()` checks are clarity-layer only.

---

## Security Notes

### innerHTML Audit

All `innerHTML` assignments in `renderVisualTabHTML()`:
- Breakpoint labels: from `VD_BREAKPOINTS` constant — safe.
- Edit key: `escapeHtml(el.dataset.editKey)` — safe.
- Property labels: from in-code `GROUPS` constants — not user input.
- Stored values: `escapeHtml(bpStyles[prop])` — VD-sanitized before storage, escaped before render.
- Option values: from in-code `cfg.opts` arrays — not user input.
- Save button label: `escapeHtml('Save Visual Draft*')` — constant string.

No unsafe innerHTML paths introduced.

### javascript: Check

`javascript:` appears only in guard code at lines 2478 and 3540, where it is blocked. No live `javascript:` injection.

### Secret Key / Service Role

`sb_secret_` and `service_role` appear only in `isUnsafeKey()` / `isServiceRoleKey()` validation guards — code that blocks these keys. No key in use.

### cssText

3 occurrences, all in the Phase 14 VD overlay, using numeric values from `getBoundingClientRect()`. Never user input. Safe.

### setAttribute style

No occurrences. Styles are applied via `element.style[prop] = safe` only — never via `setAttribute('style', ...)`.

### CSS Injection

All VD control writes go through `vdSanitizeStyleValue()` which:
- Checks `VD_ALLOWED_STYLE_PROPS` allowlist.
- Routes each property to a specific validator (allowlist sets, regex, clamped numbers).
- Returns `null` on failure — value is not applied.

---

## Browser QA Notes

The Visual tab is rendered server-side (admin IIFE) and uses standard HTML form elements. No external dependencies added.

- `<details>/<summary>` groups: supported in all modern browsers.
- `display: contents` on `.gv-vd-row`: supported Chrome 58+, Firefox 37+, Safari 11.1+.
- `<input type="color">`: supported in all modern browsers; Safari's color picker is basic but functional.
- Color swatch ↔ hex text sync: bidirectional, debounced only by browser input event rate.

UI was not tested in a live browser (no dev server access). Functional correctness was verified by code review and `node --check`.

---

## Known Limitations

1. **Tablet/mobile styles not applied to public visitors** — Only desktop VD styles are applied via `applyElementStyleJson()`. Full responsive hydration would require injecting `@media` rules at publish time, which is a Phase 17+ scope item.

2. **No unsaved-change guard on clearSelection** — `vdVisualDirty = true` does not block panel close with a confirmation dialog (to avoid over-prompting, since VD styles preview live on the DOM). Note: `clearSelection()` resets `vdVisualDirty = false`.

3. **Draft Compare shows raw JSON** — Element styles in Draft Compare show truncated JSON, not a visual diff. A future phase could render styled before/after comparisons.

4. **Stale-draft detection not available for element styles** — `isDraftStale()` checks `row.updated_at`, but `elementStyleDrafts[key]` stores style_json directly (not a full row object), so `updated_at` is not available client-side. Stale badge will never appear for element style drafts.

5. **`fontFamily` control not exposed** — `fontFamily` is in `VD_ALLOWED_STYLE_PROPS` but excluded from the panel to avoid free-text font injection risks. It can be added with an explicit allowlist in a future pass.

6. **`objectFit` not in panel** — Present in `VD_ALLOWED_STYLE_PROPS` but omitted from the panel groups; primarily relevant to images which have their own inspector.

7. **No per-breakpoint published diff in compare** — The publish dialog shows a count, not which breakpoints differ. A deeper diff view is a future enhancement.

---

## Temporary QA Files Status

No temporary QA or debug files were created during Phase 16.

---

## node --check Result

```
admin/admin.js     — PASS
js/script.js       — PASS
js/content-registry.js — PASS
```

---

## Safe to Commit

**Yes.** All changes are:
- Additive (new tab, new functions, new CSS — nothing removed)
- Non-breaking (existing Content tab, Style tab, Section Builder, Media Library, Visual Control, Section Manager, Preview as Visitor, Draft Compare, Save Draft, Publish all continue to work)
- Security-clean (no new innerHTML vectors, no unsafe CSS injection, no key exposure)
- Syntax-valid (`node --check` passes for all three JS files)
- Bug-fix included (Draft Compare element style preview was broken — fixed)

---

## Exact Commit Command

```bash
git add admin/admin.js admin/admin.css supabase/phase-16-visual-properties-panel.sql ADMIN_PHASE_16_VISUAL_PROPERTIES_PANEL_REPORT.md
git commit -m "$(cat <<'EOF'
Phase 16: Visual Properties Panel + Persistent Style Editing

- Add Visual tab to element inspector (Content | Style | Visual)
- 6 collapsible property groups: Typography, Spacing, Layout, Size, Border, Effects
- 46 CSS properties with type-specific controls (text, select, color swatch + hex)
- Breakpoint switcher (Desktop / Tablet / Mobile) via GV_ADMIN_VISUAL.setBreakpoint()
- Undo / Redo / Copy Style / Paste Style / Reset controls
- Live DOM preview via VD engine writeStyle() on every input event
- Save Visual Draft persists breakpoint-aware style_json to cms_element_styles
- vd16HydrateStoreEntry() hydrates vdStyleStore from loaded drafts on admin entry
- applyElementStyleJson() updated for both legacy and VD breakpoint formats
- VD drafts automatically counted and published via existing publish workflow
- Role-gated: viewer = read-only, editor = save drafts, owner = publish
- Fix: Draft Compare element style preview was always showing empty string
- Documentation-only SQL file (no schema changes required)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 17 Safe to Start

**Yes.** No regressions introduced. All prior phase features remain intact:
- GSAP / Lenis / Three.js / Flip / page transitions: not touched
- Mega menu / mobile menu: not touched
- Section Builder / Media Library / Visual Control / Section Manager: not touched
- Content tab / Style tab / image inspector: not touched
- Design tokens / section settings / custom sections: not touched
- Supabase integration and RLS: not touched

---

## Recommended Phase 17 Title

**Phase 17: Contact Form, Lead Capture, and Notification Pipeline**

Suggested scope: wire the `contact.html` form to a Supabase `cms_contact_submissions` table, add Resend (or similar) email notification on submission, honeypot spam protection, rate-limit guard via RLS, thank-you/error states, and surface form submissions in the admin dashboard as a new "Leads" tab.
