# GROWVA Full Site Admin Audit Report

## 1. Executive Summary

This is an audit-only report for the existing static GROWVA website and Supabase-powered Admin/CMS layer.

The public site contains 54 HTML pages: 9 top-level/main pages, 20 service detail pages, and 25 work/portfolio pages. Every HTML page inspected includes the required public and admin assets:

- `css/style.css`
- `admin/admin.css`
- `js/script.js`
- `js/content-registry.js`
- Supabase browser SDK
- `admin/supabase-config.js`
- `admin/admin.js`

The script order is consistent across all inspected pages:

1. public libraries such as Three.js, GSAP, ScrollTrigger, Flip when present, and Lenis
2. `js/script.js`
3. `js/content-registry.js`
4. Supabase SDK
5. `admin/supabase-config.js`
6. `admin/admin.js`

Browser inspection of `http://localhost:5500/` and `http://localhost:5500/work.html` showed that both pages load the admin shell, content registry, Supabase config, Supabase client, and debug helper correctly when logged out. The Supabase Auth health endpoint returned `200` from both pages.

The main likely cause of "Admin works on Home but exits/asks for login on other pages" is not missing scripts on `work.html`. The most likely cause is that normal navigation performs a full page reload, Admin Mode itself is not persisted as a separate state, and each page relies on Supabase session rehydration during boot. If `getSession()`, `getUser()`, or `admin_profiles` lookup is slow, locked by auth refresh, or returns a stale/invalid session, the new page boots as logged out and opens the login modal.

The current schema assumption in code is correct for the local SQL file: `public.admin_profiles.id` references `auth.users(id)`. There is no `user_id` column in `supabase/schema.sql`, and the current admin code queries `.from('admin_profiles').eq('id', user.id)`.

No code was fixed in this audit. No SQL was changed. No commit or deployment was performed.

## 2. Public Website Map

### Main HTML Pages

| Page | Visitor-facing purpose | H1 / primary signal | Editable keys |
|---|---|---:|---:|
| `index.html` | Home page / full-service growth partner entry | Growth By Design. | 211 |
| `shopify.html` | Shopify development pillar page | The platform ambitious brands grow on. | 184 |
| `services.html` | Services overview | Five departments. One growth system. | 166 |
| `work.html` | Portfolio category overview | Work That Performs. | 144 |
| `process.html` | Process / methodology | Nine stages. No guesswork. | 177 |
| `about.html` | Company philosophy/about page | Growth By Design is a philosophy, not a slogan. | 159 |
| `pricing.html` | Pricing and investment packages | Transparent pricing. Fixed proposals. No surprises. | 276 |
| `faq.html` | FAQ | Questions worth answering upfront. | 202 |
| `contact.html` | Contact / lead capture | Start a project. We'll reply within one business day. | 138 |

### Service Pages

| Page | Service area | Editable keys |
|---|---|---:|
| `services/amazon-account-management.html` | Amazon Seller Central | 146 |
| `services/amazon-account-setup.html` | Amazon Seller Central | 146 |
| `services/amazon-listing-advertising-optimization.html` | Amazon Seller Central | 146 |
| `services/brand-identity-design.html` | Graphic Design | 146 |
| `services/business-marketing-print.html` | Printing | 146 |
| `services/conversion-optimization.html` | Growth & Strategy | 147 |
| `services/corporate-websites.html` | Web Development | 146 |
| `services/custom-store-development.html` | Web Development | 146 |
| `services/ecommerce-strategy.html` | Growth & Strategy | 147 |
| `services/growth-systems.html` | Growth & Strategy | 147 |
| `services/large-format-retail-print.html` | Printing | 146 |
| `services/marketing-social-design.html` | Graphic Design | 146 |
| `services/packaging-design.html` | Graphic Design | 146 |
| `services/packaging-print-production.html` | Printing | 146 |
| `services/performance-optimization.html` | Shopify & Ecommerce | 147 |
| `services/portfolio-websites.html` | Web Development | 146 |
| `services/premium-shopify-website-development.html` | Shopify & Ecommerce | 147 |
| `services/shopify-cro.html` | Shopify & Ecommerce | 147 |
| `services/shopify-store-optimization.html` | Shopify & Ecommerce | 147 |
| `services/website-maintenance.html` | Growth & Strategy | 147 |

### Work / Portfolio Pages

| Page | Category | Editable keys |
|---|---|---:|
| `work/amazon-storefronts.html` | Amazon Storefronts category | 117 |
| `work/amazon-storefronts/hasat-organics.html` | Amazon case study | 85 |
| `work/amazon-storefronts/maison-luxe.html` | Amazon case study | 85 |
| `work/amazon-storefronts/noor-perfumery.html` | Amazon case study | 85 |
| `work/brand-identity.html` | Brand Identity category | 117 |
| `work/brand-identity/hasat-organics.html` | Brand case study | 85 |
| `work/brand-identity/noor-perfumery.html` | Brand case study | 85 |
| `work/brand-identity/vella-cosmetics.html` | Brand case study | 85 |
| `work/marketing-print.html` | Marketing & Print category | 117 |
| `work/marketing-print/noor-holiday.html` | Marketing/print case study | 85 |
| `work/marketing-print/terra-grove.html` | Marketing/print case study | 85 |
| `work/marketing-print/vella-campaign.html` | Marketing/print case study | 85 |
| `work/packaging-design.html` | Packaging Design category | 117 |
| `work/packaging-design/atelier-marbre.html` | Packaging case study | 85 |
| `work/packaging-design/noor-no03.html` | Packaging case study | 85 |
| `work/packaging-design/terra-grove.html` | Packaging case study | 85 |
| `work/shopify-stores.html` | Shopify Stores category | 120 |
| `work/shopify-stores/atelier-marbre.html` | Shopify case study | 88 |
| `work/shopify-stores/noor-perfumery.html` | Shopify case study | 88 |
| `work/shopify-stores/terra-grove.html` | Shopify case study | 88 |
| `work/shopify-stores/vella-cosmetics.html` | Shopify case study | 88 |
| `work/websites.html` | Websites category | 117 |
| `work/websites/atelier-marbre.html` | Website case study | 85 |
| `work/websites/dune-studio.html` | Website case study | 85 |
| `work/websites/hasat-organics.html` | Website case study | 85 |

### Repeated Layout Elements

All inspected HTML pages include repeated public layout systems:

- Fixed header/navigation.
- Desktop mega menu.
- Mobile navigation/mega menu.
- Footer.
- CTA links/buttons leading toward `contact.html`.
- Page transition overlay.
- Admin entry buttons.
- Editable content attributes through `data-edit-key`.
- Admin CSS and admin scripts.

`contact.html` is the only page with a public form in this audit. The public lead form is handled in `js/script.js`, which sends contact/lead data through Supabase/Edge Function plumbing when configured.

## 3. Admin/CMS Architecture Map

### Core Files

| File | Role |
|---|---|
| `admin/admin.js` | Main Admin/CMS runtime, auth, shell, dashboard, inspector, draft/publish, media, visual editor, CRM/control center |
| `admin/admin.css` | Admin modal, shell, topbar, panel, dashboard, publish modal, overlays, responsive admin UI |
| `admin/supabase-config.js` | Browser Supabase URL and publishable/anon key config |
| `admin/supabase-config.example.js` | Placeholder config template |
| `js/content-registry.js` | Builds `window.GROWVA_CONTENT_REGISTRY` from page DOM editable fields |
| `js/script.js` | Public website interactions, page transitions, contact form, attribution, animation |
| `css/style.css` | Public website visual system, layout, navigation, page transition overlay |

### Admin Boot Flow

Key functions in `admin/admin.js`:

- `getPagePath()` at `admin/admin.js:382`
- `initSupabase()` at `admin/admin.js:445`
- `setupAuthStateListener()` at `admin/admin.js:590`
- `ensureRoot()` at `admin/admin.js:708`
- `bindEntryEvents()` at `admin/admin.js:932`
- `openAdminEntry()` at `admin/admin.js:956`
- `withTimeout()` at `admin/admin.js:1002`
- `hasActiveAdminSession()` at `admin/admin.js:1044`
- `fetchAdminProfile()` at `admin/admin.js:1098`
- `loadAdminProfile()` at `admin/admin.js:1115`
- `handleLoginSubmit()` at `admin/admin.js:1138`
- `enterAdminMode()` at `admin/admin.js:2790`
- `exitAdminMode()` at `admin/admin.js:2812`
- `boot()` at `admin/admin.js:9748`

Boot sequence:

1. Adds CMS loading class.
2. Ensures public ADMIN buttons are safe.
3. Binds admin entry events.
4. Self-mounts admin root/shell.
5. Captures original editable values.
6. Installs debug helper.
7. Initializes Supabase client from `window.GROWVA_SUPABASE_CONFIG`.
8. Installs auth state listener.
9. Loads published visual/content/custom data.
10. Runs `hasActiveAdminSession()` with timeout.
11. If a valid session/profile exists, enters Admin Mode.

### Admin Button / Modal

Admin entry is detected through:

- `[data-admin-action="open-admin"]`
- `[data-admin-entry]`

`bindEntryEvents()` installs a document-level capture click listener. It prevents the public navigation transition from taking over admin clicks.

`openAdminEntry()`:

1. Sets a loading state on the clicked admin trigger.
2. Closes public mobile nav if open.
3. Ensures admin shell exists.
4. Checks active session/profile.
5. Enters Admin Mode if valid.
6. Otherwise opens the login modal.
7. Clears loading state in `finally`.

### Admin Shell

`ensureRoot()` creates:

- `.gv-admin-root.gv-admin-shell`
- login modal
- topbar
- inspector panel
- dashboard
- publish dialog
- hover badge

It exposes diagnostics via:

- `.gv-admin-shell`
- `[data-admin-shell]`
- `[data-admin-panel]`

### Admin Mode State

Admin Mode is represented by runtime variables and body classes:

- `mode`
- `currentUser`
- `adminProfile`
- `document.body.classList.contains('admin-mode')`
- `admin-preview-mode`
- `admin-edit-mode`
- `editor-safe-mode`

There is no separate persistent `localStorage` key that says "stay in Admin Mode across page navigation" for real Supabase auth. A full page reload must rehydrate from Supabase Auth session and `public.admin_profiles`.

## 4. Supabase/Auth Flow Map

### Frontend Config

`admin/supabase-config.js` defines:

- Supabase URL: `https://nynyhjjvvfxrpbmwstkq.supabase.co`
- A publishable/anon key is present.

The key value is intentionally not printed in this report.

### Client Creation

`initSupabase()` reads `window.GROWVA_SUPABASE_CONFIG` and creates the client only if:

- URL exists.
- anon/publishable key exists.
- key is not detected as unsafe/service-role.
- URL/key are not placeholders.
- `window.supabase.createClient` exists.

Client options:

- `persistSession: true`
- `autoRefreshToken: true`
- `detectSessionInUrl: true`

### Login

`handleLoginSubmit()` calls:

```js
supabaseClient.auth.signInWithPassword({ email, password })
```

Then it calls `loadAdminProfile(data.user)`.

If the profile is missing, login is rejected even if Supabase Auth succeeds.

### Session Restore

`hasActiveAdminSession()`:

1. Allows explicit mock mode only when `?mockAdmin=true` and `growva_admin_session` is set.
2. Calls `supabaseClient.auth.getSession()`.
3. Calls `supabaseClient.auth.getUser()` to verify server-side token validity.
4. Calls `loadAdminProfile(session.user)`.

### Admin Profile Schema

The local SQL schema defines:

```sql
create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

The current code queries:

```js
.from('admin_profiles')
.select('id,email,role')
.eq('id', user.id)
.maybeSingle()
```

This matches `supabase/schema.sql`. There is no `user_id` column in the inspected schema.

### Storage Keys

Admin/CMS code uses:

- `growva_admin_session` for explicit mock admin mode only.
- `growva_admin_draft` for local mock draft content.
- `growva_admin_custom_sections` for local mock custom sections.
- Supabase SDK-managed keys generally beginning with `sb-` or containing `supabase`.

Public code uses:

- `sessionStorage.gv_nav` for page transition detection.
- UTM/landing attribution keys in session storage.

Current `clearSupabaseAuthStorage()` removes Supabase-related keys only:

- keys beginning with `sb-`
- keys containing `supabase.auth`
- keys containing `supabase`

It should not clear `growva_admin_draft` or `growva_admin_custom_sections`.

## 5. Cross-Page Admin Session Investigation

### What Happens During Navigation

`js/script.js` installs the page transition system at `js/script.js:1399`.

For ordinary internal links:

1. It ignores admin targets:
   - `[data-admin-ui]`
   - `[data-admin-action]`
   - `[data-admin-entry]`
   - `.gv-admin-root`
   - `.admin-shell`
   - `.admin-panel`
2. For normal public links, it calls `preventDefault()`.
3. It sets `sessionStorage.gv_nav = '1'`.
4. It performs `window.location.href = href`.

This is a full page reload, not an SPA route change. Full reload destroys the current admin DOM and all in-memory state.

### Expected Admin Behavior Across Pages

Because Admin Mode is not separately persisted, cross-page Admin continuity depends entirely on:

- Supabase Auth session still existing in browser storage.
- `getSession()` returning quickly enough.
- `getUser()` returning quickly enough.
- `public.admin_profiles` returning a valid role quickly enough.
- `boot()` calling `enterAdminMode()` after successful session/profile restore.

### Browser Evidence

Audit browser run:

- `http://localhost:5500/`
  - `body.dataset.pageId`: `home`
  - admin shell present: yes
  - registry keys: 211
  - duplicate registry keys: 0
  - Supabase client ready: yes
  - `getSession()` works: yes
  - logged-in session in audit context: no
  - Auth health endpoint: `200`

- `http://localhost:5500/work.html`
  - `body.dataset.pageId`: `work`
  - admin shell present: yes
  - registry keys: 144
  - duplicate registry keys: 0
  - Supabase client ready: yes
  - `getSession()` works: yes
  - logged-in session in audit context: no
  - Auth health endpoint: `200`

This means `work.html` is not missing the Supabase SDK/config/admin scripts in the current files.

### Main Cross-Page Finding

The most likely failure is in session rehydration timing or session validity after a full page reload, not in static script inclusion.

Important timing detail:

- `boot()` wraps `hasActiveAdminSession()` in a 10s timeout.
- `openAdminEntry()` wraps `hasActiveAdminSession()` in a 5s timeout.
- `hasActiveAdminSession()` itself can do `getSession()`, `getUser()`, and profile lookup.

If Supabase refresh/getUser/profile is slow or internally locked after navigation, `openAdminEntry()` can decide there is no session before the sequence finishes. On heavier pages, animation and published-content boot work may add pressure to the same startup window.

## 6. Script Include / Order Table For All HTML Pages

Legend:

- Required stack present: `style.css`, `admin.css`, `script.js`, `content-registry.js`, Supabase SDK, `supabase-config.js`, `admin.js`
- Order checked: `script.js` before `content-registry.js` before Supabase SDK before `supabase-config.js` before `admin.js`

| Page | Required stack present | Order OK | Editable keys | Forms |
|---|---:|---:|---:|---:|
| `about.html` | yes | yes | 159 | 0 |
| `contact.html` | yes | yes | 138 | 1 |
| `faq.html` | yes | yes | 202 | 0 |
| `index.html` | yes | yes | 211 | 0 |
| `pricing.html` | yes | yes | 276 | 0 |
| `process.html` | yes | yes | 177 | 0 |
| `services.html` | yes | yes | 166 | 0 |
| `services/amazon-account-management.html` | yes | yes | 146 | 0 |
| `services/amazon-account-setup.html` | yes | yes | 146 | 0 |
| `services/amazon-listing-advertising-optimization.html` | yes | yes | 146 | 0 |
| `services/brand-identity-design.html` | yes | yes | 146 | 0 |
| `services/business-marketing-print.html` | yes | yes | 146 | 0 |
| `services/conversion-optimization.html` | yes | yes | 147 | 0 |
| `services/corporate-websites.html` | yes | yes | 146 | 0 |
| `services/custom-store-development.html` | yes | yes | 146 | 0 |
| `services/ecommerce-strategy.html` | yes | yes | 147 | 0 |
| `services/growth-systems.html` | yes | yes | 147 | 0 |
| `services/large-format-retail-print.html` | yes | yes | 146 | 0 |
| `services/marketing-social-design.html` | yes | yes | 146 | 0 |
| `services/packaging-design.html` | yes | yes | 146 | 0 |
| `services/packaging-print-production.html` | yes | yes | 146 | 0 |
| `services/performance-optimization.html` | yes | yes | 147 | 0 |
| `services/portfolio-websites.html` | yes | yes | 146 | 0 |
| `services/premium-shopify-website-development.html` | yes | yes | 147 | 0 |
| `services/shopify-cro.html` | yes | yes | 147 | 0 |
| `services/shopify-store-optimization.html` | yes | yes | 147 | 0 |
| `services/website-maintenance.html` | yes | yes | 147 | 0 |
| `shopify.html` | yes | yes | 184 | 0 |
| `work.html` | yes | yes | 144 | 0 |
| `work/amazon-storefronts.html` | yes | yes | 117 | 0 |
| `work/amazon-storefronts/hasat-organics.html` | yes | yes | 85 | 0 |
| `work/amazon-storefronts/maison-luxe.html` | yes | yes | 85 | 0 |
| `work/amazon-storefronts/noor-perfumery.html` | yes | yes | 85 | 0 |
| `work/brand-identity.html` | yes | yes | 117 | 0 |
| `work/brand-identity/hasat-organics.html` | yes | yes | 85 | 0 |
| `work/brand-identity/noor-perfumery.html` | yes | yes | 85 | 0 |
| `work/brand-identity/vella-cosmetics.html` | yes | yes | 85 | 0 |
| `work/marketing-print.html` | yes | yes | 117 | 0 |
| `work/marketing-print/noor-holiday.html` | yes | yes | 85 | 0 |
| `work/marketing-print/terra-grove.html` | yes | yes | 85 | 0 |
| `work/marketing-print/vella-campaign.html` | yes | yes | 85 | 0 |
| `work/packaging-design.html` | yes | yes | 117 | 0 |
| `work/packaging-design/atelier-marbre.html` | yes | yes | 85 | 0 |
| `work/packaging-design/noor-no03.html` | yes | yes | 85 | 0 |
| `work/packaging-design/terra-grove.html` | yes | yes | 85 | 0 |
| `work/shopify-stores.html` | yes | yes | 120 | 0 |
| `work/shopify-stores/atelier-marbre.html` | yes | yes | 88 | 0 |
| `work/shopify-stores/noor-perfumery.html` | yes | yes | 88 | 0 |
| `work/shopify-stores/terra-grove.html` | yes | yes | 88 | 0 |
| `work/shopify-stores/vella-cosmetics.html` | yes | yes | 88 | 0 |
| `work/websites.html` | yes | yes | 117 | 0 |
| `work/websites/atelier-marbre.html` | yes | yes | 85 | 0 |
| `work/websites/dune-studio.html` | yes | yes | 85 | 0 |
| `work/websites/hasat-organics.html` | yes | yes | 85 | 0 |

## 7. Content Registry / Page Path Investigation

### Registry Behavior

`js/content-registry.js`:

- Reads `document.body.dataset.pageId`, or first `[data-page-id]`, or `unknown`.
- Finds all `[data-edit-key]` elements.
- Stores fields in `window.GROWVA_CONTENT_REGISTRY.fields`.
- Tracks duplicate edit keys.
- Stores `[data-section-type]` sections.

Every inspected HTML page has many editable keys. Browser inspection found:

- Home: 211 keys, 0 duplicates.
- Work overview: 144 keys, 0 duplicates.

### Admin Registry Fallback

`admin/admin.js` also has `getRegistry()` and `refreshContentRegistry()` fallbacks. If `window.GROWVA_CONTENT_REGISTRY` is missing, admin can rebuild a registry from DOM `[data-edit-key]`.

### Page Path Behavior

`getPagePath()` normalizes browser paths to storage paths:

- `/` becomes `index.html`
- `/index.html` becomes `index.html`
- `/work.html` becomes `work.html`
- `/services/foo.html` becomes `services/foo.html`
- nested work paths become `work/...html`

Drafts, published content, custom sections, design tokens, section settings, and element styles are scoped heavily by `pagePath`.

Potential future risk: if older database rows were saved under `/`, `/index.html`, or `/work.html`, current code would not find them because current canonical values are `index.html` and `work.html`. The inspected current code is internally consistent, but existing Supabase data could still contain older path variants.

## 8. Current Bug Root-Cause Analysis

### Ranked Hypotheses

#### 1. Session rehydration timeout after full page navigation

Evidence from code:

- Public navigation performs full reload via `window.location.href` in `js/script.js:1431`.
- Admin Mode is not stored separately.
- New page must call `hasActiveAdminSession()` during `boot()`.
- `openAdminEntry()` uses a 5s wrapper timeout around the whole session/profile sequence.
- The session sequence can require `getSession()`, `getUser()`, and `admin_profiles` lookup.

Evidence from browser behavior:

- Home and `work.html` both load scripts and Supabase client correctly when logged out.
- Reported user behavior is "Admin exits or asks login after navigation," which matches failed/late rehydration on reload.

Files involved:

- `admin/admin.js`
- `js/script.js`

Risk level: high for admin UX, low for public site.

Fix complexity: medium.

Scope: admin only.

#### 2. Auth refresh/session lock or stale token during navigation

Evidence from code:

- Supabase client uses `autoRefreshToken: true`.
- Previous browser QA saw revoked refresh-token errors.
- Current code has stale-session handling, but full-page boot still depends on Supabase client settling quickly.

Evidence from browser behavior:

- User has observed timeout/stale-auth-like messages on non-home pages.

Files involved:

- `admin/admin.js`
- Supabase browser auth storage

Risk level: high for admin, none for public visitors.

Fix complexity: medium.

Scope: admin only.

#### 3. Admin Mode is not designed to persist as UI state across pages

Evidence from code:

- No real Supabase admin-mode persistence key exists.
- `growva_admin_session` is mock-mode only.
- `admin-mode` is a body class that disappears on reload.
- Re-entry relies on Supabase Auth profile restoration.

Evidence from behavior:

- Admin shell disappears during normal navigation because DOM reloads.

Files involved:

- `admin/admin.js`
- `js/script.js`

Risk level: medium.

Fix complexity: medium.

Scope: admin only.

#### 4. Existing database page_path variants may not match current canonicalization

Evidence from code:

- Current code uses `index.html`, `work.html`, and relative nested paths.
- Public contact attribution uses paths that may include leading slash/query in `js/script.js`.
- Older CMS rows could have been saved under slash-prefixed paths.

Evidence from browser behavior:

- This would affect content hydration or drafts, not usually auth login itself.

Files involved:

- `admin/admin.js`
- Supabase `cms_content` rows

Risk level: medium for CMS content consistency.

Fix complexity: medium.

Scope: CMS content/publish.

#### 5. RLS/profile lookup failure

Evidence from code:

- Profile lookup is by `admin_profiles.id = user.id`.
- Schema expects `id uuid primary key references auth.users(id)`.
- If the real Supabase table lacks the row for the logged-in user, auth succeeds but admin role fails.

Evidence from behavior:

- User says Home login works, so the profile likely exists for at least one session. Still possible if session belongs to another user or if RLS is inconsistent.

Files involved:

- `admin/admin.js`
- `public.admin_profiles`
- Supabase RLS policies

Risk level: medium.

Fix complexity: low to medium.

Scope: admin auth.

#### 6. Missing scripts on non-home pages

Evidence from code/browser:

- All 54 pages include required stack and order.
- Browser confirmed `work.html` has admin shell, registry, SDK, config, client, and health endpoint.

Risk level: low.

Fix complexity: low if discovered later, but current audit does not support this as the main cause.

Scope: not likely.

## 9. Browser Debug Checklist

Run these manually in the browser console.

### Supabase/Admin Debug

```js
window.GROWVA_ADMIN_DEBUG = true;
location.reload();
```

```js
await window.growvaAdminDebug.testSupabase();
window.growvaAdminDebug;
window.growvaAdminDebug.getState();
```

### Path / Page State

```js
window.location.pathname;
document.body.dataset.pageId;
document.body.className;
document.documentElement.className;
```

### Storage Keys

```js
Object.keys(localStorage).filter(k => k.includes('supabase') || k.startsWith('sb-') || k.includes('growva'));
Object.keys(sessionStorage);
```

### Scripts Loaded

```js
[...document.scripts].map(s => s.src).filter(Boolean);
```

### Admin Shell / Mode

```js
document.querySelector('.gv-admin-shell, [data-admin-shell], [data-admin-panel]');
document.querySelectorAll('[data-admin-action=\"open-admin\"], [data-admin-entry]').length;
document.body.classList.contains('admin-mode');
document.body.classList.contains('admin-edit-mode');
document.body.classList.contains('admin-preview-mode');
```

### Content Registry

```js
window.GROWVA_CONTENT_REGISTRY;
window.GROWVA_CONTENT_REGISTRY?.pageId;
window.GROWVA_CONTENT_REGISTRY?.keys().length;
window.GROWVA_CONTENT_REGISTRY?.duplicateKeys;
```

### Supabase Availability

```js
Boolean(window.supabase);
Boolean(window.GROWVA_SUPABASE_CONFIG);
window.GROWVA_SUPABASE_CONFIG?.url;
```

Do not print or paste the anon key value into issue reports.

## 10. Files Likely Needing Fixes Later

| File | Why it may need edits later |
|---|---|
| `admin/admin.js` | Session rehydration timing, admin-mode persistence strategy, auth/profile retry sequencing, page_path compatibility |
| `js/script.js` | Page transition behavior during admin mode/navigation, possible admin-aware navigation handling |
| `admin/supabase-config.js` | Only if deployment/local config differs from audited config |
| HTML files | Only if future audit finds include drift; current audit found no missing required includes |
| Supabase data rows | Only if old `page_path` variants exist and need migration/compatibility |

## 11. Files That Should Not Be Touched Unless Necessary

- `supabase/schema.sql` unless a future prompt explicitly asks for schema work.
- Supabase Edge Functions unless a CRM/notification-specific bug is being fixed.
- Public page content/layout HTML unless script include drift is found.
- Public `css/style.css` unless admin z-index/navigation conflicts are proven.
- CRM/Leads/Pipeline/Tasks code paths unless auth failure is proven to affect them.
- `admin/supabase-config.js` key value should not be printed or replaced casually.

## 12. Risk Warnings

- Do not add `user_id` assumptions to `admin_profiles`; inspected schema uses `id`.
- Do not query `cms_admin_profiles`; project context and SQL point to `public.admin_profiles`.
- Do not store service-role keys in frontend.
- Do not blindly clear all `growva_*` storage. Some keys are mock/admin draft state.
- Do not treat all auth timeouts as wrong credentials; network, stale refresh token, auth lock, and profile lookup must be distinguished.
- Do not make public navigation bypass page transitions for all users unless admin mode is active.
- Do not normalize page paths without considering existing Supabase rows that may use older slash-prefixed values.
- Do not assume login continuity means preserving DOM. Normal static navigation reloads the page.

## 13. Final Recommended Fix Plan

### Stage 1: Fix admin session persistence across pages

Files to edit later:

- `admin/admin.js`

Problem to solve:

- Full navigation reloads pages and destroys `admin-mode`; rehydration needs to be reliable and user-friendly.

Likely repair:

- Add an explicit admin UI intent flag such as `growva_admin_mode_intent` only after real Supabase admin profile is loaded.
- On boot, if a valid Supabase session/profile exists and the intent flag is present, enter Admin Mode after rehydration.
- If session is invalid, clear only the intent and Supabase stale auth keys as appropriate.
- Ensure `openAdminEntry()` waits for any in-flight boot session check instead of racing another one.

Acceptance tests:

- Login on `/` with real admin.
- Navigate to `/work.html`.
- Admin Mode re-enters without showing login modal.
- Navigate to nested page such as `/work/shopify-stores/noor-perfumery.html`.
- Admin Mode re-enters.
- Logout clears admin intent and does not re-enter.

Must not change:

- Role permissions.
- Draft/publish logic.
- CRM features.

### Stage 2: Fix script include/order consistency across all HTML pages

Files to edit later:

- HTML pages only if drift is found.

Problem to solve:

- Current audit found no missing required stack. Future repair should keep a verification script to prevent drift.

Acceptance tests:

- All HTML pages include admin/public scripts in required order.
- Nested pages resolve `../` / `../../` paths correctly.

Must not change:

- Page content or visual design.

### Stage 3: Fix page path canonicalization for CMS

Files to edit later:

- `admin/admin.js`
- Possibly a Supabase data migration only in a separate SQL-approved prompt.

Problem to solve:

- Current canonical path is relative no-leading-slash. Existing rows might have older variants.

Likely repair:

- Read using a small compatibility set such as `index.html`, `/index.html`, `/` for home and `work.html`, `/work.html` for work.
- Continue writing one canonical value.

Acceptance tests:

- Published home edits load on `/` and `/index.html`.
- Published work edits load on `/work.html`.
- Nested page edits load on their nested paths.

Must not change:

- `edit_key` format.
- Existing draft/publish tables.

### Stage 4: Fix Supabase auth/profile loading reliability

Files to edit later:

- `admin/admin.js`

Problem to solve:

- Auth/profile restore has multiple async steps and can be misclassified as logged out.

Likely repair:

- Centralize boot auth check into one promise.
- Increase or stage timeouts.
- Show "restoring admin session" before giving up.
- Distinguish `getSession`, `getUser`, and `admin_profiles` failures in UI/debug.

Acceptance tests:

- Refresh while logged in restores admin.
- Invalid refresh token logs out gracefully.
- Missing profile shows exact `public.admin_profiles` message.

Must not change:

- Supabase RLS model.
- Role names.

### Stage 5: Fix Admin Edit/Publish persistence across all pages

Files to edit later:

- `admin/admin.js`

Problem to solve:

- Ensure Save Draft and Publish work on all pages, not only home.

Acceptance tests:

- Save/publish on `index.html`.
- Save/publish on `work.html`.
- Save/publish on one service page.
- Save/publish on one nested work case study.
- Refresh shows published content.

Must not change:

- Public visitor mode.
- Text safety and escaping.

### Stage 6: Fix Admin UI overlap

Files to edit later:

- `admin/admin.css`
- Possibly minor `admin/admin.js` class toggles only if needed.

Problem to solve:

- Admin topbar/panel/modal/selection overlays can visually compete with public layouts.

Acceptance tests:

- Desktop admin editing on home, work, service, nested work page.
- Mobile admin drawer behavior.
- Publish modal hides/softens selection overlays.
- Preview as Visitor hides admin overlays.

Must not change:

- Public layout for normal visitors.

### Stage 7: Run final QA

Files to edit later:

- No planned edits; testing only.

Acceptance tests:

- `node --check admin/admin.js`
- `node --check js/script.js`
- `node --check js/content-registry.js`
- `git diff --check`
- Browser: login, navigate pages, refresh, save draft, publish, preview visitor, logout.
- Verify no service-role key in frontend.

## 14. Exact Acceptance Tests For Future Fix Prompt

1. Start server:

```powershell
python -m http.server 5500
```

2. Open:

```text
http://localhost:5500/
```

3. Enable debug:

```js
window.GROWVA_ADMIN_DEBUG = true;
location.reload();
```

4. Login with a real Supabase admin user.

Expected:

- Admin Mode enters.
- Role is shown as owner/editor/viewer.
- `await window.growvaAdminDebug.testSupabase()` returns `clientReady: true`, `getSession.hasSession: true`, and `adminProfile.found: true`.

5. Navigate to:

```text
http://localhost:5500/work.html
```

Expected:

- Admin Mode restores automatically.
- No login modal.
- No `Auth request timed out`.
- No `Supabase connection failed`.

6. Navigate to:

```text
http://localhost:5500/services/premium-shopify-website-development.html
```

Expected:

- Admin Mode restores automatically.
- Registry is present and has editable keys.

7. Navigate to:

```text
http://localhost:5500/work/shopify-stores/noor-perfumery.html
```

Expected:

- Admin Mode restores automatically.
- Registry is present and has editable keys.

8. Refresh on each page.

Expected:

- Valid session restores.
- Invalid/revoked session logs out gracefully and opens login only on admin entry.

9. Save Draft and Publish on:

- `index.html`
- `work.html`
- one service page
- one nested work page

Expected:

- Draft appears in inspector.
- Publish dialog shows correct changed value.
- Refresh shows published value.
- Visitor preview hides admin overlays and shows published content.

10. Logout.

Expected:

- Admin mode exits.
- Admin intent/session state is cleared.
- Refresh does not re-enter admin.

## Audit Commands Run

```powershell
git status --short --untracked-files=all
node --check admin/admin.js
node --check js/script.js
node --check js/content-registry.js
```

All three `node --check` commands passed.

Current working tree at audit time included prior uncommitted admin work:

```text
 M admin/admin.css
 M admin/admin.js
?? ADMIN_AUTH_LOGIN_TIMEOUT_FIX_REPORT.md
?? ADMIN_EDIT_PUBLISH_UI_FIX_REPORT.md
?? supabase/.temp/linked-project.json
```

This audit created only:

```text
GROWVA_FULL_SITE_ADMIN_AUDIT_REPORT.md
```
