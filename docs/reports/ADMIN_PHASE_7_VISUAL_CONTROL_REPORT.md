# GROWVA CMS Phase 7 — Visual Control Center + Section Manager + Editor Safe Mode

## What Was Built

Phase 7 adds a full Visual Control Center, Section Manager, and Editor Safe Mode to the existing static HTML/CSS/JS CMS. No build tools, no React, no service-role key. All persistence uses Supabase RLS.

---

## Files Created / Modified

### New Files

| File | Purpose |
|------|---------|
| `supabase/phase-7-visual-controls.sql` | SQL patch: three new tables + full RLS |
| `ADMIN_PHASE_7_VISUAL_CONTROL_REPORT.md` | This report |

### Modified Files

| File | What Changed |
|------|-------------|
| `admin/admin.js` | Editor Safe Mode, Visual Control tab, Section Manager tab, Inspector Style tab, all Phase 7 functions, boot/enterAdminMode/exitAdminMode wired up |
| `admin/admin.css` | Safe mode cursor suppression, inspector tab strip, visual control UI, section manager UI, inspector style panel |

---

## Database Changes

### `public.cms_design_tokens`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `scope` | text | `'global'` or `'page'` |
| `page_path` | text | NULL for global scope |
| `token_key` | text | CSS variable name without `--` prefix |
| `value_json` | jsonb | `{ "value": "#B1FA20" }` |
| `status` | text | `'draft'` or `'published'` |
| `updated_by` | uuid | References `auth.users(id)` |

Unique constraint: `(scope, coalesce(page_path, ''), token_key, status)`

### `public.cms_section_settings`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `page_path` | text | Page this setting applies to |
| `section_id` | text | Matches `data-section-id` attribute |
| `order_index` | int | DOM order position |
| `is_visible` | boolean | Whether section is visible |
| `style_json` | jsonb | `{ "paddingTop": "80px", ... }` |
| `status` | text | `'draft'` or `'published'` |

Unique constraint: `(page_path, section_id, status)`

### `public.cms_element_styles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `page_path` | text | Page this style applies to |
| `edit_key` | text | Matches `data-edit-key` attribute |
| `section_id` | text | Parent section (nullable) |
| `style_json` | jsonb | `{ "styles": { "color": "#fff", "fontSize": "18px" } }` |
| `status` | text | `'draft'` or `'published'` |

Unique constraint: `(page_path, edit_key, status)`

---

## RLS Policy Summary

All three tables follow the same pattern:

| Action | Anon | Viewer | Editor | Owner |
|--------|------|--------|--------|-------|
| Read published | ✓ | ✓ | ✓ | ✓ |
| Read all (incl. drafts) | ✗ | ✓ | ✓ | ✓ |
| Insert draft | ✗ | ✗ | ✓ | ✓ |
| Update draft | ✗ | ✗ | ✓ | ✓ |
| Delete draft | ✗ | ✗ | ✓ | ✓ |
| Insert published | ✗ | ✗ | ✗ | ✓ |
| Update published | ✗ | ✗ | ✗ | ✓ |

---

## New JavaScript Functions (admin/admin.js)

### Safety + Sanitization

| Function | Purpose |
|----------|---------|
| `sanitizeColorValue(v)` | Validates hex (`#RGB`/`#RRGGBB`/`#RRGGBBAA`) and `rgb()`/`rgba()` — rejects all others |
| `sanitizeSizeValue(v)` | Validates `px`, `rem`, `em`, `%`, `vw`, `vh` values — bare integers get `px` appended |
| `sanitizeStyleValue(prop, v)` | Validates a CSS property+value pair against `ALLOWED_STYLE_PROPS` whitelist |
| `sanitizeCssVarValue(v)` | Validates a token value as color, size, or safe font name |

### CSS Token Application

| Function | Purpose |
|----------|---------|
| `applyTokenToRoot(key, valueJson)` | Sets `--{key}` on `document.documentElement` after sanitization |
| `applyAllDraftTokensPreview()` | Applies all draft tokens to root for instant live preview |
| `applyPublishedDesignTokens()` | On page load: fetches published tokens and applies them (global first, page overrides second) |
| `applyPublishedSectionSettings()` | On page load: applies visibility, order, and style for published section settings |
| `applyPublishedElementStyles()` | On page load: applies published style overrides to editable elements |
| `applySectionStyleJson(el, styleJson)` | Safely applies a section's style JSON to a DOM element |
| `applyElementStyleJson(el, styleJson)` | Safely applies `{ styles: {...} }` format to a DOM element |
| `applySectionOrder(rows)` | Reorders DOM sections by `order_index` from published settings |

### Supabase Data Loaders

| Function | Purpose |
|----------|---------|
| `loadDesignTokens()` | Fetches draft + published tokens for current page + global scope |
| `loadSectionSettings()` | Fetches draft + published section settings for current page |
| `loadElementStyles()` | Fetches draft + published element style overrides for current page |

### Save / Publish / Reset

| Function | Purpose |
|----------|---------|
| `saveDesignTokenDraft(key, valueJson, scope)` | Upserts a single token draft into `cms_design_tokens` |
| `saveSectionSettingDraft(sectionId, fields)` | Upserts a section settings draft into `cms_section_settings` |
| `saveElementStyleDraftData(editKey, styleJson)` | Upserts an element style draft into `cms_element_styles` |
| `saveAllTokenDrafts()` | Reads all token inputs in Visual Control tab and saves them as drafts |
| `publishCurrentPageVisuals()` | Publishes all token/section/element style drafts for current page (owner only) |
| `initiateGlobalTokenPublish()` | Sets `globalTokenPublishPending = true` to show confirmation banner |
| `executeGlobalTokenPublish()` | Publishes all draft tokens as global scope (owner only, after confirmation) |
| `resetTokenDrafts()` | Deletes all token drafts and re-applies published values |
| `resetSectionDraft(sectionId)` | Deletes section draft, reverts element to published state |
| `resetElementStyleFromInspector()` | Deletes element style draft, reverts element to published or unstyled |

### Section Management

| Function | Purpose |
|----------|---------|
| `getSections()` | Returns all `[data-section-id]` elements not inside `[data-admin-ui]` |
| `isSectionProtected(el)` | Detects canvas, data-gsap/scrolltrigger, fixed/sticky position, known animation class names |
| `moveSectionRelative(sectionId, direction)` | Moves section up (-1) or down (+1) in the DOM; saves new order_index drafts |
| `toggleSectionVisibility(sectionId)` | Toggles `display:none` on a section; saves draft |
| `saveSectionDraftFromUI(sectionId)` | Reads style inputs from the section's expanded style panel and saves draft |
| `saveInspectorStyleDraft()` | Reads style inputs from the inspector Style tab and saves element style draft |

### Rendering

| Function | Purpose |
|----------|---------|
| `renderVisualControlTab()` | Builds the Visual Control dashboard tab HTML with sub-tabs and action buttons |
| `renderBrandTokensPanel()` | Brand color token inputs (mint, bg, surface, text, muted, border) |
| `renderTypographyPanel()` | Font family dropdowns + size inputs |
| `renderButtonsPanel()` | Button-specific token inputs (colors, radius, padding) |
| `renderCardsPanel()` | Card-specific token inputs (colors, radius, padding) |
| `renderPageThemePanel()` | Page-level token inputs (bg, text, max-width) |
| `renderTokenColorRow(t)` | Color swatch + hex text input row with bidirectional sync |
| `renderTokenSizeRow(t)` | Size text input row |
| `renderTokenFontRow(t)` | Safe font dropdown row |
| `renderSectionManagerTab()` | Builds the Section Manager dashboard tab HTML |
| `renderSectionItem(el, idx, total)` | Single section row with visibility/reorder/scroll/style controls |
| `renderSectionStyleControls(sid, draft)` | Expandable style control panel for a section |
| `getElementStyleType(el)` | Returns `'text'`, `'button'`, or `'card'` based on element's `data-edit-type` |
| `renderInspectorStyleTabHTML(el)` | Style tab panel for the inspector (properties vary by element type) |

### Event Binding

| Function | Purpose |
|----------|---------|
| `bindVisualControlEvents()` | Attaches bidirectional color swatch↔hex sync and live CSS var preview to token inputs |
| `bindSectionManagerEvents()` | Idempotent binding hook for section manager interactions |
| `bindInspectorStyleEvents()` | Attaches live style preview to inspector style tab inputs |

### Editor Safe Mode + Debug

| Function | Purpose |
|----------|---------|
| `setEditorSafeMode(active)` | Toggles `body.editor-safe-mode` class and `editorSafeMode` state variable |
| `logCmsVisualDebug(context, extra)` | Logs visual debug info when `?cmsDebug=true` |

---

## Changes to Existing Functions

| Function | Change |
|----------|--------|
| State variables | Added `editorSafeMode`, `inspectorTab`, `visualControlTab`, `designTokenDrafts`, `designTokenPublished`, `sectionSettingsDrafts`, `sectionSettingsPublished`, `elementStyleDrafts`, `elementStylesPublished`, `unsavedVisualCount`, `sectionManagerExpanded`, `globalTokenPublishPending` |
| Constants | Added `ALLOWED_STYLE_PROPS`, `SAFE_FONTS`, `SAFE_TEXT_ALIGNS`, `SAFE_FONT_WEIGHTS` |
| `renderDashboard` tabs | Added `['visual', 'Visual Control']` and `['sections', 'Section Manager']` |
| `renderDashboardTab` | Added cases for `visual` and `sections` tabs |
| `switchDashboardTab` | Added `bindVisualControlEvents()` and `bindSectionManagerEvents()` on tab switch |
| `renderInspector` | Added Content/Style tab strip; routes to `renderInspectorStyleTabHTML` when `inspectorTab === 'style'` |
| `buildTopbar` | Added Safe Mode toggle button |
| `updateTopbar` | Syncs Safe Mode button text and `is-safe-mode-on` class |
| `enterAdminMode` | Loads design tokens/section settings/element styles; calls `setEditorSafeMode(true)` |
| `exitAdminMode` | Removes `editor-safe-mode` body class; resets `editorSafeMode = true` |
| `boot` | Calls `applyPublishedDesignTokens`, `applyPublishedSectionSettings`, `applyPublishedElementStyles` on page load (for both anonymous and re-auth paths) |
| `refreshDashboardData` | Calls `loadDesignTokens`, `loadSectionSettings`, `loadElementStyles` |
| `handleAdminClick` | Added all Phase 7 action handlers (16 new actions) |

---

## Editor Safe Mode

When Safe Mode is ON (default), the body gets `class="editor-safe-mode"`. CSS rules inside this class suppress all custom cursors site-wide (`cursor: auto !important`). Admin UI elements retain `cursor: default`.

Toggling Safe Mode:
- **Topbar button**: "Safe Mode: ON / OFF"
- **Via `handleAdminClick`**: `toggle-safe-mode` action
- **On enter admin**: always starts ON
- **On exit admin**: class removed, state reset to `true`

Public interaction scripts are isolated via the `[data-admin-ui="true"]` attribute on all admin UI elements.

---

## Visual Control Center

### Sub-tabs

| Tab | Controls |
|-----|---------|
| Brand Tokens | `--mint`, `--bg`, `--surface`, `--text`, `--muted`, `--border` (color pickers + hex inputs) |
| Typography | `--font-heading`, `--font-body` (safe font dropdowns); `--font-size-base`, `--font-size-h1`, `--font-size-h2` (size inputs) |
| Buttons | `--btn-bg`, `--btn-color`, `--btn-border` (colors); `--radius-btn`, `--btn-padding-y` (sizes) |
| Cards | `--card-bg`, `--card-border` (colors); `--radius-card`, `--card-padding` (sizes) |
| Page Theme | `--page-bg`, `--page-text` (colors); `--section-max-width` (size) |

### Live Preview

Changes to any input immediately update `document.documentElement.style.setProperty('--{key}', value)` — no save required to preview.

Color swatch and hex text input are **bidirectionally synced**: changing either updates the other.

### Scope

- Brand Tokens, Typography, Buttons, Cards → `scope: 'global'` (published to all pages)
- Page Theme → `scope: 'page'` (published to current page only)
- Global publish requires owner confirmation via a confirmation banner

---

## Section Manager

- Detects all `[data-section-id]` elements on the page (excludes `[data-admin-ui]` children)
- Per-section controls: Hide/Show toggle, Move Up/Down, Scroll To, Style panel
- Style panel properties: `paddingTop`, `paddingBottom`, `marginTop`, `marginBottom`, `backgroundColor`, `maxWidth`, `opacity`
- Protected section detection: canvas elements, `data-gsap`/`data-scrolltrigger` attributes, `position: fixed`/`sticky`, known animation class names
- Protected sections show a browser `confirm()` warning before visibility toggle or reorder
- Section reorder uses `parentElement.insertBefore()` + saves `order_index` drafts for all siblings
- Published section order and visibility are reapplied on every page load

---

## Element Style Inspector

The inspector panel gains a **Content / Style** tab strip:
- **Content tab** — existing text editor (unchanged)
- **Style tab** — style controls based on `data-edit-type`:

| Edit Type | Available Properties |
|-----------|---------------------|
| `text` (default) | color, fontSize, fontWeight, lineHeight, letterSpacing, textAlign, maxWidth, marginTop, marginBottom |
| `button` | backgroundColor, color, borderColor, borderRadius, paddingTop, paddingBottom |
| `card` | backgroundColor, borderColor, borderRadius, paddingTop, opacity |

Style changes preview live. Save Draft writes to `cms_element_styles`. Reset reverts to published or unstyled.

---

## `value_json` Formats

### Design Token
```json
{ "value": "#B1FA20" }
```

### Section Style
```json
{ "paddingTop": "80px", "paddingBottom": "80px", "backgroundColor": "#0a0a0a" }
```

### Element Style
```json
{ "styles": { "color": "#ffffff", "fontSize": "18px", "fontWeight": "600" } }
```

---

## Public Hydration

On every page load (before the user interacts):
1. `applyPublishedDesignTokens()` — applies global tokens first, then page-level overrides
2. `applyPublishedSectionSettings()` — applies section visibility, order, and style
3. `applyPublishedElementStyles()` — applies per-element style overrides

All three run for anonymous visitors and for returning admin sessions.

---

## Security Rules

- **No arbitrary CSS injection**: users never type raw CSS. All inputs go through `sanitizeStyleValue()` or `sanitizeCssVarValue()` before touching the DOM.
- **CSS property whitelist**: `ALLOWED_STYLE_PROPS` Set enforced in `sanitizeStyleValue()`.
- **Safe font list**: `SAFE_FONTS` array enforced in `sanitizeStyleValue()` for `fontFamily`.
- **Color validation**: regex-based hex and rgb() validation; HSL and `data:` blocked.
- **Size validation**: only known CSS units accepted.
- **No innerHTML**: style application uses `element.style[prop] = safe` only.
- **RLS is the real gate**: client-side role checks show UX messages but cannot replace database-level enforcement.
- **No service-role key**: anon key only throughout.
- **Global token publish**: owner-only, behind a confirmation banner before executing.

---

## Debug Mode (`?cmsDebug=true`)

Phase 7 adds `logCmsVisualDebug(context, extra)` with these log messages:

```
[GROWVA CMS Visual Debug] tokens-hydrated       { count: 6 }
[GROWVA CMS Visual Debug] sections-hydrated     { count: 4 }
[GROWVA CMS Visual Debug] element-styles-hydrated { count: 2 }
[GROWVA CMS Visual Debug] tokens-saved          { count: 5 }
[GROWVA CMS Visual Debug] section-draft-saved   { sectionId, styleJson }
[GROWVA CMS Visual Debug] element-style-saved   { key, styles }
[GROWVA CMS Visual Debug] page-visuals-published { tokenCount, sectionCount, styleCount }
[GROWVA CMS Visual Debug] global-tokens-published { count }
```

---

## What Was Not Done (By Spec)

- No redesign of the public website
- No changes to GSAP, Lenis, Three.js, Flip, page transitions, mega menu, mobile menu, or custom cursor
- No image upload work in this phase
- No full arbitrary HTML editing
- No React / Vite / Next / build tools
- No arbitrary CSS injection (users cannot type raw CSS)
- No SVG, no `innerHTML`, no XSS vectors introduced

---

## Validation

```
node --check admin/admin.js          → OK (no syntax errors)
node --check js/script.js            → OK (no syntax errors)
node --check js/content-registry.js → OK (no syntax errors)
```
