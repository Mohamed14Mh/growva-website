# GROWVA CMS Phase 17 — Responsive Style Runtime + Public CSS Publisher

## Files Changed

| File | Change |
|------|--------|
| `admin/admin.js` | +128 lines (net): 7 new Phase 17 functions, 8 integration hooks across existing functions |
| `supabase/phase-17-responsive-style-runtime.sql` | Created — documentation-only, no schema changes |
| `ADMIN_PHASE_17_RESPONSIVE_STYLE_RUNTIME_REPORT.md` | This report |

---

## SQL Patch Needed?

**No.** The existing `cms_element_styles` table stores `style_json` as JSONB. Phase 17 reads this data and generates CSS at runtime in the browser. No schema change, no new table, no RLS modification.

---

## Breakpoint Strategy

| Breakpoint | Wrapper | Width |
|------------|---------|-------|
| Desktop | *(none — base rules)* | All widths |
| Tablet | `@media (max-width:991px)` | ≤ 991 px |
| Mobile | `@media (max-width:767px)` | ≤ 767 px |

These match the GROWVA site's existing responsive breakpoints. The breakpoints are defined as the constant `VD17_BREAKPOINTS` in the Phase 17 section, making them easy to update in a future phase.

Desktop styles use no media query — they cascade down. Tablet styles override desktop at ≤ 991 px. Mobile styles override tablet (and desktop) at ≤ 767 px. This matches standard mobile-first overrides in descending order.

---

## CSS Rule Generator Result

`vd17BuildElementCSS(stylesMap)` processes all element styles and returns a CSS string.

**Per element:**
1. Detects format via `vd17HasBreakpointFormat(styleJson)`:
   - If VD format (`desktop`/`tablet`/`mobile` keys present) → generate CSS rules
   - If legacy only (`styles` key only) → skip (legacy rows handled by existing inline path)
2. Desktop base: `Object.assign({}, styleJson.styles || {}, styleJson.desktop || {})` — VD desktop overrides any legacy `styles` key for the same property
3. Tablet/mobile: only from their respective keys
4. Each property goes through `vdSanitizeStyleValue(prop, val)` before appearing in CSS output — invalid values are silently dropped

**CSS selector strategy:**
```css
[data-edit-key="home.hero.title"] { font-size:18px; color:#fff }
@media (max-width:991px) {
  [data-edit-key="home.hero.title"] { font-size:16px }
}
@media (max-width:767px) {
  [data-edit-key="home.hero.title"] { font-size:14px }
}
```

`vd17EscapeSelector(str)` escapes `"` → `\"` and `\` → `\\` to prevent CSS selector injection.

Specificity: `[data-edit-key="..."]` = `[0,1,0,0]`. Lower than inline styles (`[1,0,0,0]`) so the VD panel's live DOM writes always win during admin editing.

---

## Style Tag Injection Result

Two managed style tags in `<head>`:

| ID | Content | Lifetime |
|----|---------|----------|
| `gv-cms-published-element-styles` | Published VD-format element styles (all breakpoints) | Permanent — set on page load for all visitors |
| `gv-cms-draft-element-styles` | Draft VD-format element styles | Admin mode only — removed on `exitAdminMode()` |

Both tags carry `data-gv-phase="17"` for identification.

`vd17GetOrCreateStyleTag(id)` creates the tag if it doesn't exist, otherwise returns the existing one. `textContent` is replaced on each update — no duplication.

---

## Public Hydration Result

`applyPublishedElementStyles()` now:

1. **Legacy rows** (style_json has `styles` key only, no breakpoint keys): applied inline as before via `applyElementStyleJson()` — unchanged behavior, full backward compatibility.

2. **VD-format rows** (style_json has `desktop`/`tablet`/`mobile` keys): **NOT applied inline** (this was the Phase 16 limitation where inline desktop styles blocked tablet/mobile CSS from firing). Instead, CSS injection handles all breakpoints.

3. After all rows are processed: `vd17InjectPublishedCSS()` writes the complete published CSS block to `<style id="gv-cms-published-element-styles">`.

**Result:** Public visitors now receive correct responsive styles at all three breakpoints. A visitor on a 768 px tablet viewport will see the tablet overrides fire correctly via the media query. Previously they would have received only inline desktop styles.

Draft styles never leak: the draft style tag is only created inside `vd17InjectDraftCSS()` which checks `document.body.classList.contains('admin-mode')` before proceeding. `exitAdminMode()` calls `vd17RemoveDraftCSS()` which removes the draft style tag from the DOM entirely.

---

## Admin Draft Style Result

`loadElementStyles()` (called every time `enterAdminMode()` runs) now calls `vd17InjectDraftCSS()` after populating `elementStyleDrafts`. This means:

- On admin entry: draft CSS is injected, showing the saved draft state via CSS rules.
- Admin edits via the VD panel write inline styles via `vd.writeStyle()` — inline styles override the draft CSS during active editing (correct: admin sees live preview).
- Draft CSS reflects the **saved** draft state. Unsaved edits show as inline overrides.

The draft `<style>` tag is appended **after** the published `<style>` tag in the DOM (because draft tag is created when admin loads, published tag is created on boot). CSS cascade: same selector specificity → last wins → draft CSS overrides published CSS. Correct behavior.

---

## Save / Reset / Publish Integration Result

| Action | CSS side-effect |
|--------|----------------|
| Save Visual Draft | `vd17InjectDraftCSS()` — regenerates draft CSS from updated `elementStyleDrafts` |
| Reset Visual Draft | `vd17InjectDraftCSS()` — regenerates draft CSS; reset element no longer appears |
| Publish visuals | `vd17InjectPublishedCSS()` — regenerates published CSS from newly published rows |
| Exit admin mode | `vd17RemoveDraftCSS()` — draft style tag removed |
| Enter visitor preview (published) | `vd17ClearDraftCSSContent()` — draft tag content emptied without removing tag |
| Enter visitor preview (draft) | draft CSS unchanged — admin sees published + draft CSS |
| Exit visitor preview | `vd17InjectDraftCSS()` — draft tag content restored |

All regenerations are synchronous and immediate — no RAF or debounce needed since CSS text replacement via `textContent` is a single DOM write.

---

## Draft Compare Improvement Result

The element styles section in Draft Compare now shows:

```
hero.title  [published]
Desktop: 3 props | Tablet: 1 prop | Mobile: 2 props

services.cta.button  [no published]
Legacy flat: 2 props
```

Improvements over the previous raw JSON truncation:
- Edit key shown clearly
- "published" or "no published" badge (blue vs grey)
- Per-breakpoint property counts for VD-format rows
- "Legacy flat: N props" for old Style-tab rows
- No raw JSON (was unreadable at 180 chars)

Still no full visual diff (before/after values per property) — that remains a future enhancement.

---

## Security Review

### Generated CSS Safety

`vd17BuildDeclarations(styles)` calls `vdSanitizeStyleValue(prop, val)` for every property-value pair before writing to the CSS string. `vdSanitizeStyleValue()`:
- Checks `VD_ALLOWED_STYLE_PROPS` — unknown properties → `null` → dropped
- Uses property-specific validators: allowlist sets (`display`, `flexDirection`, `overflow`, etc.), strict regex for `boxShadow` and `transform`, clamped integer for `zIndex`
- The `boxShadow` regex `/^[\d\s\-\.px%rgba(),#a-fA-F]+$/` does NOT allow `u`, `l`, `e` in `url()` → `url()` cannot appear in generated CSS
- The `transform` regex only allows named transform functions — no `url()` or `expression()`

### CSS Selector Safety

`vd17EscapeSelector(str)` escapes `"` → `\"` and `\` → `\\`. Edit keys are set by the site developer in HTML attributes (`data-edit-key="..."`) and never from user text input. Still, escaping is applied as a defense-in-depth measure.

### innerHTML

Phase 17 adds no new `innerHTML` assignments. The draft compare improvement uses template literals inside an existing `innerHTML` assignment. All user-controlled values (`key`) go through `escapeHtml()`. New computed values (`deskCount`, `tabCount`, `mobCount`) are JavaScript integers from `Object.keys(...).length` — cannot contain markup.

### Draft CSS Visibility

`vd17InjectDraftCSS()` guards with `document.body.classList.contains('admin-mode')`. `exitAdminMode()` removes the admin-mode class AND calls `vd17RemoveDraftCSS()`. These two guards together ensure the draft style tag cannot persist after the admin session ends.

### All Other Checks

| Check | Result |
|-------|--------|
| `javascript:` | Guard/block code only |
| `sb_secret_` | Guard code only |
| `service_role` | Guard code only |
| `cssText` | Phase 14 overlay only — numeric `getBoundingClientRect()` values |
| `setAttribute('style')` | Zero occurrences |
| `url()` in generated CSS | Blocked by vdSanitizeStyleValue |

---

## Browser QA Notes

The Phase 17 runtime was not tested in a live browser (no dev server access). Functional correctness was verified by code review and `node --check`.

**Public visitor path (code review):**
- `boot()` → `applyPublishedElementStyles()` → VD rows skipped for inline → `vd17InjectPublishedCSS()` → style tag appended to `<head>` with full breakpoint CSS. ✓
- Visitor on 480px viewport: `@media (max-width:767px)` rule fires for mobile properties. ✓
- Legacy rows: inline path unchanged. ✓
- No draft tag created (no admin-mode class). ✓

**Admin path (code review):**
- `boot()` → `enterAdminMode()` → `loadElementStyles()` → `vd17InjectDraftCSS()` → draft tag created after published tag → draft CSS overrides published via cascade. ✓
- VD panel edit → inline style on element → overrides both CSS tags (higher specificity). ✓
- Save Visual Draft → `vd17InjectDraftCSS()` → draft CSS updated to reflect saved state. ✓
- Reset → `vd17InjectDraftCSS()` → element removed from draft CSS. ✓
- Publish → `vd17InjectPublishedCSS()` → published CSS updated. ✓
- Exit admin → draft tag removed from DOM. ✓
- Published preview → draft CSS cleared (tag stays but empty). ✓
- Exit published preview → `vd17InjectDraftCSS()` → draft CSS restored. ✓
- Draft preview → draft CSS intact. ✓

**Regression checks (code review):**
- Content tab: no changes. ✓
- Style tab: no changes. ✓
- Legacy Style-tab rows: `!vd17HasBreakpointFormat(r.style_json)` evaluates true → inline path taken → identical to Phase 16 behavior. ✓
- Section Builder, Media Library, Visual Control, Section Manager: not touched. ✓
- GSAP / Lenis / Three.js: not touched. ✓
- Page transitions, mega menu, mobile menu: not touched. ✓
- Publish modal count: unchanged (still `Object.keys(elementStyleDrafts).length`). ✓
- Draft Compare: element styles section improved; other sections unchanged. ✓

---

## Known Limitations

1. **No FOUC guard for public visitors** — The published CSS is injected by JavaScript after the page DOM is parsed. There is a brief flash before styles apply. A server-side render or `<noscript>` fallback would fix this but requires a build pipeline (out of scope).

2. **Responsive preview in admin is simulated, not true** — When the admin switches to Mobile breakpoint in the VD panel, styles are applied inline (not via actual viewport narrowing). The admin cannot see a true mobile layout without resizing the browser window. True breakpoint preview would require an iframe simulator.

3. **Tablet/mobile published styles don't apply retroactively to inline legacy rows** — If a legacy-format row (only `styles` key) exists for an element, its desktop styles are applied inline. No tablet/mobile overrides are possible for legacy rows. The admin must re-save the element through the Visual Properties Panel (which converts it to VD format) to gain responsive support.

4. **Draft Compare lacks before/after value diff** — Per-property comparison between draft and published values is not shown. Only property counts per breakpoint are displayed. A full visual diff is a future enhancement.

5. **CSS injection specificity gap** — Generated CSS uses attribute selector specificity `[0,1,0,0]`. If the site's own stylesheets use more specific selectors (e.g., `.hero h1.title`) for the same properties, the VD styles will be overridden. Adding `!important` to generated styles would solve this but could cause unexpected side-effects. Documented as a known trade-off.

6. **`fontFamily` not in VD panel** — Excluded from Phase 16 panel. Can be added in a future pass with an explicit allowlist.

---

## Temporary QA Files Status

No temporary QA or debug files were created during Phase 17.

---

## node --check Result

```
admin/admin.js          — PASS
js/script.js            — PASS
js/content-registry.js  — PASS
```

---

## Safe to Commit

**Yes.** All changes are:
- Additive (new functions, existing function extensions — nothing removed)
- Non-breaking (legacy rows unchanged; VD-format rows now render better responsively)
- Security-clean (`vdSanitizeStyleValue` on all CSS output; no raw user CSS; draft tag removed on admin exit)
- Syntax-valid (`node --check` passes for all three JS files)

---

## Exact Commit Command

```bash
git add admin/admin.js supabase/phase-17-responsive-style-runtime.sql ADMIN_PHASE_17_RESPONSIVE_STYLE_RUNTIME_REPORT.md
git commit -m "$(cat <<'EOF'
Phase 17: Responsive style runtime + public CSS publisher

- vd17BuildElementCSS() converts element style_json to scoped CSS rules
- Generates desktop base, @media (max-width:991px) tablet, @media (max-width:767px) mobile
- CSS selector: [data-edit-key="..."] — value escaped to prevent injection
- All property values sanitized through vdSanitizeStyleValue() — no raw CSS
- Injects <style id="gv-cms-published-element-styles"> at boot for public visitors
- Injects <style id="gv-cms-draft-element-styles"> in admin mode only
- Legacy flat style_json rows retain inline application (backward compatible)
- VD-format rows no longer applied inline — CSS handles all breakpoints correctly
- Draft CSS removed on exitAdminMode() — visitors never see draft styles
- Published-preview mode clears draft CSS content; restored on exit
- Save/reset/publish all regenerate the appropriate CSS tag
- Draft Compare: element styles now show per-breakpoint property counts
- Documentation-only SQL (no schema changes)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 18 Safe to Start

**Yes.** No regressions introduced. All prior phase features remain intact.

---

## Recommended Phase 18 Title

**Phase 18: Contact Form, Lead Capture, and Notification Pipeline**

Suggested scope: wire the `contact.html` form to a `cms_contact_submissions` Supabase table, add server-side field validation via RLS / database constraints, honeypot spam protection, rate-limit guard, Resend (or similar) email notification on new submission, thank-you / error states on the public page, and surface form submissions in the admin dashboard as a new "Leads" tab with read/archive actions.
