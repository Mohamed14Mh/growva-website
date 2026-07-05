// crm-reminder-sweep - Supabase Edge Function
// Sends a controlled digest email for overdue and due-today CRM tasks.
//
// Manual mode:
//   POST with authenticated Supabase user JWT. Caller must be owner/editor.
//
// Scheduled mode:
//   POST with x-crm-reminder-secret matching CRM_REMINDER_SWEEP_SECRET.
//
// Required secrets:
//   RESEND_API_KEY
//   CONTACT_NOTIFY_TO_EMAIL
//   CONTACT_NOTIFY_FROM_EMAIL
//   CRM_REMINDER_SWEEP_SECRET
//
// Built-in:
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonMap = Record<string, unknown>;
type AdminClient = ReturnType<typeof createClient>;

type SweepTask = {
  id: string;
  lead_id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  assigned_to: string | null;
  due_at: string | null;
  reminder_enabled?: boolean | null;
  reminder_sent_at?: string | null;
  reminder_count?: number | null;
  last_reminder_error?: string | null;
};

type SweepLead = {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  project_type: string | null;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function asRecord(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {};
}

function text(value: unknown, max = 500): string {
  const str = String(value ?? '').trim();
  return str.length > max ? str.slice(0, max) : str;
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfTodayIso(now = new Date()): string {
  const end = startOfLocalDay(now);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end.toISOString();
}

function reminderType(task: SweepTask, now = new Date()): 'overdue' | 'today' {
  const due = task.due_at ? new Date(task.due_at) : now;
  return startOfLocalDay(due).getTime() < startOfLocalDay(now).getTime() ? 'overdue' : 'today';
}

function isReminderRecent(task: SweepTask, now = new Date()): boolean {
  if (!task.reminder_sent_at) return false;
  const sent = new Date(task.reminder_sent_at);
  if (Number.isNaN(sent.getTime())) return false;
  return now.getTime() - sent.getTime() < 24 * 60 * 60 * 1000;
}

function leadLabel(lead: SweepLead | undefined, task: SweepTask): string {
  return text(lead?.name || lead?.email || task.lead_id || 'Lead', 180);
}

function dueLabel(task: SweepTask): string {
  if (!task.due_at) return 'No due date';
  const due = new Date(task.due_at);
  return Number.isNaN(due.getTime()) ? 'Invalid due date' : due.toUTCString();
}

async function createRun(admin: AdminClient, row: JsonMap): Promise<string | null> {
  const { data, error } = await admin
    .from('cms_crm_reminder_runs')
    .insert([row])
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[crm-reminder-sweep] run insert failed:', error.message);
    return null;
  }
  return typeof data?.id === 'string' ? data.id : null;
}

async function updateRun(admin: AdminClient, runId: string | null, row: JsonMap): Promise<void> {
  if (!runId) return;
  const { error } = await admin
    .from('cms_crm_reminder_runs')
    .update(row)
    .eq('id', runId);
  if (error) console.error('[crm-reminder-sweep] run update failed:', error.message);
}

async function insertRunItems(admin: AdminClient, items: JsonMap[]): Promise<boolean> {
  if (!items.length) return true;
  const { error } = await admin.from('cms_crm_reminder_run_items').insert(items);
  if (error) {
    console.error('[crm-reminder-sweep] run item insert failed:', error.message);
    return false;
  }
  return true;
}

async function insertActivities(admin: AdminClient, rows: JsonMap[]): Promise<boolean> {
  if (!rows.length) return true;
  const { error } = await admin.from('cms_lead_activity').insert(rows);
  if (error) {
    console.warn('[crm-reminder-sweep] activity insert failed:', error.message);
    return false;
  }
  return true;
}

async function insertNotificationLog(admin: AdminClient, row: JsonMap): Promise<boolean> {
  const { error } = await admin.from('cms_notification_log').insert([row]);
  if (error) {
    console.warn('[crm-reminder-sweep] notification log insert failed:', error.message);
    return false;
  }
  return true;
}

async function authenticateManualCaller(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
  admin: AdminClient,
): Promise<{ ok: true; actor_id: string; actor_email: string | null } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.id) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const { data: profile, error: profileError } = await admin
    .from('admin_profiles')
    .select('id,email,role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profileError || !profile || !['owner', 'editor'].includes(String(profile.role))) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return {
    ok: true,
    actor_id: userData.user.id,
    actor_email: text(profile.email || userData.user.email || '', 320) || null,
  };
}

function renderTaskRows(tasks: SweepTask[], leadsById: Map<string, SweepLead>): string {
  return tasks.map(task => {
    const lead = leadsById.get(task.lead_id);
    const leadLine = [
      esc(leadLabel(lead, task)),
      lead?.email ? esc(lead.email) : '',
      lead?.company ? esc(lead.company) : '',
    ].filter(Boolean).join(' / ');
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;"><strong>${esc(task.title || 'Untitled task')}</strong><br><span style="color:#6b7280;font-size:12px;">${leadLine}</span></td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;">${esc(task.priority || 'normal')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;">${esc(dueLabel(task))}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;">${esc(task.assigned_to || 'Unassigned')}</td>
    </tr>`;
  }).join('');
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: JsonMap = {};
  try {
    const parsed = await req.json();
    body = asRecord(parsed);
  } catch {
    body = {};
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const resendKey = Deno.env.get('RESEND_API_KEY') || '';
  const toEmail = Deno.env.get('CONTACT_NOTIFY_TO_EMAIL') || '';
  const fromEmail = Deno.env.get('CONTACT_NOTIFY_FROM_EMAIL') || '';
  const sweepSecret = Deno.env.get('CRM_REMINDER_SWEEP_SECRET') || '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Supabase credentials not configured' }, 500);
  }
  if (!resendKey || !toEmail || !fromEmail) {
    return json({ error: 'Email not configured' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const scheduledSecret = req.headers.get('x-crm-reminder-secret') || '';
  const isScheduled = Boolean(scheduledSecret);
  const isTest = body.test === true;
  let runType: 'manual' | 'scheduled' | 'test' = isTest ? 'test' : isScheduled ? 'scheduled' : 'manual';
  let actorId: string | null = null;
  let actorEmail: string | null = null;

  if (isScheduled) {
    if (!sweepSecret || !constantTimeEqual(scheduledSecret, sweepSecret)) {
      return json({ error: 'Unauthorized' }, 401);
    }
  } else {
    const auth = await authenticateManualCaller(req, supabaseUrl, anonKey, admin);
    if (!auth.ok) return json({ error: auth.error }, auth.status);
    actorId = auth.actor_id;
    actorEmail = auth.actor_email;
  }

  const now = new Date();
  const runId = await createRun(admin, {
    run_type: runType,
    status: 'started',
    actor_id: actorId,
    actor_email: actorEmail,
    metadata: { source: 'crm-reminder-sweep', phase: 29, manual: runType === 'manual' },
  });
  if (!runId) {
    return json({ ok: false, error: 'Reminder run logging unavailable. Run the Phase 29 SQL patch.' }, 500);
  }

  try {
    const { data: tasksData, error: tasksError } = await admin
      .from('cms_lead_tasks')
      .select('id,lead_id,title,description,status,priority,assigned_to,due_at,reminder_enabled,reminder_sent_at,reminder_count,last_reminder_error')
      .eq('status', 'open')
      .eq('reminder_enabled', true)
      .not('due_at', 'is', null)
      .lte('due_at', endOfTodayIso(now))
      .order('due_at', { ascending: true })
      .limit(200);

    if (tasksError) throw tasksError;

    const candidates = Array.isArray(tasksData) ? tasksData as SweepTask[] : [];
    const sendable = candidates.filter(task => !isReminderRecent(task, now));
    const skipped = candidates.filter(task => isReminderRecent(task, now));
    const leadIds = Array.from(new Set(candidates.map(task => task.lead_id).filter(Boolean)));
    const leadsById = new Map<string, SweepLead>();

    if (leadIds.length) {
      const { data: leadsData, error: leadsError } = await admin
        .from('cms_contact_submissions')
        .select('id,name,email,company,project_type')
        .in('id', leadIds);
      if (!leadsError && Array.isArray(leadsData)) {
        (leadsData as SweepLead[]).forEach(lead => leadsById.set(lead.id, lead));
      }
    }

    const skippedItems = skipped.map(task => ({
      run_id: runId,
      task_id: task.id,
      lead_id: task.lead_id,
      status: 'skipped',
      reason: 'Reminder sent within the last 24 hours.',
      reminder_type: reminderType(task, now),
    }));
    await insertRunItems(admin, skippedItems);

    if (!sendable.length) {
      await updateRun(admin, runId, {
        status: 'completed',
        finished_at: new Date().toISOString(),
        total_candidates: candidates.length,
        total_sent: 0,
        total_skipped: skipped.length,
        total_failed: 0,
        metadata: { source: 'crm-reminder-sweep', phase: 29, no_email_sent: true },
      });
      return json({ ok: true, run_id: runId, total_candidates: candidates.length, total_sent: 0, total_skipped: skipped.length, total_failed: 0 });
    }

    const overdue = sendable.filter(task => reminderType(task, now) === 'overdue');
    const today = sendable.filter(task => reminderType(task, now) === 'today');
    const subject = `GROWVA CRM reminders: ${overdue.length} overdue, ${today.length} due today`;
    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>CRM Reminder Digest</title></head>
<body style="font-family:system-ui,sans-serif;color:#111827;max-width:760px;margin:0 auto;padding:24px;">
  <p style="background:#eef2ff;border:1px solid #c7d2fe;padding:12px 16px;border-radius:6px;margin:0 0 20px;font-size:13px;"><strong>CRM reminder digest</strong> generated by GROWVA admin automation.</p>
  <h2 style="margin:0 0 16px;font-size:22px;color:#111827;">${esc(subject)}</h2>
  ${overdue.length ? `<h3 style="margin:22px 0 8px;font-size:16px;">Overdue</h3><table style="width:100%;border-collapse:collapse;font-size:13px;">${renderTaskRows(overdue, leadsById)}</table>` : ''}
  ${today.length ? `<h3 style="margin:22px 0 8px;font-size:16px;">Due today</h3><table style="width:100%;border-collapse:collapse;font-size:13px;">${renderTaskRows(today, leadsById)}</table>` : ''}
  <p style="color:#9ca3af;font-size:11px;margin:24px 0 0;">Duplicate prevention: tasks reminded in the last 24 hours are skipped.</p>
</body>
</html>`;
    const textBody = [
      subject,
      '='.repeat(subject.length),
      '',
      overdue.length ? 'Overdue:' : '',
      ...overdue.map(task => `- ${text(task.title || 'Untitled task', 180)} | ${leadLabel(leadsById.get(task.lead_id), task)} | ${dueLabel(task)} | ${text(task.assigned_to || 'Unassigned', 120)}`),
      '',
      today.length ? 'Due today:' : '',
      ...today.map(task => `- ${text(task.title || 'Untitled task', 180)} | ${leadLabel(leadsById.get(task.lead_id), task)} | ${dueLabel(task)} | ${text(task.assigned_to || 'Unassigned', 120)}`),
    ].filter(line => line !== '').join('\n');

    let providerMessageId: string | null = null;
    let resendStatus = 0;
    let resendError: string | null = null;

    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject,
          html: htmlBody,
          text: textBody,
        }),
      });
      resendStatus = resendRes.status;
      try {
        const resendJson = asRecord(await resendRes.json());
        if (typeof resendJson.id === 'string') providerMessageId = resendJson.id;
      } catch {
        // ignore non-json response
      }
      if (resendStatus < 200 || resendStatus >= 300) {
        resendError = text(`Resend HTTP ${resendStatus}`, 500);
      }
    } catch (error) {
      resendError = text(String(error), 500);
    }

    if (resendError) {
      const failedItems = sendable.map(task => ({
        run_id: runId,
        task_id: task.id,
        lead_id: task.lead_id,
        status: 'failed',
        reason: resendError,
        reminder_type: reminderType(task, now),
      }));
      await insertRunItems(admin, failedItems);
      await Promise.all(sendable.map(task => admin
        .from('cms_lead_tasks')
        .update({ last_reminder_error: resendError })
        .eq('id', task.id)));
      await insertActivities(admin, sendable.map(task => ({
        lead_id: task.lead_id,
        actor_id: actorId,
        actor_email: actorEmail,
        activity_type: 'task_scheduled_reminder_failed',
        field_name: 'scheduled_reminder',
        old_value: '',
        new_value: text(task.title || 'Untitled task', 240),
        note: resendError,
        metadata: { source: 'crm-reminder-sweep', phase: 29, run_id: runId, task_id: task.id },
      })));
      await insertNotificationLog(admin, {
        event_type: 'crm_reminder_digest',
        status: 'failed',
        recipient_email: toEmail,
        sender_email: fromEmail,
        subject: text(subject, 500),
        error_message: resendError,
        metadata: { source: 'crm-reminder-sweep', phase: 29, run_id: runId, resend_status: resendStatus || null },
      });
      await updateRun(admin, runId, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        total_candidates: candidates.length,
        total_sent: 0,
        total_skipped: skipped.length,
        total_failed: sendable.length,
        error_message: resendError,
        metadata: { source: 'crm-reminder-sweep', phase: 29, resend_status: resendStatus || null },
      });
      return json({ ok: false, run_id: runId, total_candidates: candidates.length, total_sent: 0, total_skipped: skipped.length, total_failed: sendable.length, error: 'Digest email failed' }, 502);
    }

    const sentAt = new Date().toISOString();
    await Promise.all(sendable.map(task => admin
      .from('cms_lead_tasks')
      .update({
        reminder_sent_at: sentAt,
        reminder_count: Number(task.reminder_count || 0) + 1,
        last_reminder_error: null,
      })
      .eq('id', task.id)));
    await insertRunItems(admin, sendable.map(task => ({
      run_id: runId,
      task_id: task.id,
      lead_id: task.lead_id,
      status: 'sent',
      reason: providerMessageId || 'Digest sent',
      reminder_type: reminderType(task, now),
    })));
    await insertActivities(admin, sendable.map(task => ({
      lead_id: task.lead_id,
      actor_id: actorId,
      actor_email: actorEmail,
      activity_type: 'task_scheduled_reminder_sent',
      field_name: 'scheduled_reminder',
      old_value: '',
      new_value: text(task.title || 'Untitled task', 240),
      note: providerMessageId || null,
      metadata: { source: 'crm-reminder-sweep', phase: 29, run_id: runId, task_id: task.id, provider_message_id: providerMessageId },
    })));
    await insertNotificationLog(admin, {
      event_type: 'crm_reminder_digest',
      status: 'sent',
      recipient_email: toEmail,
      sender_email: fromEmail,
      subject: text(subject, 500),
      provider_message_id: providerMessageId,
      metadata: { source: 'crm-reminder-sweep', phase: 29, run_id: runId, resend_status: resendStatus, total_sent: sendable.length },
    });

    await updateRun(admin, runId, {
      status: 'completed',
      finished_at: new Date().toISOString(),
      total_candidates: candidates.length,
      total_sent: sendable.length,
      total_skipped: skipped.length,
      total_failed: 0,
      metadata: { source: 'crm-reminder-sweep', phase: 29, provider_message_id: providerMessageId, resend_status: resendStatus },
    });

    return json({ ok: true, run_id: runId, total_candidates: candidates.length, total_sent: sendable.length, total_skipped: skipped.length, total_failed: 0 });
  } catch (error) {
    const message = text(error instanceof Error ? error.message : String(error), 1000);
    await updateRun(admin, runId, {
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_message: message,
      metadata: { source: 'crm-reminder-sweep', phase: 29 },
    });
    return json({ ok: false, run_id: runId, total_candidates: 0, total_sent: 0, total_skipped: 0, total_failed: 0, error: 'Reminder sweep failed' }, 500);
  }
});
