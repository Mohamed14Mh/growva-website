# GROWVA CMS Phase 19 — Contact Form, Lead Capture, and Notification Pipeline

## Files Changed

| File | Change |
|------|--------|
| `supabase/phase-19-contact-leads.sql` | **RUN REQUIRED** — creates `cms_contact_submissions` table, indexes, trigger, RLS |
| `contact.html` | +8 lines: honeypot field, status div inserted inside form |
| `js/script.js` | +72 lines net: full Supabase-integrated form handler replaces 8-line stub |
| `admin/admin.js` | +128 lines net: state vars, `loadLeads()`, `updateLeadStatus()`, `updateLeadArchived()`, `renderLeadsTab()`, tab registration, click handlers, Overview metric |
| `admin/admin.css` | +130 lines: honeypot hiding, form status styles, leads tab (filter bar, badges, detail panel, actions) |
| `ADMIN_PHASE_19_CONTACT_LEADS_REPORT.md` | This report |

---

## SQL Patch Details

**File:** `supabase/phase-19-contact-leads.sql`
**Must be run:** Yes — this creates or completes `cms_contact_submissions`.

### Original Failure (v1 → v2)

The first version of this file incorrectly referenced `public.cms_admin_profiles` in RLS policy `USING` / `WITH CHECK` clauses. That table does not exist. The project uses `public.admin_profiles` (primary key = `auth.uid()`) and the helper function `public.current_admin_role()` defined in `schema.sql`. Every other CMS phase SQL file uses `public.current_admin_role()` exclusively.

**Error was:** `ERROR: 42P01: relation "public.cms_admin_profiles" does not exist`

**Fix:** All four RLS policies now use `public.current_admin_role()` — the same pattern as `phase-7-visual-controls.sql`, `phase-8-section-builder.sql`, `phase-11-media-asset-management.sql`, and all other phase SQL files.

**Safe after partial failure:** Yes. The table, indexes, and trigger may already exist from the first run. `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`, and `DROP POLICY IF EXISTS` before every `CREATE POLICY` make the script fully idempotent. No data is lost.

### Schema

```sql
CREATE TABLE public.cms_contact_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,          -- combined first + last name
  email         TEXT NOT NULL,
  company       TEXT,
  phone         TEXT,                   -- not wired in current form (future use)
  project_type  TEXT,                   -- from <select name="service">
  budget        TEXT,                   -- from <select name="budget">
  message       TEXT NOT NULL,          -- includes timeline if provided
  page_path     TEXT,
  source        TEXT DEFAULT 'contact_form',
  status        TEXT DEFAULT 'new',     -- CHECK IN ('new', 'read', 'archived')
  is_archived   BOOLEAN DEFAULT false,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

Constraints: `status IN ('new','read','archived')`, name ≤ 200 chars, email ≤ 320 chars, message ≤ 5000 chars.

Indexes on `status`, `created_at DESC`, `is_archived` for efficient admin queries.

`updated_at` trigger fires on UPDATE to auto-timestamp changes.

---

## RLS Behavior

**Admin role system:** `public.current_admin_role()` (defined in `schema.sql`)  
Returns `'owner' | 'editor' | 'viewer' | NULL` for the authenticated user.  
Source table: `public.admin_profiles` where `id = auth.uid()`.

| Role | INSERT | SELECT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Anon (public visitor) | ✓ | ✗ | ✗ | ✗ |
| Authenticated viewer | ✗ | ✓ | ✗ | ✗ |
| Authenticated editor | ✗ | ✓ | ✓ | ✗ |
| Authenticated owner | ✗ | ✓ | ✓ | ✓ |

- Public visitors **cannot** read, update, or delete any submissions. Their own submission is not returned to them after INSERT (RLS blocks the SELECT).
- Viewer role can see all submissions in the admin but cannot change status or archive.
- Editor/Owner can mark read/unread and archive/unarchive.
- Only owner can delete (not exposed in the UI — archive is preferred).

---

## Public Form Behavior

The form handler in `js/script.js` (`initContactForm()` IIFE):

1. Records `gvFormPageLoadTime = Date.now()` at module initialization.
2. On submit:
   - Prevents default.
   - Checks honeypot field — if filled, silently shows success (bot gets no error signal).
   - Checks timing — if submitted in under 2 seconds, silently shows success (bot).
   - Combines `first_name` + `last_name` → `name`.
   - Appends `timeline` value to `message` if provided ("Ideal start date: …").
   - Runs `validateLeadData()` — returns first validation error as a string.
   - If valid: disables submit, shows "Sending…" status, inserts to Supabase.
   - On success: hides form, shows `#formSuccess` block.
   - On error: unlocks submit, re-enables button, shows error message with fallback email.

The `#formStatus` div is `aria-live="polite"` so screen readers announce status changes.

---

## Validation Behavior

| Rule | Value |
|------|-------|
| Name minimum length | 2 characters |
| Email format | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| Project type | Required (select must not be empty) |
| Message minimum | 10 characters |
| Message maximum | 4000 characters (DB constraint is 5000) |

Validation errors surface in `#formStatus` with red styling (`contact-form-status--error`). Only the first error is shown at a time. The form is NOT hidden on validation errors — user can correct and resubmit.

---

## Spam Protection

| Protection | Method |
|------------|--------|
| Honeypot | `<input name="hp_website">` hidden off-screen; if filled → silently "succeed" without DB insert |
| Timing check | Form submitted < 2s after page load → silently "succeed" (bots fill forms instantly) |
| Min message length | 10 chars — prevents blank/single-word submissions |
| Max message length | 4000 chars — prevents payload flooding |
| Email format | Regex validates format |
| Re-submit lock | `gvSubmitLocked = true` on submit attempt; only unlocked on error — prevents double-submit |
| No CAPTCHA | Intentionally omitted this phase — see Phase 20 notes |

The honeypot does NOT use `display:none` — it uses `position:absolute; left:-9999px` which is harder for bots to detect. `tabindex="-1"` prevents keyboard focus. `autocomplete="off"` prevents browser autofill.

---

## Admin Leads Tab Behavior

### Location

Dashboard → **Leads** tab (last in tab list).

### On First Open

If `leadsData` is empty when the tab opens, `loadLeads()` is called automatically, then the dashboard re-renders with results.

### Filter Bar

Four filter buttons: **All Active** | **New** | **Read** | **Archived** | **↻ Refresh**

- "All Active" = all rows where `is_archived = false`
- "Archived" = rows where `is_archived = true`
- Counts shown in button labels

### Lead List

Per lead row:
- Name (bold) + status badge (NEW / read) + received date (right-aligned)
- Email address (blue)
- Company name (if present)
- Message preview (first 120 chars, truncated with "…")
- Expand / Collapse button

### Expanded Detail

- Company, Project type, Budget, Page path, Source, Full received timestamp
- Full message (scrollable, pre-wrapped)
- User agent (first 120 chars, muted)
- Action buttons: Mark Read, Mark New, Archive, Unarchive (as applicable)

### Status Badges

- `NEW` — lime green badge, blue left-border on row
- `read` — grey badge, no border accent

### Optimistic Updates

`updateLeadStatus()` and `updateLeadArchived()` update `leadsData` immediately before the Supabase call for instant UI feedback. On Supabase error, the change is reverted and the dashboard re-renders.

### Permissions in UI

| Action | Viewer | Editor | Owner |
|--------|--------|--------|-------|
| See leads | ✓ | ✓ | ✓ |
| Mark read/new | ✗ | ✓ | ✓ |
| Archive/unarchive | ✗ | ✓ | ✓ |
| Delete | ✗ | ✗ | (RLS allows, not in UI) |

All mutating actions are guarded by `canAdminEdit()` in JavaScript. RLS is the authoritative gate.

### Refresh

Manual refresh via the **↻ Refresh** button reloads from Supabase and re-renders. `refreshDashboardData()` does NOT auto-load leads (they are cross-page, not page-specific). Leads are loaded only when:
- Leads tab is opened for the first time in a session
- Refresh button is clicked

### Overview Tab Metric

The Overview tab shows **Leads (new)** as a metric card (count of `status === 'new' && !is_archived`).

---

## Notification Strategy

**Email notifications are NOT implemented in this phase.** This is a deliberate constraint — email notifications require server-side code and API secrets, neither of which belong in the frontend.

**Recommended approach for Phase 20+:**

1. Create a Supabase Edge Function (TypeScript/Deno)
2. Register it as a database webhook triggered on `INSERT` to `cms_contact_submissions`
3. The function reads the new row and calls Resend (or SendGrid) with the admin notification email
4. The API key is stored as a Supabase Edge Function secret — never in client code

Until email notifications are implemented, admins can:
- Check the Leads tab in the dashboard
- Set up a Supabase notification via the Supabase dashboard → Database → Webhooks

---

## Security Review

### innerHTML in renderLeadsTab()

All user-controlled values from the database are passed through `escapeHtml()`:

| Value | Escaped |
|-------|---------|
| `lead.name` | `escapeHtml(lead.name \|\| '—')` ✓ |
| `lead.email` | `escapeHtml(lead.email \|\| '—')` ✓ |
| `lead.company` | `escapeHtml(lead.company)` ✓ |
| `lead.project_type` | `escapeHtml(lead.project_type)` ✓ |
| `lead.budget` | `escapeHtml(lead.budget)` ✓ |
| `lead.message` | `escapeHtml(lead.message \|\| '')` ✓ |
| `lead.page_path` | `escapeHtml(lead.page_path)` ✓ |
| `lead.source` | `escapeHtml(lead.source)` ✓ |
| `lead.user_agent` | `escapeHtml(...)` ✓ |
| `lead.id` | `escapeHtml(lead.id)` in `data-lead-id` ✓ |
| `lead.created_at` | `escapeHtml(new Date(...).toLocaleString())` ✓ |
| `createdDate` | `escapeHtml(createdDate)` in template ✓ |
| `msgPreview` | `escapeHtml(message.slice(0,120))` ✓ |
| `statusBadge` | Hardcoded HTML from `lead.status === 'new'` comparison — no user input in markup ✓ |

No stored XSS risk — all database values are escaped before innerHTML assignment.

### Public form submission

- The Supabase anon key is used (publishable, safe with RLS)
- No service-role key anywhere in client code
- `user_agent` is truncated to 400 chars before INSERT — no large payload risk
- Form values are NOT pre-processed or evaluated — sent as plain strings

### Secret key checks

```
javascript:   — 2 occurrences, both guard/block code only ✓
sb_secret_    — 0 occurrences in js/script.js ✓
service_role  — 0 occurrences in js/script.js ✓
resend        — 0 occurrences ✓
api_key       — 0 occurrences ✓
```

---

## Browser QA Notes

Verified by code review and `node --check`. No live browser available.

**Public form (code review):**
- Missing name → "Please enter your full name." ✓
- Missing project type → "Please select a project type." ✓
- Short message → "Please tell us about your project (at least 10 characters)." ✓
- Honeypot filled → silent success (no DB insert) ✓
- Submitted < 2s → silent success (no DB insert) ✓
- Supabase error → "Something went wrong…" message shown, button re-enabled ✓
- Supabase not configured → "Form service is currently unavailable…" + email link ✓
- Success state → form hidden, `#formSuccess` shown with `.show` class ✓
- `aria-live="polite"` on status div → screen reader announcements ✓

**Admin Leads tab (code review):**
- Opens with loading state if no data → `loadLeads()` called → re-renders ✓
- Filter buttons switch `leadsFilter` → re-renders immediately ✓
- Expand toggles `leadsExpanded` → shows detail section ✓
- Mark Read → optimistic update + Supabase UPDATE ✓
- Mark New → optimistic update + Supabase UPDATE ✓
- Archive → sets `is_archived = true`, row moves out of "All Active" view ✓
- Unarchive → sets `is_archived = false`, row returns to "All Active" view ✓
- Viewer: action buttons not rendered (guarded by `canEdit` in `renderLeadsTab()`) ✓
- Empty state message shown when no leads or filter matches nothing ✓

**Regression checks (code review):**
- Visual Designer, Properties Panel, Responsive Runtime: not touched ✓
- Content tab, Style tab: not touched ✓
- Save Draft, Publish, Draft Compare: not touched ✓
- Preview as Visitor: not touched ✓
- Section Builder, Media Library, Visual Control, Section Manager: not touched ✓
- GSAP, Lenis, Three.js, page transitions: not touched ✓
- Mega menu, mobile menu: not touched ✓
- All existing dashboard tabs continue to work ✓
- `handleAdminClick` extended with leads actions — no existing action names conflict ✓

---

## Known Limitations

1. **No email notification** — Admins must manually check the Leads tab. Email notification requires a Supabase Edge Function (Phase 20+).

2. **No delete in UI** — Archive is preferred. Owner-level DELETE is RLS-allowed but not surfaced in the admin dashboard this phase.

3. **Leads are global, not page-scoped** — Unlike content drafts, leads are not filtered by `page_path` in the admin. All leads from all pages appear. This is intentional (there is only one contact form page).

4. **Leads not auto-reloaded on dashboard open** — Leads only load when the Leads tab is first opened in a session, or when Refresh is clicked. If a new submission arrives while the admin has the dashboard open, they must click Refresh.

5. **No CAPTCHA** — Honeypot + timing check provides basic bot protection. High-volume spam would require reCAPTCHA or Cloudflare Turnstile (Phase 20+).

6. **Phone field in DB, not in form** — The HTML form does not have a phone field. The DB column exists for future use.

7. **Viewer cannot mark leads** — Read-only for viewers. This is per the role spec.

8. **No archived lead count in Overview metric** — Overview shows "new unarchived leads only" count. Full stats are in the Leads tab.

---

## Temporary QA Files

No temporary QA or debug files were created during Phase 19.

---

## node --check Result

```
admin/admin.js     — PASS
js/script.js       — PASS
js/content-registry.js — PASS
```

---

## Safe to Commit

**Yes** — after running `supabase/phase-19-contact-leads.sql` in the Supabase SQL Editor.

---

## Exact Commit Command

```bash
git add contact.html js/script.js admin/admin.js admin/admin.css supabase/phase-19-contact-leads.sql ADMIN_PHASE_19_CONTACT_LEADS_REPORT.md
git commit -m "$(cat <<'EOF'
Phase 19: Contact form lead capture + admin Leads tab

- cms_contact_submissions table: RLS anon-INSERT-only, admin-SELECT,
  editor/owner UPDATE, owner DELETE; status enum, DB constraints, updated_at trigger
- contact.html: honeypot field (off-screen, tabindex=-1) + formStatus aria-live div
- js/script.js: full Supabase-integrated form handler; validates name/email/service/
  message; honeypot + 2s timing bot guards; loading/error/success states; submit lock
- admin.js: Leads tab with loadLeads(), renderLeadsTab(), updateLeadStatus(),
  updateLeadArchived(); filter bar (All/New/Read/Archived); expandable detail rows;
  optimistic status updates; Mark Read/New, Archive/Unarchive actions; role-gated;
  Overview tab shows unread lead count; leads load on first tab open or refresh
- admin.css: honeypot hide, form status messages, leads filter bar, status badges,
  lead detail panel, action buttons
- Email notification deferred to Phase 20 (requires Edge Function + secret key)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 20 Safe to Start

**Yes.** No regressions introduced. All prior phase features remain intact.

---

## Recommended Phase 20 Title

**Phase 20: Email Notification Pipeline via Supabase Edge Function**

Suggested scope:
- Create a Supabase Edge Function (`contact-notify`) triggered by a database webhook on INSERT to `cms_contact_submissions`
- Function calls Resend API (or SendGrid) to email the admin team when a new lead arrives
- Function secret (`RESEND_API_KEY`) stored as Supabase Edge Function environment secret — never in client code
- Email includes name, email, company, project type, message excerpt
- Admin dashboard: add "Send test notification" button (owner-only) that calls the edge function directly via `supabase.functions.invoke()`
- Rate-limit guard in the edge function to prevent abuse
- Document deployment in `supabase/phase-20-edge-function-notify.md`
