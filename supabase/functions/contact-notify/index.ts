// contact-notify — Supabase Edge Function
// Sends an email via Resend when a new cms_contact_submissions row is inserted.
// Triggered by a Supabase Database Webhook (INSERT) or owner admin test call.
//
// Required secrets (set with `supabase secrets set`):
//   RESEND_API_KEY               — Resend API key
//   CONTACT_NOTIFY_TO_EMAIL      — admin inbox to receive notifications
//   CONTACT_NOTIFY_FROM_EMAIL    — verified sender address in Resend
//
// Optional:
//   CONTACT_NOTIFY_WEBHOOK_SECRET — shared secret validated via x-contact-notify-secret header

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

  const isTest = body.test === true;
  const webhookSecret = Deno.env.get('CONTACT_NOTIFY_WEBHOOK_SECRET');

  // ── Auth check ──────────────────────────────────────────────────────────────
  // If CONTACT_NOTIFY_WEBHOOK_SECRET is set:
  //   • Webhook calls  → must include matching x-contact-notify-secret header
  //   • Test calls     → must have a valid Supabase user session (Authorization: Bearer <jwt>)
  // If secret is NOT set → all POST requests accepted (OK for local dev; set in production)

  if (webhookSecret) {
    if (isTest) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return json({ error: 'Unauthorized: test requires authenticated session' }, 401);
      }
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
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
  // Supabase DB webhooks include { type, table, record, ... }
  if (!isTest && typeof body.type === 'string') {
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
  const resendKey  = Deno.env.get('RESEND_API_KEY');
  const toEmail    = Deno.env.get('CONTACT_NOTIFY_TO_EMAIL');
  const fromEmail  = Deno.env.get('CONTACT_NOTIFY_FROM_EMAIL');

  if (!resendKey || !toEmail || !fromEmail) {
    return json(
      { error: 'Email notification not configured — set RESEND_API_KEY, CONTACT_NOTIFY_TO_EMAIL, CONTACT_NOTIFY_FROM_EMAIL' },
      500,
    );
  }

  // ── Sanitise lead fields ────────────────────────────────────────────────────
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

  // Only use lead email as reply-to if it passes format check
  const replyTo = isEmail(email) ? email : undefined;

  // ── Build email ─────────────────────────────────────────────────────────────
  const subject = isTest
    ? `[TEST] New GROWVA lead: ${name} — ${projectType || 'No project type'}`
    : `New GROWVA lead: ${name} — ${projectType || 'No project type'}`;

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:600;width:110px;vertical-align:top;">${label}</td>
      <td style="padding:8px 0 8px 12px;border-bottom:1px solid #e5e7eb;">${value}</td>
    </tr>`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Lead</title></head>
<body style="font-family:system-ui,sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:24px;">
${isTest ? `<p style="background:#fef3c7;border:1px solid #f59e0b;padding:12px 16px;border-radius:6px;margin-bottom:20px;font-size:13px;"><strong>Test notification</strong> — no real lead was submitted.</p>` : ''}
<h2 style="margin:0 0 20px;font-size:20px;color:#111827;">New Contact Form Lead</h2>
<table style="width:100%;border-collapse:collapse;font-size:14px;">
  ${row('Name',     esc(name))}
  ${row('Email',    `<a href="mailto:${esc(email)}" style="color:#2563eb;">${esc(email)}</a>`)}
  ${company     ? row('Company',  esc(company))     : ''}
  ${projectType ? row('Project',  esc(projectType)) : ''}
  ${budget      ? row('Budget',   esc(budget))      : ''}
  ${pagePath    ? row('Page',     esc(pagePath))    : ''}
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

  const textLines = [
    isTest ? '[TEST NOTIFICATION — no real lead was submitted]\n' : '',
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
  ].filter(Boolean);
  const textBody = textLines.join('\n');

  // ── Call Resend API ─────────────────────────────────────────────────────────
  const payload: Record<string, unknown> = {
    from: fromEmail,
    to: [toEmail],
    subject,
    html: htmlBody,
    text: textBody,
  };
  if (replyTo) payload.reply_to = replyTo;

  let resendStatus: number;
  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    resendStatus = resendRes.status;
  } catch (err) {
    return json({ error: 'Failed to reach Resend API', detail: String(err) }, 502);
  }

  if (resendStatus < 200 || resendStatus >= 300) {
    console.error(`[contact-notify] Resend returned HTTP ${resendStatus}`);
    return json({ error: 'Email delivery failed', resend_status: resendStatus }, 502);
  }

  return json({ ok: true, test: isTest });
});
