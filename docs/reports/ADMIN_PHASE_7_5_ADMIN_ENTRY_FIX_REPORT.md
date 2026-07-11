# ADMIN PHASE 7.5 ADMIN ENTRY FIX REPORT

## Scope

Phase 7.5 stabilized Admin entry reliability and editor interaction isolation only. No Phase 8 work was started. Supabase schema, content data, CMS publishing logic, and public visual design were not changed.

## Files Changed

- `admin/admin.js`
- `admin/admin.css`
- `js/script.js`
- Site HTML pages with Admin entry buttons: 54 HTML files now mark the desktop and mobile Admin triggers as admin UI.
- `ADMIN_PHASE_7_5_ADMIN_ENTRY_FIX_REPORT.md`

Existing uncommitted Phase 7 visual-control work was already present in `admin/admin.js`, `admin/admin.css`, `ADMIN_PHASE_7_VISUAL_CONTROL_REPORT.md`, and `supabase/phase-7-visual-controls.sql`; this pass did not redesign or remove it.

## Root Cause Found

Admin entry buttons were visually present but still participated in public visitor interaction systems. Public page transitions, custom cursor handling, magnetic hover logic, and mobile navigation state could all see Admin entry clicks before or alongside the CMS handler. That made entry feel inconsistent, especially after refresh, page transitions, and inside the mobile menu.

A secondary runtime issue was found during validation: Phase 7 visual debug logging referenced `cmsDebugEnabled`, but this file uses `cmsDebug`. That produced console errors when `cmsDebug=true`.

## Admin Button Markup and Runtime Normalization

- All 108 Admin triggers across the 54 HTML pages now include `data-admin-ui="true"`.
- Runtime normalization in `ensureEntryButtonsAreSafe()` now covers both `[data-admin-entry]` and `[data-admin-action="open-admin"]`.
- Admin trigger buttons are forced to `type="button"`.
- Admin trigger anchors, if introduced later, are made inert by moving their `href` into `data-admin-href`.
- Admin triggers get `role="button"` and `tabindex="0"` when needed.

## JS Capture-Phase Click Handling

- `admin/admin.js` now captures Admin entry clicks at the document level before public click systems.
- The handler targets `[data-admin-action="open-admin"], [data-admin-entry]`.
- It calls `preventDefault()`, `stopPropagation()`, and `stopImmediatePropagation()` for Admin entry clicks.
- Admin entry now has an in-flight guard to avoid double-open races.
- Admin entry closes the public mobile menu before opening the login modal or entering Admin Mode.
- Debug logging is available behind `?cmsDebug=true` and reports the trigger, auth state, action taken, and whether public transition interception was prevented.

## Page Transition Exclusions

`js/script.js` now excludes these admin surfaces from public link transition interception:

- `[data-admin-ui]`
- `[data-admin-action]`
- `[data-admin-entry]`
- `.gv-admin-root`
- `.gv-admin`
- `.admin-shell`
- `.growva-admin`
- `.admin-panel`

Public visitor links still use the existing page transition path.

## Cursor, Magnetic, Spotlight, and Tilt Exclusions

Public custom cursor and magnetic button logic now treats Admin triggers and Admin UI as excluded targets. Admin Mode still resets tilt and magnetic transforms through the existing admin interaction isolation. The admin cursor remains native in admin/editor contexts.

## Z-Index and Pointer Events

`.admin-entry-btn` now has:

- `position: relative`
- `z-index: 10020`
- `pointer-events: auto !important`
- `cursor: pointer !important`
- `touch-action: manipulation`

The loading state keeps pointer events enabled so temporary state cannot strand the button.

## Desktop Behavior

Validated:

- Logged-out Admin click on `index.html` opens the login modal.
- Admin click still works after refresh.
- Mock logged-in session persists after refresh.
- After exiting Admin Mode without logging out, the desktop Admin button re-enters Admin Mode.
- Admin click after a normal public page transition opens the login modal.
- Nested service page Admin entry opens the login modal.
- Nested work/project page Admin entry opens the login modal.

## Mobile Behavior

Validated:

- Mobile menu Admin button opens the login modal.
- Mobile menu closes after Admin entry click.
- Admin entry click is not swallowed by mobile navigation state.

## Validation Results

Static checks passed:

```text
node --check admin/admin.js
node --check js/script.js
node --check js/content-registry.js
```

Browser validation passed with a temporary Playwright harness under `output/playwright/phase-7-5-admin-entry-check.cjs`. The harness was removed after validation because it was a QA artifact, not product code.

Validated browser paths:

- `index.html` logged-out Admin entry.
- `index.html` Admin entry after refresh.
- `index.html` mock logged-in Admin entry after exiting Admin Mode.
- `index.html` mobile Admin entry.
- `services/brand-identity-design.html` Admin entry.
- `work/shopify-stores/noor-perfumery.html` Admin entry.
- Public mega menu hover still opens.
- Public link navigation from `index.html` to `about.html` still works.
- Admin entry after that public navigation opens the login modal.
- No console/page errors were reported during the passing browser run.

Additional sanity checks:

- HTML marker count: 54 HTML files, 108 `data-admin-action="open-admin"` triggers, 108 `data-admin-ui="true"` markers.
- No remaining `cmsDebugEnabled` references.

## Known Limitations

- The browser validation used the existing local mock admin path for the logged-in state, not real Supabase credentials.
- The temporary Playwright harness was deleted after passing, so it is not part of the product source.
- Existing Phase 7 visual-control changes remain in the working tree and should be reviewed as part of that phase's commit scope.

## Phase 8 Readiness

Phase 8 is safe to start after committing Phase 7.5 together with the already-present Phase 7 work, or after separating commits intentionally. No Admin entry blocker remains from this pass.
