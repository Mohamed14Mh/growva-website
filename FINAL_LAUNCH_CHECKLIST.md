# GROWVA CMS — Final Launch Checklist
## All Phases Complete (1–32)

**Date:** 2026-07-05

---

## Pre-Deploy: Local Verification

- [ ] `node --check admin/admin.js` — PASS
- [ ] `node --check js/script.js` — PASS
- [ ] `git status` — working tree clean
- [ ] `git diff --check` — no whitespace errors

---

## Supabase: SQL Patches (Run in Order)

Apply any unapplied SQL patches in the Supabase SQL Editor. Patches are idempotent — safe to re-run if unsure.

### Phase patches to run (if not already applied)

```
supabase/phase-24-lead-pipeline.sql
supabase/phase-25-lead-activity.sql
supabase/phase-26-notification-log.sql
supabase/phase-27-lead-tasks.sql
supabase/phase-28-task-reminders.sql
supabase/phase-29-crm-reminder-runs.sql
supabase/phase-31-security-hardening.sql
```

**Phase 30** and **Phase 32** require no SQL — frontend-only changes.

### Verification query after all patches

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'admin_profiles',
    'cms_content',
    'cms_audit_log',
    'cms_contact_submissions',
    'cms_notification_log',
    'cms_lead_activity',
    'cms_lead_tasks',
    'cms_crm_reminder_runs',
    'cms_crm_reminder_run_items'
  )
ORDER BY tablename;
-- All rows: rowsecurity = true
```

---

## Supabase: Edge Functions (Deploy/Redeploy)

```bash
# Deploy all Edge Functions (or redeploy individually)
supabase functions deploy contact-notify
supabase functions deploy resend-webhook
supabase functions deploy task-reminder-notify
supabase functions deploy crm-reminder-sweep
```

`crm-reminder-sweep` **must** be redeployed — Phase 31 fixed an HTML injection vulnerability in the digest email renderer.

---

## Supabase: Secrets / Environment Variables

### Required secrets (must be set before Edge Functions work)

```bash
supabase secrets set RESEND_API_KEY=<your-resend-key>
supabase secrets set ADMIN_NOTIFY_EMAIL=<admin-email>
supabase secrets set ADMIN_FROM_EMAIL=<from-email>
```

### Strongly recommended

```bash
# Prevents unauthenticated POST to contact-notify triggering email delivery
supabase secrets set CONTACT_NOTIFY_WEBHOOK_SECRET=<strong-random-value>

# Generate a strong value:
# openssl rand -hex 32
```

Without `CONTACT_NOTIFY_WEBHOOK_SECRET`, any POST to the `contact-notify` URL triggers email delivery. The Database Webhook must send the matching `x-contact-notify-secret` header once this secret is set.

### Verify secrets are set (does not expose values)

```bash
supabase secrets list
```

Expected output includes: `RESEND_API_KEY`, `ADMIN_NOTIFY_EMAIL`, `ADMIN_FROM_EMAIL`, `CONTACT_NOTIFY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (auto-set).

---

## Supabase: Admin Profiles

Ensure at least one admin user exists with `role = 'owner'`:

```sql
SELECT id, email, role FROM public.admin_profiles ORDER BY role;
-- Should have at least one 'owner' row
```

If no owner exists, insert one (after the user has registered via Supabase Auth):

```sql
INSERT INTO public.admin_profiles (id, email, role)
VALUES ('<auth-user-uuid>', '<admin-email>', 'owner')
ON CONFLICT (id) DO UPDATE SET role = 'owner';
```

---

## Deployment: Static Files

Push all updated files to your hosting provider (Netlify, Vercel, Cloudflare Pages, etc.):

**Files changed in Phase 30–32:**
```
admin/admin.js           — Control Center tab + CSS fixes
admin/admin.css          — Control Center CSS + warn/mobile fixes
supabase/functions/crm-reminder-sweep/index.ts  — HTML injection fix
```

**Full deploy recommended** — push all files to ensure CDN cache is cleared on updated assets.

---

## Post-Deploy: Smoke Tests

### Admin login
- [ ] Navigate to `/admin/` (or admin entry point)
- [ ] Login overlay appears if not authenticated
- [ ] Login with owner credentials → dashboard loads
- [ ] All tabs visible in tab row (including Control Center)

### CMS tabs
- [ ] Overview tab loads without error
- [ ] Drafts tab shows existing drafts
- [ ] Visual Designer opens (Content/Style tabs work)
- [ ] Section Builder loads
- [ ] Media Library loads

### CRM tabs
- [ ] Leads tab loads all leads
- [ ] Pipeline tab renders kanban board
- [ ] Tasks tab shows open tasks
- [ ] Lead Insights renders charts
- [ ] Notifications tab shows log
- [ ] Control Center tab loads and shows health metrics
- [ ] Archive button on a lead shows amber/warning color (Phase 32 fix)
- [ ] Cancel task button shows amber/warning color (Phase 32 fix)
- [ ] Lead detail grid stacks to single column on mobile (Phase 32 fix)

### Reminder sweep (editor/owner only)
- [ ] Control Center → Run Sweep button visible (not shown to viewer)
- [ ] Click Run Sweep → sweep executes → status message updates

### Contact form
- [ ] Submit contact form → confirmation shown
- [ ] Lead appears in admin Leads tab
- [ ] Notification email received at `ADMIN_NOTIFY_EMAIL`

### Viewer role (if applicable)
- [ ] Log in with viewer credentials
- [ ] Leads visible but no Archive/Mark Read buttons
- [ ] Run Sweep button not visible
- [ ] Pipeline drag-and-drop disabled
- [ ] Task creation form disabled

---

## Security Checklist

- [ ] No `RESEND_API_KEY` in any frontend JS file
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` in any frontend JS file
- [ ] `supabase-config.js` contains only the publishable anon key
- [ ] Admin path (`/admin/`) is in `robots.txt` Disallow
- [ ] `CONTACT_NOTIFY_WEBHOOK_SECRET` set in Supabase secrets
- [ ] RLS enabled on all 9 admin tables (verified by SQL query above)
- [ ] `crm-reminder-sweep` redeployed with HTML injection fix

### Optional production hardening
- [ ] Block `?mockAdmin=true` at CDN/reverse proxy layer (prevents UI bypass in production; RLS still blocks all data access)

---

## Rollback Plan

All SQL patches are additive (no drops, no destructive changes). If a frontend issue is found post-deploy:

1. Revert the affected JS/CSS files to the prior commit
2. Redeploy static files
3. No SQL rollback needed for Phase 30–32 (no SQL changes in Phase 30 or 32)
4. For Phase 31 SQL: `REVOKE ALL ON public.cms_notification_log FROM anon` is safe to leave in place even if rolling back frontend

---

## Done

All 32 phases complete. Build is production-ready.

| System | Status |
|--------|--------|
| Frontend (JS/CSS/HTML) | Production-ready |
| Supabase DB (RLS + tables) | Production-ready |
| Edge Functions | Production-ready (redeploy crm-reminder-sweep) |
| Admin CRM | Production-ready |
| Security hardening | Complete |
| Mobile responsiveness | Complete |
