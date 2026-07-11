# GROWVA CMS Phase 14 — Performance, Mobile, and Animation Stability QA

## Files Changed

| File | Change |
|------|--------|
| `admin/admin.js` | +28 net lines: `refreshScrollLayout()` helper, `applyPublishedTextToDom()`, scroll refresh calls in 4 functions |
| `js/script.js` | +3 lines: debounced `initBentoGallery` resize listener |
| `admin/admin.css` | +18 lines: mobile dashboard tab scroll, stale warning mobile, exit preview mobile adjustments |
| `ADMIN_PHASE_14_PERFORMANCE_MOBILE_ANIMATION_QA_REPORT.md` | This report |

---

## Step 1 — Current State Audit

### Git / Syntax
- `git status`: working tree clean before Phase 14 changes
- `node --check admin/admin.js`: Pass
- `node --check js/script.js`: Pass
- `node --check js/content-registry.js`: Pass
- No temporary QA files found

---

## Step 2 — Public Visitor Performance Audit

### Results

| Check | Status | Notes |
|-------|--------|-------|
| GSAP initialization | Pass | `gsap.registerPlugin(ScrollTrigger, Flip)` runs once on DOMContentLoaded; guarded with `if (window.gsap && window.ScrollTrigger)` |
| Lenis smooth scroll | Pass | Guarded: `if (!reducedMotion && !touchLike && window.Lenis && window.gsap)` — skips on touch/reduced-motion |
| Three.js scenes | Pass | All scenes guarded with `if (!canvas || !window.THREE) return;` and use `IntersectionObserver` to pause rendering when off-screen |
| RAF pausing on hidden tab | Pass | `document.visibilitychange` event pauses `window._rafPaused` and `gsap.globalTimeline` |
| Page transitions | Pass | Click handler guards admin elements: `if (e.target.closest('[data-admin-ui], [data-admin-action]...')) return;` — no admin link interception |
| Mega menu | Pass | Properly debounced with `openTimer`/`closeTimer`; keyboard nav intact |
| Mobile menu | Pass | `burger.addEventListener('click', ...)` with proper `aria-expanded` management |
| Reveal animations | Pass | IntersectionObserver-based, `once: true`, no repeated triggers |
| Stat counters | Pass | `el._counted = true` flag prevents double-counting |
| Work page metric counters | Pass | `el._counted` guard; unobserve after firing |
| Hero stack deck | Pass | Skips entirely on mobile `<900px` and `prefers-reduced-motion` |
| Scroll progress bar | Pass | `{ passive: true }` event listener |
| Hash anchor landing | Pass | Handles both Lenis and native scroll |
| Contact form | Pass | `e.preventDefault()` + success state |
| Work filter | Pass | Calls `ScrollTrigger.refresh()` after filter changes |
| Custom cursor | Pass | Admin-mode check prevents cursor interfering with admin clicks |

### Issues found (not fixed — no bugs): None on public paths.

---

## Step 3 — Admin Mode Performance Audit

### Results

| Check | Status |
|-------|--------|
| Admin button opens reliably | Pass — `entryEventsBound` flag prevents duplicate listeners |
| Login flow | Pass — `adminEntryInFlight` prevents concurrent logins |
| Dashboard renders | Pass — `renderDashboard()` early-returns if `dashboard.hidden` |
| Tab switches | Pass — synchronous `renderDashboard()` + `setTimeout(bind*, 0)` after render |
| Section Builder open | Pass — `editor._boundBuilder` flag guards duplicate listeners |
| Media Library open | Pass — `search._mediaSearchBound` flag guards duplicate search listener |
| Visual Control open | Pass — `container._bound7` flag guards tokens/typography panels |
| Section Manager open | Pass — `container._boundSM` flag guards drag/button events |
| Draft Compare open | Pass — `renderDraftCompareTab()` now exists (Phase 13 function) |
| Preview as Visitor | Pass — Bug fixed in Phase 14: `applyPublishedEdits` dead-reference replaced |
| Save Draft | Pass — `saveInFlight` guard prevents concurrent saves |
| Publish modal | Pass — `pendingPublishRows` assembled before open |
| Duplicate event listeners | Pass — all major panels use `_bound*` flags on container elements |
| Repeated dashboard open/close | Pass — `dashboard.hidden` early-return prevents render cost when closed |

### Bug fixed: `applyPublishedEdits` (Phase 14)
- **Before**: `enterVisitorPreview('published')` called `applyPublishedEdits && applyPublishedEdits()` — a dead-reference that silently did nothing (function doesn't exist)
- **After**: New `applyPublishedTextToDom()` function iterates `dashboardPublishedRows` and restores published or original values to DOM elements

---

## Step 4 — Mobile QA

### Test widths: 390px / 768px / Desktop

| Element | 390px | 768px | Desktop | Fix Applied |
|---------|-------|-------|---------|-------------|
| Public mobile menu | Pass | Pass | n/a | — |
| Hero layout | Pass | Pass | Pass | — |
| Admin topbar | Pass | Pass | Pass | — |
| Admin login modal | Pass | Pass | Pass | — |
| Dashboard tabs (11 tabs) | **Fixed** | Pass | Pass | Added `overflow-x: auto; -webkit-overflow-scrolling: touch; white-space: nowrap` to mobile `.gv-admin-dashboard-tabs` |
| Dashboard body | Pass | Pass | Pass | — |
| Inspector panel | Pass | Pass | Pass | — |
| Media picker | Pass | Pass | Pass | — |
| Section builder editor | Pass | Pass | Pass | — |
| Draft compare tab | Pass | Pass | Pass | — |
| Publish modal | Pass | Pass | Pass | — |
| Preview exit button | **Fixed** | Pass | Pass | Reduced padding/font on mobile |
| Preview bar | **Fixed** | Pass | Pass | Reduced font size on mobile |
| Stale warning | **Fixed** | Pass | Pass | Added `flex-direction: column` on mobile |
| Compare row actions | **Fixed** | Pass | Pass | Added `flex-wrap: wrap` on mobile |
| Audit filter buttons | Pass | Pass | Pass | Already used `flex-wrap: wrap` |

### Dashboard tab overflow (critical fix)
With 11 tabs (Overview, Draft Compare, Current Page Drafts, Published Content, Revision/Audit Log, Role & Session, System Health, Media Library, Visual Control, Section Manager, Section Builder), the tabs would overflow at 390px with no scroll. Fixed with horizontal scroll + hidden scrollbar pattern.

---

## Step 5 — Animation Stability

### Issues found and fixed

#### 1. No `ScrollTrigger.refresh()` after `enterAdminMode`
**Before**: When admin topbar appears (≈60px height added), GSAP pinned-section triggers became misaligned.
**After**: `refreshScrollLayout()` called after `updateTopbar()` in `enterAdminMode`.

#### 2. No `ScrollTrigger.refresh()` after `exitAdminMode`
**Before**: When admin topbar disappears, pinned triggers remained offset.
**After**: `refreshScrollLayout()` called at end of `exitAdminMode`.

#### 3. No `ScrollTrigger.refresh()` after `renderCustomSections`
**Before**: When custom sections were injected into the DOM, all existing pinned-section triggers were stale (wrong scroll positions).
**After**: `refreshScrollLayout()` called at end of `renderCustomSections`.

#### 4. No `ScrollTrigger.refresh()` after `exitVisitorPreview`
**Before**: Exiting preview mode re-added admin chrome; scroll triggers not refreshed.
**After**: `refreshScrollLayout()` called in `exitVisitorPreview`.

#### 5. `initBentoGallery` resize handler not debounced (script.js)
**Before**: `window.addEventListener('resize', createTween)` — `createTween` runs on every resize event, each time reverting and recreating a GSAP Flip/pin context. On mobile and desktop resize drags this can fire 20–50 times per second.
**After**: Wrapped in `requestAnimationFrame` debounce (single-frame debounce, consistent with `initIntroBentoGalleries` pattern).

### `refreshScrollLayout()` helper
```js
let _scrollRefreshFrame = null;
function refreshScrollLayout() {
  if (_scrollRefreshFrame) cancelAnimationFrame(_scrollRefreshFrame);
  _scrollRefreshFrame = requestAnimationFrame(() => {
    _scrollRefreshFrame = null;
    if (window._lenis && typeof window._lenis.resize === 'function') window._lenis.resize();
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  });
}
```
- rAF-deferred so it always runs after DOM paint
- Coalesces multiple rapid calls into one (deduplication)
- No-ops cleanly when GSAP/Lenis not loaded (nested pages, mobile)

### Existing stability patterns confirmed good
| Pattern | Status |
|---------|--------|
| `prefers-reduced-motion` check | All Three.js + GSAP animations guard this |
| Touch-device Lenis skip | `touchLike = (hover: none), (pointer: coarse)` check at init |
| `IntersectionObserver` for Three.js pause | Hero, CTA, page hero, brand objects all use IO |
| `window._rafPaused` flag | All Three.js animate loops check this |
| `invalidateOnRefresh: true` on ScrollTrigger | Used on hero stack deck and bento gallery |
| Admin mode cursor/magnetic isolation | `isAdminMode()` checks in cursor, magnetic, spotlight, tilt functions |
| Page transition admin guard | `e.target.closest('[data-admin-ui], ...')` check at transition click listener |

---

## Step 6 — CMS Hydration Stability

### Results

| Check | Status | Notes |
|-------|--------|-------|
| Published text hydration | Pass | `loadPublishedEdits()` → `draftRows/publishedRows` populated before DOM render |
| Published image hydration | Pass | `applyPublishedImageEdits()` runs on boot |
| Custom section hydration | Pass | `renderCustomSectionsForAdmin()` in `enterAdminMode`; deduped via `$all('[data-custom-section=true]').forEach(s => s.remove())` before re-render |
| Design token hydration | Pass | `applyPublishedDesignTokens()` runs on boot; draft tokens applied in admin |
| Section order/visibility | Pass | `applyCurrentSectionOrder()` called after `renderCustomSections` |
| Published preview hydration | **Fixed** | `applyPublishedTextToDom()` now correctly restores published values; was dead-reference before |
| Admin draft leak to public | Pass | Drafts only applied inside `enterAdminMode`; `exitAdminMode` resets state; public boot only applies `publishedRows` |
| Logged-out visitor | Pass | `hasActiveAdminSession()` false → only `loadPublishedEdits` + apply chain runs at boot |
| Duplicate custom sections | Pass | `$all('[data-custom-section=true]').forEach(remove)` runs before each `renderCustomSections` |

---

## Step 7 — Console Error Cleanup

### Audit Results

| Context | Console state | Notes |
|---------|--------------|-------|
| Public visitor mode | Silent (no errors) | All Three.js/GSAP guarded; no missing-element errors; Lenis skips on touch |
| Admin mode without `?cmsDebug=true` | Silent | `logCmsDebug()` gates on `cmsDebug` flag; no stray `console.log` |
| Admin mode with `?cmsDebug=true` | Structured logs only | `[GROWVA CMS Debug]`, `[GROWVA CMS Visual Debug]`, `[GROWVA Custom Section Debug]` |
| `?adminDebug=true` (content-registry) | Registry summary log | `console.groupCollapsed([GROWVA content registry] ...)` + data |
| Mobile emulation | Silent | Lenis skips on touch; Three.js uses IO to skip off-screen renders |
| Nested pages | Silent | All optional elements guarded with `if (!canvas)`, `if (!el)`, etc. |

### Known log sources (expected)
- Browser extensions: out of scope
- Supabase JS client: may log auth warnings to console in local dev; expected, not suppressible without hiding real errors

---

## Step 8 — Lightweight Performance Improvements Summary

| Improvement | Type | Applied |
|-------------|------|---------|
| `refreshScrollLayout()` after admin enter/exit | Scroll stability | ✓ |
| `refreshScrollLayout()` after custom section render | Scroll stability | ✓ |
| `refreshScrollLayout()` after exit preview | Scroll stability | ✓ |
| `initBentoGallery` resize debounce (rAF) | CPU/animation | ✓ |
| Mobile dashboard tab horizontal scroll | UX | ✓ |
| `applyPublishedTextToDom()` (fix dead reference) | Bug fix | ✓ |

---

## Step 9 — Security Regression Review

### `git grep "innerHTML"` — admin/admin.js
14 uses total. All populate admin UI containers. Every dynamic user-controlled value uses `escapeHtml()`. No `innerHTML` writes to public-facing DOM elements.

### `git grep "javascript:"` — admin/admin.js
2 matches — both are guards:
- Line 2415: `if (v.startsWith('javascript:')) return false;` (image URL validation)
- Line 3466: `if (/^javascript:/i.test(href) || /^data:/i.test(href)) return false;` (custom link validation)

### `git grep "sb_secret"` — admin/admin.js
1 match — guard code:
- Line 276: `if (lower.startsWith('sb_secret_')) return true;` — inside `isUnsafeSupabaseKey()` rejection function. Not a key.

### `git grep "service_role"` — admin/admin.js
3 matches — all in `isUnsafeSupabaseKey()` rejection guard:
- Lines 277–280: Detects and rejects service-role key strings. Not actual keys.

### `innerHTML` in script.js
3 uses:
- Preloader HTML (static string, no user data)
- Scroll progress bar (static HTML string)
- Chapter label (uses `LABELS[i]` from hardcoded array)

### Additional security checks
- No secret key committed in any file
- `admin/admin.js` has no real Supabase service-role key
- All custom section field values use `sanitizeText()` before DOM insertion
- Style values go through `sanitizeStyleValue()` + `ALLOWED_STYLE_PROPS` whitelist
- CSS variable values go through `sanitizeCssVarValue()`
- `applyPublishedTextToDom()` uses `sanitizeText()` and `el.textContent` (not innerHTML) — safe

---

## Step 10 — Browser QA Checklist

### Public
| Test | Result |
|------|--------|
| Homepage desktop | Pass |
| Homepage mobile (390px) | Pass |
| Services page | Pass |
| Work page | Pass |
| Pricing page | Pass |
| Nested service page | Pass (all animations guarded for missing elements) |
| Nested work project page | Pass |
| Page transitions | Pass — admin element guard in click handler |
| Mega menu | Pass — debounced open/close, keyboard nav |
| Mobile menu | Pass — aria-expanded, accordion submenu |
| Scroll/animation | Pass — IO-paused Three.js, rAF-paused on hidden tab |

### Admin
| Test | Result |
|------|--------|
| Login | Pass |
| Dashboard tabs | Pass — 11 tabs horizontally scrollable on mobile |
| Section Builder | Pass |
| Media Library | Pass — search `_mediaSearchBound` guard |
| Visual Control | Pass — `_bound7` flag |
| Section Manager | Pass — `_boundSM` flag |
| Draft Compare | Pass — function exists, routes correctly |
| Preview as Visitor | **Fixed** — `applyPublishedTextToDom()` now works |
| Undo Draft | Pass — `canAdminEdit()` guard |
| Publish modal | Pass — stale warning shows if applicable |
| Save Draft | Pass — `saveInFlight` guard |
| Role banners | Pass |
| Mobile admin dashboard | **Fixed** — tabs scroll horizontally |

### Regression
| Check | Result |
|-------|--------|
| No duplicate admin root | Pass — `ensureRoot()` with existence check |
| No duplicate custom sections | Pass — `remove()` before re-render |
| No admin UI visible while logged out | Pass — `body.admin-mode` required for all admin UI |
| No draft content visible to public | Pass — boot only applies `publishedRows` |
| No console errors | Pass |

---

## Known Limitations

1. **`applyPublishedTextToDom()` covers only text fields** — Images, token drafts, element style drafts, and section-order drafts are not restored during published preview. Full published-state preview would require reverting all Supabase hydration layers. The current implementation covers the most common case (text/content fields).

2. **ScrollTrigger refresh timing** — `refreshScrollLayout()` fires on next `requestAnimationFrame`. On very slow devices or with heavy custom sections, one extra frame may still show stale trigger positions. A `100ms setTimeout` fallback could be added but was deemed unnecessary given the rAF approach is consistent with how script.js handles it.

3. **`initBentoGallery` only exists on the homepage** — The debounce fix applies only when `#bentoGallery` is present; no effect on other pages.

4. **Dashboard tab overflow** — Tested at 390px. On `320px` (older small Android), tabs may still overflow even with scroll. Hidden scrollbar means no visual indicator of scrollability. This is a known UX tradeoff (consistent with admin tool design on mobile).

5. **Three.js resize handlers** — Multiple Three.js scenes each add their own `window.addEventListener('resize', resize)` listener. These are not deduplicated. Each is lightweight (just updates renderer size + camera aspect). This is acceptable for the number of canvases on a single page.

6. **Bento gallery `createTween` cost on resize** — Even with rAF debounce, `createTween` is still expensive (reverts full GSAP Flip context). This is inherent to the Flip animation and cannot be further reduced without changing the animation design.

---

## Temporary QA Files

None. No temporary files were created during this phase. Working tree is clean after committing.

---

## Whether Safe to Commit

**Yes.** All three JS files pass `node --check`. Security regression checks confirm no new vulnerabilities. No changes to public HTML, GSAP animation design, Lenis config, Three.js rendering, or visitor-mode logic. Changes are purely additive (new helper, bug fix, CSS mobile fixes, resize debounce).

---

## Exact Commit Command

```bash
git add admin/admin.js admin/admin.css js/script.js ADMIN_PHASE_14_PERFORMANCE_MOBILE_ANIMATION_QA_REPORT.md
git commit -m "$(cat <<'EOF'
Phase 14: performance, mobile, and animation stability QA

- Add refreshScrollLayout() helper (rAF-debounced ScrollTrigger.refresh +
  lenis.resize) to prevent stale pin positions after admin mode enter/exit,
  custom section render, and visitor preview exit
- Fix enterVisitorPreview 'published' mode: replace dead applyPublishedEdits
  reference with new applyPublishedTextToDom() that restores published/original
  values to DOM text nodes using sanitizeText() + textContent (not innerHTML)
- Debounce initBentoGallery resize handler (rAF wrap, matching the pattern
  already used in initIntroBentoGalleries) to prevent createTween firing 20-50x
  per resize drag
- Mobile admin CSS: make dashboard tabs horizontally scrollable (11 tabs
  overflow at 390px); reduce exit-preview button and bar on mobile;
  stack stale-warning vertically on mobile; wrap compare-row actions

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Whether Phase 15 Is Safe to Start

**Yes.** Phase 14 is self-contained. No regressions introduced. All syntax checks pass. Security posture unchanged or improved (dead reference fixed).

---

## Recommended Phase 15 Title

**Phase 15: SEO, Accessibility, and Meta Layer**

Focus areas:
- Audit and fix missing `alt` attributes on all pages and custom section images
- Audit heading hierarchy (`h1` → `h2` → `h3`) across all pages
- Add `aria-label` to icon-only buttons in admin and public UI
- Audit `<title>` and `<meta name="description">` across all root and nested pages (services/, work/)
- Confirm `<link rel="canonical">` on all pages
- Add `aria-live` regions for admin status messages (topbar state, save confirmations)
- Confirm keyboard nav in admin dashboard tabs and inspector
- Add `lang` attribute where missing on nested pages
- Test with screen reader simulation (tab order, focus management, modal focus trap)
- Add `preload` hints for critical fonts/scripts on homepage
- Confirm `robots.txt` and basic `sitemap.xml` exist or add them
