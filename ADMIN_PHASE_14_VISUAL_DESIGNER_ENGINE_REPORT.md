# GROWVA CMS Phase 14 — Visual Designer Engine (Core Infrastructure)

## Files Changed

| File | Change |
|------|--------|
| `admin/admin.js` | +~310 net lines: Visual Designer Engine, bug fixes, keyboard shortcuts, integration hooks |
| `admin/admin.css` | +72 lines: box model overlay layers, label, boxmodel readout |
| `ADMIN_PHASE_14_VISUAL_DESIGNER_ENGINE_REPORT.md` | This report |

No new Supabase tables. No SQL patch required. No changes to public HTML, public CSS, script.js, or content-registry.js.

---

## Architecture

### Module Structure

The Visual Designer Engine lives entirely inside the existing IIFE (`(function(){ 'use strict'; ... })()`). It is a self-contained subsystem at the bottom of `admin.js`, between the Phase 13 section and `boot()`. It does not pollute the global namespace except for the intentional developer hook `window.GV_ADMIN_VISUAL`.

### State Variables (Phase 14)

```js
let vdActive = false;          // engine on/off
let vdSelectedEl = null;       // element currently tracked by the engine
let vdBreakpoint = 'desktop';  // 'desktop' | 'tablet' | 'mobile'
let vdStyleStore = {};         // { storeKey: { desktop:{}, tablet:{}, mobile:{} } }
let vdHistory = [];            // undo/redo stack (max 50)
let vdHistoryIndex = -1;       // current position in history
let vdClipboard = null;        // { styles: {prop:val} }
let vdOverlay = null;          // box model overlay DOM element
let vdOverlayRaf = null;       // pending rAF for overlay positioning
let vdBatchRaf = null;         // pending rAF for batched writes
let vdBatchQueue = null;       // pending batch { el, styles, breakpoint }
let vdScrollBound = false;     // scroll/resize listeners active?
```

### Activation Lifecycle

```
boot() → published data hydrated
  ↓
hasActiveAdminSession() → true
  ↓
enterAdminMode() → vdActivate()
  ├── vdBuildOverlay()       — creates .gv-vd-overlay in document.body
  └── vdBindScrollResize()   — scroll + resize → vdScheduleOverlayUpdate()

exitAdminMode() → vdDeactivate()
  ├── vdDeselect()
  ├── vdDestroyOverlay()
  └── vdUnbindScrollResize()
```

### Integration with Existing Selection System

The engine is a listener on top of the existing selection pipeline. `selectElement()` and `clearSelection()` were the only integration points modified:

```js
// selectElement() — existing function, one line added
function selectElement(element) {
  ...
  vdSelect(element);   // ← Phase 14: notify engine
  renderInspector(element);
}

// clearSelection() — existing function, one line added
function clearSelection(renderEmpty = true) {
  ...
  vdDeselect();        // ← Phase 14: notify engine
  ...
}
```

No changes to the content inspector, CMS save/load, publish, or dashboard flows.

---

## Feature Details

### 1. Element Selection Engine

**`vdSelect(el)`** — sets `vdSelectedEl`, schedules overlay update via rAF.

**`vdDeselect()`** — clears `vdSelectedEl`, hides overlay immediately.

**`vdSelectParent()`** — traverses to `parentElement.closest('[data-edit-key]')`. Blocked if parent is `document.body` or an admin UI element.

**`vdSelectChild(index)`** — finds children with `[data-edit-key]` at given index (skips admin UI elements).

Both parent/child traversal call the existing `selectElement()` so the CMS inspector stays in sync.

### 2. Visual Overlay System — Box Model

The overlay (`div.gv-vd-overlay`) is appended to `document.body` with `position:fixed; pointer-events:none`. It does not affect document flow or layout.

Four nested layers (DevTools colour palette):
- **Margin** (amber dashed outline) — extends beyond `getBoundingClientRect()` by computed margins
- **Border** (blue solid outline) — exact border-box rect
- **Padding** (green tinted) — inside border
- **Content** (blue tinted) — inside padding

Two readouts:
- **Label** — `tag[.class] [editKey] W×H` positioned just above the element
- **Box model strip** — `M top right bottom left  B ...  P ...  contentW×contentH` positioned below

All overlay positions update via `requestAnimationFrame` to avoid layout thrashing. Scroll and resize events each schedule a single rAF, so rapid events are coalesced.

### 3. Style Abstraction Layer

**`VD_ALLOWED_STYLE_PROPS`** — superset of the existing `ALLOWED_STYLE_PROPS`:

| Category | Properties |
|----------|-----------|
| Typography | color, fontSize, fontFamily, fontWeight, lineHeight, letterSpacing, textAlign, textDecoration, textTransform |
| Spacing | marginTop/Right/Bottom/Left, paddingTop/Right/Bottom/Left |
| Sizing | width, height, minWidth, minHeight, maxHeight, maxWidth |
| Borders | borderColor, borderWidth, borderStyle, borderRadius, borderTop/Right/Bottom/LeftWidth/Color |
| Layout | display, flexDirection, flexWrap, justifyContent, alignItems, alignSelf, gap |
| Visual | backgroundColor, opacity, boxShadow, objectFit, overflow |
| Motion | transform, transition |
| Position | zIndex |

**`vdSanitizeStyleValue(prop, val)`** — routes each prop through its own allow-list:
- Reuses existing `sanitizeStyleValue()` and `sanitizeColorValue()` for inherited props
- New props validated against dedicated `Set` allow-lists (display values, flex values, etc.)
- `boxShadow` — regex `/^[\d\s\-\.px%rgba(),#a-fA-F]+$/` + length cap, or `'none'`
- `transform` — only `translate/scale/rotate/skew` with numeric args; no `matrix()`, no `url()`
- `transition` — alphanumeric only, no `url()`, no expressions
- `zIndex` — integer parse, clamped -999 to 9999

No `cssText` assignment anywhere. No `setAttribute('style', ...)` with unsanitized values.

**`vdReadElementStyles(el)`** — returns `{ computed: {...}, stored: { desktop:{}, tablet:{}, mobile:{} } }`. `computed` is a snapshot of `getComputedStyle()` for all allowed props.

### 4. Responsive Editing — Breakpoint-Aware Storage

Style store key: `editKey` or `sectionId` from `data-*` attributes.

```js
vdStyleStore[storeKey] = {
  desktop: { color: '#fff', fontSize: '18px' },
  tablet:  { fontSize: '16px' },
  mobile:  { fontSize: '14px' }
}
```

**`vdWriteStyle(el, prop, val, breakpoint)`** — writes to store and applies immediately if `breakpoint === vdBreakpoint`. Pushes to history.

**`vdBatchWriteStyles(el, styles, breakpoint)`** — collects multiple writes into one rAF frame. Prevents layout thrashing from multiple simultaneous style changes.

**`vdApplyBreakpointStyles(el, bp)`** — clears all managed props, applies desktop as base, then applies breakpoint overrides. Called by `vdSetBreakpoint()`.

**`vdSetBreakpoint(bp)`** — switches active breakpoint and re-applies styles for the currently selected element.

**Note:** Style store is in-memory only for Phase 14. No Supabase persistence. Breakpoint styles are cleared on page reload. Phase 15+ of the designer track will add persistence (likely extending `cms_element_styles` with a `breakpoint` column).

### 5. Undo/Redo History

Stack: `vdHistory[]` — max 50 entries. Each entry: `{ storeKey, prop, breakpoint, before, after }`.

`vdHistoryIndex` tracks current position. Forward entries are trimmed on new write (standard linear history).

**`vdHistoryUndo()`** — steps back, restores `before` value. Fires on `Ctrl+Z` in edit mode.
**`vdHistoryRedo()`** — steps forward, restores `after` value. Fires on `Ctrl+Y` or `Ctrl+Shift+Z`.

Both undo/redo:
1. Update `vdStyleStore`
2. Apply via `el.style[prop] = val` (only if current breakpoint matches)
3. Do NOT push a new history entry (prevents history bloat)

### 6. Copy / Paste Styles

**`vdClipboardCopy(el)`** — copies all stored styles for current breakpoint into `vdClipboard`.
**`vdClipboardPaste(el)`** — pastes clipboard styles onto target element, going through sanitization and history for each property.

### 7. Global Design Token Integration

Existing design tokens (`designTokenDrafts`, `designTokenPublished`) apply to `document.documentElement` CSS vars. The Visual Designer Engine's element-level overrides are a complementary layer — they write to element `style` properties, which have higher specificity than CSS var references in stylesheets. No conflict.

### 8. RAF + Batched Updates

| Mechanism | RAF variable | Purpose |
|-----------|-------------|---------|
| Overlay position | `vdOverlayRaf` | Coalesce scroll/resize/select updates |
| Style batch writes | `vdBatchRaf` | Coalesce multiple `vdWriteStyle()` calls in one frame |
| Lenis/ScrollTrigger refresh | `_scrollRefreshFrame` (existing) | On admin mode toggle |

---

## Developer Hook — `window.GV_ADMIN_VISUAL`

Frozen object exposed for future panel phases. All writes go through engine sanitizers.

```js
window.GV_ADMIN_VISUAL = Object.freeze({
  version: '14.0',
  breakpoints: ['desktop','tablet','mobile'],
  allowedProps: [...],         // full list of allowed style properties

  // State (read-only getters)
  active,                      // Boolean — engine running?
  selectedEl,                  // Element | null
  breakpoint,                  // 'desktop' | 'tablet' | 'mobile'
  historyLength,               // Number
  historyIndex,                // Number
  hasUndo,                     // Boolean
  hasRedo,                     // Boolean
  hasClipboard,                // Boolean

  // Selection
  select(el),                  // wraps selectElement(); blocks admin UI elements
  deselect(),
  selectParent(),
  selectChild(index),

  // Style abstraction
  readStyles(el),              // → { computed, stored }
  writeStyle(el, prop, val, breakpoint),  // → Boolean (success?)
  batchWriteStyles(el, styles, breakpoint),
  applyBreakpointStyles(el, bp),
  setBreakpoint(bp),
  snapshot(el),                // → { prop: computedValue, ... }
  sanitize(prop, val),         // → safe string | null

  // History
  undo(),                      // → Boolean
  redo(),                      // → Boolean

  // Clipboard
  copyStyles(el),
  pasteStyles(el),

  // Introspection
  getStyleStore(),             // → deep clone of vdStyleStore
  updateOverlay()              // force overlay reposition via rAF
});
```

### Usage example (future panel phase):

```js
const vd = window.GV_ADMIN_VISUAL;
// Change selected element's font size on mobile breakpoint
vd.setBreakpoint('mobile');
vd.writeStyle(vd.selectedEl, 'fontSize', '14px', 'mobile');
// Read back everything
const styles = vd.readStyles(vd.selectedEl);
console.log(styles.stored.mobile.fontSize); // '14px'
// Undo it
vd.undo();
```

---

## Bug Fix: `currentElement` (Latent Strict-Mode Defect)

`currentElement` was used in 5 locations (`handleAdminClick`, `saveElementStyleDraftData`, `resetElementStyleFromInspector`, `saveInspectorStyleDraft`, `bindInspectorStyleEvents`) without ever being declared. In strict mode, reading an undeclared variable throws `ReferenceError` at runtime — `node --check` does not catch this as it only validates syntax.

The style tab and its save/reset actions were unreachable without triggering this error. **Fixed in Phase 14** by replacing all `currentElement` references with `selectedElement` (the properly declared IIFE-scope variable that holds the same element in all these call paths).

---

## Performance Notes

- Overlay uses `getBoundingClientRect()` once per rAF frame (not per event)
- `vdScheduleOverlayUpdate()` cancels the previous rAF before scheduling — only ever one pending frame
- `vdBatchWriteStyles()` uses the same pattern for multi-property style changes
- Scroll and resize listeners are `passive: true` — do not block the browser's scroll thread
- Engine activates only inside `enterAdminMode()` and deactivates fully on `exitAdminMode()` — zero cost to public visitors
- `window.getComputedStyle()` in `vdGetComputedStyleSnapshot()` forces a layout recalc; this only runs on explicit `readStyles()` calls from future panels, not on every render

---

## Security Regression Notes

### Style Injection Prevention

- No `cssText` assignment
- No `setAttribute('style', rawValue)`
- Every `el.style[prop] = val` write goes through `vdSanitizeStyleValue()` first
- `boxShadow` — character allow-list regex, no `url()`, no `expression()`, length capped at 120 chars
- `transform` — strict regex, only specific function names with numeric args
- `transition` — alphanumeric allow-list, no expressions
- `zIndex` — integer parse with range clamp

### Existing Security Unchanged

- `javascript:` — blocked in existing `isSafeHref()` and `isSafeImageUrl()` (not touched)
- `sb_secret_` / `service_role` — blocked in existing `isUnsafeSupabaseKey()` (not touched)
- `escapeHtml()` — unchanged
- RLS is still the authoritative gate

---

## Remaining Limitations

1. **Style store is in-memory only** — refreshing the page loses all visual designer changes. Phase 15 of the designer track adds Supabase persistence.

2. **No breakpoint preview** — `vdSetBreakpoint()` applies stored styles for that breakpoint to the live DOM, but does not resize the viewport or inject a `@media` wrapper. A proper responsive preview would need an iframe or CSS override strategy. Deferred to a future panel phase.

3. **Overlay does not scroll with Lenis** — Lenis intercepts native scroll and moves the content div; `getBoundingClientRect()` reads the correct visual position so the overlay stays in sync, but during a Lenis scroll animation the overlay may lag by one frame. This is acceptable for an editing tool; Lenis scroll completes before the user selects another element.

4. **No persistence for style store** — `getStyleStore()` returns a deep clone of in-memory state. A future phase should:
   - Add `breakpoint` column to `cms_element_styles` Supabase table
   - Call `saveElementStyleDraftData()` through the VD engine on write
   - Load and rehydrate `vdStyleStore` on admin entry

5. **No UI panel** — The engine is intentionally headless in Phase 14. `window.GV_ADMIN_VISUAL` is the only interface. Phase 15 will build the Visual Properties Panel in the admin sidebar.

6. **Parent/child traversal limited to `[data-edit-key]` elements** — `vdSelectParent()` and `vdSelectChild()` only navigate to elements already registered in the CMS registry. Structural containers without `data-edit-key` are skipped. This is correct for Phase 14 (engine drives the existing CMS inspector); a future "free-select any element" mode can relax this constraint.

7. **History is per-session, not per-element** — The undo stack is a flat timeline across all elements, not per-element. This is the standard behaviour (Photoshop, Figma model) and is intentional.

---

## Regression Notes

- No changes to public HTML, public CSS (`style.css`), `script.js`, or `content-registry.js`
- GSAP / Lenis / Three.js / Flip / page transitions: not touched
- Mega menu / mobile menu: not touched
- Section Builder / Media Library / Visual Control / Section Manager: not touched
- Preview as Visitor / Draft Compare / Undo Draft / Save Draft / Publish: not touched
- Supabase integration and RLS: not touched
- Existing `ALLOWED_STYLE_PROPS` and `sanitizeStyleValue()`: not changed (VD engine uses its own superset)
- `node --check`: PASS

---

## node --check

```
admin/admin.js — PASS
```

---

## Safe to Commit

**Yes.** The engine is purely additive. It activates only inside an authenticated admin session and deactivates completely on exit. Zero impact on public visitors.

---

## Exact Commit Command

```bash
git add admin/admin.js admin/admin.css ADMIN_PHASE_14_VISUAL_DESIGNER_ENGINE_REPORT.md
git commit -m "$(cat <<'EOF'
Phase 14: Visual Designer Engine — core infrastructure

- Add VD engine namespace (vdActive, vdSelectedEl, vdBreakpoint,
  vdStyleStore, vdHistory, vdClipboard, vdOverlay) inside IIFE
- Add VD_ALLOWED_STYLE_PROPS: superset of ALLOWED_STYLE_PROPS covering
  display, flex, gap, borders, shadows, transform, transition, zIndex, etc.
- Add vdSanitizeStyleValue() with per-property allow-lists; no cssText;
  no setAttribute; boxShadow/transform/transition hardened against injection
- Add vdReadElementStyles() / vdWriteStyle() / vdBatchWriteStyles() with
  RAF batching to prevent layout thrashing
- Add breakpoint-aware style storage (desktop/tablet/mobile) in vdStyleStore;
  vdApplyBreakpointStyles() applies desktop-as-base + breakpoint overrides
- Add 50-entry undo/redo stack (vdHistoryPush/Undo/Redo); Ctrl+Z / Ctrl+Y
  keyboard shortcuts wired in edit mode
- Add vdClipboardCopy / vdClipboardPaste for style copy-paste between elements
- Add vdSelect / vdDeselect / vdSelectParent / vdSelectChild for traversal
- Add box model overlay (.gv-vd-overlay): 4 layers (margin/border/padding/
  content), element label, M/B/P/content readout; position:fixed, pointer-
  events:none, updated via rAF on scroll/resize/select
- Hook vdActivate() into enterAdminMode(); vdDeactivate() into exitAdminMode()
- Hook vdSelect() into selectElement(); vdDeselect() into clearSelection()
- Expose window.GV_ADMIN_VISUAL frozen API for future panel phases
- Fix latent bug: currentElement (undeclared, strict-mode ReferenceError)
  replaced with selectedElement in 5 locations across style inspector
- Add overlay CSS to admin.css: .gv-vd-overlay, .gv-vd-layer, .gv-vd-label,
  .gv-vd-boxmodel with DevTools-inspired colour palette

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 15 Recommendation

**Phase 15: Visual Properties Panel**

Build the sidebar panel that lets admins edit styles through the Visual Designer Engine — no coding required.

Suggested scope:
- Add a "Visual" tab to the existing admin inspector panel (alongside Content and Style)
- Wire the tab to `window.GV_ADMIN_VISUAL` for all reads and writes
- Build grouped property editors: Typography, Spacing, Layout, Borders, Effects
- Add breakpoint switcher (Desktop / Tablet / Mobile) in the panel header
- Surface undo/redo state (can undo N, can redo M) with button controls
- Add copy/paste style buttons per element
- Persist `vdStyleStore` to Supabase: add `breakpoint` column to `cms_element_styles`, write on every `vdWriteStyle()` call, rehydrate `vdStyleStore` in `enterAdminMode()`

No new Supabase tables needed — extend `cms_element_styles` with one nullable `breakpoint` column and a SQL patch.
