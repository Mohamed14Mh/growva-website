// task-reminder-notify - Supabase Edge Function
// Manually sends a CRM task reminder email from the admin dashboard.
//
// Required secrets:
//   RESEND_API_KEY               - Resend API key
//   CONTACT_NOTIFY_TO_EMAIL      - admin inbox to receive reminders
//   CONTACT_NOTIFY_FROM_EMAIL    - verified sender address in Resend
//
// Built-in:
//   SUPABASE_URL                 - project URL
//   SUPABASE_ANON_KEY            - verifies caller JWT
//   SUPABASE_SERVICE_ROLE_KEY    - server-side task/activity/log updates

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonMap = Record<string, unknown>;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function text(value: unknown, max = 500): string {
  const str = String(value ?? '').trim();
  return str.length > max ? str.slice(0, max) : str;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function asRecord(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {};
}

async function insertActivity(admin: ReturnType<typeof createClient>, row: JsonMap): Promise<boolean> {
  try {
    const { error } = await admin.from('cms_lead_activity').insert([row]);
    if (error) {
      console.warn('[task-reminder-notify] activity insert failed:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[task-reminder-notify] activity insert exception:', String(error));
    return false;
  }
}

async function insertNotificationLog(admin: ReturnType<typeof createClient>, row: JsonMap): Promise<boolean> {
  try {
    const { error } = await admin.from('cms_notification_log').insert([row]);
    if (error) {
      console.warn('[task-reminder-notify] notification log insert failed:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[task-reminder-notify] notification log insert exception:', String(error));
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: JsonMap;
  try {
    const parsed = await req.json();
    body = asRecord(parsed);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const taskId = body.task_id;
  if (!isUuid(taskId)) {
    return json({ error: 'Invalid task_id' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const resendKey = Deno.env.get('RESEND_API_KEY') || '';
  const toEmail = Deno.env.get('CONTACT_NOTIFY_TO_EMAIL') || '';
  const fromEmail = Deno.env.get('CONTACT_NOTIFY_FROM_EMAIL') || '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Supabase credentials not configured' }, 500);
  }
  if (!resendKey || !toEmail || !fromEmail) {
    return json({ error: 'Email not configured' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.id) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await admin
    .from('admin_profiles')
    .select('id,email,role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile || !['owner', 'editor'].includes(String(profile.role))) {
    return json({ error: 'Forbidden' }, 403);
  }

  const { data: task, error: taskError } = await admin
    .from('cms_lead_tasks')
    .select('id,lead_id,title,description,status,priority,assigned_to,due_at,reminder_enabled,reminder_sent_at,reminder_count,last_reminder_error,automation_source,metadata,created_at')
    .eq('id', taskId)
    .maybeSingle();

  if (taskError) {
    return json({ error: 'Task lookup failed' }, 500);
  }
  if (!task?.id || !task.lead_id) {
    return json({ error: 'Task not found' }, 404);
  }
  if (task.status !== 'open') {
    return json({ error: 'Only open tasks can receive reminders' }, 400);
  }
  if (task.reminder_enabled === false) {
    return json({ error: 'Reminder disabled for this task' }, 400);
  }

  const { data: lead, error: leadError } = await admin
    .from('cms_contact_submissions')
    .select('id,name,email,company,project_type,page_path,source,created_at')
    .eq('id', task.lead_id)
    .maybeSingle();

  if (leadError || !lead?.id) {
    return json({ error: 'Lead lookup failed' }, 500);
  }

  const leadName = text(lead.name || lead.email || 'Lead', 180);
  const leadEmail = text(lead.email, 320);
  const taskTitle = text(task.title || 'CRM task', 240);
  const due = task.due_at ? new Date(String(task.due_at)).toUTCString() : 'No due date';
  const subject = `CRM task reminder: ${taskTitle}`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>CRM Task Reminder</title></head>
<body style="font-family:system-ui,sans-serif;color:#111827;max-width:620px;margin:0 auto;padding:24px;">
  <p style="background:#eef2ff;border:1px solid #c7d2fe;padding:12px 16px;border-radius:6px;margin:0 0 20px;font-size:13px;"><strong>Manual CRM reminder</strong> sent from the GROWVA admin dashboard.</p>
  <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">${esc(taskTitle)}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:600;width:120px;">Lead</td><td style="padding:8px 0 8px 12px;border-bottom:1px solid #e5e7eb;">${esc(leadName)}</td></tr>
    ${leadEmail ? `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:600;">Email</td><td style="padding:8px 0 8px 12px;border-bottom:1px solid #e5e7eb;">${esc(leadEmail)}</td></tr>` : ''}
    ${lead.company ? `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:600;">Company</td><td style="padding:8px 0 8px 12px;border-bottom:1px solid #e5e7eb;">${esc(lead.company)}</td></tr>` : ''}
    <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:600;">Due</td><td style="padding:8px 0 8px 12px;border-bottom:1px solid #e5e7eb;">${esc(due)}</td></tr>
    ${task.assigned_to ? `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:600;">Owner</td><td style="padding:8px 0 8px 12px;border-bottom:1px solid #e5e7eb;">${esc(task.assigned_to)}</td></tr>` : ''}
  </table>
  ${task.description ? `<div style="margin-top:18px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px;white-space:pre-wrap;font-size:14px;line-height:1.6;">${esc(task.description)}</div>` : ''}
  <p style="color:#9ca3af;font-size:11px;margin:24px 0 0;">Requested by ${esc(profile.email || userData.user.email || 'admin')}.</p>
</body>
</html>`;

  const textBody = [
    'Manual CRM task reminder',
    '========================',
    `Task: ${taskTitle}`,
    `Lead: ${leadName}`,
    leadEmail ? `Email: ${leadEmail}` : '',
    lead.company ? `Company: ${text(lead.company, 180)}` : '',
    `Due: ${due}`,
    task.assigned_to ? `Owner: ${text(task.assigned_to, 160)}` : '',
    '',
    task.description ? `Description:\n${text(task.description, 2000)}` : '',
  ].filter(Boolean).join('\n');

  const emailPayload: JsonMap = {
    from: fromEmail,
    to: [toEmail],
    subject,
    html: htmlBody,
    text: textBody,
  };
  if (isEmail(leadEmail)) emailPayload.reply_to = leadEmail;

  let providerMessageId: string | null = null;
  let resendStatus = 0;
  let errorMessage: string | null = null;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });
    resendStatus = resendRes.status;
    let resendJson: JsonMap = {};
    try {
      resendJson = asRecord(await resendRes.json());
      if (typeof resendJson.id === 'string') providerMessageId = resendJson.id;
    } catch {
      resendJson = {};
    }
    if (resendStatus < 200 || resendStatus >= 300) {
      errorMessage = text(`Resend HTTP ${resendStatus}`, 500);
    }
  } catch (error) {
    errorMessage = text(String(error), 500);
  }

  const now = new Date().toISOString();
  const previousMetadata = asRecord(task.metadata);
  const reminderMetadata = {
    ...previousMetadata,
    last_manual_reminder: {
      requested_at: now,
      requested_by: userData.user.id,
      requested_by_email: profile.email || userData.user.email || null,
      provider_message_id: providerMessageId,
      resend_status: resendStatus || null,
      ok: !errorMessage,
    },
  };

  if (errorMessage) {
    await admin
      .from('cms_lead_tasks')
      .update({
        last_reminder_error: errorMessage,
        metadata: reminderMetadata,
        updated_by: userData.user.id,
        updated_by_email: profile.email || userData.user.email || null,
      })
      .eq('id', task.id);

    const logged = await insertActivity(admin, {
      lead_id: task.lead_id,
      actor_id: userData.user.id,
      actor_email: profile.email || userData.user.email || null,
      activity_type: 'task_reminder_failed',
      field_name: 'task_reminder',
      old_value: '',
      new_value: taskTitle,
      note: errorMessage,
      metadata: { source: 'task-reminder-notify', phase: 28, task_id: task.id },
    });

    await insertNotificationLog(admin, {
      lead_id: task.lead_id,
      event_type: 'task_reminder',
      status: 'failed',
      recipient_email: toEmail,
      sender_email: fromEmail,
      subject: text(subject, 500),
      error_message: errorMessage,
      metadata: { source: 'task-reminder-notify', phase: 28, task_id: task.id, resend_status: resendStatus || null },
    });

    return json({ ok: false, sent: false, logged, error: 'Reminder email failed' }, 502);
  }

  await admin
    .from('cms_lead_tasks')
    .update({
      reminder_sent_at: now,
      reminder_count: Number(task.reminder_count || 0) + 1,
      last_reminder_error: null,
      metadata: reminderMetadata,
      updated_by: userData.user.id,
      updated_by_email: profile.email || userData.user.email || null,
    })
    .eq('id', task.id);

  const logged = await insertActivity(admin, {
    lead_id: task.lead_id,
    actor_id: userData.user.id,
    actor_email: profile.email || userData.user.email || null,
    activity_type: 'task_reminder_sent',
    field_name: 'task_reminder',
    old_value: '',
    new_value: taskTitle,
    note: providerMessageId || null,
    metadata: { source: 'task-reminder-notify', phase: 28, task_id: task.id, provider_message_id: providerMessageId },
  });

  const notificationLogged = await insertNotificationLog(admin, {
    lead_id: task.lead_id,
    event_type: 'task_reminder',
    status: 'sent',
    recipient_email: toEmail,
    sender_email: fromEmail,
    subject: text(subject, 500),
    provider_message_id: providerMessageId,
    metadata: { source: 'task-reminder-notify', phase: 28, task_id: task.id, resend_status: resendStatus },
  });

  return json({ ok: true, sent: true, logged, notification_logged: notificationLogged });
});
