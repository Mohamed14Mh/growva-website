# GROWVA CMS Phase 18 — Visual Designer Production Hardening + Responsive Preview

## Files Changed

| File | Change |
|------|--------|
| `admin/admin.js` | +118 lines (net): CSS specificity upgrade, FOUC mitigation, responsive preview frame, Draft Compare detailed diff, safety controls, publish modal enhancement |
| `admin/admin.css` | +120 lines: Frame overlay, FOUC class, publish detail, diff row styles |
| `supabase/phase-18-visual-designer-hardening.sql` | Created — documentation-only, no schema changes |
| `ADMIN_PHASE_18_VISUAL_DESIGNER_HARDENING_REPORT.md` | This report |

---

## SQL Patch Needed?

**No.** The existing `cms_element_styles` table is unchanged. Phase 18 is a pure client-side hardening pass.

---

## 1. CSS Specificity Strategy Result

`vd17BuildElementCSS(stylesMap, mode)` now accepts a `mode` parameter:

| Mode | Selector | Specificity |
|------|----------|-------------|
| `'published'` | `html body [data-edit-key="..."]` | (0, 1, 2) |
| `'draft'` | `body.admin-mode [data-edit-key="..."]` | (0, 2, 1) |
| Phase 17 (old) | `[data-edit-key="..."]` | (0, 1, 0) |

**Why it matters:** The old `[0,1,0]` attribute selector lost to typical site CSS like `.hero-section h1` = `(0,1,1)`. The upgraded selectors win over most single and double-class site rules without `!important`.

**Draft wins over published:** The draft selector `(0,2,1)` > published `(0,1,2)`, and the draft `<style>` tag is appended after the published `<style>` tag — both cascade order and specificity ensure admin edits remain visible.

**Inline styles still win:** The VD panel writes inline styles via `el.style[prop]` = specificity `(1,0,0)` — higher than both CSS tags, so live admin preview is always correct.

`vd17InjectPublishedCSS()` passes `'published'` and `vd17InjectDraftCSS()` passes `'draft'`. All other call sites are unchanged.

---

## 2. FOUC Mitigation Result

`boot()` restructured:

```
1. document.body.classList.add('gv-cms-loading')    ← new
2. Safety timer: remove loading after 1000ms         ← new
3. initSupabase() + setupAuthStateListener()
4. await applyPublishedElementStyles()               ← moved EARLIER (was last)
5. clearTimeout(safetyTimer)                         ← new
6. body: gv-cms-loading → gv-cms-ready              ← new
7. loadPublishedEdits, applyPublishedImageEdits, ...
```

**Effect:** VD styles are injected via `<style>` tag before other published content loads. The window between page paint and VD style application is shorter.

**CSS hook:** `body.gv-cms-loading [data-edit-key] { transition: none !important }` — suppresses CSS transitions on editable elements during boot so rapid style changes don't cause janky animations.

**Honest limitation:** True FOUC elimination requires server-side rendering. The `gv-cms-loading` / `gv-cms-ready` body classes are hooks for future extensibility. Content is not hidden during load (no `visibility:hidden` or `opacity:0`) to avoid a blank page flash which would be worse than a style flash.

---

## 3. Responsive Preview Frame Result

New admin-only UI in the Visual tab — a "Responsive preview frame" bar with three buttons: **Tablet Frame** | **Mobile Frame** | **Clear Frame**.

When activated, `vd18ShowResponsiveFrame(bp)` injects `<div id="gv-resp-preview-frame" data-vd-bp="tablet|mobile">` into `<body>`. CSS gives it:

```css
#gv-resp-preview-frame[data-vd-bp="tablet"] {
  position: fixed; top:0; bottom:0;
  left:50%; transform:translateX(-50%);
  width: 991px;
  border-left: 2px solid rgba(97,191,255,0.55);
  border-right: 2px solid rgba(97,191,255,0.55);
  box-shadow: 0 0 0 9999px rgba(0,8,24,0.22);
  pointer-events: none; z-index: 10080;
}
```

- **Tablet frame** (blue): 991px width boundary
- **Mobile frame** (amber): 767px width boundary
- The dimming `box-shadow` shows the out-of-frame area
- `pointer-events: none` — frame is non-interactive
- `z-index: 10080` — above page content, below admin panel
- `refreshScrollLayout()` called on show/hide — GSAP/Lenis safe

The frame is a visual overlay only. It does NOT change the real viewport. Admins must resize the browser to see the true responsive layout. A contextual hint message makes this clear.

**Frame cleanup:**
- `exitAdminMode()` → `vd18RemoveResponsiveFrame()` ✓
- `enterVisitorPreview()` → `vd18RemoveResponsiveFrame()` ✓ (new)
- `exitVisitorPreview()` → frame stays cleared (admin re-activates if needed) ✓

---

## 4. Draft Compare Detailed Diff Result

The element styles section in `renderDraftCompareTab()` now shows a per-property diff for VD-format rows:

```
hero.title  [published]
  DESKTOP
    fontSize    18px → 20px    [changed]
    color       —    → #fff    [added]
  TABLET
    fontSize    16px → 18px    [changed]
```

- **`vd18BuildStyleDiff(draftSj, pubSj, bp)`** — compares draft vs published at the property level for one breakpoint. Returns `[{ prop, pv, dv, status }]` where `status` is `'added'`, `'changed'`, or `'removed'`.
- Unchanged properties are omitted.
- Published value shown with strikethrough styling (`.gv-vd18-diff-from`).
- Draft value shown in green (`.gv-vd18-diff-to`) or with italic "removed" for deleted props.
- Status badge: green (added) / blue (changed) / red (removed).
- All values escaped via `escapeHtml()`. Values truncated to 40 chars.
- Legacy flat rows still show "Legacy flat: N props" — no per-property diff (no breakpoint data to compare).
- If draft has no changes vs published: "No changes vs published" message shown.

---

## 5. Visual Style Safety Controls Result

### Empty Save Prevention

`saveVisualStyleDraft()` now rejects saves when the element has zero VD props set AND no legacy styles:

```js
if (vd18TotalVdProps === 0 && !vd18HasLegacy) {
  statusMessage = 'Nothing to save — no visual styles set for this element.';
  return;
}
```

This prevents accidentally creating empty draft rows.

### Pre-Save Property Summary

The Visual tab save bar now shows a prop count summary when there are stored VD styles:

```
[Save Visual Draft]  Desktop: 3 / Tablet: 1 / Mobile: 0
```

Rendered as a `.gv-vd-save-note` span. Gives the admin a quick at-a-glance of what will be saved per breakpoint before clicking Save.

### Smarter Reset Confirmation

`resetVisualStyleDraft()` now:
1. Blocks the reset entirely if no VD props are stored (shows status message, no dialog)
2. Shows per-breakpoint counts in the confirm message:
   ```
   Reset Visual Designer styles for "hero.title"?

   This will clear:
   - Desktop: 3 props
   - Tablet: 1 prop
   - Mobile: 0 props

   Legacy Style tab overrides are preserved. Published styles are not deleted until you publish.
   ```

---

## 6. Publish Modal Enhancement Result

`openPublishDialog()` now computes for element style drafts:
- **Total property count** across all VD-format drafts (flat legacy props also counted)
- **Affected breakpoints** (which of desktop/tablet/mobile have at least one prop)

Shown in the publish summary:
```
Element style overrides    3
  6 props · Breakpoints: desktop, tablet
```

An advisory note is also shown when element style drafts are present:
> Specificity note: published element styles use `html body [data-edit-key]` selectors. Verify overrides in browser if site selectors are more specific.

---

## 7. Preview as Visitor Consistency Result

`enterVisitorPreview()` calls `vd18RemoveResponsiveFrame()` as its first action. This ensures:
- The frame overlay is cleared before the visitor preview chrome appears
- No DOM collisions between the frame and the exit-preview button/bar
- Body classes `gv-resp-preview-tablet`/`gv-resp-preview-mobile` are always removed

`exitVisitorPreview()` is unchanged — frame remains cleared on exit (intentional; admin re-enables manually).

---

## Security Review

### Generated CSS Safety

No new CSS generation paths introduced. All property values still route through `vdSanitizeStyleValue()`. Edit keys still escaped via `vd17EscapeSelector()`.

### Responsive Preview Frame

Built entirely via `document.createElement()` with no user input. `data-vd-bp` attribute is set to a hardcoded string (`'tablet'` or `'mobile'`) from a button's `data-vd18-bp` attribute — not from user text input. The element carries `aria-hidden="true"` and `pointer-events: none`.

### innerHTML

New `renderDraftCompareTab()` diff HTML:
- `key` → `escapeHtml(key)` ✓
- `d.prop` → `escapeHtml(d.prop)` — property names come from `Object.keys(styleJson[bp])` — Supabase DB values, still escaped ✓
- `d.pv` / `d.dv` → `escapeHtml(String(...).slice(0,40))` ✓
- `d.status` → `escapeHtml(d.status)` — but `d.status` is always `'added'|'changed'|'removed'` (hardcoded in `vd18BuildStyleDiff`) ✓
- Breakpoint labels → `escapeHtml(bp.charAt(0).toUpperCase() + bp.slice(1))` — bp is always `'desktop'|'tablet'|'mobile'` ✓

Publish modal new HTML:
- `vd18BpList` = `[...Set].join(', ')` — set values are always `'desktop'|'tablet'|'mobile'` — still escaped via `escapeHtml()` ✓

### All Other Checks

| Check | Result |
|-------|--------|
| `javascript:` | Guard/block code only |
| `sb_secret_` / `service_role` | Guard code only |
| `cssText` | Phase 14 overlay only (numeric values) |
| `setAttribute('style')` | Zero occurrences |
| `url()` in generated CSS | Blocked by vdSanitizeStyleValue |
| `innerHTML` new assignments | All values escaped ✓ |

---

## Browser QA Notes

Phase 18 was validated by code review and `node --check`. No live browser testing (no dev server access).

**Responsive preview frame (code review):**
- Frame injected as `position:fixed` element → does not affect document flow ✓
- `pointer-events:none` → admin can still click through the frame ✓
- `z-index: 10080` → above page content, below the admin sidebar ✓
- `vd18RemoveResponsiveFrame()` removes body classes and the DOM element → no leakage ✓
- `refreshScrollLayout()` called on show/hide → GSAP/Lenis notified ✓

**FOUC mitigation (code review):**
- `applyPublishedElementStyles()` moved before all other Supabase calls → VD styles applied earliest possible ✓
- 1000ms safety timer → loading class always removed even if Supabase fails ✓
- No content hidden during load → no blank page flash ✓

**CSS specificity (code review):**
- Published: `html body [data-edit-key]` = (0,1,2) → wins over `.section h1` = (0,1,1) ✓
- Draft: `body.admin-mode [data-edit-key]` = (0,2,1) → wins over published ✓
- Inline admin edits = (1,0,0) → always win during live editing ✓
- Draft `<style>` appended after published `<style>` → same-spec cascade order also favors draft ✓

**Regression checks (code review):**
- Content tab: unchanged ✓
- Style tab: unchanged ✓
- Visual tab: breakpoint switcher unchanged, new RP bar added below it ✓
- Section Builder, Media Library, Visual Control, Section Manager: not touched ✓
- GSAP / Lenis / Three.js: not touched; `refreshScrollLayout()` called on frame show/hide ✓
- Page transitions, mega menu, mobile menu: not touched ✓
- Draft Compare: element section enhanced; all other sections unchanged ✓
- Save Draft, Publish, Reset, Undo, Redo, Copy, Paste: all unchanged ✓
- Preview as Visitor (published/draft): both paths unchanged except frame cleanup addition ✓
- exitAdminMode: adds frame removal before existing `vd17RemoveDraftCSS()` ✓
- Public visitor mode: frame element never created (no admin-mode class) ✓

---

## Known Limitations

1. **Responsive preview is visual only** — The frame overlay shows breakpoint boundaries but does not change the real viewport. Admins must resize the browser (or use DevTools responsive mode) to see the true responsive layout.

2. **FOUC not fully eliminated** — A short flash may still occur between page paint and Supabase data load. True FOUC elimination requires server-side rendering or build-time critical CSS inlining.

3. **Draft Compare diff for legacy rows** — Old `{ styles: {} }` format rows still show only a prop count, not a per-property diff. To gain the diff view, the admin should re-save through the Visual Properties Panel (which converts to VD format).

4. **Specificity still insufficient for deeply nested site selectors** — `body.admin-mode [data-edit-key]` = (0,2,1) loses to `.section .inner h1.title` = (0,2,1) if it appears later in the stylesheet. The only remedy without `!important` would be adding another wrapper element or using `:is()` with a higher-specificity argument. Documented as a known trade-off.

5. **FOUC mitigation covers VD styles only** — Published text edits, image edits, and design tokens still load sequentially after VD styles. Their hydration order is unchanged.

---

## Temporary QA Files

No temporary QA or debug files were created during Phase 18.

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
- Additive (new functions, new CSS, extended existing functions — nothing removed)
- Non-breaking (all prior phase features verified in code review)
- Security-clean (all innerHTML values escaped, no new CSS injection vectors, no key exposure)
- Syntax-valid (`node --check` passes)

---

## Exact Commit Command

```bash
git add admin/admin.js admin/admin.css supabase/phase-18-visual-designer-hardening.sql ADMIN_PHASE_18_VISUAL_DESIGNER_HARDENING_REPORT.md
git commit -m "$(cat <<'EOF'
Phase 18: Visual Designer production hardening + responsive preview

- CSS specificity upgrade: published → html body [data-edit-key] (0,1,2);
  draft → body.admin-mode [data-edit-key] (0,2,1); no !important
- FOUC mitigation: body.gv-cms-loading/ready classes; applyPublishedElementStyles
  moved to run first in boot() to minimise VD style flash; 1000ms safety timer
- Responsive preview frame: non-destructive fixed overlay showing tablet (991px)
  or mobile (767px) breakpoint boundary; pointer-events:none; GSAP/Lenis safe;
  cleared on exitAdminMode() and enterVisitorPreview()
- Draft Compare: per-property diff for VD-format rows (added/changed/removed badges,
  published value → draft value per breakpoint); legacy rows unchanged
- Safety controls: empty-save guard in saveVisualStyleDraft(); prop count summary
  in save bar; smarter reset confirm with per-breakpoint counts; reset blocked
  if nothing to reset
- Publish modal: total VD prop count, affected breakpoints, specificity advisory
- Preview consistency: enterVisitorPreview() clears responsive frame first
- Documentation-only SQL; no schema changes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
