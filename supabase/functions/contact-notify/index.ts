// contact-notify — Supabase Edge Function
// Sends a Resend email and writes a delivery log row to cms_notification_log.
//
// Required secrets (set with `supabase secrets set`):
//   RESEND_API_KEY               — Resend API key
//   CONTACT_NOTIFY_TO_EMAIL      — admin inbox to receive notifications
//   CONTACT_NOTIFY_FROM_EMAIL    — verified sender address in Resend
//
// Optional:
//   CONTACT_NOTIFY_WEBHOOK_SECRET — guards webhook endpoint (x-contact-notify-secret header)
//
// Built-in (automatically injected by Supabase, no manual setup needed):
//   SUPABASE_URL                 — project URL used for log writes
//   SUPABASE_ANON_KEY            — used to verify user JWT on test/retry calls
//   SUPABASE_SERVICE_ROLE_KEY    — used to write notification logs (bypasses RLS)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trunc(s: unknown, max: number): string {
  const str = String(s ?? '');
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Write a row to cms_notification_log using service-role client (bypasses RLS).
// Returns true if the insert succeeded, false otherwise.
// Never throws — logging must never prevent the email result from being returned.
async function insertLog(row: Record<string, unknown>): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.warn('[contact-notify] SUPABASE_SERVICE_ROLE_KEY not available — log skipped');
    return false;
  }
  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.from('cms_notification_log').insert([row]);
    if (error) {
      console.error('[contact-notify] Log insert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[contact-notify] Log insert exception:', String(err));
    return false;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const isTest  = body.test  === true;
  const isRetry = body.retry === true && !isTest;
  const webhookSecret = Deno.env.get('CONTACT_NOTIFY_WEBHOOK_SECRET');

  // ── Auth check ──────────────────────────────────────────────────────────────
  // If CONTACT_NOTIFY_WEBHOOK_SECRET is set:
  //   • Webhook calls        → must include matching x-contact-notify-secret header
  //   • Test / retry calls   → must have a valid Supabase user session (JWT)
  // If secret is NOT set → all POST requests accepted (fine for dev; set in production)

  if (webhookSecret) {
    if (isTest || isRetry) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return json({ error: 'Unauthorized: test/retry requires authenticated session' }, 401);
      }
      const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
      if (supabaseUrl && supabaseAnonKey) {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { error } = await client.auth.getUser();
        if (error) {
          return json({ error: 'Unauthorized: invalid session' }, 401);
        }
      }
    } else {
      const reqSecret = req.headers.get('x-contact-notify-secret');
      if (!reqSecret || reqSecret !== webhookSecret) {
        return json({ error: 'Unauthorized' }, 401);
      }
    }
  }

  // ── Webhook event filtering ─────────────────────────────────────────────────
  if (!isTest && !isRetry && typeof body.type === 'string') {
    if (body.type !== 'INSERT') {
      return json({ ignored: true, reason: 'not an INSERT event' }, 200);
    }
    if (body.table !== 'cms_contact_submissions') {
      return json({ ignored: true, reason: 'table not relevant' }, 200);
    }
  }

  // ── Validate record ─────────────────────────────────────────────────────────
  const record = body.record as Record<string, unknown> | null | undefined;
  if (!record || typeof record !== 'object') {
    return json({ error: 'Missing or invalid record' }, 400);
  }

  // ── Read secrets ────────────────────────────────────────────────────────────
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const toEmail   = Deno.env.get('CONTACT_NOTIFY_TO_EMAIL');
  const fromEmail = Deno.env.get('CONTACT_NOTIFY_FROM_EMAIL');

  if (!resendKey || !toEmail || !fromEmail) {
    return json(
      { error: 'Email not configured — set RESEND_API_KEY, CONTACT_NOTIFY_TO_EMAIL, CONTACT_NOTIFY_FROM_EMAIL' },
      500,
    );
  }

  // ── Sanitise lead fields ────────────────────────────────────────────────────
  const leadId      = typeof record.id === 'string' ? record.id : undefined;
  const name        = trunc(record.name,         200);
  const email       = trunc(record.email,        320);
  const company     = trunc(record.company,      200);
  const projectType = trunc(record.project_type, 100);
  const budget      = trunc(record.budget,       100);
  const message     = trunc(record.message,      2000);
  const pagePath    = trunc(record.page_path,    200);
  const createdAt   = record.created_at
    ? new Date(String(record.created_at)).toUTCString()
    : new Date().toUTCString();

  const replyTo = isEmail(email) ? email : undefined;

  // ── Determine event type ────────────────────────────────────────────────────
  const eventType = isTest ? 'test_notification' : isRetry ? 'retry_notification' : 'lead_notification';

  // ── Build email ─────────────────────────────────────────────────────────────
  const subject = isTest
    ? `[TEST] New GROWVA lead: ${name} — ${projectType || 'No project type'}`
    : `New GROWVA lead: ${name} — ${projectType || 'No project type'}`;

  const tdRow = (label: string, value: string) =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:600;width:110px;vertical-align:top;">${label}</td>
      <td style="padding:8px 0 8px 12px;border-bottom:1px solid #e5e7eb;">${value}</td>
    </tr>`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Lead</title></head>
<body style="font-family:system-ui,sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:24px;">
${isTest ? `<p style="background:#fef3c7;border:1px solid #f59e0b;padding:12px 16px;border-radius:6px;margin-bottom:20px;font-size:13px;"><strong>Test notification</strong> — no real lead was submitted.</p>` : ''}
${isRetry ? `<p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:6px;margin-bottom:20px;font-size:13px;"><strong>Retry notification</strong> — manually re-sent from the admin dashboard.</p>` : ''}
<h2 style="margin:0 0 20px;font-size:20px;color:#111827;">New Contact Form Lead</h2>
<table style="width:100%;border-collapse:collapse;font-size:14px;">
  ${tdRow('Name',  esc(name))}
  ${tdRow('Email', `<a href="mailto:${esc(email)}" style="color:#2563eb;">${esc(email)}</a>`)}
  ${company     ? tdRow('Company', esc(company))     : ''}
  ${projectType ? tdRow('Project', esc(projectType)) : ''}
  ${budget      ? tdRow('Budget',  esc(budget))      : ''}
  ${pagePath    ? tdRow('Page',    esc(pagePath))    : ''}
  <tr>
    <td style="padding:8px 0;font-weight:600;vertical-align:top;">Received</td>
    <td style="padding:8px 0 8px 12px;">${esc(createdAt)}</td>
  </tr>
</table>
<div style="margin-top:20px;">
  <p style="font-weight:600;margin:0 0 6px;font-size:14px;">Message</p>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px;white-space:pre-wrap;font-size:14px;line-height:1.6;">${esc(message)}</div>
</div>
<hr style="margin:28px 0;border:none;border-top:1px solid #e5e7eb;">
<p style="color:#9ca3af;font-size:11px;margin:0;">Sent by GROWVA CMS notification pipeline. Log into the admin dashboard to view and manage all leads.</p>
</body>
</html>`;

  const textBody = [
    isTest  ? '[TEST NOTIFICATION — no real lead was submitted]\n' : '',
    isRetry ? '[RETRY — manually re-sent from admin dashboard]\n'  : '',
    'New Contact Form Lead',
    '=====================',
    `Name:     ${name}`,
    `Email:    ${email}`,
    company     ? `Company:  ${company}`     : '',
    projectType ? `Project:  ${projectType}` : '',
    budget      ? `Budget:   ${budget}`      : '',
    pagePath    ? `Page:     ${pagePath}`    : '',
    `Received: ${createdAt}`,
    '',
    'Message:',
    message,
  ].filter(Boolean).join('\n');

  // ── Call Resend API ─────────────────────────────────────────────────────────
  const emailPayload: Record<string, unknown> = {
    from: fromEmail,
    to: [toEmail],
    subject,
    html: htmlBody,
    text: textBody,
  };
  if (replyTo) emailPayload.reply_to = replyTo;

  let resendStatus: number;
  let resendJson: Record<string, unknown> = {};
  let providerMessageId: string | undefined;

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
    // Parse response to capture provider message ID
    try {
      resendJson = await resendRes.json() as Record<string, unknown>;
      if (typeof resendJson.id === 'string') {
        providerMessageId = resendJson.id;
      }
    } catch {
      // Non-JSON response — ignore, status code is the authority
    }
  } catch (err) {
    // Network-level failure — log and return error
    const errMsg = trunc(String(err), 500);
    await insertLog({
      lead_id:         leadId ?? null,
      event_type:      eventType,
      status:          'failed',
      recipient_email: toEmail,
      sender_email:    fromEmail,
      subject:         trunc(subject, 500),
      error_message:   errMsg,
      metadata:        { reason: 'network_error' },
    });
    return json({ error: 'Failed to reach Resend API', logged: true }, 502);
  }

  // ── Handle Resend failure ───────────────────────────────────────────────────
  if (resendStatus < 200 || resendStatus >= 300) {
    console.error(`[contact-notify] Resend returned HTTP ${resendStatus}`);
    const errMsg = trunc(`Resend HTTP ${resendStatus}`, 500);
    await insertLog({
      lead_id:         leadId ?? null,
      event_type:      eventType,
      status:          'failed',
      recipient_email: toEmail,
      sender_email:    fromEmail,
      subject:         trunc(subject, 500),
      error_message:   errMsg,
      metadata:        { resend_status: resendStatus },
    });
    return json({ error: 'Email delivery failed', resend_status: resendStatus, logged: true }, 502);
  }

  // ── Log success ─────────────────────────────────────────────────────────────
  const logStatus = isTest ? 'test' : 'sent';
  const logged = await insertLog({
    lead_id:             leadId ?? null,
    event_type:          eventType,
    status:              logStatus,
    recipient_email:     toEmail,
    sender_email:        fromEmail,
    subject:             trunc(subject, 500),
    provider_message_id: providerMessageId ?? null,
    metadata:            { resend_status: resendStatus },
  });

  return json({ ok: true, test: isTest, retry: isRetry, logged });
});
