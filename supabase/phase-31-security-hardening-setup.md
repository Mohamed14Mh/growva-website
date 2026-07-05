# Phase 31 — Security Hardening Setup Guide

Final production security hardening across SQL, Edge Functions, and configuration.

---

## Step 1 — Run SQL Patch

In the Supabase SQL Editor, run:

```
supabase/phase-31-security-hardening.sql
```

This adds an explicit `REVOKE ALL ON public.cms_notification_log FROM anon` for defense-in-depth.

RLS on `cms_notification_log` already blocked all anon access (no anon policy = deny with RLS enabled). This REVOKE makes the privilege restriction explicit at the table-grant level, consistent with other CRM tables (Phase 26, 27, 29).

**Safe to run on a live production database.** Idempotent. Does not alter any RLS policy or table structure.

Verify:
```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'cms_notification_log'
ORDER BY grantee, privilege_type;
-- anon should NOT appear in results
```

---

## Step 2 — Redeploy crm-reminder-sweep Edge Function

A one-line HTML injection fix was applied to `renderTaskRows()` in `crm-reminder-sweep/index.ts`.

Previously, `leadLabel()` output was inserted into the HTML email body without HTML escaping. An attacker controlling a lead's `name` field via the contact form could inject HTML into the CRM reminder digest email.

Redeploy:
```bash
supabase functions deploy crm-reminder-sweep
```

No other Edge Functions changed.

---

## Step 3 — Review Production Config Warnings

### 3a. Set CONTACT_NOTIFY_WEBHOOK_SECRET (Strongly Recommended)

If not already set, configure the webhook guard:

```bash
supabase secrets set CONTACT_NOTIFY_WEBHOOK_SECRET=<strong-random-value>
```

Without this, any POST to the `contact-notify` Edge Function URL (without `test=true`) triggers email delivery. Setting this secret requires Supabase Database Webhooks to include the matching `x-contact-notify-secret` header.

Generate a secure value:
```bash
openssl rand -hex 32
```

### 3b. Mock Admin Mode Warning

`admin/admin.js` includes a development mock admin mode (`?mockAdmin=true`). This bypasses the client-side authentication UI but does NOT bypass Supabase RLS — all data operations fail without a real JWT.

**Recommended production action:** Block `?mockAdmin=true` at the CDN/web server layer, or accept as a development-only risk since RLS prevents any data access.

---

## Step 4 — Verify Final Security State

Run these verification queries in the Supabase SQL Editor:

```sql
-- 1. All CRM tables have RLS enabled
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
-- All rows should have rowsecurity = true

-- 2. No anon policy on notification log
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'cms_notification_log'
ORDER BY policyname;
-- Should show: cms_notification_log_admin_select (authenticated), cms_notification_log_owner_delete (authenticated)
-- Should NOT show any policy for anon

-- 3. No anon grant on notification log
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'cms_notification_log'
ORDER BY grantee;
-- anon should not appear

-- 4. Confirm cms_contact_submissions anon INSERT is preserved
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'cms_contact_submissions'
ORDER BY policyname;
-- Should show anon INSERT policy (intentional: allows contact form submissions)
```

---

## Security Summary

| Area | Status |
|------|--------|
| Secrets in frontend | None — PASS |
| Frontend XSS | All user content through `escapeHtml()` — PASS |
| Edge Function HTML injection | Fixed in crm-reminder-sweep — PASS |
| RLS correctness | All policies verified — PASS |
| Anon access to admin tables | Blocked by RLS + REVOKE — PASS |
| Service-role key in frontend | None — PASS |
| Admin auth stale token handling | Implemented — PASS |
| Viewer mutation prevention | Enforced at RLS + code layer — PASS |
