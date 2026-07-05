# Phase 30 — Production CRM Control Center Setup Guide

Adds a **Control Center** tab to the Admin Dashboard — a single-screen reliability view
aggregating CRM health, active issues, recent operations, and quick navigation actions.

---

## Architecture

No new SQL is required for Phase 30. All data is sourced from existing tables:

```
leadsData          — cms_contact_submissions (Phase 19)
notificationLogs   — cms_notification_log    (Phase 21)
leadTasks          — cms_lead_tasks          (Phase 28)
leadActivities     — cms_lead_activity       (Phase 28)
reminderRuns       — cms_crm_reminder_runs   (Phase 29)
```

Client-side aggregation only. No new DB queries, Edge Functions, or secrets needed.

---

## Prerequisites

Phase 30 requires the following prior phases to be deployed. Sections degrade gracefully
if earlier phases are not yet applied:

| Phase | Table / Feature | Degradation if missing |
|-------|----------------|------------------------|
| 19    | `cms_contact_submissions` | No leads data in Control Center |
| 21    | `cms_notification_log`    | Email health shows "No data" |
| 28    | `cms_lead_tasks`, `cms_lead_activity` | Task/activity ops not shown |
| 29    | `cms_crm_reminder_runs`   | Sweep health shows "Unavailable" |

---

## Step 1 — No SQL Required

Phase 30 is a frontend-only change. No SQL patch needs to be run.

---

## Step 2 — Deploy Updated Admin Files

After committing:

1. Deploy `admin/admin.js` — updated file, no separate step needed if auto-deployed.
2. Deploy `admin/admin.css` — updated file.

No Edge Function redeployment needed for Phase 30.

---

## Step 3 — Verify Control Center Tab

1. Log in to the admin dashboard (any role).
2. Open Dashboard → **Control Center** tab.
3. Click **↻ Refresh** to load data.
4. Confirm the System Health grid shows 5 cards: Lead Intake, Email Delivery, Reminder Sweeps, Task Queue, Pipeline.
5. Confirm Issues section shows "No active issues detected" when system is healthy.
6. Confirm Recent Operations list shows recent sweep runs and notification events.
7. Confirm quick-action buttons navigate to the correct tabs.

---

## Health Status Reference

| Status | Color | Meaning |
|--------|-------|---------|
| `healthy` | Green | No issues detected |
| `attention` | Amber | Minor issues, monitor |
| `critical` | Red | Requires immediate attention |
| `no-data` | Grey | No data loaded yet |
| `unavailable` | Grey | Phase SQL not yet applied |

---

## Issue Detection Logic

| Issue | Severity | Trigger |
|-------|----------|---------|
| Failed/bounced/complained notifications | warning / critical | ≥1 problem notification in log |
| Failed reminder sweep runs | critical | ≥1 run with `status = 'failed'` |
| Sweep runs with delivery errors | warning | ≥1 completed run with `total_failed > 0` |
| Overdue urgent/high tasks | critical | ≥1 open task past due date |
| Tasks with reminder delivery errors | warning | ≥1 task with `reminder_last_error IS NOT NULL` |
| Unassigned urgent/high leads | critical/warning | ≥1 active lead with high/urgent priority and no `assigned_to` |
| Leads stuck in New >7 days | warning | ≥1 active lead in `new` stage for >7 days |
| No sweep in 24h | info | Last sweep older than 24 hours (only if sweeps are available) |

---

## Access Control

| Role | Can view Control Center | Can run sweep |
|------|------------------------|---------------|
| Viewer | Yes | No |
| Editor | Yes | Yes |
| Owner  | Yes | Yes |

The **Run Reminder Sweep** button only appears for editor/owner roles.
RLS on underlying tables remains the authoritative security gate.

---

## No New Secrets Required

Phase 30 introduces no new secrets, Edge Functions, or external dependencies.
All data aggregation is done client-side from existing loaded state.
